"use client";

import { useState, useRef } from "react";

interface PriceRow {
  id: string;
  variantId: string;
  conditionId: string;
  buyPrice: number;
  marketValue: number;
  marginPercent: number;
  manualOverride: boolean;
  updatedAt: Date | string;
  variant: {
    storageGb: number;
    carrier: string;
    skuCode: string;
  };
  condition: {
    grade: string;
    label: string;
    multiplier: number;
  };
}

interface Props {
  modelName: string;
  prices: PriceRow[];
  tenantId: string | null;
}

const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-yellow-100 text-yellow-800",
  D: "bg-red-100 text-red-800",
};

const CARRIER_LABELS: Record<string, string> = {
  UNLOCKED: "Unlocked",
  ATT: "AT&T",
  TMOBILE: "T-Mobile",
  VERIZON: "Verizon",
  SPRINT: "Sprint",
  OTHER: "Other",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function groupByVariant(prices: PriceRow[]) {
  const map = new Map<string, { variant: PriceRow["variant"]; conditions: PriceRow[] }>();
  for (const p of prices) {
    const key = p.variantId;
    if (!map.has(key)) {
      map.set(key, { variant: p.variant, conditions: [] });
    }
    map.get(key)!.conditions.push(p);
  }
  return [...map.values()];
}

// ─── Inline edit cell ─────────────────────────────────────────────────────────

interface PriceCellProps {
  row: PriceRow;
  canEdit: boolean;
  onSaved: (id: string, newPrice: number, isManual: boolean) => void;
}

function PriceCell({ row, canEdit, onSaved }: PriceCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.buyPrice.toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setValue(row.buyPrice.toFixed(2));
    setEditing(true);
    setError("");
    setTimeout(() => inputRef.current?.select(), 10);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError("");
  };

  const save = async () => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) { setError("Enter a valid price"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pricing/override", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: row.id, buyPrice: num }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSaved(row.id, data.buyPrice, true);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const clearOverride = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/pricing/override?priceId=${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      onSaved(row.id, row.buyPrice, false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-gray-400 text-xs">$</span>
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          className="w-20 border border-blue-400 rounded px-1.5 py-0.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancelEdit();
          }}
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-green-600 hover:text-green-700 disabled:opacity-50"
          title="Save"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600" title="Cancel">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {error && <span className="text-xs text-red-500 ml-1">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group min-w-0">
      <span className={`font-medium ${row.manualOverride ? "text-orange-600" : "text-gray-800"}`}>
        {fmt(row.buyPrice)}
      </span>
      {row.manualOverride && (
        <span
          className="text-xs bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-medium cursor-pointer"
          onClick={clearOverride}
          title="Manual override — click to reset to auto"
        >
          manual
        </span>
      )}
      {canEdit && !saving && (
        <button
          onClick={startEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-600"
          title="Override price"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 013.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}
      {saving && <span className="text-xs text-gray-400 animate-pulse">saving…</span>}
    </div>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

export function PriceTable({ modelName, prices: initialPrices, tenantId }: Props) {
  const [prices, setPrices] = useState<PriceRow[]>(initialPrices);
  const [carrierFilter, setCarrierFilter] = useState<string>("ALL");

  const canEdit = tenantId !== null; // Platform admin view is read-only

  const handleSaved = (id: string, newPrice: number, isManual: boolean) => {
    setPrices((prev) =>
      prev.map((p) => (p.id === id ? { ...p, buyPrice: newPrice, manualOverride: isManual } : p))
    );
  };

  const carriers = [...new Set(prices.map((p) => p.variant.carrier))];
  const filtered =
    carrierFilter === "ALL" ? prices : prices.filter((p) => p.variant.carrier === carrierFilter);
  const grouped = groupByVariant(filtered);
  const conditions = [...new Set(prices.map((p) => p.condition.grade))].sort();

  const lastUpdated = prices.reduce((latest, p) => {
    const d = new Date(p.updatedAt);
    return d > latest ? d : latest;
  }, new Date(0));

  const manualCount = prices.filter((p) => p.manualOverride).length;

  if (prices.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
        No prices synced for this model yet. Run a price sync from the Pricing Engine.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{modelName}</h3>
            {manualCount > 0 && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                {manualCount} manual override{manualCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Updated {lastUpdated.getTime() > 0 ? lastUpdated.toLocaleString() : "—"}
            {canEdit && <span className="ml-2 text-gray-300">· Hover a price to edit</span>}
          </p>
        </div>
        {carriers.length > 1 && (
          <div className="flex gap-1">
            <button
              onClick={() => setCarrierFilter("ALL")}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${carrierFilter === "ALL" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              All
            </button>
            {carriers.map((c) => (
              <button
                key={c}
                onClick={() => setCarrierFilter(c)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${carrierFilter === c ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {CARRIER_LABELS[c] ?? c}
              </button>
            ))}
          </div>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-left">
            <th className="px-5 py-2.5 text-xs font-medium text-gray-500">Storage</th>
            {carriers.length > 1 && (
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500">Carrier</th>
            )}
            <th className="px-5 py-2.5 text-xs font-medium text-gray-500">Market Value</th>
            {conditions.map((g) => (
              <th key={g} className="px-5 py-2.5 text-xs font-medium text-gray-500">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${GRADE_COLORS[g] ?? "bg-gray-100 text-gray-600"}`}>
                  Grade {g}
                </span>
              </th>
            ))}
            <th className="px-5 py-2.5 text-xs font-medium text-gray-500">Margin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {grouped.map(({ variant, conditions: conds }) => {
            const byGrade = Object.fromEntries(conds.map((c) => [c.condition.grade, c]));
            const sample = conds[0];
            return (
              <tr key={variant.skuCode} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-5 py-3 font-medium text-gray-800">
                  {variant.storageGb >= 1024 ? "1TB" : `${variant.storageGb}GB`}
                </td>
                {carriers.length > 1 && (
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {CARRIER_LABELS[variant.carrier] ?? variant.carrier}
                  </td>
                )}
                <td className="px-5 py-3 text-gray-600">
                  {sample ? fmt(sample.marketValue) : "—"}
                </td>
                {conditions.map((g) => {
                  const row = byGrade[g];
                  if (!row) return <td key={g} className="px-5 py-3 text-gray-300">—</td>;
                  return (
                    <td key={g} className="px-5 py-3">
                      <PriceCell row={row} canEdit={canEdit} onSaved={handleSaved} />
                    </td>
                  );
                })}
                <td className="px-5 py-3 text-xs text-gray-400">
                  {sample ? `${Math.round(sample.marginPercent * 100)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
