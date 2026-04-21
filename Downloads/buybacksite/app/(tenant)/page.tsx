import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { QuoteWizard } from "@/components/quote/wizard";
import type { CatalogCategory } from "@/app/api/quote/catalog/route";

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

async function getCatalog(tenantId: string): Promise<CatalogCategory[]> {
  const disabled = await db.tenantDeviceSettings.findMany({
    where: { tenantId, active: false },
    select: { modelId: true },
  });
  const disabledIds = new Set(disabled.map((d) => d.modelId));

  const categories = await db.deviceCategory.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      brands: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          models: {
            where: { active: true },
            orderBy: { sortOrder: "asc" },
            include: {
              variants: {
                where: { active: true },
                orderBy: [{ storageGb: "asc" }, { carrier: "asc" }],
                select: { id: true, storageGb: true, carrier: true },
              },
            },
          },
        },
      },
    },
  });

  return categories
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      brands: cat.brands
        .map((brand) => ({
          id: brand.id,
          name: brand.name,
          models: brand.models
            .filter((m) => !disabledIds.has(m.id) && m.variants.length > 0)
            .map((m) => ({
              id: m.id,
              name: m.name,
              releaseYear: m.releaseYear,
              variants: m.variants.map((v) => ({
                id: v.id,
                storageGb: v.storageGb,
                carrier: v.carrier as string,
              })),
            })),
        }))
        .filter((b) => b.models.length > 0),
    }))
    .filter((c) => c.brands.length > 0);
}

export default async function TenantPage() {
  const tenant = await resolveTenantFromHeaders();

  if (!tenant) {
    // No tenant context — visitor is on the platform root domain
    redirect("/login");
  }

  const catalog = await getCatalog(tenant.id);

  const nap = tenant.napSettings
    ? {
        businessName: tenant.napSettings.businessName,
        streetAddress: tenant.napSettings.streetAddress,
        city: tenant.napSettings.city,
        state: tenant.napSettings.state,
        zipCode: tenant.napSettings.zipCode,
        phone: tenant.napSettings.phone,
      }
    : null;

  if (catalog.length === 0) {
    // Tenant has no devices configured yet
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔧</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">{tenant.name}</h1>
          <p className="text-gray-500">We're setting up our buyback catalog. Check back soon!</p>
        </div>
      </div>
    );
  }

  return (
    <QuoteWizard
      tenantId={tenant.id}
      tenantName={tenant.name}
      catalog={catalog}
      nap={nap}
    />
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
    title: `Sell Your Phone — ${tenantName}`,
    description: `Get an instant offer for your phone or tablet. ${tenantName} buys used devices — fast payment, free shipping.`,
    robots: { index: true, follow: true },
  };
}
