"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  "account-cancelled": "Your account has been cancelled. Please contact support.",
  OAuthAccountNotLinked: "This email is linked to a different sign-in method.",
  EmailSignin: "There was a problem sending your login email. Please try again.",
  default: "Something went wrong. Please try again.",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const isVerifyRequest = searchParams.get("verify") === "true";
  const errorParam = searchParams.get("error");
  const errorMessage = errorParam
    ? ERROR_MESSAGES[errorParam] ?? ERROR_MESSAGES.default
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;

    setLoading(true);
    await signIn("email", {
      email,
      callbackUrl,
      redirect: false,
    });
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
            <span className="text-white font-bold text-xl">B</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">BuyBackSite</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {errorMessage && (
            <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {isVerifyRequest || submitted ? (
            // Success state
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500">
                We sent a sign-in link to <strong>{email || "your email"}</strong>.
                Click the link to sign in — it expires in 1 hour.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 text-sm text-blue-600 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            // Login form
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourbusiness.com"
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
              >
                {loading ? "Sending link..." : "Send sign-in link"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          No password needed — we&apos;ll email you a secure link.
        </p>
      </div>
    </div>
  );
}
