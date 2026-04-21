import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { NapSettingsForm } from "./nap-settings-form";
import { DomainSettingsForm } from "./domain-settings-form";
import { PricingRulesForm } from "./pricing-rules-form";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  if (session.user.role === UserRole.STAFF) redirect("/dashboard");

  const tenantId = session.user.tenantId!;

  const [tenant, napSettings, domainSettings, pricingRules, categories] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId } }),
    db.napSettings.findUnique({ where: { tenantId } }),
    db.domainSettings.findUnique({ where: { tenantId } }),
    db.pricingRule.findMany({
      where: {
        tenantId,
        scope: { in: ["GLOBAL", "CATEGORY"] },
      },
    }),
    db.deviceCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  if (!tenant) redirect("/dashboard");

  const globalRule = pricingRules.find((r) => r.scope === "GLOBAL");
  const globalMargin = globalRule?.marginPercent ?? 0.65;

  // Build map categoryId → marginPercent (only overrides that exist)
  const categoryMargins: Record<string, number> = {};
  for (const rule of pricingRules) {
    if (rule.scope === "CATEGORY" && rule.scopeId) {
      categoryMargins[rule.scopeId] = rule.marginPercent;
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">{tenant.name}</p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-1">Business Info</h2>
          <p className="text-sm text-gray-500 mb-4">
            This info is injected into every public page for local SEO.
          </p>
          <NapSettingsForm
            tenantId={tenantId}
            initial={napSettings ? {
              businessName: napSettings.businessName,
              streetAddress: napSettings.streetAddress,
              city: napSettings.city,
              state: napSettings.state,
              zipCode: napSettings.zipCode,
              phone: napSettings.phone,
              serviceArea: napSettings.serviceArea ?? "",
              googleMapsUrl: napSettings.googleMapsUrl ?? "",
            } : null}
          />
        </section>

        <div className="border-t border-gray-200" />

        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-1">Custom Domain</h2>
          <p className="text-sm text-gray-500 mb-4">
            Point your domain to <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">proxy.{process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "buybacksite.com"}</code> then add it here.
          </p>
          <DomainSettingsForm
            tenantId={tenantId}
            initial={domainSettings ? {
              customDomain: domainSettings.customDomain ?? "",
              domainStatus: domainSettings.domainStatus,
            } : null}
            subdomain={`${tenant.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "buybacksite.com"}`}
          />
        </section>

        <div className="border-t border-gray-200" />

        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-1">Pricing Rules</h2>
          <p className="text-sm text-gray-500 mb-4">
            Set a global margin, then optionally override it per device category.
            You offer this percentage of the current eBay market value.
          </p>
          <PricingRulesForm
            tenantId={tenantId}
            globalMargin={globalMargin}
            categories={categories}
            categoryMargins={categoryMargins}
          />
        </section>
      </div>
    </div>
  );
}
