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

export default async function PrivacyPage() {
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

  const h2Class = "text-white font-bold text-xl mt-10 mb-3";
  const pClass = "text-gray-400 leading-relaxed";
  const ulClass = "text-gray-400 leading-relaxed list-disc list-inside space-y-1";

  return (
    <div className="bg-black min-h-screen">
      <TenantNavbar tenantName={tenant.name} />

      <main className="max-w-3xl mx-auto py-20 px-4 pt-32">
        <h1 className="text-white font-black text-4xl mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-12">Last updated: January 2025</p>

        <h2 className={h2Class}>1. Information We Collect</h2>
        <p className={pClass}>
          When you use our service we may collect the following personal
          information:
        </p>
        <ul className={ulClass + " mt-3"}>
          <li>Full name and email address</li>
          <li>Phone number</li>
          <li>Shipping and mailing address</li>
          <li>Device information (make, model, storage, condition)</li>
        </ul>

        <h2 className={h2Class}>2. How We Use Your Information</h2>
        <p className={pClass}>
          We use the information we collect to process your buyback order,
          generate prepaid shipping labels, communicate with you about your
          order status, and send payment upon approval of your device. We do not
          use your information for marketing purposes without your consent.
        </p>

        <h2 className={h2Class}>3. Information Sharing</h2>
        <p className={pClass}>
          We do not sell, trade, or rent your personal information to third
          parties. We may share your information only as necessary with:
        </p>
        <ul className={ulClass + " mt-3"}>
          <li>
            Payment processors (such as PayPal and Zelle) to send you payment
          </li>
          <li>
            Shipping providers (such as USPS via EasyPost) to generate and track
            labels
          </li>
        </ul>
        <p className={pClass + " mt-3"}>
          These third parties are only given the information required to perform
          their specific service.
        </p>

        <h2 className={h2Class}>4. Data Retention</h2>
        <p className={pClass}>
          Order and transaction data is retained for a minimum of 7 years to
          comply with applicable tax and accounting regulations. You may request
          deletion of other personal data not subject to these requirements at
          any time.
        </p>

        <h2 className={h2Class}>5. Your Rights</h2>
        <p className={pClass}>
          You have the right to access, correct, or request deletion of your
          personal data. To exercise these rights, please contact us through our{" "}
          <Link href="/contact" className="text-orange-500 hover:text-orange-400 transition-colors">
            contact page
          </Link>
          . We will respond within 30 days.
        </p>

        <h2 className={h2Class}>6. Contact Us</h2>
        <p className={pClass}>
          If you have any questions about this Privacy Policy, please{" "}
          <Link href="/contact" className="text-orange-500 hover:text-orange-400 transition-colors">
            contact us
          </Link>
          .
        </p>
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
    title: `Privacy Policy — ${tenantName}`,
    description: `Read the privacy policy for ${tenantName}.`,
  };
}
