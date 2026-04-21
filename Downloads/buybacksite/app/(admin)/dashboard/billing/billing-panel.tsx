"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "{SUPPORT_EMAIL}";

const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter — $49/mo",
  GROWTH:  "Growth — $99/mo",
  PRO:     "Pro — $199/mo",
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  TRIAL:     { label: "Free Trial",  color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  ACTIVE:    { label: "Active",      color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200"  },
  PAST_DUE:  { label: "Past Due",    color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200"},
  CANCELLED: { label: "Cancelled",   color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200"   },
};

interface Props {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  hasSubscription: boolean;
}

export function BillingPanel({ plan, status, trialEndsAt, hasSubscription }: Props) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const statusMeta = STATUS_META[status] ?? STATUS_META.ACTIVE;

  const trialEnd = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const handleCancel = async () => {
    setCancelling(true);
    setError("");
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Cancellation failed");
      setCancelled(true);
      setShowConfirm(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  if (cancelled || status === "CANCELLED") {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-red-700 mb-1">Account Cancelled</p>
          <p className="text-sm text-red-600">
            Your account has been cancelled. You can no longer access the dashboard after your current period ends.
            To reactivate, please contact{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current plan card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5 uppercase tracking-widest font-semibold">Current Plan</p>
            <p className="text-lg font-bold text-gray-900">{PLAN_LABELS[plan] ?? plan}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusMeta.color} ${statusMeta.bg} ${statusMeta.border}`}>
            {statusMeta.label}
          </span>
        </div>

        {/* Trial progress */}
        {status === "TRIAL" && trialEnd && daysLeft !== null && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-green-800">Free Trial Active</p>
              <p className="text-sm font-bold text-green-700">{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</p>
            </div>
            <div className="w-full bg-green-100 rounded-full h-2 mb-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.max(5, ((14 - (daysLeft ?? 0)) / 14) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-green-700">
              Your card will be charged <strong>${plan === "STARTER" ? "49" : plan === "GROWTH" ? "99" : "199"}/month</strong> on{" "}
              <strong>{trialEnd}</strong> unless you cancel before then.
            </p>
          </div>
        )}

        {status === "PAST_DUE" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <p className="font-semibold mb-1">Payment Failed</p>
            <p>We couldn&apos;t charge your card. Please update your payment method to keep your account active.</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-2 inline-block text-yellow-700 underline text-xs"
            >
              Contact support
            </a>
          </div>
        )}
      </div>

      {/* Cancel trial section — only show when in trial */}
      {status === "TRIAL" && !showConfirm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-1">Cancel Trial</p>
          <p className="text-sm text-gray-500 mb-4">
            You won&apos;t be charged. Cancelling removes your access immediately and your storefront will go offline.
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 text-sm border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
          >
            Cancel Free Trial
          </button>
        </div>
      )}

      {/* Cancel subscription (active) */}
      {status === "ACTIVE" && hasSubscription && !showConfirm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-1">Cancel Subscription</p>
          <p className="text-sm text-gray-500 mb-4">
            Your subscription will remain active until the end of the current billing period. After that, your storefront will be taken offline.
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 text-sm border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
          >
            Cancel Subscription
          </button>
        </div>
      )}

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-4">
          <div>
            <p className="text-sm font-bold text-red-800 mb-1">
              Are you sure you want to cancel?
            </p>
            <p className="text-sm text-red-700">
              {status === "TRIAL"
                ? "Your trial will end immediately and your storefront will go offline. No charges will be made."
                : "Your subscription will cancel at the end of your billing period. Your storefront will go offline after that."}
            </p>
          </div>

          {error && <p className="text-sm text-red-700 font-medium">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              disabled={cancelling}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Keep My Account
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? "Cancelling…" : "Yes, Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* Contact */}
      <p className="text-xs text-gray-400">
        Questions about your billing?{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 hover:underline">
          Contact support
        </a>
      </p>
    </div>
  );
}
