"use client";

import { useState, useEffect, useCallback } from "react";
import type { CatalogCategory } from "@/app/api/quote/catalog/route";
import type { ConditionPrice } from "@/app/api/quote/price/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "category"
  | "brand"
  | "model"
  | "storage"
  | "carrier"
  | "condition"
  | "quote"
  | "contact"
  | "submitted";

interface CartItem {
  variantId: string;
  conditionId: string;
  deviceLabel: string;   // "iPhone 15 Pro · 256GB · Unlocked"
  conditionLabel: string;
  grade: string;
  buyPrice: number;
}

interface Contact {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  payoutMethod: string;
  payoutAddress: string;
  notes: string;
}

interface NapData {
  businessName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
}

interface OrderResultItem {
  orderNumber: string;
  quotedPrice: number;
  deviceName: string;
  storageGb: number;
  carrier: string;
  conditionLabel: string;
}

interface OrderResult {
  orders: OrderResultItem[];
  totalPrice: number;
  labelUrl: string | null;
  trackingNumber: string | null;
  carrierName: string | null;
}

interface Props {
  tenantId: string;
  tenantName: string;
  catalog: CatalogCategory[];
  nap: NapData | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const CARRIER_LABELS: Record<string, string> = {
  UNLOCKED: "Unlocked",
  ATT: "AT&T",
  TMOBILE: "T-Mobile",
  VERIZON: "Verizon",
  SPRINT: "Sprint",
  OTHER: "Other",
};

const GRADE_COLORS: Record<string, string> = {
  A: "border-green-400 bg-green-50",
  B: "border-blue-400 bg-blue-50",
  C: "border-yellow-400 bg-yellow-50",
  D: "border-red-400 bg-red-50",
};

const GRADE_BADGE: Record<string, string> = {
  A: "bg-green-100 text-green-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-yellow-100 text-yellow-800",
  D: "bg-red-100 text-red-800",
};

const PAYOUT_METHODS = [
  { value: "PAYPAL", label: "PayPal", placeholder: "your@paypal.com" },
  { value: "ZELLE", label: "Zelle", placeholder: "Phone or email" },
  { value: "VENMO", label: "Venmo", placeholder: "@username" },
  { value: "CHECK", label: "Check", placeholder: "Mailing address" },
  { value: "ACH", label: "Bank Transfer", placeholder: "Routing + account number" },
];

const STEP_ORDER: Step[] = ["category", "brand", "model", "storage", "carrier", "condition", "quote", "contact", "submitted"];

function stepProgress(step: Step): number {
  return STEP_ORDER.indexOf(step);
}

// ─── Wizard Component ─────────────────────────────────────────────────────────

export function QuoteWizard({ tenantId, tenantName, catalog, nap }: Props) {
  const [step, setStep] = useState<Step>("category");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [storageGb, setStorageGb] = useState<number | null>(null);
  const [carrier, setCarrier] = useState<string | null>(null);
  const [conditionPrices, setConditionPrices] = useState<ConditionPrice[] | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<ConditionPrice | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [contact, setContact] = useState<Contact>({
    name: "", email: "", phone: "",
    street: "", city: "", state: "", zip: "",
    payoutMethod: "PAYPAL", payoutAddress: "", notes: "",
  });

  // Derived catalog lookups
  const category = catalog.find((c) => c.id === categoryId);
  const brand = category?.brands.find((b) => b.id === brandId);
  const model = brand?.models.find((m) => m.id === modelId);

  const storageOptions = model
    ? [...new Set(model.variants.map((v) => v.storageGb))].sort((a, b) => a - b)
    : [];

  const carrierOptions = model && storageGb !== null
    ? [...new Set(model.variants.filter((v) => v.storageGb === storageGb).map((v) => v.carrier))]
    : [];

  // Fetch prices when variant is determined
  const fetchPrices = useCallback(async (vid: string) => {
    setPricesLoading(true);
    setPriceError("");
    setConditionPrices(null);
    try {
      const res = await fetch(`/api/quote/price?tenantId=${tenantId}&variantId=${vid}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "No prices available for this device yet.");
      }
      const prices: ConditionPrice[] = await res.json();
      setConditionPrices(prices);
    } catch (err) {
      setPriceError((err as Error).message);
    } finally {
      setPricesLoading(false);
    }
  }, [tenantId]);

  // Re-fetch if modelId / storageGb / carrier change — use primitive deps only
  // to avoid infinite re-renders caused by new array references on every render.
  useEffect(() => {
    if (!model || storageGb === null) return;
    const cOptions = [...new Set(
      model.variants.filter((v) => v.storageGb === storageGb).map((v) => v.carrier)
    )];
    const effectiveCarrier = cOptions.length === 1 ? cOptions[0] : carrier;
    if (!effectiveCarrier) return;
    const v = model.variants.find(
      (v) => v.storageGb === storageGb && v.carrier === effectiveCarrier
    );
    if (v) {
      setVariantId(v.id);
      fetchPrices(v.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId, storageGb, carrier]); // primitives only — stable across renders

  const goBack = () => {
    const backMap: Partial<Record<Step, Step>> = {
      brand: "category",
      model: "brand",
      storage: "model",
      carrier: "storage",
      condition: carrierOptions.length > 1 ? "carrier" : "storage",
      quote: "condition",
      contact: "quote",
    };
    const prev = backMap[step];
    if (prev) setStep(prev);
  };

  // Reset only the current-device state (keep cart + contact)
  const resetDeviceState = () => {
    setCategoryId(null); setBrandId(null); setModelId(null);
    setVariantId(null); setStorageGb(null); setCarrier(null);
    setConditionPrices(null); setSelectedCondition(null);
    setPriceError("");
  };

  // Full reset (new session)
  const resetWizard = () => {
    resetDeviceState();
    setCartItems([]);
    setOrderResult(null);
    setSubmitError("");
    setContact({ name: "", email: "", phone: "", street: "", city: "", state: "", zip: "", payoutMethod: "PAYPAL", payoutAddress: "", notes: "" });
    setStep("category");
  };

  // Add the current device to the cart and go back to pick another
  const addToCart = () => {
    if (!variantId || !selectedCondition || !model || storageGb === null) return;
    const storageLabel = storageGb >= 1024 ? "1TB" : `${storageGb}GB`;
    const carrierLabel = CARRIER_LABELS[carrier ?? "UNLOCKED"] ?? carrier ?? "";
    const deviceLabel = `${model.name} · ${storageLabel} · ${carrierLabel}`;
    setCartItems((prev) => [
      ...prev,
      {
        variantId,
        conditionId: selectedCondition.conditionId,
        deviceLabel,
        conditionLabel: selectedCondition.label,
        grade: selectedCondition.grade,
        buyPrice: selectedCondition.buyPrice,
      },
    ]);
    resetDeviceState();
    setStep("category");
  };

  const removeFromCart = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  const cartTotal = cartItems.reduce((s, i) => s + i.buyPrice, 0);

  const handleSubmitOrder = async () => {
    if (!variantId || !selectedCondition) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const items = [
        ...cartItems.map((i) => ({ variantId: i.variantId, conditionId: i.conditionId })),
        { variantId, conditionId: selectedCondition.conditionId },
      ];
      const res = await fetch("/api/quote/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          items,
          sellerName:    contact.name,
          sellerEmail:   contact.email,
          sellerPhone:   contact.phone   || undefined,
          payoutMethod:  contact.payoutMethod,
          payoutAddress: contact.payoutAddress,
          deviceNotes:   contact.notes   || undefined,
          sellerStreet:  contact.street,
          sellerCity:    contact.city,
          sellerState:   contact.state,
          sellerZip:     contact.zip,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit order");
      setOrderResult({
        orders:         data.orders,
        totalPrice:     data.totalPrice,
        labelUrl:       data.labelUrl       ?? null,
        trackingNumber: data.trackingNumber ?? null,
        carrierName:    data.carrierName    ?? null,
      });
      setStep("submitted");
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const showBack = !["category", "submitted"].includes(step);
  const totalSteps = 6; // category → brand → model → storage/carrier → condition → quote
  const currentProgress = Math.min(stepProgress(step), totalSteps);

  const selectedPayoutMethod = PAYOUT_METHODS.find((m) => m.value === contact.payoutMethod);

  // Current device price (for totals in contact step)
  const currentDevicePrice = selectedCondition?.buyPrice ?? 0;
  const grandTotal = cartTotal + currentDevicePrice;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        {showBack && (
          <button
            onClick={goBack}
            className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">B</span>
          </div>
          <span className="text-sm font-semibold text-gray-900 truncate">{tenantName}</span>
        </div>

        {/* Cart chip — visible whenever there are queued items */}
        {cartItems.length > 0 && step !== "submitted" && (
          <div className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 7M17 13l1.5 7M9 20a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z" />
            </svg>
            {cartItems.length} {cartItems.length === 1 ? "device" : "devices"} · {fmt(cartTotal)}
          </div>
        )}

        {step !== "submitted" && step !== "contact" && cartItems.length === 0 && (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i < currentProgress ? "w-4 bg-blue-600" : "w-1.5 bg-gray-200"}`}
              />
            ))}
          </div>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {/* ── Category ── */}
        {step === "category" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {cartItems.length > 0 ? "Add another device" : "What are you selling?"}
            </h1>
            <p className="text-gray-500 mb-6">
              {cartItems.length > 0
                ? "Pick a category for your next device."
                : "Get an instant offer in under a minute."}
            </p>
            <div className="space-y-3">
              {catalog.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setCategoryId(cat.id); setStep("brand"); }}
                  className="w-full flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-sm transition-all text-left"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl">
                    {cat.slug === "smartphone" ? "📱" : cat.slug === "tablet" ? "📱" : "💻"}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{cat.name}</p>
                    <p className="text-sm text-gray-400">
                      {cat.brands.reduce((n, b) => n + b.models.length, 0)} models
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-300 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>

            {/* Cart review — show queued devices if any */}
            {cartItems.length > 0 && (
              <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">In your order</p>
                <div className="space-y-2">
                  {cartItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${GRADE_BADGE[item.grade] ?? "bg-gray-100 text-gray-700"}`}>{item.grade}</span>
                        <span className="text-sm text-gray-700 truncate">{item.deviceLabel}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{item.conditionLabel}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-900">{fmt(item.buyPrice)}</span>
                        <button
                          onClick={() => removeFromCart(idx)}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Subtotal so far</span>
                  <span className="text-sm font-bold text-gray-900">{fmt(cartTotal)}</span>
                </div>
                <button
                  onClick={() => setStep("contact")}
                  className="mt-3 w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
                >
                  Done adding — Continue to checkout
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Brand ── */}
        {step === "brand" && category && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Which brand?</h1>
            <p className="text-gray-500 mb-6">{category.name}</p>
            <div className="grid grid-cols-2 gap-3">
              {category.brands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setBrandId(b.id); setStep("model"); }}
                  className="flex flex-col items-center gap-2 bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-500 hover:shadow-sm transition-all"
                >
                  <span className="text-2xl">
                    {b.name === "Apple" ? "🍎" : b.name === "Samsung" ? "🔷" : b.name === "Google" ? "🔵" : "📱"}
                  </span>
                  <span className="font-semibold text-gray-900 text-sm">{b.name}</span>
                  <span className="text-xs text-gray-400">{b.models.length} models</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Model ── */}
        {step === "model" && brand && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Which model?</h1>
            <p className="text-gray-500 mb-6">{brand.name}</p>
            <div className="space-y-2">
              {brand.models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setModelId(m.id); setStorageGb(null); setCarrier(null); setStep("storage"); }}
                  className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-blue-500 hover:shadow-sm transition-all text-left"
                >
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{m.name}</p>
                    {m.releaseYear && <p className="text-xs text-gray-400 mt-0.5">{m.releaseYear}</p>}
                  </div>
                  <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Storage ── */}
        {step === "storage" && model && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Storage size?</h1>
            <p className="text-gray-500 mb-6">{model.name}</p>
            <div className="grid grid-cols-3 gap-3">
              {storageOptions.map((gb) => (
                <button
                  key={gb}
                  onClick={() => {
                    setStorageGb(gb);
                    const carriers = [...new Set(model.variants.filter((v) => v.storageGb === gb).map((v) => v.carrier))];
                    if (carriers.length === 1) {
                      setCarrier(carriers[0]);
                      setStep("condition");
                    } else {
                      setCarrier(null);
                      setStep("carrier");
                    }
                  }}
                  className={`flex flex-col items-center gap-1 border rounded-xl p-4 transition-all hover:border-blue-500 hover:shadow-sm bg-white ${storageGb === gb ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
                >
                  <span className="font-bold text-gray-900">{gb >= 1024 ? "1TB" : `${gb}GB`}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Carrier ── */}
        {step === "carrier" && model && storageGb && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Which carrier?</h1>
            <p className="text-gray-500 mb-6">{model.name} · {storageGb >= 1024 ? "1TB" : `${storageGb}GB`}</p>
            <div className="space-y-2">
              {carrierOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => { setCarrier(c); setStep("condition"); }}
                  className={`w-full flex items-center justify-between border rounded-xl px-4 py-3.5 transition-all hover:border-blue-500 bg-white ${carrier === c ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}
                >
                  <span className="font-semibold text-gray-900">{CARRIER_LABELS[c] ?? c}</span>
                  {c === "UNLOCKED" && <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">Best value</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Condition ── */}
        {step === "condition" && model && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">What&apos;s the condition?</h1>
            <p className="text-gray-500 mb-6">Be honest — we verify at inspection.</p>

            {(pricesLoading || (!conditionPrices && !priceError)) && (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            )}

            {priceError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{priceError}</div>
            )}

            {!pricesLoading && conditionPrices && (
              <div className="space-y-3">
                {conditionPrices.map((cp) => (
                  <button
                    key={cp.grade}
                    onClick={() => { setSelectedCondition(cp); setStep("quote"); }}
                    className={`w-full flex items-start gap-4 border-2 rounded-xl p-4 transition-all text-left hover:shadow-sm ${GRADE_COLORS[cp.grade] ?? "border-gray-200 bg-white"}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${GRADE_BADGE[cp.grade]}`}>
                      {cp.grade}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{cp.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{cp.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-900">{fmt(cp.buyPrice)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Quote ── */}
        {step === "quote" && selectedCondition && model && storageGb && (
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">Your instant offer</p>
            <div className="bg-white border border-gray-200 rounded-2xl px-6 py-8 mb-6 shadow-sm">
              <p className="text-5xl font-black text-gray-900 mb-1">{fmt(selectedCondition.buyPrice)}</p>
              <p className="text-sm text-gray-400 mb-4">
                {model.name} · {storageGb >= 1024 ? "1TB" : `${storageGb}GB`} · {CARRIER_LABELS[carrier ?? "UNLOCKED"]} · {selectedCondition.label}
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Based on {fmt(selectedCondition.marketValue)} eBay market value
              </div>
            </div>

            {/* Cart total callout when devices are already in cart */}
            {cartItems.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-sm text-blue-800 text-left">
                <p className="font-semibold mb-1">Order total so far</p>
                <ul className="space-y-0.5 text-blue-700">
                  {cartItems.map((item, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span className="truncate mr-2">{item.deviceLabel}</span>
                      <span className="font-medium flex-shrink-0">{fmt(item.buyPrice)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between font-bold border-t border-blue-200 mt-1 pt-1">
                    <span>+ This device</span>
                    <span>{fmt(selectedCondition.buyPrice)}</span>
                  </li>
                  <li className="flex justify-between font-black text-blue-900">
                    <span>Combined total</span>
                    <span>{fmt(grandTotal)}</span>
                  </li>
                </ul>
              </div>
            )}

            <div className="space-y-3 text-sm text-gray-600 text-left mb-8">
              {[
                "Free shipping — we email you a prepaid label",
                "Offer locked in for 14 days after acceptance",
                "Payment within 2 business days of inspection",
              ].map((point) => (
                <div key={point} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {point}
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep("contact")}
              className="w-full py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all text-base"
            >
              {cartItems.length > 0
                ? `Accept All — ${fmt(grandTotal)}`
                : `Accept Offer — ${fmt(selectedCondition.buyPrice)}`}
            </button>

            {/* Sell Another Device */}
            <button
              onClick={addToCart}
              className="mt-3 w-full py-3.5 border-2 border-blue-200 text-blue-700 font-semibold rounded-xl hover:bg-blue-50 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Sell Another Device
            </button>

            <button
              onClick={resetWizard}
              className="mt-2 w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Start over
            </button>
          </div>
        )}

        {/* ── Contact ── */}
        {step === "contact" && selectedCondition && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Almost done</h1>
            <p className="text-gray-500 mb-6">Tell us where to send your payment.</p>

            {/* Order summary — all devices */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Order summary</p>
              <div className="space-y-2">
                {cartItems.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${GRADE_BADGE[item.grade] ?? "bg-gray-100 text-gray-700"}`}>{item.grade}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 leading-snug">{item.deviceLabel}</p>
                        <p className="text-xs text-gray-400">{item.conditionLabel}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{fmt(item.buyPrice)}</span>
                  </div>
                ))}
                {/* Current device */}
                <div className="flex items-start justify-between gap-2 pt-2 border-t border-gray-100">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${GRADE_BADGE[selectedCondition.grade] ?? "bg-gray-100 text-gray-700"}`}>{selectedCondition.grade}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 leading-snug">
                        {model?.name} · {storageGb != null ? (storageGb >= 1024 ? "1TB" : `${storageGb}GB`) : ""} · {CARRIER_LABELS[carrier ?? "UNLOCKED"]}
                      </p>
                      <p className="text-xs text-gray-400">{selectedCondition.label}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{fmt(selectedCondition.buyPrice)}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Total offer</span>
                <span className="text-xl font-black text-blue-600">{fmt(grandTotal)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                <input
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={contact.name}
                  onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                  placeholder="John Smith"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={contact.email}
                  onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                  placeholder="you@gmail.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={contact.phone}
                  onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                  placeholder="(312) 555-0100"
                  autoComplete="tel"
                />
              </div>

              {/* Shipping address — used to generate free prepaid label */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm font-medium text-blue-900 mb-3">
                  📦 Your shipping address
                  <span className="ml-1 text-xs font-normal text-blue-600">— we&apos;ll generate a free prepaid label</span>
                </p>
                <div className="space-y-2">
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={contact.street}
                    onChange={(e) => setContact((c) => ({ ...c, street: e.target.value }))}
                    placeholder="Street address"
                    autoComplete="street-address"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      className="col-span-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={contact.city}
                      onChange={(e) => setContact((c) => ({ ...c, city: e.target.value }))}
                      placeholder="City"
                      autoComplete="address-level2"
                    />
                    <input
                      className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white uppercase"
                      value={contact.state}
                      onChange={(e) => setContact((c) => ({ ...c, state: e.target.value.slice(0, 2).toUpperCase() }))}
                      placeholder="TX"
                      maxLength={2}
                      autoComplete="address-level1"
                    />
                    <input
                      className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={contact.zip}
                      onChange={(e) => setContact((c) => ({ ...c, zip: e.target.value }))}
                      placeholder="ZIP"
                      maxLength={10}
                      autoComplete="postal-code"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">How would you like to be paid?</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {PAYOUT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setContact((c) => ({ ...c, payoutMethod: m.value, payoutAddress: "" }))}
                      className={`py-2.5 px-2 text-xs font-medium rounded-lg border transition-colors ${
                        contact.payoutMethod === m.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <input
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={contact.payoutAddress}
                  onChange={(e) => setContact((c) => ({ ...c, payoutAddress: e.target.value }))}
                  placeholder={selectedPayoutMethod?.placeholder ?? ""}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes about your device{cartItems.length > 0 ? "s" : ""} <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  value={contact.notes}
                  onChange={(e) => setContact((c) => ({ ...c, notes: e.target.value }))}
                  placeholder="Any cracks, defects, or accessories included..."
                />
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{submitError}</div>
              )}

              <button
                onClick={handleSubmitOrder}
                disabled={submitting || !contact.name || !contact.email || !contact.payoutAddress || !contact.street || !contact.city || !contact.state || !contact.zip}
                className="w-full py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all text-base"
              >
                {submitting
                  ? "Submitting..."
                  : `Confirm Order — ${fmt(grandTotal)}`}
              </button>
              <p className="text-xs text-center text-gray-400">
                By submitting, you agree to ship your device{cartItems.length > 0 ? "s" : ""} within 14 days.
              </p>
            </div>
          </div>
        )}

        {/* ── Submitted ── */}
        {step === "submitted" && orderResult && nap && (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {orderResult.orders.length > 1 ? "Orders confirmed!" : "Offer confirmed!"}
              </h1>
              <p className="text-gray-500">Check your email for shipping instructions.</p>
            </div>

            {/* Per-device order cards */}
            <div className="space-y-3 mb-4">
              {orderResult.orders.map((o) => {
                const storageLabel = o.storageGb >= 1024 ? "1TB" : `${o.storageGb}GB`;
                const carrierLabel = CARRIER_LABELS[o.carrier] ?? o.carrier;
                return (
                  <div key={o.orderNumber} className="bg-white border border-gray-200 rounded-2xl p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Order number</p>
                        <p className="font-mono font-bold text-gray-900 text-sm">{o.orderNumber}</p>
                      </div>
                      <p className="text-xl font-black text-green-600">{fmt(o.quotedPrice)}</p>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {o.deviceName} · {storageLabel} · {carrierLabel} · {o.conditionLabel}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Total row */}
            {orderResult.orders.length > 1 && (
              <div className="bg-gray-900 text-white rounded-2xl px-5 py-4 flex justify-between items-center mb-4">
                <span className="font-semibold">Total payout</span>
                <span className="text-2xl font-black text-green-400">{fmt(orderResult.totalPrice)}</span>
              </div>
            )}

            {/* Prepaid label download */}
            {orderResult.labelUrl && (
              <a
                href={orderResult.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors mb-4"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Download Free Shipping Label
              </a>
            )}
            {orderResult.trackingNumber && (
              <p className="text-center text-xs text-gray-400 -mt-2 mb-4">
                Tracking: <span className="font-mono font-medium text-gray-600">{orderResult.trackingNumber}</span>
                {orderResult.carrierName && ` · ${orderResult.carrierName}`}
              </p>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">Ship your device{orderResult.orders.length > 1 ? "s" : ""} to:</p>
              <address className="not-italic text-sm text-blue-800 leading-relaxed">
                <strong>{nap.businessName}</strong><br />
                {nap.streetAddress}<br />
                {nap.city}, {nap.state} {nap.zipCode}
              </address>
              <p className="text-xs text-blue-600 mt-2">
                {orderResult.labelUrl
                  ? <>Print the label above and attach it to your package — <strong>shipping is free</strong>.</>
                  : <>Write your order number on the outside of your package.</>
                }
              </p>
            </div>

            <div className="space-y-3 text-sm text-gray-600 mb-6">
              {[
                { icon: "📦", text: "Pack it securely and drop it off at any USPS / FedEx / UPS location" },
                { icon: "🔍", text: "We inspect within 1 business day of receiving your device" },
                { icon: "💸", text: `Payment via ${PAYOUT_METHODS.find((m) => m.value === contact.payoutMethod)?.label} within 2 business days` },
              ].map((item) => (
                <div key={item.text} className="flex gap-3 bg-white border border-gray-100 rounded-xl p-3">
                  <span className="text-lg">{item.icon}</span>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>

            <button
              onClick={resetWizard}
              className="w-full py-3 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Sell more devices
            </button>
          </div>
        )}

        {/* Edge case: submitted but no NAP data */}
        {step === "submitted" && orderResult && !nap && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {orderResult.orders.length > 1 ? "Orders confirmed!" : "Order confirmed!"}
            </h1>
            <p className="text-xl font-bold text-green-600 mb-4">{fmt(orderResult.totalPrice)}</p>
            <div className="space-y-1 mb-4">
              {orderResult.orders.map((o) => (
                <p key={o.orderNumber} className="text-sm text-gray-500">Order #{o.orderNumber}</p>
              ))}
            </div>
            <p className="text-sm text-gray-400">Check your email for shipping instructions.</p>
          </div>
        )}
      </main>
    </div>
  );
}
