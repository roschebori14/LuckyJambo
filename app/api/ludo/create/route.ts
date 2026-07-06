import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  stake_amount: z.number().positive(),
  max_players: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  invited_user_id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const body = await request.json();
    const validated = schema.parse(body);

    const { data, error } = await supabase.rpc("create_ludo_match", {
      p_stake_amount: validated.stake_amount,
      p_max_players: validated.max_players,
      p_invited_user_id: validated.invited_user_id ?? null,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, match: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Match creation failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
