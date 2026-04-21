import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

/**
 * GET /api/prices?modelId=xxx
 *
 * Returns all buyback prices for the current tenant, grouped by model → variant.
 * Optionally filtered to a single model.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId =
    session.user.role === UserRole.PLATFORM_ADMIN
      ? (new URL(req.url).searchParams.get("tenantId") ?? undefined)
      : session.user.tenantId!;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  const modelId = new URL(req.url).searchParams.get("modelId");

  const prices = await db.buybackPrice.findMany({
    where: {
      tenantId,
      ...(modelId
        ? { variant: { modelId } }
        : {}),
    },
    include: {
      variant: {
        include: {
          model: {
            include: {
              brand: { include: { category: true } },
            },
          },
        },
      },
      condition: true,
    },
    orderBy: [
      { variant: { model: { brand: { category: { sortOrder: "asc" } } } } },
      { variant: { model: { brand: { sortOrder: "asc" } } } },
      { variant: { model: { sortOrder: "asc" } } },
      { variant: { storageGb: "asc" } },
      { condition: { sortOrder: "asc" } },
    ],
  });

  return NextResponse.json(
    prices.map((p) => ({
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
        model: {
          id: p.variant.model.id,
          name: p.variant.model.name,
          brandName: p.variant.model.brand.name,
          categoryName: p.variant.model.brand.category.name,
        },
      },
      condition: {
        grade: p.condition.grade,
        label: p.condition.label,
        multiplier: p.condition.multiplier,
      },
    }))
  );
}
