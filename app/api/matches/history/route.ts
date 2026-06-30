import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const { data } = await supabase
      .from("matches")
      .select("*")
      .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      success: true,
      matches: data,
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
