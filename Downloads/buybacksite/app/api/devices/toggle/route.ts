import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === UserRole.PLATFORM_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });

  const { modelId, active } = await req.json() as { modelId: string; active: boolean };

  await db.tenantDeviceSettings.upsert({
    where: { tenantId_modelId: { tenantId, modelId } },
    update: { active },
    create: { tenantId, modelId, active },
  });

  return NextResponse.json({ ok: true });
}
