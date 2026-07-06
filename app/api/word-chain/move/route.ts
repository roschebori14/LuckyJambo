import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applySubmitWord, WordChainRulesError } from "@/lib/games/word-chain/engine";
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

    const state = match.game_state as WordChainState;

    // applySubmitWord (lib/games/word-chain/engine.ts) does the
    // dictionary/letter/repeat check and runs the validated result
    // through WordChainGame's actual boardgame.io move - this route
    // just shuttles state in and the result out. Note the distinction:
    // a thrown WordChainRulesError means the *request* was illegal
    // (not your turn, game already over) - a 400. An accepted-but-
    // wrong word is not thrown; it's a normal 200 with
    // word_accepted: false, because the submission itself was valid,
    // the word just wasn't.
    let outcome;
    try {
      outcome = applySubmitWord(state, user.id, validated.word);
    } catch (err) {
      if (err instanceof WordChainRulesError) {
        return NextResponse.json({ success: false, message: err.message }, { status: 400 });
      }
      throw err;
    }

    // Persistence + settlement happen atomically in the DB via a
    // SECURITY DEFINER RPC, same reasoning as every other game: no RLS
    // UPDATE policy on `matches`, so a player's own session can't
    // rewrite the chain or winner directly. p_expected_chain re-checks
    // the chain hasn't changed since this player last read it
    // (optimistic concurrency).
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
