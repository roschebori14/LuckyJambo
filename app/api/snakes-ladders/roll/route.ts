import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ match_id: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const validated = schema.parse(body);

    // The die roll itself, the ladder/snake lookup, and win/draw
    // detection all happen server-side inside this RPC - the route
    // only ever forwards "roll for me", with no numbers a client could
    // tamper with.
    const { data: rpcData, error: rpcError } = await supabase.rpc("submit_snakes_ladders_roll", {
      p_match_id: validated.match_id,
    });

    if (rpcError) {
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...rpcData });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Roll failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
