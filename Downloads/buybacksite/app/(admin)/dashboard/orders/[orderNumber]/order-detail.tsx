"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OrderStatus } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusHistoryEntry {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string | null;
  deviceNotes: string | null;
  quotedPrice: number;
  finalPrice: number | null;
  payoutMethod: string;
  payoutAddress: string | null;
  payoutReference: string | null;
  paidAt: string | null;
  shippingLabelUrl: string | null;
  trackingNumber: string | null;
  carrierName: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  internalNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  tenantName: string;
  nap: { businessName: string; phone: string } | null;
  statusHistory: StatusHistoryEntry[];
  device: { modelName: string; brandName: string; storageGb: number; carrier: string } | null;
  condition: { grade: string; label: string } | null;
  canEdit?: boolean;
}

interface Props {
  order: Order;
  canEdit: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRANSITIONS: Partial<Record<OrderStatus, { status: OrderStatus; label: string; color: string }[]>> = {
  PENDING:       [{ status: OrderStatus.SHIPPED, label: "Mark Shipped", color: "blue" }, { status: OrderStatus.CANCELLED, label: "Cancel", color: "red" }],
  SHIPPED:       [{ status: OrderStatus.RECEIVED, label: "Mark Received", color: "indigo" }, { status: OrderStatus.CANCELLED, label: "Cancel", color: "red" }],
  RECEIVED:      [{ status: OrderStatus.INSPECTING, label: "Start Inspection", color: "purple" }],
  INSPECTING:    [
    { status: OrderStatus.APPROVED, label: "Approve", color: "green" },
    { status: OrderStatus.OFFER_REVISED, label: "Revise Offer", color: "orange" },
    { status: OrderStatus.REJECTED, label: "Reject", color: "red" },
  ],
  OFFER_REVISED: [{ status: OrderStatus.APPROVED, label: "Approve", color: "green" }, { status: OrderStatus.REJECTED, label: "Reject", color: "red" }],
  APPROVED:      [{ status: OrderStatus.PAID, label: "Mark Paid", color: "green" }],
  REJECTED:      [{ status: OrderStatus.RETURNED, label: "Mark Returned", color: "gray" }],
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:       "bg-yellow-100 text-yellow-800",
  SHIPPED:       "bg-blue-100 text-blue-800",
  RECEIVED:      "bg-indigo-100 text-indigo-800",
  INSPECTING:    "bg-purple-100 text-purple-800",
  OFFER_REVISED: "bg-orange-100 text-orange-800",
  APPROVED:      "bg-teal-100 text-teal-800",
  PAID:          "bg-green-100 text-green-800",
  REJECTED:      "bg-red-100 text-red-800",
  RETURNED:      "bg-gray-100 text-gray-600",
  CANCELLED:     "bg-gray-100 text-gray-400",
};

const BUTTON_COLORS: Record<string, string> = {
  blue:   "bg-blue-600 hover:bg-blue-700 text-white",
  indigo: "bg-indigo-600 hover:bg-indigo-700 text-white",
  purple: "bg-purple-600 hover:bg-purple-700 text-white",
  green:  "bg-green-600 hover:bg-green-700 text-white",
  orange: "bg-orange-500 hover:bg-orange-600 text-white",
  red:    "border border-red-300 text-red-600 hover:bg-red-50",
  gray:   "border border-gray-300 text-gray-600 hover:bg-gray-50",
};

const CARRIER_LABELS: Record<string, string> = {
  UNLOCKED: "Unlocked", ATT: "AT&T", TMOBILE: "T-Mobile",
  VERIZON: "Verizon", SPRINT: "Sprint", OTHER: "Other",
};

const PAYOUT_LABELS: Record<string, string> = {
  PAYPAL: "PayPal", ZELLE: "Zelle", VENMO: "Venmo",
  CHECK: "Check", ACH: "Bank Transfer", STORE_CREDIT: "Store Credit",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderDetail({ order: initial, canEdit }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [transitioning, setTransitioning] = useState(false);
  const [activeTransition, setActiveTransition] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");
  const [finalPrice, setFinalPrice] = useState(
    initial.finalPrice?.toString() ?? initial.quotedPrice.toString()
  );
  const [trackingInput, setTrackingInput] = useState(initial.trackingNumber ?? "");
  const [carrierInput, setCarrierInput] = useState(initial.carrierName ?? "");
  const [payoutRef, setPayoutRef] = useState(initial.payoutReference ?? "");
  const [error, setError] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [internalNotes, setInternalNotes] = useState(initial.internalNotes ?? "");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Label generation state
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [labelForm, setLabelForm] = useState({ street: "", city: "", state: "", zip: "" });
  const [generatingLabel, setGeneratingLabel] = useState(false);
  const [labelError, setLabelError] = useState("");

  const transitions = TRANSITIONS[order.status] ?? [];
  const needsFinalPrice = activeTransition === OrderStatus.OFFER_REVISED || activeTransition === OrderStatus.APPROVED;
  const needsTracking = activeTransition === OrderStatus.SHIPPED || activeTransition === OrderStatus.RETURNED;
  const needsPayoutRef = activeTransition === OrderStatus.PAID;
  const needsRejection = activeTransition === OrderStatus.REJECTED;

  // Auto-save internal notes with debounce
  const saveNotes = useCallback(async (value: string) => {
    setSavingNotes(true);
    try {
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "notes", internalNotes: value }),
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch { /* silent */ }
    finally { setSavingNotes(false); }
  }, [order.id]);

  const handleNotesChange = (v: string) => {
    setInternalNotes(v);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => saveNotes(v), 1200);
  };

  const handleTransition = async () => {
    if (!activeTransition) return;
    setTransitioning(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        action: "transition",
        status: activeTransition,
        note: note || undefined,
      };
      if (needsFinalPrice) body.finalPrice = parseFloat(finalPrice);
      if (needsTracking) { body.trackingNumber = trackingInput; body.carrierName = carrierInput; }
      if (needsPayoutRef) body.payoutReference = payoutRef;
      if (needsRejection) body.rejectionReason = note;

      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");

      setActiveTransition(null);
      setNote("");
      router.refresh();
      // Optimistically update status shown
      setOrder((o) => ({ ...o, status: activeTransition }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTransitioning(false);
    }
  };

  const handleGenerateLabel = async () => {
    setGeneratingLabel(true);
    setLabelError("");
    try {
      const res = await fetch(`/api/orders/${order.id}/label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerName: order.sellerName,
          sellerStreet: labelForm.street,
          sellerCity: labelForm.city,
          sellerState: labelForm.state,
          sellerZip: labelForm.zip,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate label");
      setOrder((o) => ({
        ...o,
        shippingLabelUrl: data.labelUrl,
        trackingNumber: data.trackingNumber,
        carrierName: data.carrier,
      }));
      setTrackingInput(data.trackingNumber);
      setShowLabelForm(false);
    } catch (err) {
      setLabelError((err as Error).message);
    } finally {
      setGeneratingLabel(false);
    }
  };

  const device = order.device;
  const storageLabel = device ? (device.storageGb >= 1024 ? "1TB" : `${device.storageGb}GB`) : "";

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/orders" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{order.orderNumber}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
              {order.status.charAt(0) + order.status.slice(1).toLowerCase().replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {order.tenantName} · {fmtDate(order.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left column: details ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Device + pricing */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Device</h2>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-base">
                  {device ? `${device.modelName} ${storageLabel}` : "—"}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {device ? CARRIER_LABELS[device.carrier] ?? device.carrier : ""}
                  {order.condition ? ` · Grade ${order.condition.grade} — ${order.condition.label}` : ""}
                </p>
                {order.deviceNotes && (
                  <p className="text-xs text-gray-400 mt-1.5 italic">"{order.deviceNotes}"</p>
                )}
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-xs text-gray-400">Quoted</p>
                <p className="text-xl font-bold text-gray-900">{fmt(order.quotedPrice)}</p>
                {order.finalPrice !== null && order.finalPrice !== order.quotedPrice && (
                  <>
                    <p className="text-xs text-gray-400 mt-1">Final</p>
                    <p className="text-base font-semibold text-orange-600">{fmt(order.finalPrice)}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Seller info */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Seller</h2>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-gray-400">Name</span>
              <span className="font-medium text-gray-800">{order.sellerName}</span>
              <span className="text-gray-400">Email</span>
              <a href={`mailto:${order.sellerEmail}`} className="text-blue-600 hover:underline">{order.sellerEmail}</a>
              {order.sellerPhone && (
                <>
                  <span className="text-gray-400">Phone</span>
                  <a href={`tel:${order.sellerPhone}`} className="text-blue-600 hover:underline">{order.sellerPhone}</a>
                </>
              )}
              <span className="text-gray-400">Payout</span>
              <span className="text-gray-700">
                {PAYOUT_LABELS[order.payoutMethod] ?? order.payoutMethod}
                {order.payoutAddress && <span className="text-gray-400"> · {order.payoutAddress}</span>}
              </span>
              {order.payoutReference && (
                <>
                  <span className="text-gray-400">Reference</span>
                  <span className="font-mono text-xs text-gray-700">{order.payoutReference}</span>
                </>
              )}
              {order.paidAt && (
                <>
                  <span className="text-gray-400">Paid at</span>
                  <span className="text-green-600 font-medium">{fmtDate(order.paidAt)}</span>
                </>
              )}
            </div>
          </div>

          {/* Shipping */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Shipping</h2>
              {canEdit && !order.shippingLabelUrl && (
                <button
                  onClick={() => setShowLabelForm((v) => !v)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {showLabelForm ? "Cancel" : "Generate prepaid label"}
                </button>
              )}
            </div>

            {order.trackingNumber ? (
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-gray-400">Tracking #</span>
                <span className="font-mono text-gray-800">{order.trackingNumber}</span>
                {order.carrierName && (
                  <>
                    <span className="text-gray-400">Carrier</span>
                    <span className="text-gray-700">{order.carrierName}</span>
                  </>
                )}
                {order.shippedAt && (
                  <>
                    <span className="text-gray-400">Shipped</span>
                    <span className="text-gray-700">{fmtDate(order.shippedAt)}</span>
                  </>
                )}
                {order.receivedAt && (
                  <>
                    <span className="text-gray-400">Received</span>
                    <span className="text-gray-700">{fmtDate(order.receivedAt)}</span>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No shipping info yet.</p>
            )}

            {order.shippingLabelUrl && (
              <a
                href={order.shippingLabelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download shipping label
              </a>
            )}

            {showLabelForm && canEdit && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <p className="text-xs font-medium text-gray-600">Seller's shipping address (from)</p>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Street address"
                  value={labelForm.street}
                  onChange={(e) => setLabelForm((f) => ({ ...f, street: e.target.value }))}
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    className="col-span-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="City"
                    value={labelForm.city}
                    onChange={(e) => setLabelForm((f) => ({ ...f, city: e.target.value }))}
                  />
                  <input
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="State"
                    value={labelForm.state}
                    onChange={(e) => setLabelForm((f) => ({ ...f, state: e.target.value }))}
                  />
                  <input
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ZIP"
                    value={labelForm.zip}
                    onChange={(e) => setLabelForm((f) => ({ ...f, zip: e.target.value }))}
                  />
                </div>
                {labelError && <p className="text-xs text-red-600">{labelError}</p>}
                <button
                  onClick={handleGenerateLabel}
                  disabled={generatingLabel || !labelForm.street || !labelForm.city || !labelForm.state || !labelForm.zip}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {generatingLabel ? "Generating…" : "Generate Label"}
                </button>
              </div>
            )}
          </div>

          {/* Internal notes */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Internal Notes</h2>
              <span className={`text-xs transition-opacity ${savingNotes || notesSaved ? "opacity-100" : "opacity-0"} ${notesSaved ? "text-green-500" : "text-gray-400"}`}>
                {notesSaved ? "Saved" : "Saving…"}
              </span>
            </div>
            <textarea
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-gray-700 placeholder-gray-300"
              placeholder="Staff-only notes — not visible to the seller…"
              value={internalNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          {/* Status history timeline */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">History</h2>
            <div className="space-y-0">
              {order.statusHistory.map((h, i) => (
                <div key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${i === order.statusHistory.length - 1 ? "bg-blue-500" : "bg-gray-300"}`} />
                    {i < order.statusHistory.length - 1 && (
                      <div className="w-px flex-1 bg-gray-100 my-1" />
                    )}
                  </div>
                  <div className="pb-4 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[h.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {h.status.charAt(0) + h.status.slice(1).toLowerCase().replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-gray-400">{fmtDate(h.createdAt)}</span>
                    </div>
                    {h.note && <p className="text-xs text-gray-500 mt-0.5">{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column: actions ─────────────────────────────────────────── */}
        <div className="space-y-4">
          {canEdit && transitions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions</h2>

              {!activeTransition ? (
                <div className="space-y-2">
                  {transitions.map((t) => (
                    <button
                      key={t.status}
                      onClick={() => { setActiveTransition(t.status); setError(""); }}
                      className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${BUTTON_COLORS[t.color]}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">
                    {transitions.find((t) => t.status === activeTransition)?.label}
                  </p>

                  {needsFinalPrice && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">
                        {activeTransition === OrderStatus.OFFER_REVISED ? "Revised offer amount" : "Final price"}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full pl-6 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={finalPrice}
                          onChange={(e) => setFinalPrice(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {needsTracking && (
                    <div className="space-y-2">
                      <input
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Tracking number (optional)"
                        value={trackingInput}
                        onChange={(e) => setTrackingInput(e.target.value)}
                      />
                      <input
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Carrier (USPS, FedEx…)"
                        value={carrierInput}
                        onChange={(e) => setCarrierInput(e.target.value)}
                      />
                    </div>
                  )}

                  {needsPayoutRef && (
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Payment reference / confirmation #</label>
                      <input
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Transaction ID, check #…"
                        value={payoutRef}
                        onChange={(e) => setPayoutRef(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      {needsRejection ? "Rejection reason (sent to seller)" : "Note (optional)"}
                    </label>
                    <textarea
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder={needsRejection ? "E.g. Device is blacklisted / has iCloud lock" : "Add a note…"}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>

                  {error && <p className="text-xs text-red-600">{error}</p>}

                  <div className="flex gap-2">
                    <button
                      onClick={handleTransition}
                      disabled={transitioning || (needsPayoutRef && !payoutRef) || (needsRejection && !note)}
                      className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {transitioning ? "Saving…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => { setActiveTransition(null); setError(""); }}
                      className="px-3 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Order summary chip */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm space-y-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Summary</h2>
            <Row label="Order #" value={<span className="font-mono text-xs">{order.orderNumber}</span>} />
            <Row label="Created" value={fmtDate(order.createdAt)} />
            <Row label="Quoted" value={fmt(order.quotedPrice)} />
            {order.finalPrice !== null && (
              <Row label="Final" value={<span className={order.finalPrice !== order.quotedPrice ? "text-orange-600 font-medium" : ""}>{fmt(order.finalPrice)}</span>} />
            )}
            <Row label="Payout" value={PAYOUT_LABELS[order.payoutMethod] ?? order.payoutMethod} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className="text-gray-700 text-xs">{value}</span>
    </div>
  );
}
