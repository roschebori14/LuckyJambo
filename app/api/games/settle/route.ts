import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const settleSchema = z.object({
  match_id: z.string().uuid(),
  winner_id: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const body = await request.json();
    const validated = settleSchema.parse(body);

    const { data, error } = await supabase.rpc("settle_match", {
      p_match_id: validated.match_id,
      p_winner_id: validated.winner_id,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, match: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settlement failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
