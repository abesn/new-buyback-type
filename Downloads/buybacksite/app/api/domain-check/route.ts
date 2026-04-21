import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/domain-check?domain=chicagophonebuyback.com
 *
 * Used by Caddy's on_demand_tls to verify a domain before issuing an SSL cert.
 * Returns 200 if the domain is registered, 404 if not.
 * Also used internally to check domain status during setup flow.
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");

  if (!domain) {
    return NextResponse.json({ error: "domain param required" }, { status: 400 });
  }

  const domainSettings = await db.domainSettings.findFirst({
    where: { customDomain: domain },
    select: { domainStatus: true, tenantId: true },
  });

  if (!domainSettings) {
    return new NextResponse("not found", { status: 404 });
  }

  return new NextResponse("ok", { status: 200 });
}
