import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { DeviceCatalog } from "./device-catalog";

export default async function DevicesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isPlatformAdmin = session.user.role === UserRole.PLATFORM_ADMIN;
  const tenantId = isPlatformAdmin ? null : session.user.tenantId;

  const [categories, tenantSettings] = await Promise.all([
    db.deviceCategory.findMany({
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
                _count: { select: { variants: true } },
              },
            },
          },
        },
      },
    }),
    tenantId
      ? db.tenantDeviceSettings.findMany({ where: { tenantId } })
      : Promise.resolve([]),
  ]);

  const disabledModelIds = new Set(
    (tenantSettings as { modelId: string; active: boolean }[])
      .filter((s) => !s.active)
      .map((s) => s.modelId)
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Devices & Pricing</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isPlatformAdmin
            ? "Platform-wide device catalog"
            : "Toggle devices on/off for your buyback wizard"}
        </p>
      </div>
      <DeviceCatalog
        categories={categories}
        disabledModelIds={[...disabledModelIds]}
        tenantId={tenantId}
        isPlatformAdmin={isPlatformAdmin}
      />
    </div>
  );
}
