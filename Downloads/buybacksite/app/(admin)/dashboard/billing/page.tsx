import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { BillingPanel } from "./billing-panel";

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === UserRole.STAFF) redirect("/dashboard");

  const tenantId = session.user.tenantId!;

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      plan: true,
      status: true,
      trialEndsAt: true,
      stripeSubscriptionId: true,
    },
  });

  if (!tenant) redirect("/dashboard");

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-0.5">{tenant.name}</p>
      </div>

      <BillingPanel
        plan={tenant.plan}
        status={tenant.status}
        trialEndsAt={tenant.trialEndsAt?.toISOString() ?? null}
        hasSubscription={!!tenant.stripeSubscriptionId}
      />
    </div>
  );
}
