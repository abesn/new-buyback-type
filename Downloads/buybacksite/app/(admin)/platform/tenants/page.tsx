import { db } from "@/lib/db";
import { TenantStatus, TenantPlan } from "@prisma/client";
import { CreateTenantDialog } from "./create-tenant-dialog";

const planLabels: Record<TenantPlan, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  PRO: "Pro",
};

const statusColors: Record<TenantStatus, string> = {
  TRIAL: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-green-100 text-green-800",
  PAST_DUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function TenantsPage() {
  const tenants = await db.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, orders: true } },
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">All Tenants</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tenants.length} tenant{tenants.length !== 1 ? "s" : ""} on the platform</p>
        </div>
        <CreateTenantDialog />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Shop</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Slug</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Plan</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Users</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Orders</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No tenants yet. Create the first one.
                </td>
              </tr>
            )}
            {tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{t.slug}</td>
                <td className="px-4 py-3 text-gray-600">{planLabels[t.plan]}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[t.status]}`}>
                    {t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{t._count.users}</td>
                <td className="px-4 py-3 text-gray-600">{t._count.orders}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
