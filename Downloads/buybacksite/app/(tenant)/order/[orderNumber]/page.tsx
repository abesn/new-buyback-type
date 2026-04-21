import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { TenantNavbar, TenantFooter } from "@/components/tenant/shared";

const CARRIER_LABELS: Record<string, string> = {
  UNLOCKED: "Unlocked",
  ATT: "AT&T",
  TMOBILE: "T-Mobile",
  VERIZON: "Verizon",
  SPRINT: "Sprint",
  OTHER: "Other",
};

const STATUS_META: Record<string, {
  label: string;
  desc: string;
  icon: string;
  dotColor: string;
  cardBg: string;
  cardBorder: string;
  textColor: string;
}> = {
  PENDING: {
    label: "Awaiting Shipment",
    desc: "Please ship your device to us using the prepaid label.",
    icon: "📦",
    dotColor: "bg-yellow-500",
    cardBg: "bg-yellow-900/20",
    cardBorder: "border-yellow-500/40",
    textColor: "text-yellow-300",
  },
  SHIPPED: {
    label: "In Transit",
    desc: "Your package is on its way. We'll notify you when it arrives.",
    icon: "🚚",
    dotColor: "bg-blue-500",
    cardBg: "bg-blue-900/20",
    cardBorder: "border-blue-500/40",
    textColor: "text-blue-300",
  },
  RECEIVED: {
    label: "Received",
    desc: "Your device has arrived at our facility. Inspection coming up.",
    icon: "📬",
    dotColor: "bg-indigo-500",
    cardBg: "bg-indigo-900/20",
    cardBorder: "border-indigo-500/40",
    textColor: "text-indigo-300",
  },
  INSPECTING: {
    label: "Under Inspection",
    desc: "We're verifying your device's condition — usually done within a few hours.",
    icon: "🔍",
    dotColor: "bg-purple-500",
    cardBg: "bg-purple-900/20",
    cardBorder: "border-purple-500/40",
    textColor: "text-purple-300",
  },
  OFFER_REVISED: {
    label: "Revised Offer Sent",
    desc: "We found a condition difference — check your email for the updated offer.",
    icon: "✉️",
    dotColor: "bg-orange-500",
    cardBg: "bg-orange-900/20",
    cardBorder: "border-orange-500/40",
    textColor: "text-orange-300",
  },
  APPROVED: {
    label: "Approved — Payment Queued",
    desc: "All good! Payment is being processed and will arrive shortly.",
    icon: "✅",
    dotColor: "bg-teal-500",
    cardBg: "bg-teal-900/20",
    cardBorder: "border-teal-500/40",
    textColor: "text-teal-300",
  },
  PAID: {
    label: "Paid!",
    desc: "Your payment has been sent. Thank you for selling with us!",
    icon: "💸",
    dotColor: "bg-green-500",
    cardBg: "bg-green-900/20",
    cardBorder: "border-green-500/40",
    textColor: "text-green-300",
  },
  REJECTED: {
    label: "Rejected",
    desc: "We couldn't accept this device. Check your email for details.",
    icon: "❌",
    dotColor: "bg-red-500",
    cardBg: "bg-red-900/20",
    cardBorder: "border-red-500/40",
    textColor: "text-red-300",
  },
  RETURNED: {
    label: "Returned",
    desc: "Your device has been shipped back to you.",
    icon: "↩️",
    dotColor: "bg-gray-500",
    cardBg: "bg-white/5",
    cardBorder: "border-white/10",
    textColor: "text-gray-400",
  },
  CANCELLED: {
    label: "Cancelled",
    desc: "This order was cancelled.",
    icon: "🚫",
    dotColor: "bg-gray-600",
    cardBg: "bg-white/5",
    cardBorder: "border-white/10",
    textColor: "text-gray-500",
  },
};

// Status pipeline for progress bar display
const STATUS_PIPELINE = ["PENDING", "SHIPPED", "RECEIVED", "INSPECTING", "APPROVED", "PAID"] as const;

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
  let tenantData: { name: string; napSettings: { businessName: string; streetAddress: string; city: string; state: string; zipCode: string; phone: string; facebookUrl: string | null; instagramUrl: string | null } | null } | null = null;

  if (slug) {
    const t = await db.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        napSettings: {
          select: {
            businessName: true, streetAddress: true, city: true,
            state: true, zipCode: true, phone: true,
            facebookUrl: true, instagramUrl: true,
          },
        },
      },
    });
    tenantId = t?.id ?? null;
    tenantData = t ?? null;
  } else if (domain) {
    const ds = await db.domainSettings.findFirst({
      where: { customDomain: domain },
      select: {
        tenantId: true,
        tenant: {
          select: {
            name: true,
            napSettings: {
              select: {
                businessName: true, streetAddress: true, city: true,
                state: true, zipCode: true, phone: true,
                facebookUrl: true, instagramUrl: true,
              },
            },
          },
        },
      },
    });
    tenantId = ds?.tenantId ?? null;
    tenantData = ds?.tenant ?? null;
  }

  const order = await db.order.findUnique({
    where: {
      orderNumber: params.orderNumber,
      ...(tenantId ? { tenantId } : {}),
    },
    include: {
      tenant: { include: { napSettings: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
      items: {
        include: {
          variant: { include: { model: true } },
          condition: true,
        },
      },
    },
  });

  if (!order) notFound();

  const statusInfo = STATUS_META[order.status] ?? {
    label: order.status,
    desc: "",
    icon: "📋",
    dotColor: "bg-gray-500",
    cardBg: "bg-white/5",
    cardBorder: "border-white/10",
    textColor: "text-gray-400",
  };

  const nap = tenantData?.napSettings ?? order.tenant.napSettings;
  const tenantName = tenantData?.name ?? order.tenant.name;
  const isMulti = order.items.length > 1;

  // Pipeline progress
  const pipelineIdx = STATUS_PIPELINE.indexOf(order.status as typeof STATUS_PIPELINE[number]);

  const footerNap = nap
    ? {
        businessName: nap.businessName,
        streetAddress: nap.streetAddress,
        city: nap.city,
        state: nap.state,
        zipCode: nap.zipCode,
        phone: nap.phone,
        facebookUrl: nap.facebookUrl,
        instagramUrl: nap.instagramUrl,
      }
    : null;

  return (
    <div className="bg-black min-h-screen">
      <TenantNavbar tenantName={tenantName} />

      <main className="max-w-2xl mx-auto px-4 pt-24 pb-20 space-y-5">

        {/* Back link */}
        <Link
          href="/track"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Track another order
        </Link>

        {/* Status hero card */}
        <div className={`border rounded-2xl p-6 ${statusInfo.cardBg} ${statusInfo.cardBorder}`}>
          <div className="flex items-start gap-4">
            <div className="text-3xl">{statusInfo.icon}</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Order Status</p>
              <p className={`text-2xl font-black ${statusInfo.textColor}`}>{statusInfo.label}</p>
              <p className="text-gray-400 text-sm mt-1 leading-relaxed">{statusInfo.desc}</p>
            </div>
          </div>

          {/* Progress pipeline */}
          {pipelineIdx >= 0 && (
            <div className="mt-6 flex items-center gap-1">
              {STATUS_PIPELINE.map((s, i) => {
                const done = i <= pipelineIdx;
                const active = i === pipelineIdx;
                return (
                  <div key={s} className="flex items-center flex-1 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors ${active ? statusInfo.dotColor + " ring-2 ring-offset-1 ring-offset-transparent ring-current" : done ? "bg-white/40" : "bg-white/10"}`} />
                    {i < STATUS_PIPELINE.length - 1 && (
                      <div className={`flex-1 h-px mx-1 ${i < pipelineIdx ? "bg-white/30" : "bg-white/10"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Order details card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex justify-between items-start mb-5">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Order number</p>
              <p className="font-mono font-bold text-white text-lg">{order.orderNumber}</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {new Date(order.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-0.5">Quoted value</p>
              <p className="text-2xl font-black text-orange-500">{fmt(Number(order.quotedPrice))}</p>
              {order.finalPrice && Number(order.finalPrice) !== Number(order.quotedPrice) && (
                <p className="text-sm text-orange-400 font-medium">Final: {fmt(Number(order.finalPrice))}</p>
              )}
            </div>
          </div>

          {/* Device list */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
              {order.items.length} Device{order.items.length > 1 ? "s" : ""}
            </p>
            {order.items.map((item) => {
              const storageGb = item.variant.storageGb;
              const storageLabel = storageGb >= 1024 ? "1TB" : `${storageGb}GB`;
              return (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm">
                      📱
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white leading-snug">
                        {item.variant.model.name} {storageLabel}
                      </p>
                      <p className="text-xs text-gray-500">
                        {CARRIER_LABELS[item.variant.carrier] ?? item.variant.carrier} · {item.condition.label}
                      </p>
                    </div>
                  </div>
                  {isMulti && (
                    <span className="text-sm font-semibold text-gray-300 flex-shrink-0">{fmt(Number(item.quotedPrice))}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Shipping — pending */}
        {order.status === "PENDING" && nap && (
          <div className="bg-orange-600/10 border border-orange-600/30 rounded-2xl p-5">
            <p className="text-sm font-semibold text-orange-300 mb-3 flex items-center gap-2">
              <span>📬</span> Ship your device{isMulti ? "s" : ""} to:
            </p>
            <address className="not-italic text-orange-200 text-sm leading-relaxed">
              <span className="font-semibold">{nap.businessName}</span><br />
              {nap.streetAddress}<br />
              {nap.city}, {nap.state} {nap.zipCode}
            </address>
            <p className="text-xs text-orange-400 mt-3">
              Write <span className="font-mono font-semibold bg-orange-600/20 px-1 py-0.5 rounded">{order.orderNumber}</span> on the outside of your package.
            </p>
            {order.shippingLabelUrl && (
              <a
                href={order.shippingLabelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Download Prepaid Shipping Label
              </a>
            )}
          </div>
        )}

        {/* Tracking info */}
        {order.trackingNumber && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Tracking</p>
            <p className="font-mono text-white text-base">{order.trackingNumber}</p>
            {order.carrierName && (
              <p className="text-xs text-gray-500 mt-1">{order.carrierName}</p>
            )}
          </div>
        )}

        {/* Status history timeline */}
        {order.statusHistory.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-4">History</p>
            <div className="space-y-4">
              {order.statusHistory.map((h, idx) => {
                const meta = STATUS_META[h.status];
                return (
                  <div key={h.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${idx === 0 ? (meta?.dotColor ?? "bg-gray-500") : "bg-white/20"}`} />
                      {idx < order.statusHistory.length - 1 && (
                        <div className="w-px flex-1 bg-white/10 mt-1 min-h-[16px]" />
                      )}
                    </div>
                    <div className="pb-2">
                      <p className={`text-sm font-semibold ${idx === 0 ? "text-white" : "text-gray-400"}`}>
                        {STATUS_META[h.status]?.label ?? h.status}
                      </p>
                      {h.note && <p className="text-xs text-gray-500 mt-0.5">{h.note}</p>}
                      <p className="text-xs text-gray-600 mt-0.5">
                        {new Date(h.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Help CTA */}
        {nap && (
          <div className="text-center py-2">
            <p className="text-xs text-gray-600">
              Questions about your order?{" "}
              <Link href="/contact" className="text-orange-500 hover:text-orange-400 transition-colors">
                Contact us
              </Link>
              {nap.phone && (
                <>
                  {" "}or call{" "}
                  <a href={`tel:${nap.phone}`} className="text-orange-500 hover:text-orange-400 transition-colors">
                    {nap.phone}
                  </a>
                </>
              )}
            </p>
          </div>
        )}
      </main>

      <TenantFooter tenantName={tenantName} nap={footerNap} />
    </div>
  );
}

export async function generateMetadata({ params }: { params: { orderNumber: string } }) {
  return {
    title: `Order ${params.orderNumber} — Status`,
    robots: { index: false, follow: false },
  };
}
