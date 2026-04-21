import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { getSyncStatus } from "@/lib/pricing";
import { SyncPanel } from "./sync-panel";
import { PriceTable } from "./price-table";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: { brand?: string; modelId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isPlatformAdmin = session.user.role === UserRole.PLATFORM_ADMIN;
  const tenantId = isPlatformAdmin ? null : session.user.tenantId;

  const [brands, syncStatus, marketPriceCount, priceCount] = await Promise.all([
    db.deviceBrand.findMany({
      where: { active: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: {
        category: { select: { name: true } },
        models: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
    getSyncStatus(),
    db.marketPrice.count(),
    tenantId ? db.buybackPrice.count({ where: { tenantId } }) : Promise.resolve(0),
  ]);

  // Fetch prices for the selected model (or first model if none selected)
  const selectedBrand = searchParams.brand ?? brands[0]?.id;
  const modelsForBrand = brands.find((b) => b.id === selectedBrand)?.models ?? [];
  const selectedModelId = searchParams.modelId ?? modelsForBrand[0]?.id;

  type PriceRow = {
    id: string;
    variantId: string;
    conditionId: string;
    buyPrice: number;
    marketValue: number;
    marginPercent: number;
    updatedAt: Date;
    variant: {
      storageGb: number;
      carrier: string;
      skuCode: string;
    };
    condition: {
      grade: string;
      label: string;
      multiplier: number;
    };
  };

  let prices: PriceRow[] = [];
  if (selectedModelId) {
    const raw = await db.buybackPrice.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        variant: { modelId: selectedModelId },
      },
      include: {
        variant: true,
        condition: true,
      },
      orderBy: [
        { variant: { storageGb: "asc" } },
        { condition: { sortOrder: "asc" } },
      ],
      take: tenantId ? undefined : 200, // platform admin: cap for display
    });

    prices = raw.map((p) => ({
      id: p.id,
      variantId: p.variantId,
      conditionId: p.conditionId,
      buyPrice: Number(p.buyPrice),
      marketValue: Number(p.marketValue),
      marginPercent: p.marginPercent,
      updatedAt: p.updatedAt,
      variant: {
        storageGb: p.variant.storageGb,
        carrier: p.variant.carrier,
        skuCode: p.variant.skuCode,
      },
      condition: {
        grade: p.condition.grade,
        label: p.condition.label,
        multiplier: p.condition.multiplier,
      },
    }));
  }

  const selectedModelName =
    modelsForBrand.find((m) => m.id === selectedModelId)?.name ?? "";

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Pricing Engine</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {marketPriceCount} market prices synced ·{" "}
          {tenantId ? `${priceCount} buyback prices computed` : "platform-wide view"}
        </p>
      </div>

      {/* Sync panel — platform admin only */}
      {isPlatformAdmin && (
        <SyncPanel initialStatus={syncStatus} />
      )}

      {/* Price browser */}
      <div className="mt-6 flex gap-6">
        {/* Brand / Model selector sidebar */}
        <div className="w-52 flex-shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {brands.map((brand) => (
              <div key={brand.id}>
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {brand.name}
                  </p>
                </div>
                {brand.models.map((model) => (
                  <a
                    key={model.id}
                    href={`/dashboard/pricing?brand=${brand.id}&modelId=${model.id}`}
                    className={`block px-3 py-2 text-xs transition-colors border-b border-gray-50 ${
                      model.id === selectedModelId
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {model.name}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Price table */}
        <div className="flex-1 min-w-0">
          {selectedModelId ? (
            <PriceTable
              modelName={selectedModelName}
              prices={prices}
              tenantId={tenantId}
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              Select a model to view prices.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
