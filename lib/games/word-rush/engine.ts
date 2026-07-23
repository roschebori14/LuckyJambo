import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { WordRushState, WordRushSeat } from "@/types/word-rush";

// Deliberately NOT a boardgame.io `Game` (unlike word-chain/game.ts,
// four-in-a-row/game.ts, dots-and-boxes/game.ts). Every one of those
// exists because boardgame.io's move/turn model is a good fit for
// "exactly one player acts, then the turn passes" - that's the whole
// abstraction ctx.currentPlayer is built around. Word Rush has no
// turn order at all: both players submit words independently and
// concurrently for the whole round window, which doesn't map onto
// "whose turn is it" in any useful way. This project already has
// precedent for skipping boardgame.io when a game's shape doesn't
// call for it - rock-paper-scissors/coin-flip/dice (lib/games/
// rps-engine.ts, coinflip-engine.ts, dice-engine.ts) resolve in a
// single simultaneous reveal and don't use it either. So this folder
// only has an engine.ts: plain, pure, server-only functions, same
// division of labor as every other engine.ts (dictionary + validation
// logic lives here), just without a Game object underneath it.

// Reuses word-chain's dictionary rather than sourcing a new one, per
// the build brief - same lazy-loaded, module-level cache idea as
// lib/games/word-chain/engine.ts's getDictionary.
let dictionary: Set<string> | null = null;

function getDictionary(): Set<string> {
  if (!dictionary) {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "lib/games/word-chain/wordlist.txt"),
      "utf-8",
    );
    dictionary = new Set(raw.split("\n").map((w) => w.trim()).filter(Boolean));
  }
  return dictionary;
}

// ---------------------------------------------------------------
// Letter scramble generation
// ---------------------------------------------------------------

// Approximate English letter-frequency weights (per mille), the same
// idea real word-scramble/Boggle-style games use so a random draw
// still reliably contains playable words instead of being uniform
// A-Z (which routinely produces boards with three Qs and no vowels).
// Rare letters (J, Q, X, Z) are kept in the pool at a low but nonzero
// weight - real Boggle dice include them too, just sparingly.
const LETTER_WEIGHTS: Record<string, number> = {
  a: 82, b: 15, c: 28, d: 43, e: 127, f: 22, g: 20, h: 61, i: 70,
  j: 2, k: 8, l: 40, m: 24, n: 67, o: 75, p: 19, q: 1, r: 60,
  s: 63, t: 91, u: 28, v: 10, w: 24, x: 2, y: 20, z: 1,
};
const VOWELS = new Set(["a", "e", "i", "o", "u"]);

const WEIGHTED_POOL: string[] = Object.entries(LETTER_WEIGHTS).flatMap(
  ([letter, weight]) => Array(weight).fill(letter),
);

function drawLetter(): string {
  return WEIGHTED_POOL[Math.floor(Math.random() * WEIGHTED_POOL.length)];
}

// Generates a shared scramble for the round. Retries (bounded) until
// the draw has a reasonable number of vowels - a straight weighted
// draw is already vowel-heavy on average, but a run of bad luck could
// still produce something like 14 consonants and 1 vowel, which is
// close to unplayable. This is the only "regenerate if unlucky" logic
// here; everything else about the draw is a single honest random pass.
export function generateScramble(count = 14): string[] {
  const minVowels = Math.max(3, Math.round(count * 0.3));

  for (let attempt = 0; attempt < 25; attempt++) {
    const letters = Array.from({ length: count }, drawLetter);
    const vowelCount = letters.filter((l) => VOWELS.has(l)).length;
    if (vowelCount >= minVowels) return letters;
  }

  // Should be unreachable in practice given the weighting above, but
  // never let match creation hard-fail on bad luck - fall back to a
  // scramble that simply forces the minimum vowel count directly.
  const forced = Array.from({ length: count }, drawLetter);
  let vowelDeficit = minVowels - forced.filter((l) => VOWELS.has(l)).length;
  const vowelPool = ["a", "e", "i", "o", "u"];
  for (let i = 0; i < forced.length && vowelDeficit > 0; i++) {
    if (!VOWELS.has(forced[i])) {
      forced[i] = vowelPool[vowelDeficit % vowelPool.length];
      vowelDeficit--;
    }
  }
  return forced;
}

export function createInitialState(creatorId: string, roundSeconds = 80): WordRushState {
  return {
    letters: generateScramble(),
    round_started_at: null,
    round_seconds: roundSeconds,
    a_player_id: creatorId,
    b_player_id: null,
    a_found_words: [],
    b_found_words: [],
    a_score: 0,
    b_score: 0,
    winner: null,
    game_over: false,
  };
}

// ---------------------------------------------------------------
// Word validation
// ---------------------------------------------------------------

function canFormFromLetters(word: string, letters: string[]): boolean {
  const available = new Map<string, number>();
  for (const l of letters) available.set(l, (available.get(l) ?? 0) + 1);

  for (const ch of word) {
    const remaining = available.get(ch) ?? 0;
    if (remaining <= 0) return false;
    available.set(ch, remaining - 1);
  }
  return true;
}

// Real GamePigeon Word Hunt scoring: non-linear, back-loaded toward
// long words (confirmed against real Word Hunt data rather than a
// flat +100/letter scale, per the build brief's ask to check this).
//   3 letters -> 100
//   4 letters -> 400
//   5 letters -> 800
//   6 letters -> 1400
//   7+ letters -> 1400 + 200 per letter past 6
export function scoreForWord(word: string): number {
  const n = word.length;
  if (n <= 3) return 100;
  if (n === 4) return 400;
  if (n === 5) return 800;
  if (n === 6) return 1400;
  return 1400 + 200 * (n - 6);
}

export class WordRushRulesError extends Error {}

export interface SubmitWordOutcome {
  state: WordRushState;
  wordAccepted: boolean;
  points?: number;
  reason?: string;
}

/**
 * Validates + applies one word submission during an active round.
 * Same split as word-chain's applySubmitWord: a thrown
 * WordRushRulesError means the *request* itself was illegal (not a
 * participant, round not active yet, round already over) - a 400. A
 * word that reaches the scramble/dictionary/already-found check but
 * fails it is a normal outcome (nothing happens - no strike, no
 * penalty, per the build brief) and comes back as
 * `wordAccepted: false` with a human-readable reason.
 */
export function applySubmitWord(
  state: WordRushState,
  playerId: string,
  rawWord: string,
): SubmitWordOutcome {
  if (state.game_over) {
    throw new WordRushRulesError("This match has already ended");
  }

  const isA = state.a_player_id === playerId;
  const isB = state.b_player_id === playerId;
  if (!isA && !isB) {
    throw new WordRushRulesError("You are not a participant in this match");
  }

  if (!state.round_started_at) {
    throw new WordRushRulesError("The round hasn't started yet");
  }

  // Belt-and-suspenders check, same reasoning as word-chain's turn
  // clock check: the real deadline enforcement lives in the DB RPC
  // (apply_word_rush_submit_word, using the database's own now()),
  // this just avoids doing the validation work at all for a
  // submission that's already going to be rejected server-side.
  const startedAt = Date.parse(state.round_started_at);
  if (Number.isFinite(startedAt) && Date.now() - startedAt > state.round_seconds * 1000) {
    throw new WordRushRulesError("The round has already ended");
  }

  const seat: WordRushSeat = isA ? "A" : "B";
  const word = rawWord.trim().toLowerCase();
  const foundWords = seat === "A" ? state.a_found_words : state.b_found_words;

  let reason: string | undefined;
  let valid = true;

  if (!/^[a-z]{3,15}$/.test(word)) {
    valid = false;
    reason = "Words must be 3-15 letters, no spaces or punctuation";
  } else if (foundWords.includes(word)) {
    valid = false;
    reason = "You've already found that word this round";
  } else if (!canFormFromLetters(word, state.letters)) {
    valid = false;
    reason = "That word isn't in the scramble";
  } else if (!getDictionary().has(word)) {
    valid = false;
    reason = `"${rawWord.trim()}" isn't in the dictionary`;
  }

  if (!valid) {
    return { state, wordAccepted: false, reason };
  }

  const points = scoreForWord(word);
  const nextState: WordRushState = {
    ...state,
    a_found_words: seat === "A" ? [...state.a_found_words, word] : state.a_found_words,
    b_found_words: seat === "B" ? [...state.b_found_words, word] : state.b_found_words,
    a_score: seat === "A" ? state.a_score + points : state.a_score,
    b_score: seat === "B" ? state.b_score + points : state.b_score,
  };

  return { state: nextState, wordAccepted: true, points };
}

/**
 * Given final scores, decides the outcome. Called once the round
 * timer has actually elapsed (server clock) - see
 * apply_word_rush_end_round in the migration, which re-derives
 * everything from the locked match row rather than trusting this
 * function's caller about anything except the two already-persisted
 * score totals.
 */
export function reconcileRoundEnd(state: WordRushState): {
  winner: WordRushSeat | null;
} {
  if (state.a_score === state.b_score) return { winner: null };
  return { winner: state.a_score > state.b_score ? "A" : "B" };
}
