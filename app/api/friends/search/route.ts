import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json([]);
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", `%${query}%`)
    .limit(20);

  return NextResponse.json(data);
}
