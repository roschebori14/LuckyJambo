// Word Chain - rules engine
//
// Same division of labor as lib/games/four-in-a-row/game.ts: this is a
// real boardgame.io `Game` config, authored against boardgame.io's public
// types, and it's the single source of truth for "does this submission
// advance the chain, cost a strike, or end the match". It does NOT know
// about the dictionary or the used-word list - dictionary lookup needs
// file I/O (see ./wordlist.txt) which has no place in a Game object
// that's meant to be a pure state machine. `engine.ts` in this folder
// does that lookup, decides the boolean "is this a legal word right
// now", and hands that boolean in here - this file only ever answers
// "given that a word either was or wasn't legal, what happens to the
// match state".
//
// Run headlessly, same as every other new game since Four in a Row -
// see engine.ts for why (one realtime/persistence path: Supabase, not
// boardgame.io's own multiplayer transport).

import type { Game } from "boardgame.io";
import { INVALID_MOVE } from "boardgame.io/core";

export type Seat = "A" | "B";

export interface WordChainG {
  chain: string[];
  requiredLetter: string | null;
  strikesA: number;
  strikesB: number;
  maxStrikes: number;
  winner: Seat | null;
}

export interface SubmitWordPayload {
  word: string; // already lowercased/trimmed by engine.ts
  valid: boolean; // engine.ts's dictionary+chain+letter verdict
}

export const WordChainGame: Game<WordChainG> = {
  setup: () => ({
    chain: [],
    requiredLetter: null,
    strikesA: 0,
    strikesB: 0,
    maxStrikes: 3,
    winner: null,
  }),

  moves: {
    submitWord: ({ G, ctx }, payload: SubmitWordPayload) => {
      if (G.winner) return INVALID_MOVE;

      const seat: Seat = ctx.currentPlayer === "0" ? "A" : "B";

      if (payload.valid) {
        return {
          ...G,
          chain: [...G.chain, payload.word],
          requiredLetter: payload.word[payload.word.length - 1],
        };
      }

      // Wrong/duplicate/too-short word: the acting player takes a
      // strike, the chain is untouched, and (per engine.ts, which
      // doesn't advance current_turn on an invalid submission) it's
      // still their turn - they get another shot at the same
      // requiredLetter rather than losing their turn outright.
      const strikesA = seat === "A" ? G.strikesA + 1 : G.strikesA;
      const strikesB = seat === "B" ? G.strikesB + 1 : G.strikesB;
      const busted = (seat === "A" ? strikesA : strikesB) >= G.maxStrikes;

      return {
        ...G,
        strikesA,
        strikesB,
        winner: busted ? (seat === "A" ? "B" : "A") : null,
      };
    },
  },

  endIf: ({ G }) => {
    if (G.winner) return { winner: G.winner };
    return undefined;
  },
};
