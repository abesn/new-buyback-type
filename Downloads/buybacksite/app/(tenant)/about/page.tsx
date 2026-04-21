import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { TenantNavbar, TenantFooter } from "@/components/tenant/shared";

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

export default async function AboutPage() {
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

  const tenantName = tenant.name;

  return (
    <div className="bg-black min-h-screen">
      <TenantNavbar tenantName={tenantName} activeHref="/about" />

      {/* Hero */}
      <section className="pt-16">
        <div className="py-24 text-center px-4">
          <span className="inline-block bg-orange-600/20 text-orange-500 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-6">
            About Us
          </span>
          <h1 className="text-white font-black text-5xl md:text-7xl mb-6">
            {tenantName}
          </h1>
          <p className="text-gray-400 text-xl max-w-xl mx-auto">
            Turning old devices into cash since day one.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-3xl mx-auto py-16 px-4">
        <h2 className="text-white font-black text-3xl mb-4">Our Mission</h2>
        <p className="text-gray-400 leading-relaxed mb-4">
          We believe selling your used phone or tablet shouldn&apos;t be
          complicated. Too many buyback services lowball customers, take weeks
          to pay, or bury fees in the fine print. We built {tenantName} to be
          different.
        </p>
        <p className="text-gray-400 leading-relaxed">
          Every price we offer is calculated daily from real eBay sold listings
          — so you&apos;re always getting a competitive, data-driven quote. We
          cover shipping, inspect quickly, and pay within 48 hours. No games, no
          surprises.
        </p>
      </section>

      {/* Stats */}
      <section className="bg-neutral-950 py-16 px-4">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { value: "500+", label: "Devices Bought" },
            { value: "Free", label: "Shipping Always" },
            { value: "48hr", label: "Payment" },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center"
            >
              <p className="text-4xl font-black text-orange-500">{value}</p>
              <p className="text-gray-400 mt-2">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto py-16 px-4">
        <h2 className="text-white font-black text-3xl mb-10 text-center">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Get a Quote",
              desc: "Select your device, describe its condition, and get an instant offer — no haggling.",
            },
            {
              step: "2",
              title: "Ship for Free",
              desc: "We email you a prepaid shipping label. Drop it off at any USPS location.",
            },
            {
              step: "3",
              title: "Get Paid",
              desc: "Once we inspect and approve your device, we pay within 48 hours via PayPal or Zelle.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex flex-col items-start gap-4">
              <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-sm">{step}</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 text-center px-4">
        <h2 className="text-white font-black text-4xl mb-6">
          Ready to sell?
        </h2>
        <Link
          href="/quote"
          className="inline-block bg-orange-600 hover:bg-orange-500 text-white font-bold px-8 py-4 rounded-xl transition-colors text-base"
        >
          Get a Quote
        </Link>
      </section>

      <TenantFooter tenantName={tenantName} nap={nap} />
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
    title: `About Us — ${tenantName}`,
    description: `Learn about ${tenantName} — our mission, how we work, and why we're different.`,
  };
}
