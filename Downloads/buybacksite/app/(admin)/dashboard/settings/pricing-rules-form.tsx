"use client";

import { useState } from "react";

interface Props {
  tenantId: string;
  globalMargin: number;
}

export function PricingRulesForm({ tenantId, globalMargin }: Props) {
  const [margin, setMargin] = useState(Math.round(globalMargin * 100));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/settings/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, marginPercent: margin / 100 }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Global Margin: <span className="text-blue-600 font-semibold">{margin}%</span> of market value
        </label>
        <input
          type="range"
          min={10}
          max={90}
          step={5}
          value={margin}
          onChange={(e) => setMargin(parseInt(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>10% (aggressive)</span>
          <span>90% (generous)</span>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Example: If a device sells on eBay for $200, you offer{" "}
        <strong>${((200 * margin) / 100).toFixed(0)}</strong> to the seller.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving ? "Saving..." : "Save Pricing Rules"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </form>
  );
}
