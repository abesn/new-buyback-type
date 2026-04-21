import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { UserRole, OrderStatus } from "@prisma/client";
import Link from "next/link";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const statusColors: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  SHIPPED: "bg-blue-100 text-blue-800",
  RECEIVED: "bg-indigo-100 text-indigo-800",
  INSPECTING: "bg-purple-100 text-purple-800",
  OFFER_REVISED: "bg-orange-100 text-orange-800",
  APPROVED: "bg-teal-100 text-teal-800",
  PAID: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  RETURNED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-gray-100 text-gray-400",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isPlatformAdmin = session.user.role === UserRole.PLATFORM_ADMIN;
  const tenantFilter = isPlatformAdmin ? {} : { tenantId: session.user.tenantId! };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalOrders,
    pendingOrders,
    ordersThisMonth,
    recentOrders,
    tenantCount,
  ] = await Promise.all([
    db.order.count({ where: tenantFilter }),
    db.order.count({ where: { ...tenantFilter, status: { in: [OrderStatus.PENDING, OrderStatus.SHIPPED, OrderStatus.RECEIVED, OrderStatus.INSPECTING] } } }),
    db.order.aggregate({
      where: { ...tenantFilter, createdAt: { gte: startOfMonth }, status: { notIn: [OrderStatus.REJECTED, OrderStatus.CANCELLED, OrderStatus.RETURNED] } },
      _sum: { quotedPrice: true },
      _count: true,
    }),
    db.order.findMany({
      where: tenantFilter,
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { tenant: { select: { name: true } } },
    }),
    isPlatformAdmin ? db.tenant.count() : Promise.resolve(null),
  ]);

  const revenueThisMonth = Number(ordersThisMonth._sum.quotedPrice ?? 0);

  const stats = [
    { label: "Total Orders", value: totalOrders.toString(), sub: "all time" },
    { label: "Active Orders", value: pendingOrders.toString(), sub: "in progress" },
    { label: "Orders This Month", value: ordersThisMonth._count.toString(), sub: new Date().toLocaleString("default", { month: "long" }) },
    { label: "Revenue This Month", value: formatCurrency(revenueThisMonth), sub: "quoted value" },
    ...(isPlatformAdmin ? [{ label: "Total Tenants", value: (tenantCount as number).toString(), sub: "on platform" }] : []),
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back, {session.user.name ?? session.user.email}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Recent Orders</h2>
          <Link href="/dashboard/orders" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500">Order</th>
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500">Seller</th>
              {isPlatformAdmin && <th className="px-5 py-2.5 text-xs font-medium text-gray-500">Shop</th>}
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500">Status</th>
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500">Quoted</th>
              <th className="px-5 py-2.5 text-xs font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recentOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-400">No orders yet.</td>
              </tr>
            )}
            {recentOrders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-gray-700">{o.orderNumber}</td>
                <td className="px-5 py-3 text-gray-700">{o.sellerName}</td>
                {isPlatformAdmin && <td className="px-5 py-3 text-gray-500 text-xs">{o.tenant.name}</td>}
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[o.status]}`}>
                    {o.status.charAt(0) + o.status.slice(1).toLowerCase().replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-700">{formatCurrency(Number(o.quotedPrice))}</td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
