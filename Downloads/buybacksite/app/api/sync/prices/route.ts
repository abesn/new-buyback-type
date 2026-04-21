import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { syncMarketPrices, getSyncStatus } from "@/lib/pricing";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== UserRole.PLATFORM_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = await getSyncStatus();
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== UserRole.PLATFORM_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = await getSyncStatus();
  if (status.running) {
    return NextResponse.json(
      { error: "Sync already running", status },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({})) as { variantIds?: string[] };

  // Fire sync in background — don't await so we return immediately
  syncMarketPrices(body.variantIds).catch((err) =>
    console.error("[sync] Unhandled error:", err)
  );

  return NextResponse.json({ started: true });
}
