import type { SupabaseClient } from "@supabase/supabase-js";
import type { WordChainState } from "@/types/word-chain";

/** True when the current turn's deadline has passed (client-side estimate). */
export function isTurnExpired(state: WordChainState, nowMs = Date.now()): boolean {
  if (state.game_over) return false;
  const started = Date.parse(state.turn_started_at);
  if (!Number.isFinite(started)) return false;
  return nowMs >= started + state.turn_seconds * 1000;
}

/**
 * If the turn clock has expired, apply the timeout strike server-side.
 * Returns the updated state when a timeout was applied, otherwise null.
 */
export async function applyPendingTimeout(
  supabase: SupabaseClient,
  matchId: string,
  state: WordChainState,
): Promise<WordChainState | null> {
  if (!isTurnExpired(state)) return null;

  const { data, error } = await supabase.rpc("apply_word_chain_timeout", {
    p_match_id: matchId,
  });

  if (error || !data?.game_state) return null;
  return data.game_state as WordChainState;
}
