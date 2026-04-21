"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TrackOrderForm() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = orderNumber.trim().toUpperCase();
    if (!trimmed) return;
    router.push("/order/" + trimmed);
  }

  return (
    <div className="bg-black min-h-screen pt-16">
      <div className="max-w-lg mx-auto px-4 py-16">
        {/* Heading */}
        <div className="mb-8 text-center">
          <span className="inline-block bg-orange-600/20 text-orange-500 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
            Order Tracking
          </span>
          <h1 className="text-white font-black text-4xl mb-3">
            Where&apos;s my order?
          </h1>
          <p className="text-gray-400 text-base leading-relaxed">
            Enter your order number to check the current status and shipping
            details.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. ORD-ABC123"
            className="bg-white/5 border border-white/20 text-white placeholder:text-gray-600 rounded-xl px-5 py-4 text-base focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 w-full"
          />
          <button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl transition-colors text-base mt-4"
          >
            Track Order &rarr;
          </button>
        </form>

        {/* Help blurb */}
        <p className="text-xs text-gray-600 text-center mt-4">
          Your order number was emailed to you when you submitted your quote. It
          looks like ORD-XXXXXXXX.
        </p>
      </div>
    </div>
  );
}
