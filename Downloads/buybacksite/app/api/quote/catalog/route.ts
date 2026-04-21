import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export interface CatalogVariant {
  id: string;
  storageGb: number;
  carrier: string;
}

export interface CatalogModel {
  id: string;
  name: string;
  releaseYear: number | null;
  variants: CatalogVariant[];
}

export interface CatalogBrand {
  id: string;
  name: string;
  models: CatalogModel[];
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  brands: CatalogBrand[];
}

export interface CatalogResponse {
  tenantId: string;
  categories: CatalogCategory[];
}

/**
 * GET /api/quote/catalog?tenantId=xxx
 *
 * Returns the full device catalog for a tenant, filtered by:
 * - Active categories / brands / models (platform-level)
 * - Tenant device settings (models the shop has disabled)
 *
 * Called once on wizard load — all filtering then happens client-side.
 */
export async function GET(req: NextRequest) {
  const tenantId = new URL(req.url).searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId, status: { in: ["TRIAL", "ACTIVE"] } },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Get set of model IDs disabled by this tenant
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

  const result: CatalogCategory[] = categories
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

  return NextResponse.json(
    { tenantId, categories: result } satisfies CatalogResponse,
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    }
  );
}
