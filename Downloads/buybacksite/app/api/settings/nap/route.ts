import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === UserRole.STAFF) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { tenantId, businessName, streetAddress, city, state, zipCode, phone, serviceArea, googleMapsUrl } = body;

  if (session.user.role !== UserRole.PLATFORM_ADMIN && session.user.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nap = await db.napSettings.upsert({
    where: { tenantId },
    update: { businessName, streetAddress, city, state, zipCode, phone, serviceArea, googleMapsUrl },
    create: { tenantId, businessName, streetAddress, city, state, zipCode, phone, serviceArea, googleMapsUrl },
  });

  return NextResponse.json(nap);
}
