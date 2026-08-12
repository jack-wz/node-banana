import { NextResponse } from "next/server";
import { dbHealth } from "@/lib/db";

// GET: Report whether metadata persistence is configured and reachable
export async function GET() {
  const health = await dbHealth();
  return NextResponse.json(health, { status: health.enabled && !health.ok ? 503 : 200 });
}
