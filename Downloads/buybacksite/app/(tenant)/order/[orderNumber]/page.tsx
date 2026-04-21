import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

const CARRIER_LABELS: Record<string, string> = {
  UNLOCKED: "Unlocked",
  ATT: "AT&T",
  TMOBILE: "T-Mobile",
  VERIZON: "Verizon",
  SPRINT: "Sprint",
  OTHER: "Other",
};

const STATUS_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  PENDING: { label: "Awaiting Shipment", color: "text-yellow-700 bg-yellow-50 border-yellow-200", desc: "Please ship your device to us." },
  SHIPPED: { label: "In Transit", color: "text-blue-700 bg-blue-50 border-blue-200", desc: "We'll notify you when it arrives." },
  RECEIVED: { label: "Received", color: "text-indigo-700 bg-indigo-50 border-indigo-200", desc: "Your device arrived. Inspection coming up." },
  INSPECTING: { label: "Under Inspection", color: "text-purple-700 bg-purple-50 border-purple-200", desc: "We're verifying the condition." },
  OFFER_REVISED: { label: "Revised Offer Sent", color: "text-orange-700 bg-orange-50 border-orange-200", desc: "Check your email for our updated offer." },
  APPROVED: { label: "Approved — Payment Queued", color: "text-teal-700 bg-teal-50 border-teal-200", desc: "Payment is being processed." },
  PAID: { label: "Paid!", color: "text-green-700 bg-green-50 border-green-200", desc: "Your payment has been sent. Thank you!" },
  REJECTED: { label: "Rejected", color: "text-red-700 bg-red-50 border-red-200", desc: "Unfortunately we couldn't accept this device. Check your email for details." },
  RETURNED: { label: "Returned", color: "text-gray-700 bg-gray-50 border-gray-200", desc: "Your device has been shipped back to you." },
  CANCELLED: { label: "Cancelled", color: "text-gray-500 bg-gray-50 border-gray-200", desc: "This order was cancelled." },
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default async function OrderStatusPage({
  params,
}: {
  params: { orderNumber: string };
}) {
  const headersList = headers();
  const slug = headersList.get("x-tenant-slug");
  const domain = headersList.get("x-tenant-domain");

  // Resolve tenant
  let tenantId: string | null = null;
  if (slug) {
    const t = await db.tenant.findUnique({ where: { slug }, select: { id: true } });
    tenantId = t?.id ?? null;
  } else if (domain) {
    const ds = await db.domainSettings.findFirst({
      where: { customDomain: domain },
      select: { tenantId: true },
    });
    tenantId = ds?.tenantId ?? null;
  }

  const order = await db.order.findUnique({
    where: {
      orderNumber: params.orderNumber,
      ...(tenantId ? { tenantId } : {}),
    },
    include: {
      tenant: { include: { napSettings: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) notFound();

  const variant = await db.deviceVariant.findUnique({
    where: { id: order.variantId },
    include: { model: true },
  });

  const condition = await db.deviceCondition.findUnique({
    where: { id: order.conditionId },
  });

  const statusInfo = STATUS_LABELS[order.status] ?? { label: order.status, color: "text-gray-700 bg-gray-50 border-gray-200", desc: "" };
  const nap = order.tenant.napSettings;
  const storageGb = variant?.storageGb ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xs">B</span>
        </div>
        <span className="text-sm font-semibold text-gray-900">{order.tenant.name}</span>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-4">
        {/* Status card */}
        <div className={`border rounded-2xl p-5 ${statusInfo.color}`}>
          <p className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">Order status</p>
          <p className="text-xl font-bold">{statusInfo.label}</p>
          <p className="text-sm mt-1 opacity-80">{statusInfo.desc}</p>
        </div>

        {/* Order summary */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Order number</p>
              <p className="font-mono font-bold text-gray-900 text-lg">{order.orderNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-gray-900">{fmt(Number(order.quotedPrice))}</p>
              {order.finalPrice && Number(order.finalPrice) !== Number(order.quotedPrice) && (
                <p className="text-sm text-orange-600 font-medium">Final: {fmt(Number(order.finalPrice))}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5 text-sm text-gray-600 pt-4 border-t border-gray-100">
            <div className="flex justify-between">
              <span className="text-gray-400">Device</span>
              <span className="font-medium text-gray-800">{variant?.model.name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Storage</span>
              <span>{storageGb >= 1024 ? "1TB" : `${storageGb}GB`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Carrier</span>
              <span>{CARRIER_LABELS[variant?.carrier ?? ""] ?? variant?.carrier}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Condition</span>
              <span>{condition?.label ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Submitted</span>
              <span>{new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
          </div>
        </div>

        {/* Shipping address (if still pending) */}
        {order.status === "PENDING" && nap && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-blue-900 mb-2">Ship your device to:</p>
            <address className="not-italic text-sm text-blue-800 leading-relaxed">
              <strong>{nap.businessName}</strong><br />
              {nap.streetAddress}<br />
              {nap.city}, {nap.state} {nap.zipCode}
            </address>
            <p className="text-xs text-blue-600 mt-2">
              Write <strong>{order.orderNumber}</strong> on the outside of your package.
            </p>
          </div>
        )}

        {/* Tracking info */}
        {order.trackingNumber && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-xs text-gray-400 mb-1">Tracking number</p>
            <p className="font-mono text-sm text-gray-800">{order.trackingNumber}</p>
            {order.carrierName && <p className="text-xs text-gray-400 mt-0.5">{order.carrierName}</p>}
          </div>
        )}

        {/* Status history */}
        {order.statusHistory.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">History</p>
            <div className="space-y-3">
              {order.statusHistory.map((h) => (
                <div key={h.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{STATUS_LABELS[h.status]?.label ?? h.status}</p>
                    {h.note && <p className="text-xs text-gray-400">{h.note}</p>}
                    <p className="text-xs text-gray-300 mt-0.5">
                      {new Date(h.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {nap && (
          <p className="text-center text-xs text-gray-400 pb-4">
            Questions? Call <a href={`tel:${nap.phone}`} className="text-blue-600">{nap.phone}</a>
          </p>
        )}
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { orderNumber: string } }) {
  return {
    title: `Order ${params.orderNumber}`,
    robots: { index: false, follow: false },
  };
}
