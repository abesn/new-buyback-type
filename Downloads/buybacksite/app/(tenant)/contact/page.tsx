import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TenantNavbar, TenantFooter } from "@/components/tenant/shared";
import { ContactForm } from "./contact-form";

async function resolveTenantFromHeaders() {
  const headersList = headers();
  const slug = headersList.get("x-tenant-slug");
  const domain = headersList.get("x-tenant-domain");

  if (!slug && !domain) return null;

  if (slug) {
    return db.tenant.findUnique({
      where: { slug, status: { in: ["TRIAL", "ACTIVE"] } },
      include: { napSettings: true },
    });
  }

  const domainSettings = await db.domainSettings.findFirst({
    where: { customDomain: domain!, domainStatus: "ACTIVE" },
    include: { tenant: { include: { napSettings: true } } },
  });
  return domainSettings?.tenant ?? null;
}

// ─── Phone icon ───────────────────────────────────────────────────────────────

function PhoneIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-orange-500 w-5 h-5"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

// ─── Location pin icon ────────────────────────────────────────────────────────

function MapPinIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-orange-500 w-5 h-5"
      aria-hidden="true"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

// ─── Contact info (server-rendered) ──────────────────────────────────────────

interface NapData {
  businessName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
}

function ContactInfo({ nap }: { nap: NapData | null }) {
  const cardClass =
    "bg-white/5 border border-white/10 rounded-2xl p-5 flex items-start gap-4";
  const iconCircleClass =
    "w-10 h-10 bg-orange-600/20 rounded-full flex items-center justify-center flex-shrink-0";

  return (
    <div>
      <span className="inline-block bg-orange-600/20 text-orange-500 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
        We&apos;d love to hear from you
      </span>
      <h2 className="text-white font-black text-3xl mb-4">Get in touch</h2>
      <p className="text-gray-400 leading-relaxed mb-8">
        Have a question about selling your device, an existing order, or just
        want to say hello? Reach out and we&apos;ll get back to you within one
        business day.
      </p>

      <div className="space-y-4">
        {nap?.phone && (
          <a href={`tel:${nap.phone}`} className={cardClass}>
            <div className={iconCircleClass}>
              <PhoneIcon />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Phone
              </p>
              <p className="text-white text-sm font-medium">{nap.phone}</p>
            </div>
          </a>
        )}

        {nap?.streetAddress && (
          <div className={cardClass}>
            <div className={iconCircleClass}>
              <MapPinIcon />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Address
              </p>
              <p className="text-white text-sm font-medium">
                {nap.streetAddress}
              </p>
              <p className="text-gray-400 text-sm">
                {nap.city}, {nap.state} {nap.zipCode}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ContactPage() {
  const tenant = await resolveTenantFromHeaders();

  if (!tenant) {
    redirect("/login");
  }

  const nap = tenant.napSettings
    ? {
        businessName: tenant.napSettings.businessName,
        streetAddress: tenant.napSettings.streetAddress,
        city: tenant.napSettings.city,
        state: tenant.napSettings.state,
        zipCode: tenant.napSettings.zipCode,
        phone: tenant.napSettings.phone,
        facebookUrl: tenant.napSettings.facebookUrl,
        instagramUrl: tenant.napSettings.instagramUrl,
      }
    : null;

  return (
    <div className="bg-black min-h-screen">
      <TenantNavbar tenantName={tenant.name} activeHref="/contact" />
      <main className="max-w-5xl mx-auto px-4 py-20 pt-36 grid grid-cols-1 md:grid-cols-2 gap-12">
        <ContactForm tenantId={tenant.id} />
        <ContactInfo nap={nap} />
      </main>
      <TenantFooter tenantName={tenant.name} nap={nap} />
    </div>
  );
}

export async function generateMetadata() {
  const headersList = headers();
  const slug = headersList.get("x-tenant-slug");
  const domain = headersList.get("x-tenant-domain");

  let tenantName = "BuyBackSite";

  if (slug) {
    const t = await db.tenant.findUnique({ where: { slug }, select: { name: true } });
    tenantName = t?.name ?? tenantName;
  } else if (domain) {
    const ds = await db.domainSettings.findFirst({
      where: { customDomain: domain },
      include: { tenant: { select: { name: true } } },
    });
    tenantName = ds?.tenant?.name ?? tenantName;
  }

  return {
    title: `Contact Us — ${tenantName}`,
    description: `Get in touch with ${tenantName}. We typically respond within one business day.`,
  };
}
