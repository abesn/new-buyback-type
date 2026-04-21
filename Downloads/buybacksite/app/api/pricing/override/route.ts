/**
 * PATCH /api/pricing/override
 *
 * Set a manual price override for a specific BuybackPrice row.
 * Rows with manualOverride=true are skipped by the price sync job.
 *
 * DELETE /api/pricing/override
 * Remove the override flag (row will be updated on next sync).
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

interface OverrideBody {
  priceId: string;
  buyPrice: number;
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === UserRole.STAFF) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: OverrideBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { priceId, buyPrice } = body;

  if (!priceId || typeof buyPrice !== "number" || buyPrice < 0) {
    return NextResponse.json({ error: "priceId and a non-negative buyPrice are required" }, { status: 400 });
  }

  // Verify the row belongs to this tenant (unless platform admin)
  const row = await db.buybackPrice.findUnique({ where: { id: priceId } });
  if (!row) return NextResponse.json({ error: "Price not found" }, { status: 404 });

  if (
    session.user.role !== UserRole.PLATFORM_ADMIN &&
    row.tenantId !== session.user.tenantId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.buybackPrice.update({
    where: { id: priceId },
    data: {
      buyPrice,
      manualOverride: true,
    },
  });

  // Bust the quote price cache for this variant
  const { cacheDel, CacheKey } = await import("@/lib/redis");
  await cacheDel(CacheKey.feedJson(row.tenantId), `prices:${row.tenantId}:${row.variantId}` as Parameters<typeof cacheDel>[0]);

  return NextResponse.json({ id: updated.id, buyPrice: Number(updated.buyPrice), manualOverride: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === UserRole.STAFF) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const priceId = searchParams.get("priceId");
  if (!priceId) return NextResponse.json({ error: "priceId required" }, { status: 400 });

  const row = await db.buybackPrice.findUnique({ where: { id: priceId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    session.user.role !== UserRole.PLATFORM_ADMIN &&
    row.tenantId !== session.user.tenantId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.buybackPrice.update({
    where: { id: priceId },
    data: { manualOverride: false },
  });

  return NextResponse.json({ ok: true });
}
