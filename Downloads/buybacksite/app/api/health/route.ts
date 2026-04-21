import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Verify DB connection is alive
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Database unavailable" },
      { status: 503 }
    );
  }
}
