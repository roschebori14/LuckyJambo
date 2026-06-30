import { NextResponse } from "next/server";
import { getAdminStats } from "@/lib/admin/stats-service";

export async function GET() {
  const stats = await getAdminStats();

  return NextResponse.json(stats);
}
