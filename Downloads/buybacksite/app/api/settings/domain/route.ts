import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UserRole, DomainStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === UserRole.STAFF) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tenantId, customDomain } = await req.json() as { tenantId: string; customDomain: string };

  if (session.user.role !== UserRole.PLATFORM_ADMIN && session.user.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cleanDomain = customDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

  const domain = await db.domainSettings.upsert({
    where: { tenantId },
    update: {
      customDomain: cleanDomain || null,
      domainStatus: cleanDomain ? DomainStatus.VERIFYING : DomainStatus.PENDING,
    },
    create: {
      tenantId,
      customDomain: cleanDomain || null,
      domainStatus: cleanDomain ? DomainStatus.VERIFYING : DomainStatus.PENDING,
    },
  });

  return NextResponse.json(domain);
}
