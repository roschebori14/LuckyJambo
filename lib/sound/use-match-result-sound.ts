import { useEffect, useRef } from "react";
import { useSound } from "./sound-manager";

interface MatchResultLike {
  status?: string;
  you_won?: boolean;
}

/**
 * Drop this into any board component that already tracks a `result`
 * object with `{ status, you_won }` (instant-game-board.tsx, and the
 * same shape chess/draughts/tic-tac-toe/battleship/snakes-ladders
 * boards use for their post-game banner). Fires the matching sound
 * exactly once when the match resolves, and ignores everything before
 * that (in-progress board state, null result while still loading).
 *
 * Usage:
 *   useMatchResultSound(result);
 */
export function useMatchResultSound(result: MatchResultLike | null | undefined) {
  const { play } = useSound();
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!result || !result.status) return;
    if (result.status !== "resolved" && result.status !== "completed" && result.status !== "draw") {
      return;
    }

    // Key by the whole result shape so a genuinely new match (new
    // matchId reusing this same component instance) fires again, but
    // re-renders of the same resolved result don't replay the sound.
    const key = `${result.status}:${result.you_won}`;
    if (firedFor.current === key) return;
    firedFor.current = key;

    if (result.status === "draw") {
      play("match-draw");
    } else if (result.you_won) {
      play("match-win");
    } else {
      play("match-lose");
    }
  }, [result, play]);
}
