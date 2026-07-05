// Single source of truth for every UI/game sound effect in the app.
//
// Each entry maps our internal effect name to a Freesound text search
// (used the first time an effect is resolved) and an optional pinned
// `fallbackId` - a specific Freesound sound id to use if the search
// ever returns nothing suitable, or to guarantee a stable pick instead
// of "whatever ranks #1 on Freesound today". Pin fallbackId once
// you've picked good sounds in the Freesound UI (bugpixel, Freesound
// community, etc.) and vetted their license (see LICENSE note below).
//
// LICENSE NOTE: Freesound content is per-sound licensed (CC0, CC-BY,
// CC-BY-NC...). This client filters search results to CC0 /
// "Attribution" only (see freesound-client.ts) so nothing NC ends up
// wired into a commercial product by accident, but if you pin a
// fallbackId by hand, double check its license on the sound's page
// before shipping it.
export type SoundEffectName =
  | "move" // any placed piece / played turn (chess, draughts, tic-tac-toe, board games)
  | "dice-roll"
  | "coin-flip"
  | "match-win"
  | "match-lose"
  | "match-draw"
  | "message-received" // DM toast
  | "notification" // generic toast (friend request, deposit/withdrawal, etc.)
  | "button-tap"
  | "match-found" // opponent joined / match started
  | "deposit-success"
  | "withdrawal-success";

interface EffectDefinition {
  query: string;
  fallbackId?: number;
  /** Default playback volume, 0-1. Kept low for UI taps, higher for win/lose. */
  volume: number;
}

export const SOUND_EFFECTS: Record<SoundEffectName, EffectDefinition> = {
  move: { query: "board game piece tap click", volume: 0.5 },
  "dice-roll": { query: "dice roll shake", volume: 0.6 },
  "coin-flip": { query: "coin flip spin", volume: 0.6 },
  "match-win": { query: "game win success chime", volume: 0.8 },
  "match-lose": { query: "game lose fail low tone", volume: 0.7 },
  "match-draw": { query: "neutral notification tone", volume: 0.6 },
  "message-received": { query: "message pop notification", volume: 0.6 },
  notification: { query: "ui notification ping short", volume: 0.5 },
  "button-tap": { query: "ui click tap soft", volume: 0.35 },
  "match-found": { query: "game start whoosh", volume: 0.6 },
  "deposit-success": { query: "cash register coin success", volume: 0.7 },
  "withdrawal-success": { query: "confirm success chime", volume: 0.7 },
};

export const SOUND_EFFECT_NAMES = Object.keys(SOUND_EFFECTS) as SoundEffectName[];
