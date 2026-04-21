import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { OnboardingWizard } from "@/components/admin/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Only TENANT_ADMIN should see this page
  if (session.user.role !== UserRole.TENANT_ADMIN || !session.user.tenantId) {
    redirect("/dashboard");
  }

  const tenantId = session.user.tenantId;

  const [tenant, napSettings, pricingRules] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId } }),
    db.napSettings.findUnique({ where: { tenantId } }),
    db.pricingRule.findMany({ where: { tenantId, scope: "GLOBAL" } }),
  ]);

  if (!tenant) redirect("/login");

  // Already onboarded — send them to dashboard
  if (napSettings) redirect("/dashboard");

  const globalMargin = Number(pricingRules[0]?.marginPercent ?? 0.65);

  return (
    <OnboardingWizard
      tenantId={tenantId}
      tenantName={tenant.name}
      tenantSlug={tenant.slug}
      existingNap={null}
      globalMargin={globalMargin}
    />
  );
}
