import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UserRole, PricingRuleScope } from "@prisma/client";

interface CategoryRule {
  categoryId: string;
  marginPercent: number; // 0.1–0.9
}

interface Body {
  tenantId: string;
  marginPercent: number;         // global
  categoryRules?: CategoryRule[];
  clearCategoryIds?: string[];   // category overrides to delete
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === UserRole.STAFF) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tenantId, marginPercent, categoryRules = [], clearCategoryIds = [] } = body;

  if (session.user.role !== UserRole.PLATFORM_ADMIN && session.user.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clamp = (n: number) => Math.min(0.9, Math.max(0.1, n));
  const global = clamp(marginPercent);

  // ─── Global rule ────────────────────────────────────────────────────────────
  const existingGlobal = await db.pricingRule.findFirst({
    where: { tenantId, scope: PricingRuleScope.GLOBAL, scopeId: null },
  });

  const globalRule = existingGlobal
    ? await db.pricingRule.update({ where: { id: existingGlobal.id }, data: { marginPercent: global } })
    : await db.pricingRule.create({ data: { tenantId, scope: PricingRuleScope.GLOBAL, marginPercent: global } });

  // ─── Category overrides ──────────────────────────────────────────────────────
  const upsertResults = await Promise.all(
    categoryRules.map(async ({ categoryId, marginPercent: catMargin }) => {
      const clamped = clamp(catMargin);
      const existing = await db.pricingRule.findFirst({
        where: { tenantId, scope: PricingRuleScope.CATEGORY, scopeId: categoryId },
      });
      return existing
        ? db.pricingRule.update({ where: { id: existing.id }, data: { marginPercent: clamped } })
        : db.pricingRule.create({
            data: {
              tenantId,
              scope: PricingRuleScope.CATEGORY,
              scopeId: categoryId,
              marginPercent: clamped,
            },
          });
    })
  );

  // ─── Clear removed overrides ─────────────────────────────────────────────────
  if (clearCategoryIds.length > 0) {
    await db.pricingRule.deleteMany({
      where: {
        tenantId,
        scope: PricingRuleScope.CATEGORY,
        scopeId: { in: clearCategoryIds },
      },
    });
  }

  return NextResponse.json({
    global: globalRule,
    categoryRules: upsertResults,
    cleared: clearCategoryIds.length,
  });
}
