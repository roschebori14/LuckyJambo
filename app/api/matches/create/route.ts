import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createMatchSchema = z.object({
  game_slug: z.string(),
  stake_amount: z.number().positive(),
  invited_user_id: z.string().uuid().optional(),
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
    const validated = createMatchSchema.parse(body);

    const { data, error } = await supabase.rpc("create_match", {
      p_game_slug: validated.game_slug,
      p_stake_amount: validated.stake_amount,
      p_invited_user_id: validated.invited_user_id ?? null,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, match: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Match creation failed";
    console.error("Match creation failed", { message, error });
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}