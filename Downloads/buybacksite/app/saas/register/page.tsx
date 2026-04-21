"use client";

import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { signIn } from "next-auth/react";
import Link from "next/link";

// ─── Stripe init (singleton outside component) ────────────────────────────────

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "account" | "plan" | "payment" | "success";
type Plan = "STARTER" | "GROWTH" | "PRO";
type Billing = "monthly" | "annual";

interface PlanMeta {
  name: Plan;
  label: string;
  monthly: number;
  annual: number;
  desc: string;
  features: string[];
  highlighted: boolean;
}

// ─── Plan data ────────────────────────────────────────────────────────────────

const PLANS: PlanMeta[] = [
  {
    name: "STARTER",
    label: "Starter",
    monthly: 49,
    annual: 39,
    desc: "Perfect for part-time resellers just getting started.",
    features: [
      "Up to 50 orders / month",
      "Branded storefront",
      "Automated daily pricing",
      "Prepaid shipping labels",
      "Email notifications",
    ],
    highlighted: false,
  },
  {
    name: "GROWTH",
    label: "Growth",
    monthly: 99,
    annual: 79,
    desc: "For resellers scaling their buyback operation.",
    features: [
      "Up to 300 orders / month",
      "Everything in Starter",
      "Custom domain",
      "Per-category margin rules",
      "Manual price overrides",
    ],
    highlighted: true,
  },
  {
    name: "PRO",
    label: "Pro",
    monthly: 199,
    annual: 159,
    desc: "High-volume operations with zero limits.",
    features: [
      "Unlimited orders",
      "Everything in Growth",
      "Multiple staff accounts",
      "API access",
      "Dedicated support",
    ],
    highlighted: false,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

function trialEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function CheckIcon({ className = "w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

const inputCls =
  "w-full bg-white/5 border border-white/20 text-white placeholder:text-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors";

const labelCls = "block text-xs font-medium text-gray-400 mb-1.5";

// ─── Step progress bar ────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "plan",    label: "Plan" },
  { key: "payment", label: "Payment" },
];

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-0 mb-10">
      {STEPS.map((s, i) => {
        const done    = i < idx;
        const active  = i === idx;
        const future  = i > idx;
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                  done   ? "bg-orange-600 text-white"
                  : active ? "bg-orange-600 text-white ring-4 ring-orange-600/20"
                  : "bg-white/10 text-gray-500"
                }`}
              >
                {done ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${active ? "text-white" : "text-gray-500"}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${done ? "bg-orange-600/50" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Account info ─────────────────────────────────────────────────────

interface AccountFields {
  name: string;
  email: string;
  businessName: string;
  slug: string;
}

function StepAccount({
  fields,
  onChange,
  onNext,
}: {
  fields: AccountFields;
  onChange: (f: Partial<AccountFields>) => void;
  onNext: () => void;
}) {
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");

  // Auto-derive slug from business name unless user has manually edited it
  useEffect(() => {
    if (!slugEdited && fields.businessName) {
      onChange({ slug: slugify(fields.businessName) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.businessName, slugEdited]);

  // Debounced slug check
  const checkSlug = useCallback(async (slug: string) => {
    if (!slug || slug.length < 3) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    try {
      const res = await fetch(`/api/register?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      setSlugStatus(data.available ? "available" : "taken");
    } catch {
      setSlugStatus("idle");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => checkSlug(fields.slug), 400);
    return () => clearTimeout(t);
  }, [fields.slug, checkSlug]);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fields.name || !fields.email || !fields.businessName || !fields.slug) {
      setError("Please fill in all fields.");
      return;
    }
    if (slugStatus === "taken") { setError("That URL is already taken — choose another."); return; }
    if (slugStatus === "checking") { setError("Please wait while we check the URL."); return; }
    setError("");
    onNext();
  };

  const slugIndicator = {
    idle: null,
    checking: <span className="text-gray-500 text-xs">Checking…</span>,
    available: <span className="text-green-400 text-xs flex items-center gap-1"><CheckIcon className="w-3.5 h-3.5 text-green-400" /> Available</span>,
    taken: <span className="text-red-400 text-xs">Already taken</span>,
  }[slugStatus];

  return (
    <form onSubmit={handleNext} className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-white mb-1">Create your account</h2>
        <p className="text-gray-500 text-sm">You'll use a magic link to sign in — no password needed.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Your full name</label>
          <input
            className={inputCls}
            placeholder="Jane Smith"
            value={fields.name}
            onChange={(e) => onChange({ name: e.target.value })}
            autoComplete="name"
            required
          />
        </div>
        <div>
          <label className={labelCls}>Email address</label>
          <input
            type="email"
            className={inputCls}
            placeholder="jane@yourbusiness.com"
            value={fields.email}
            onChange={(e) => onChange({ email: e.target.value })}
            autoComplete="email"
            required
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Business name</label>
        <input
          className={inputCls}
          placeholder="Chicago Buyback Co."
          value={fields.businessName}
          onChange={(e) => onChange({ businessName: e.target.value })}
          required
        />
      </div>

      <div>
        <label className={labelCls}>Your storefront URL</label>
        <div className="flex items-stretch">
          <span className="flex items-center px-3 bg-white/5 border border-r-0 border-white/20 rounded-l-xl text-gray-500 text-xs whitespace-nowrap">
            {process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "buybacksite.com"}/
          </span>
          <input
            className="flex-1 bg-white/5 border border-white/20 text-white placeholder:text-gray-600 rounded-r-xl px-3 py-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
            placeholder="chicago-buyback"
            value={fields.slug}
            onChange={(e) => {
              setSlugEdited(true);
              onChange({ slug: slugify(e.target.value) });
            }}
            required
            minLength={3}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <p className="text-xs text-gray-600">Lowercase letters, numbers, and hyphens only.</p>
          {slugIndicator}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 rounded-xl transition-colors"
      >
        Continue to Plan →
      </button>
    </form>
  );
}

// ─── Step 2: Plan selection ───────────────────────────────────────────────────

function StepPlan({
  selected,
  billing,
  onSelect,
  onBillingChange,
  onNext,
  onBack,
}: {
  selected: Plan;
  billing: Billing;
  onSelect: (p: Plan) => void;
  onBillingChange: (b: Billing) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white mb-1">Choose your plan</h2>
        <p className="text-gray-500 text-sm">All plans include a 14-day free trial. Cancel anytime before your trial ends.</p>
      </div>

      {/* Billing toggle */}
      <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1">
        <button
          onClick={() => onBillingChange("monthly")}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            billing === "monthly" ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => onBillingChange("annual")}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${
            billing === "annual" ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Annual
          <span className="text-xs text-orange-300 font-normal">save 20%</span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-4">
        {PLANS.map((plan) => {
          const price = billing === "monthly" ? plan.monthly : plan.annual;
          const isSelected = selected === plan.name;
          return (
            <button
              key={plan.name}
              type="button"
              onClick={() => onSelect(plan.name)}
              className={`w-full text-left rounded-2xl border-2 p-5 transition-all ${
                isSelected
                  ? "border-orange-500 bg-orange-600/10"
                  : "border-white/10 bg-white/5 hover:border-white/30"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold text-base">{plan.label}</span>
                    {plan.highlighted && (
                      <span className="text-xs bg-orange-600/20 text-orange-400 px-2 py-0.5 rounded-full font-medium">
                        Most Popular
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mb-3">{plan.desc}</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-gray-400">
                        <CheckIcon className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-black text-white">${price}</div>
                  <div className="text-xs text-gray-500">/mo</div>
                  {billing === "annual" && (
                    <div className="text-xs text-orange-400 mt-0.5">Billed ${price * 12}/yr</div>
                  )}
                </div>
              </div>

              {/* Selection indicator */}
              <div className={`mt-3 pt-3 border-t flex items-center gap-2 ${isSelected ? "border-orange-500/30 text-orange-400" : "border-white/10 text-gray-600"}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-orange-500 bg-orange-500" : "border-white/20"}`}>
                  {isSelected && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </div>
                <span className="text-xs font-medium">
                  {isSelected ? `${plan.label} selected` : `Select ${plan.label}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-5 py-3 border border-white/20 text-gray-400 hover:text-white hover:border-white/40 rounded-xl text-sm font-medium transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Continue to Payment →
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Payment (inner form, inside Elements provider) ───────────────────

function PaymentForm({
  account,
  plan,
  billing,
  stripeCustomerId,
  setupIntentId: _setupIntentId,
  onSuccess,
  onBack,
}: {
  account: AccountFields;
  plan: Plan;
  billing: Billing;
  stripeCustomerId: string;
  setupIntentId: string | null;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripe  = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const planMeta = PLANS.find((p) => p.name === plan)!;
  const price     = billing === "monthly" ? planMeta.monthly : planMeta.annual;
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? `https://app.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "buybacksite.com"}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError("");

    // 1. Confirm the setup intent (saves the card)
    const { error: stripeError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${appUrl}/register/callback`,
      },
    });

    if (stripeError) {
      setError(stripeError.message ?? "Card verification failed. Please try again.");
      setSubmitting(false);
      return;
    }

    if (!setupIntent || setupIntent.status !== "succeeded") {
      setError("Payment setup incomplete. Please try again.");
      setSubmitting(false);
      return;
    }

    // 2. Complete registration server-side
    try {
      const res = await fetch("/api/register/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: account.name,
          email: account.email,
          businessName: account.businessName,
          slug: account.slug,
          plan,
          billing,
          stripeCustomerId,
          setupIntentId: setupIntent.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msgs: Record<string, string> = {
          "email-taken": "That email is already registered. Try signing in.",
          "slug-taken": "That URL is already taken. Go back and choose another.",
          "payment-not-confirmed": "Payment method not confirmed. Please try again.",
        };
        throw new Error(msgs[data.error] ?? data.error ?? "Registration failed");
      }

      // 3. Send magic link
      await signIn("email", { email: account.email, redirect: false });

      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white mb-1">Payment details</h2>
        <p className="text-gray-500 text-sm">Your card won&apos;t be charged during your 14-day free trial.</p>
      </div>

      {/* Order summary */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Order summary</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-semibold">{planMeta.label} Plan</p>
            <p className="text-gray-500 text-xs">{billing === "annual" ? "Annual" : "Monthly"} billing</p>
          </div>
          <div className="text-right">
            <p className="text-white font-bold">${price}/mo</p>
            {billing === "annual" && <p className="text-xs text-orange-400">Billed ${price * 12}/yr</p>}
          </div>
        </div>
      </div>

      {/* Trial banner */}
      <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 flex items-start gap-3">
        <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-green-300 text-sm font-semibold">14-day free trial</p>
          <p className="text-green-400/70 text-xs mt-0.5 leading-relaxed">
            Nothing will be charged until <strong className="text-green-300">{trialEndDate()}</strong>.
            Cancel any time before that from your dashboard — no questions asked.
          </p>
        </div>
      </div>

      {/* Stripe Payment Element */}
      <div>
        <label className={labelCls}>Card details</label>
        <div className="bg-white/5 border border-white/20 rounded-xl p-4 focus-within:border-orange-500 transition-colors">
          <PaymentElement
            options={{
              layout: "tabs",
              appearance: {
                theme: "night",
                variables: {
                  colorPrimary: "#ea580c",
                  colorBackground: "transparent",
                  colorText: "#f9fafb",
                  colorTextSecondary: "#6b7280",
                  borderRadius: "8px",
                  fontFamily: "inherit",
                },
              },
            }}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="px-5 py-3 border border-white/20 text-gray-400 hover:text-white hover:border-white/40 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          type="submit"
          disabled={submitting || !stripe}
          className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Setting up your account…
            </>
          ) : (
            <>Start Free Trial →</>
          )}
        </button>
      </div>

      <p className="text-xs text-center text-gray-600">
        By starting your trial you agree to our{" "}
        <Link href="/terms" className="text-gray-500 hover:text-gray-300 underline">Terms of Service</Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-gray-500 hover:text-gray-300 underline">Privacy Policy</Link>.
        Payments are secured by Stripe.
      </p>
    </form>
  );
}

// ─── Step 4: Success ──────────────────────────────────────────────────────────

function StepSuccess({ email, slug }: { email: string; slug: string }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://app.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "buybacksite.com"}`;
  return (
    <div className="text-center py-4 space-y-6">
      <div className="w-20 h-20 bg-green-900/30 border border-green-500/30 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-black text-white mb-2">You&apos;re in! 🎉</h2>
        <p className="text-gray-400 leading-relaxed max-w-sm mx-auto">
          Your 14-day free trial has started. We&apos;ve sent a sign-in link to{" "}
          <strong className="text-white">{email}</strong>.
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left max-w-sm mx-auto space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">What&apos;s next</p>
        {[
          { icon: "✉️", text: "Click the sign-in link in your email" },
          { icon: "🏪", text: "Set up your business info & storefront" },
          { icon: "💸", text: "Share your link and start getting quotes" },
        ].map((item) => (
          <div key={item.text} className="flex items-start gap-3">
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            <p className="text-sm text-gray-300">{item.text}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <p className="text-xs text-gray-600">
          Your storefront URL:{" "}
          <span className="font-mono text-gray-400">{slug}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "buybacksite.com"}</span>
        </p>
        <a
          href={`${appUrl}/login`}
          className="inline-flex items-center gap-2 border border-white/20 text-gray-400 hover:text-white hover:border-white/40 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          Go to sign-in page
        </a>
      </div>
    </div>
  );
}

// ─── Wrapper that sets up Stripe Elements when on payment step ────────────────

function PaymentStep({
  account,
  plan,
  billing,
  onSuccess,
  onBack,
}: {
  account: AccountFields;
  plan: Plan;
  billing: Billing;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [clientSecret, setClientSecret]     = useState<string | null>(null);
  const [stripeCustomerId, setCustomerId]   = useState<string>("");
  const [setupIntentId, setSetupIntentId]   = useState<string | null>(null);
  const [loadError, setLoadError]           = useState("");
  const [loading, setLoading]               = useState(true);

  // Fetch setup intent on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: account.email, businessName: account.businessName }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === "email-taken") throw new Error("That email is already registered. Please sign in instead.");
          throw new Error(data.error ?? "Could not initialize payment.");
        }
        if (!cancelled) {
          setClientSecret(data.clientSecret);
          setCustomerId(data.stripeCustomerId);
          setSetupIntentId(null);
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
        <div className="h-28 bg-white/5 rounded-2xl animate-pulse" />
        <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-48 bg-white/5 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (loadError || !clientSecret) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-black text-white">Payment setup</h2>
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {loadError || "Failed to load payment form."}
        </div>
        <div className="flex gap-3">
          <button onClick={onBack} className="px-5 py-3 border border-white/20 text-gray-400 hover:text-white rounded-xl text-sm font-medium transition-colors">
            ← Back
          </button>
          <button onClick={() => window.location.reload()} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#ea580c",
            colorBackground: "#09090b",
            colorText: "#f9fafb",
            colorTextSecondary: "#6b7280",
            borderRadius: "12px",
            fontFamily: "inherit",
          },
        },
      }}
    >
      <PaymentForm
        account={account}
        plan={plan}
        billing={billing}
        stripeCustomerId={stripeCustomerId}
        setupIntentId={setupIntentId}
        onSuccess={onSuccess}
        onBack={onBack}
      />
    </Elements>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("account");

  const [account, setAccount] = useState<AccountFields>({
    name: "",
    email: "",
    businessName: "",
    slug: "",
  });
  const [plan, setPlan]       = useState<Plan>("GROWTH");
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <div className="min-h-screen bg-black">
      {/* Nav */}
      <nav className="border-b border-white/10 px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-orange-600 rounded-md flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-white font-black tracking-tight">BuyBackSite</span>
        </Link>
        <div className="text-sm text-gray-500">
          Already have an account?{" "}
          <a
            href={`${process.env.NEXT_PUBLIC_APP_URL ?? `https://app.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "buybacksite.com"}`}/login`}
            className="text-orange-500 hover:text-orange-400 font-medium"
          >
            Sign in
          </a>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        {step !== "success" && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-green-900/20 border border-green-500/30 text-green-400 text-xs font-semibold px-4 py-2 rounded-full mb-4">
              ✓ 14-day free trial · No credit card until trial ends
            </div>
          </div>
        )}

        {step !== "success" && <StepBar current={step} />}

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-7">
          {step === "account" && (
            <StepAccount
              fields={account}
              onChange={(f) => setAccount((prev) => ({ ...prev, ...f }))}
              onNext={() => setStep("plan")}
            />
          )}

          {step === "plan" && (
            <StepPlan
              selected={plan}
              billing={billing}
              onSelect={setPlan}
              onBillingChange={setBilling}
              onNext={() => setStep("payment")}
              onBack={() => setStep("account")}
            />
          )}

          {step === "payment" && (
            <PaymentStep
              account={account}
              plan={plan}
              billing={billing}
              onSuccess={() => setStep("success")}
              onBack={() => setStep("plan")}
            />
          )}

          {step === "success" && (
            <StepSuccess email={account.email} slug={account.slug} />
          )}
        </div>

        {step !== "success" && (
          <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              SSL secured by Stripe
            </span>
            <span>·</span>
            <span>Cancel before trial ends — no charge</span>
            <span>·</span>
            <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms</Link>
          </div>
        )}
      </div>
    </div>
  );
}
