import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export interface ConditionPrice {
  conditionId: string;
  grade: string;
  label: string;
  description: string;
  multiplier: number;
  buyPrice: number;
  marketValue: number;
}

/**
 * GET /api/quote/price?tenantId=xxx&variantId=yyy
 *
 * Returns buyback prices for all 4 conditions for a specific tenant + variant.
 * Called when the user selects a device variant in the wizard.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const variantId = searchParams.get("variantId");

  if (!tenantId || !variantId) {
    return NextResponse.json({ error: "tenantId and variantId required" }, { status: 400 });
  }

  const prices = await db.buybackPrice.findMany({
    where: { tenantId, variantId },
    include: { condition: true },
    orderBy: { condition: { sortOrder: "asc" } },
  });

  if (prices.length === 0) {
    // No prices yet — prices may not have been synced yet
    return NextResponse.json(
      { error: "No prices available for this device. Please check back soon." },
      { status: 404 }
    );
  }

  const result: ConditionPrice[] = prices.map((p) => ({
    conditionId: p.conditionId,
    grade: p.condition.grade,
    label: p.condition.label,
    description: p.condition.description,
    multiplier: p.condition.multiplier,
    buyPrice: Number(p.buyPrice),
    marketValue: Number(p.marketValue),
  }));

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
    },
  });
}
