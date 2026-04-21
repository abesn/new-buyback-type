"use client";

interface TrendPoint {
  month: string;
  label: string;
  revenue: number;
  count: number;
}

interface Props {
  trendData: TrendPoint[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function AnalyticsCharts({ trendData }: Props) {
  const maxRevenue = Math.max(...trendData.map((d) => d.revenue), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Monthly Revenue</h2>
      <p className="text-xs text-gray-400 mb-5">Paid orders — last 6 months</p>

      {trendData.every((d) => d.revenue === 0) ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          No paid orders yet.
        </div>
      ) : (
        <div className="flex items-end gap-2 h-40">
          {trendData.map((d) => {
            const heightPct = Math.max(4, Math.round((d.revenue / maxRevenue) * 100));
            return (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group">
                {/* Tooltip */}
                <div className="relative flex flex-col items-center">
                  <div className="absolute bottom-full mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                      <p className="font-medium">{fmt(d.revenue)}</p>
                      <p className="text-gray-400">{d.count} order{d.count !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
                  </div>
                  <div
                    className="w-full bg-blue-500 rounded-t-sm group-hover:bg-blue-600 transition-colors cursor-default"
                    style={{ height: `${heightPct * 1.4}px` }}
                  />
                </div>
                <span className="text-xs text-gray-400 truncate w-full text-center">{d.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Y-axis reference line at bottom */}
      <div className="border-t border-gray-100 mt-1 pt-2 flex justify-between">
        <span className="text-xs text-gray-400">$0</span>
        <span className="text-xs text-gray-400">{fmt(maxRevenue)}</span>
      </div>
    </div>
  );
}
