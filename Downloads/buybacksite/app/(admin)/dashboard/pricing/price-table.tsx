"use client";

import { useState } from "react";

interface PriceRow {
  id: string;
  variantId: string;
  conditionId: string;
  buyPrice: number;
  marketValue: number;
  marginPercent: number;
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

export function PriceTable({ modelName, prices, tenantId }: Props) {
  const [carrierFilter, setCarrierFilter] = useState<string>("ALL");

  if (prices.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <p className="text-gray-500 font-medium">{modelName}</p>
        <p className="text-sm text-gray-400 mt-1">No prices computed yet. Run a sync first.</p>
      </div>
    );
  }

  const carriers = [...new Set(prices.map((p) => p.variant.carrier))];
  const filtered = carrierFilter === "ALL"
    ? prices
    : prices.filter((p) => p.variant.carrier === carrierFilter);

  const grouped = groupByVariant(filtered);
  const conditions = [...new Set(prices.map((p) => p.condition.grade))].sort();

  // Sample last update
  const lastUpdated = prices.reduce((latest, p) => {
    const d = new Date(p.updatedAt);
    return d > latest ? d : latest;
  }, new Date(0));

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{modelName}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Updated {lastUpdated.getTime() > 0 ? lastUpdated.toLocaleString() : "—"}
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
              <tr key={variant.skuCode} className="hover:bg-gray-50 transition-colors">
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
                  return (
                    <td key={g} className="px-5 py-3 font-medium text-gray-800">
                      {row ? fmt(row.buyPrice) : "—"}
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
