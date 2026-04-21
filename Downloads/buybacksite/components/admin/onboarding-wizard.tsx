"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  existingNap: {
    businessName: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    phone: string;
  } | null;
  globalMargin: number; // decimal, e.g. 0.65
}

interface NapForm {
  businessName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
}

const TOTAL_STEPS = 3;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : isDone
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {isDone ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step
              )}
            </div>
            {step < TOTAL_STEPS && (
              <div className={`w-10 h-0.5 ${step < current ? "bg-blue-200" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

export function OnboardingWizard({ tenantId, tenantName, tenantSlug, existingNap, globalMargin }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [nap, setNap] = useState<NapForm>({
    businessName: existingNap?.businessName ?? tenantName,
    streetAddress: existingNap?.streetAddress ?? "",
    city: existingNap?.city ?? "",
    state: existingNap?.state ?? "",
    zipCode: existingNap?.zipCode ?? "",
    phone: existingNap?.phone ?? "",
  });

  // Step 2 state — slider value as percentage integer (30–85)
  const initialMarginPct = Math.round(globalMargin * 100);
  const [marginPct, setMarginPct] = useState(
    Math.min(85, Math.max(30, initialMarginPct))
  );

  const siteUrl = `${tenantSlug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "buybacksite.com"}`;
  const exampleOffer = Math.round(200 * (marginPct / 100));

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/nap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, ...nap }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save business info.");
      }
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStep2Submit() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, marginPercent: marginPct / 100 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save pricing.");
      }
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-blue-600 tracking-tight">BuyBackSite</span>
          <p className="text-sm text-gray-500 mt-1">Let&apos;s get your shop set up</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <StepIndicator current={step} />

          {/* ─── Step 1: Business Info ─── */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit} noValidate>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900">Business Information</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Step 1 of 3 — This info appears on your public site and helps with local SEO.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <FieldGroup label="Business Name">
                  <input
                    className={inputCls}
                    placeholder="e.g. Quick Buyback Co."
                    value={nap.businessName}
                    onChange={(e) => setNap({ ...nap, businessName: e.target.value })}
                    required
                  />
                </FieldGroup>

                <FieldGroup label="Street Address">
                  <input
                    className={inputCls}
                    placeholder="123 Main St"
                    value={nap.streetAddress}
                    onChange={(e) => setNap({ ...nap, streetAddress: e.target.value })}
                    required
                  />
                </FieldGroup>

                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="City">
                    <input
                      className={inputCls}
                      placeholder="Austin"
                      value={nap.city}
                      onChange={(e) => setNap({ ...nap, city: e.target.value })}
                      required
                    />
                  </FieldGroup>
                  <FieldGroup label="State">
                    <input
                      className={inputCls}
                      placeholder="TX"
                      maxLength={2}
                      value={nap.state}
                      onChange={(e) => setNap({ ...nap, state: e.target.value.toUpperCase() })}
                      required
                    />
                  </FieldGroup>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="ZIP Code">
                    <input
                      className={inputCls}
                      placeholder="78701"
                      value={nap.zipCode}
                      onChange={(e) => setNap({ ...nap, zipCode: e.target.value })}
                      required
                    />
                  </FieldGroup>
                  <FieldGroup label="Phone">
                    <input
                      className={inputCls}
                      type="tel"
                      placeholder="(512) 555-0100"
                      value={nap.phone}
                      onChange={(e) => setNap({ ...nap, phone: e.target.value })}
                      required
                    />
                  </FieldGroup>
                </div>
              </div>

              {error && (
                <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  {error}
                </p>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white rounded-xl py-3 px-6 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition"
                >
                  {saving ? "Saving…" : "Next: Set Margin →"}
                </button>
              </div>
            </form>
          )}

          {/* ─── Step 2: Buying Margin ─── */}
          {step === 2 && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900">Set Your Buying Margin</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Step 2 of 3 — Choose how much of market value you offer sellers.
                </p>
              </div>

              {/* Big margin display */}
              <div className="flex flex-col items-center py-6 mb-6 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-5xl font-bold text-blue-600">{marginPct}%</span>
                <p className="text-sm text-gray-500 mt-2">of estimated market value</p>
              </div>

              {/* Slider */}
              <div className="mb-2">
                <input
                  type="range"
                  min={30}
                  max={85}
                  step={1}
                  value={marginPct}
                  onChange={(e) => setMarginPct(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>30% (conservative)</span>
                  <span>85% (aggressive)</span>
                </div>
              </div>

              {/* Live example */}
              <div className="mt-5 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700">
                <span className="font-medium">Live example:</span> If a device sells for{" "}
                <span className="font-semibold">$200</span> on eBay, you&apos;ll offer{" "}
                <span className="font-semibold text-blue-600">${exampleOffer}</span>.
              </div>

              {error && (
                <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  {error}
                </p>
              )}

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleStep2Submit}
                  className="bg-blue-600 text-white rounded-xl py-3 px-6 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition"
                >
                  {saving ? "Saving…" : "Next: Finish →"}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 3: All Set ─── */}
          {step === 3 && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900">You&apos;re all set!</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Step 3 of 3 — Your shop is ready to go.
                </p>
              </div>

              {/* Success icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Site URL card */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-5">
                <p className="text-xs text-blue-500 font-medium uppercase tracking-wide mb-1">Your public site</p>
                <a
                  href={`https://${siteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 font-semibold text-base hover:underline break-all"
                >
                  {siteUrl}
                </a>
                <p className="text-xs text-gray-500 mt-2">
                  Share this link with sellers. You can add a custom domain later in Settings.
                </p>
              </div>

              {/* What's next */}
              <ul className="space-y-3 mb-6">
                {[
                  "Your buying margin is set and pricing is live.",
                  "Add your device catalog from the Pricing page.",
                  "Customize your domain in Settings anytime.",
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="mt-0.5 w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="w-full bg-blue-600 text-white rounded-xl py-3 px-6 text-sm font-medium hover:bg-blue-700 transition"
                >
                  Go to Dashboard
                </button>
                <a
                  href={`https://${siteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center border border-gray-300 text-gray-700 rounded-xl py-3 px-6 text-sm font-medium hover:bg-gray-50 transition"
                >
                  View Your Public Site ↗
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Step label footer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Step {step} of {TOTAL_STEPS}
        </p>
      </div>
    </div>
  );
}
