"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { OrderStatus } from "@prisma/client";

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

const ALL_STATUSES = Object.values(OrderStatus);

interface OrderItem {
  deviceName: string;
  storageGb: number;
  carrier: string;
  conditionLabel: string;
  grade: string;
  quotedPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  sellerName: string;
  sellerEmail: string;
  status: OrderStatus;
  quotedPrice: number;
  finalPrice: number | null;
  createdAt: string;
  payoutMethod: string;
  tenant: { name: string; slug: string };
  items: OrderItem[];
}

interface Props {
  orders: Order[];
  total: number;
  page: number;
  pages: number;
  statusCounts: Record<string, number>;
  currentStatus?: OrderStatus;
  isPlatformAdmin: boolean;
}

function fmt(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

export function OrdersTable({ orders, total, page, pages, statusCounts, currentStatus, isPlatformAdmin }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setStatus = (s: string | null) => {
    const p = new URLSearchParams(searchParams.toString());
    if (s) p.set("status", s); else p.delete("status");
    p.delete("page");
    router.push(`/dashboard/orders?${p.toString()}`);
  };

  const setPage = (n: number) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("page", n.toString());
    router.push(`/dashboard/orders?${p.toString()}`);
  };

  const activeCount = (ALL_STATUSES as string[]).includes(currentStatus ?? "") ? statusCounts[currentStatus!] ?? 0 : total;

  return (
    <div>
      {/* Status filter tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        <button
          onClick={() => setStatus(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!currentStatus ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
        >
          All <span className="ml-1 opacity-60">{total}</span>
        </button>
        {ALL_STATUSES.map((s) => {
          const count = statusCounts[s] ?? 0;
          if (count === 0 && currentStatus !== s) return null;
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${currentStatus === s ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ")}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-5 py-3 text-xs font-medium text-gray-500">Order #</th>
              <th className="px-5 py-3 text-xs font-medium text-gray-500">Seller</th>
              {isPlatformAdmin && <th className="px-5 py-3 text-xs font-medium text-gray-500">Shop</th>}
              <th className="px-5 py-3 text-xs font-medium text-gray-500">Device(s)</th>
              <th className="px-5 py-3 text-xs font-medium text-gray-500">Status</th>
              <th className="px-5 py-3 text-xs font-medium text-gray-500">Quoted</th>
              <th className="px-5 py-3 text-xs font-medium text-gray-500">Payout</th>
              <th className="px-5 py-3 text-xs font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.length === 0 && (
              <tr>
                <td colSpan={isPlatformAdmin ? 8 : 7} className="px-5 py-12 text-center text-gray-400">
                  No orders {currentStatus ? `with status "${currentStatus}"` : "yet"}.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr
                key={o.id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/orders/${o.orderNumber}`)}
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/dashboard/orders/${o.orderNumber}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-xs text-blue-600 font-medium hover:underline"
                  >
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-800">{o.sellerName}</p>
                  <p className="text-xs text-gray-400">{o.sellerEmail}</p>
                </td>
                {isPlatformAdmin && <td className="px-5 py-3 text-xs text-gray-500">{o.tenant.name}</td>}
                <td className="px-5 py-3">
                  {o.items.length === 0 ? (
                    <span className="text-xs text-gray-400">—</span>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-800 leading-snug">
                        {o.items[0].deviceName} {o.items[0].storageGb >= 1024 ? "1TB" : `${o.items[0].storageGb}GB`}
                      </p>
                      {o.items.length > 1 ? (
                        <p className="text-xs text-blue-600 font-medium">+{o.items.length - 1} more device{o.items.length > 2 ? "s" : ""}</p>
                      ) : (
                        <p className="text-xs text-gray-400">{o.items[0].conditionLabel}</p>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[o.status]}`}>
                    {o.status.charAt(0) + o.status.slice(1).toLowerCase().replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-700">{fmt(o.quotedPrice)}</td>
                <td className="px-5 py-3 text-xs text-gray-500 capitalize">{o.payoutMethod.toLowerCase()}</td>
                <td className="px-5 py-3 text-xs text-gray-400">
                  {new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, activeCount)} of {activeCount}
            </p>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Prev
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
