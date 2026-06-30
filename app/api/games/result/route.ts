import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const matchId = searchParams.get("match_id");

  const supabase = await createClient();

  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  return NextResponse.json({
    success: true,
    match: data,
  });
}
