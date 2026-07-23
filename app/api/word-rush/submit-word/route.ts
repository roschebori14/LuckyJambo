import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applySubmitWord, WordRushRulesError } from "@/lib/games/word-rush/engine";
import type { WordRushState } from "@/types/word-rush";
import { z } from "zod";

const schema = z.object({
  match_id: z.string().uuid(),
  word: z.string().min(1).max(30),
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

    const { data: match } = await supabase
      .from("matches")
      .select("*")
      .eq("id", validated.match_id)
      .single();

    if (!match || match.status !== "active") {
      return NextResponse.json({ success: false, message: "Match not active" }, { status: 400 });
    }

    const state = match.game_state as WordRushState;

    // applySubmitWord (lib/games/word-rush/engine.ts) does the
    // scramble/dictionary/already-found check. A thrown
    // WordRushRulesError means the request itself was illegal (not a
    // participant, round already over) - a 400. A word that fails the
    // scramble/dictionary check is NOT thrown - it's a normal 200 with
    // word_accepted: false and nothing persisted, since a miss costs
    // nothing here (unlike word-chain's strikes).
    let outcome;
    try {
      outcome = applySubmitWord(state, user.id, validated.word);
    } catch (err) {
      if (err instanceof WordRushRulesError) {
        return NextResponse.json({ success: false, message: err.message }, { status: 400 });
      }
      throw err;
    }

    if (!outcome.wordAccepted) {
      return NextResponse.json({
        success: true,
        state,
        word_accepted: false,
        reason: outcome.reason,
      });
    }

    // Persistence happens in a SECURITY DEFINER RPC that merges only
    // this player's found_words/score under a row lock - see the
    // migration for why this can't just overwrite the whole
    // game_state the way apply_word_chain_move_result does (both
    // players can be submitting concurrently against the same row).
    const word = validated.word.trim().toLowerCase();
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "apply_word_rush_submit_word",
      {
        p_match_id: validated.match_id,
        p_word: word,
        p_points: outcome.points,
      },
    );

    if (rpcError) {
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      state: rpcData?.game_state,
      word_accepted: true,
      points: outcome.points,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Submission failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
