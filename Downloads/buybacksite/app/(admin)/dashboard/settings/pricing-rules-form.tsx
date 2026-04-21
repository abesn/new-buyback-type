"use client";

import { useState } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  tenantId: string;
  globalMargin: number;
  categories: Category[];
  /** categoryId → 0–1 margin (only rows that have an explicit override) */
  categoryMargins: Record<string, number>;
}

const CATEGORY_ICONS: Record<string, string> = {
  smartphone: "📱",
  tablet: "📟",
  laptop: "💻",
};

function MarginSlider({
  label,
  icon,
  value,
  onChange,
  inherited,
  onClear,
}: {
  label: string;
  icon?: string;
  value: number;          // 0–100
  onChange: (v: number) => void;
  inherited?: number;     // show inherited value from global when this is an override
  onClear?: () => void;   // present only when this is a category override
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
          {icon && <span>{icon}</span>}
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-blue-600 tabular-nums w-9 text-right">
            {value}%
          </span>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              title="Reset to global default"
            >
              ✕ reset
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={10}
        max={90}
        step={5}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>10% (aggressive)</span>
        {inherited !== undefined && (
          <span className="text-gray-400">
            Global: {inherited}%
          </span>
        )}
        <span>90% (generous)</span>
      </div>
    </div>
  );
}

export function PricingRulesForm({
  tenantId,
  globalMargin,
  categories,
  categoryMargins,
}: Props) {
  const [global, setGlobal] = useState(Math.round(globalMargin * 100));

  // categoryId → number (0-100) | null (null = use global, no override)
  const [catOverrides, setCatOverrides] = useState<Record<string, number | null>>(() => {
    const init: Record<string, number | null> = {};
    for (const cat of categories) {
      init[cat.id] =
        categoryMargins[cat.id] !== undefined
          ? Math.round(categoryMargins[cat.id] * 100)
          : null;
    }
    return init;
  });

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const activeOverrides = Object.values(catOverrides).filter((v) => v !== null).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    const categoryRules = categories
      .filter((c) => catOverrides[c.id] !== null)
      .map((c) => ({
        categoryId: c.id,
        marginPercent: (catOverrides[c.id] as number) / 100,
      }));

    // categoryIds that had overrides before but are now cleared
    const clearCategoryIds = categories
      .filter((c) => catOverrides[c.id] === null && categoryMargins[c.id] !== undefined)
      .map((c) => c.id);

    try {
      const res = await fetch("/api/settings/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          marginPercent: global / 100,
          categoryRules,
          clearCategoryIds,
        }),
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

  const exampleMarket = 200;

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Global margin */}
      <div className="p-5 space-y-4">
        <MarginSlider
          label="Global Margin (all devices)"
          value={global}
          onChange={setGlobal}
        />
        <p className="text-xs text-gray-500">
          Example: A device with a <strong>$200</strong> market value → you offer{" "}
          <strong className="text-blue-600">${((exampleMarket * global) / 100).toFixed(0)}</strong> to the seller.
        </p>
      </div>

      {/* Per-category overrides */}
      <div className="border-t border-gray-100">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            Per-category overrides
            {activeOverrides > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                {activeOverrides} active
              </span>
            )}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div className="px-5 pb-5 space-y-5 border-t border-gray-50 pt-4">
            <p className="text-xs text-gray-500">
              Override the global margin for a specific device category. Leave unset to inherit the global rate.
            </p>
            {categories.map((cat) => {
              const override = catOverrides[cat.id];
              const isOverriding = override !== null;
              const displayValue = isOverriding ? override : global;

              return (
                <div key={cat.id} className={`rounded-lg p-3 border ${isOverriding ? "border-blue-200 bg-blue-50/40" : "border-gray-100 bg-gray-50/50"}`}>
                  {isOverriding ? (
                    <MarginSlider
                      label={cat.name}
                      icon={CATEGORY_ICONS[cat.slug] ?? "📦"}
                      value={displayValue}
                      onChange={(v) => setCatOverrides((prev) => ({ ...prev, [cat.id]: v }))}
                      inherited={global}
                      onClear={() => setCatOverrides((prev) => ({ ...prev, [cat.id]: null }))}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                        <span>{CATEGORY_ICONS[cat.slug] ?? "📦"}</span>
                        {cat.name}
                        <span className="text-gray-400 font-normal">· inherits global ({global}%)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCatOverrides((prev) => ({ ...prev, [cat.id]: global }));
                          setExpanded(true);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        + override
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
        {error && <p className="text-sm text-red-600 flex-1">{error}</p>}
        <div className="flex items-center gap-3 ml-auto">
          {saved && <span className="text-sm text-green-600">Saved!</span>}
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving…" : "Save Pricing Rules"}
          </button>
        </div>
      </div>
    </form>
  );
}
