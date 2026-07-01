import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createMatchSchema = z.object({
  game_slug: z.string(),
  stake_amount: z.number().positive(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createMatchSchema.parse(body);

    const { data, error } = await supabase.rpc("create_match", {
      p_game_slug: validated.game_slug,
      p_stake_amount: validated.stake_amount,
    });

    if (error) {
      // Don't rely on `instanceof Error` here — PostgrestError doesn't
      // reliably survive that check across every bundler/runtime, and
      // when it fails we lose the real Postgres exception text (e.g.
      // "Insufficient balance", "Stake must be between X and Y",
      // "Unknown or inactive game X") behind a useless generic string.
      // Log server-side for Vercel logs, and return the real message
      // directly since it's already a safe, user-facing string raised
      // deliberately by create_match itself.
      console.error("create_match RPC error:", error);
      return NextResponse.json(
        { success: false, message: error.message || "Match creation failed" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, match: data });
  } catch (error) {
    console.error("create_match route error:", error);
    const message =
      error instanceof z.ZodError
        ? "Invalid request"
        : error instanceof Error
          ? error.message
          : "Match creation failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
