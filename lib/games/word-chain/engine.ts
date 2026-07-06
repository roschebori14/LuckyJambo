import "server-only";
import fs from "node:fs";
import path from "node:path";
import { WordChainGame, type WordChainG, type Seat } from "./game";
import type { WordChainState } from "@/types/word-chain";

// Loaded once per server process (module-level, same idea as
// lib/sound/sound-cache.ts's in-memory cache) - 61k short strings is a
// trivial amount of memory to keep resident, and this avoids a disk
// read on every single word submission.
//
// Source: this project's own container ships hunspell-en-us
// (/usr/share/hunspell/en_US.dic) as a system package; wordlist.txt
// here is that dictionary's headwords only (no inflected forms
// unmunched from the .aff affix rules - unmunch wasn't available to
// expand them), lowercased, alphabetic, 3-15 letters, proper nouns
// dropped. 61,090 words is a solid Word Chain vocabulary; if a real
// player hits a legitimate word this list is missing, add it to
// wordlist.txt directly - no schema/migration needed for that.
let dictionary: Set<string> | null = null;

function getDictionary(): Set<string> {
  if (!dictionary) {
    const raw = fs.readFileSync(path.join(process.cwd(), "lib/games/word-chain/wordlist.txt"), "utf-8");
    dictionary = new Set(raw.split("\n").map((w) => w.trim()).filter(Boolean));
  }
  return dictionary;
}

export function createInitialState(creatorId: string): WordChainState {
  return {
    chain: [],
    required_letter: null,
    current_turn: "A",
    strikes_a: 0,
    strikes_b: 0,
    max_strikes: 3,
    winner: null,
    game_over: false,
    a_player_id: creatorId,
    b_player_id: null,
  };
}

export class WordChainRulesError extends Error {}

export interface SubmitWordOutcome {
  state: WordChainState;
  wordAccepted: boolean;
  reason?: string;
}

/**
 * Validates + applies one word submission. Rejections that never
 * reach the boardgame.io move at all (game already over, not a
 * participant, not this player's turn) throw WordChainRulesError - the
 * API route turns those into a 400, same as every other game's engine.
 *
 * A submission that reaches the dictionary/chain/letter check but
 * fails it is NOT thrown - it's a normal outcome (costs a strike,
 * possibly ends the match) and comes back as `wordAccepted: false`
 * with a human-readable `reason`, because the request itself
 * succeeded; the word just wasn't legal.
 */
export function applySubmitWord(
  state: WordChainState,
  playerId: string,
  rawWord: string,
): SubmitWordOutcome {
  if (state.game_over) {
    throw new WordChainRulesError("This match has already ended");
  }

  const isA = state.a_player_id === playerId;
  const isB = state.b_player_id === playerId;
  if (!isA && !isB) {
    throw new WordChainRulesError("You are not a participant in this match");
  }

  const mySeat: Seat = isA ? "A" : "B";
  if (state.current_turn !== mySeat) {
    throw new WordChainRulesError("It's not your turn");
  }

  const word = rawWord.trim().toLowerCase();
  const usedAlready = state.chain.includes(word);

  let reason: string | undefined;
  let valid = true;

  if (!/^[a-z]{3,15}$/.test(word)) {
    valid = false;
    reason = "Words must be 3-15 letters, no spaces or punctuation";
  } else if (state.required_letter && word[0] !== state.required_letter) {
    valid = false;
    reason = `Word must start with "${state.required_letter.toUpperCase()}"`;
  } else if (usedAlready) {
    valid = false;
    reason = "That word has already been used in this match";
  } else if (!getDictionary().has(word)) {
    valid = false;
    reason = `"${rawWord.trim()}" isn't in the dictionary`;
  }

  const G: WordChainG = {
    chain: state.chain,
    requiredLetter: state.required_letter,
    strikesA: state.strikes_a,
    strikesB: state.strikes_b,
    maxStrikes: state.max_strikes,
    winner: state.winner,
  };
  const ctx = { currentPlayer: mySeat === "A" ? "0" : "1" };

  const moveFn = WordChainGame.moves!.submitWord as unknown as (
    context: unknown,
    payload: { word: string; valid: boolean },
  ) => WordChainG;
  const newG = moveFn({ G, ctx } as never, { word, valid });

  const gameOver = newG.winner !== null;

  const nextState: WordChainState = {
    chain: newG.chain,
    required_letter: newG.requiredLetter,
    // Turn only passes on an accepted word - an invalid attempt costs
    // a strike but leaves it the same player's turn to try again.
    current_turn: valid ? (mySeat === "A" ? "B" : "A") : mySeat,
    strikes_a: newG.strikesA,
    strikes_b: newG.strikesB,
    max_strikes: newG.maxStrikes,
    winner: newG.winner,
    game_over: gameOver,
    a_player_id: state.a_player_id,
    b_player_id: state.b_player_id,
  };

  return { state: nextState, wordAccepted: valid, reason };
}
