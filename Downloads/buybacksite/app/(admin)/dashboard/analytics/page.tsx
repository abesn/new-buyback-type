import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { UserRole, OrderStatus } from "@prisma/client";
import { AnalyticsCharts } from "./analytics-charts";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(num: number, den: number) {
  if (den === 0) return "—";
  return `${Math.round((num / den) * 100)}%`;
}

// Ordered pipeline stages for the funnel
const FUNNEL_STAGES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.SHIPPED,
  OrderStatus.RECEIVED,
  OrderStatus.INSPECTING,
  OrderStatus.OFFER_REVISED,
  OrderStatus.APPROVED,
  OrderStatus.PAID,
  OrderStatus.REJECTED,
  OrderStatus.RETURNED,
  OrderStatus.CANCELLED,
];

const STAGE_LABEL: Record<OrderStatus, string> = {
  PENDING:       "Pending",
  SHIPPED:       "Shipped",
  RECEIVED:      "Received",
  INSPECTING:    "Inspecting",
  OFFER_REVISED: "Offer Revised",
  APPROVED:      "Approved",
  PAID:          "Paid",
  REJECTED:      "Rejected",
  RETURNED:      "Returned",
  CANCELLED:     "Cancelled",
};

const STAGE_COLOR: Record<OrderStatus, string> = {
  PENDING:       "bg-yellow-400",
  SHIPPED:       "bg-blue-400",
  RECEIVED:      "bg-indigo-400",
  INSPECTING:    "bg-purple-400",
  OFFER_REVISED: "bg-orange-400",
  APPROVED:      "bg-teal-400",
  PAID:          "bg-green-500",
  REJECTED:      "bg-red-400",
  RETURNED:      "bg-gray-400",
  CANCELLED:     "bg-gray-300",
};

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isPlatformAdmin = session.user.role === UserRole.PLATFORM_ADMIN;
  const tenantFilter = isPlatformAdmin ? {} : { tenantId: session.user.tenantId! };
  const tenantId = isPlatformAdmin ? null : (session.user.tenantId ?? null);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // ── Parallel queries ────────────────────────────────────────────────────────
  const [
    statusCounts,
    paidAgg,
    ordersThisMonthCount,
    topVariantsRaw,
    monthlyRevenueRaw,
  ] = await Promise.all([
    // 1. Count per status
    db.order.groupBy({
      by: ["status"],
      where: tenantFilter,
      _count: true,
    }),

    // 2. Paid orders aggregate (revenue + avg payout)
    db.order.aggregate({
      where: { ...tenantFilter, status: OrderStatus.PAID },
      _sum: { finalPrice: true, quotedPrice: true },
      _count: true,
      _avg: { finalPrice: true },
    }),

    // 3. Orders created this month
    db.order.count({
      where: { ...tenantFilter, createdAt: { gte: startOfMonth } },
    }),

    // 4. Top 5 variants by order volume
    db.order.groupBy({
      by: ["variantId"],
      where: tenantFilter,
      _count: true,
      orderBy: { _count: { variantId: "desc" } },
      take: 5,
    }),

    // 5. Monthly revenue (raw SQL — last 6 months, PAID orders only)
    tenantId
      ? db.$queryRaw<{ month: string; revenue: number; count: number }[]>`
          SELECT
            TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
            SUM(COALESCE("finalPrice", "quotedPrice"))::float      AS revenue,
            COUNT(*)::int                                          AS count
          FROM "Order"
          WHERE "tenantId" = ${tenantId}
            AND status = 'PAID'
            AND "createdAt" >= ${sixMonthsAgo}
          GROUP BY 1
          ORDER BY 1 ASC`
      : db.$queryRaw<{ month: string; revenue: number; count: number }[]>`
          SELECT
            TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
            SUM(COALESCE("finalPrice", "quotedPrice"))::float      AS revenue,
            COUNT(*)::int                                          AS count
          FROM "Order"
          WHERE status = 'PAID'
            AND "createdAt" >= ${sixMonthsAgo}
          GROUP BY 1
          ORDER BY 1 ASC`,
  ]);

  // ── Enrich top variants ─────────────────────────────────────────────────────
  const variantIds = topVariantsRaw.map((v) => v.variantId);
  const variants = await db.deviceVariant.findMany({
    where: { id: { in: variantIds } },
    include: { model: { include: { brand: true } } },
  });
  const variantMap = Object.fromEntries(variants.map((v) => [v.id, v]));

  const topDevices = topVariantsRaw.map((v) => {
    const variant = variantMap[v.variantId];
    const label = variant
      ? `${variant.model.brand.name} ${variant.model.name}${variant.storageGb ? ` ${variant.storageGb}GB` : ""}`
      : "Unknown";
    return { label, count: v._count };
  });

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r._count]));
  const totalOrders = statusCounts.reduce((s, r) => s + r._count, 0);

  const paidCount = byStatus[OrderStatus.PAID] ?? 0;
  const rejectedCount = byStatus[OrderStatus.REJECTED] ?? 0;
  const cancelledCount = byStatus[OrderStatus.CANCELLED] ?? 0;
  const closedCount = paidCount + rejectedCount + cancelledCount;

  const totalRevenue = Number(paidAgg._sum.finalPrice ?? paidAgg._sum.quotedPrice ?? 0);
  const avgPayout = Number(paidAgg._avg.finalPrice ?? 0);
  const acceptanceRate = pct(paidCount, closedCount);

  const kpis = [
    { label: "Total Revenue", value: fmt(totalRevenue), sub: `${paidCount} paid orders` },
    { label: "Orders This Month", value: ordersThisMonthCount.toString(), sub: now.toLocaleString("default", { month: "long", year: "numeric" }) },
    { label: "Avg Payout", value: avgPayout > 0 ? fmt(avgPayout) : "—", sub: "per paid order" },
    { label: "Acceptance Rate", value: acceptanceRate, sub: `${closedCount} resolved orders` },
    { label: "Total Orders", value: totalOrders.toString(), sub: "all time" },
  ];

  // ── Funnel data ────────────────────────────────────────────────────────────
  const funnelMax = Math.max(...FUNNEL_STAGES.map((s) => byStatus[s] ?? 0), 1);
  const funnelData = FUNNEL_STAGES.filter((s) => (byStatus[s] ?? 0) > 0).map((s) => ({
    status: s,
    label: STAGE_LABEL[s],
    count: byStatus[s] ?? 0,
    pct: Math.max(4, Math.round(((byStatus[s] ?? 0) / funnelMax) * 100)),
    color: STAGE_COLOR[s],
  }));

  // ── Monthly trend — fill missing months with 0 ─────────────────────────────
  const monthLabels: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const revenueByMonth = Object.fromEntries(
    monthlyRevenueRaw.map((r) => [r.month, { revenue: r.revenue, count: r.count }])
  );
  const trendData = monthLabels.map((m) => ({
    month: m,
    label: new Date(m + "-02").toLocaleString("default", { month: "short", year: "2-digit" }),
    revenue: revenueByMonth[m]?.revenue ?? 0,
    count: revenueByMonth[m]?.count ?? 0,
  }));

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isPlatformAdmin ? "Platform-wide statistics" : "Your shop performance"}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide leading-snug">{k.label}</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1 truncate">{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Revenue Trend */}
        <AnalyticsCharts trendData={trendData} />

        {/* Status Funnel */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Order Status Funnel</h2>
          <div className="space-y-2.5">
            {funnelData.map((f) => (
              <div key={f.status} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-28 shrink-0 text-right">{f.label}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${f.color} transition-all`}
                    style={{ width: `${f.pct}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-8 text-right">{f.count}</span>
              </div>
            ))}
            {funnelData.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No order data yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Devices */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Top Devices by Volume</h2>
        {topDevices.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No order data yet.</p>
        ) : (
          <div className="space-y-3">
            {topDevices.map((d, i) => {
              const barPct = Math.max(4, Math.round((d.count / (topDevices[0]?.count ?? 1)) * 100));
              return (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-xs font-medium text-gray-400 w-4 shrink-0">{i + 1}</span>
                  <span className="text-sm text-gray-700 w-56 shrink-0 truncate">{d.label}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-10 text-right">
                    {d.count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
