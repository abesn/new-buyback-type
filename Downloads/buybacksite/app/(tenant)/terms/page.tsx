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

export default async function TermsPage() {
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
        <h1 className="text-white font-black text-4xl mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-12">Last updated: January 2025</p>

        <h2 className={h2Class}>1. Acceptance of Terms</h2>
        <p className={pClass}>
          By submitting a device for sale through our service, you agree to
          these Terms of Service. If you do not agree with any part of these
          terms, please do not use our service.
        </p>

        <h2 className={h2Class}>2. The Buyback Process</h2>
        <p className={pClass}>
          Quotes generated through our service are valid for 14 days from the
          date of issue. The device you ship must match the make, model,
          storage, and condition you described when requesting the quote. If the
          device we receive does not match the stated condition, we reserve the
          right to revise the offer. You will be notified of any revised offer
          and may choose to accept or request a free return of your device.
        </p>

        <h2 className={h2Class}>3. Shipping</h2>
        <p className={pClass}>
          We provide a prepaid USPS shipping label at no cost to you. You are
          responsible for safely packaging your device to prevent damage in
          transit. We recommend using the original box when possible and adding
          adequate padding. We are not responsible for devices damaged due to
          inadequate packaging.
        </p>

        <h2 className={h2Class}>4. Payment</h2>
        <p className={pClass}>
          Payment will be issued within 2 business days of your device passing
          our inspection and the offer being approved. We pay via PayPal or
          Zelle as selected during checkout. Payment is sent to the email
          address or phone number you provided with your order.
        </p>

        <h2 className={h2Class}>5. Rejected Devices</h2>
        <p className={pClass}>
          If we are unable to accept your device for any reason — including
          damage beyond the stated condition, activation lock, or device not
          matching the description — we will notify you and return your device
          at no cost to you within 5 business days.
        </p>

        <h2 className={h2Class}>6. Limitation of Liability</h2>
        <p className={pClass}>
          To the fullest extent permitted by law, our liability to you for any
          claim arising from your use of our service is limited to the value of
          the quote offered for your device. We are not liable for any indirect,
          incidental, or consequential damages.
        </p>

        <h2 className={h2Class}>7. Contact Us</h2>
        <p className={pClass}>
          If you have any questions about these Terms of Service, please{" "}
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
    title: `Terms of Service — ${tenantName}`,
    description: `Read the terms of service for ${tenantName}.`,
  };
}
