import { NextResponse } from "next/server";

import { MatchService } from "@/lib/matchmaking/match-service";

export async function GET() {
  try {
    const matches = await MatchService.getOpenMatches();

    return NextResponse.json({
      success: true,
      matches,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
      },
      { status: 500 },
    );
  }
}
