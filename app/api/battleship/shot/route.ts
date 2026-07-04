import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  match_id: z.string().uuid(),
  cell: z.number().int().min(0).max(63),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const validated = schema.parse(body);

    // Hit/miss/sunk/turn/win are all resolved authoritatively inside
    // this RPC against the locked-down battleship_ships table - the
    // route only ever forwards which cell was fired at.
    const { data: rpcData, error: rpcError } = await supabase.rpc("submit_battleship_shot", {
      p_match_id: validated.match_id,
      p_cell: validated.cell,
    });

    if (rpcError) {
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...rpcData });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shot failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
