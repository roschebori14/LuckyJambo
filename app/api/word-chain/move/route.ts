import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applySubmitWord, WordChainRulesError } from "@/lib/games/word-chain/engine";
import { applyPendingTimeout } from "@/lib/games/word-chain/timeout";
import type { WordChainState } from "@/types/word-chain";
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

    let state = match.game_state as WordChainState;

    // Apply any pending timeout before evaluating the word submission.
    const afterTimeout = await applyPendingTimeout(supabase, validated.match_id, state);
    if (afterTimeout) {
      return NextResponse.json({
        success: true,
        state: afterTimeout,
        word_accepted: false,
        reason: "Time's up — strike added. Try again!",
        timed_out: true,
      });
    }

    let outcome;
    try {
      outcome = applySubmitWord(state, user.id, validated.word);
    } catch (err) {
      if (err instanceof WordChainRulesError) {
        return NextResponse.json({ success: false, message: err.message }, { status: 400 });
      }
      throw err;
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc("apply_word_chain_move_result", {
      p_match_id: validated.match_id,
      p_expected_chain: state.chain,
      p_new_chain: outcome.state.chain,
      p_new_required_letter: outcome.state.required_letter,
      p_new_turn: outcome.state.current_turn,
      p_new_strikes_a: outcome.state.strikes_a,
      p_new_strikes_b: outcome.state.strikes_b,
      p_winner: outcome.state.winner,
      p_game_over: outcome.state.game_over,
    });

    if (rpcError) {
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      state: rpcData?.game_state,
      word_accepted: outcome.wordAccepted,
      reason: outcome.reason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move failed";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
