// Per-game display metadata - badge label + accent background - shared
// between components/games/game-card.tsx (the games list) and
// components/matches/match-card.tsx (the matchmaking lobby), so a
// game's color/type identity is defined in exactly one place.
export const GAME_META: Record<string, { type: "Instant" | "Turn-based"; bg: string }> = {
  chess:               { type: "Turn-based", bg: "bg-slate-900" },
  draughts:            { type: "Turn-based", bg: "bg-red-950" },
  "tic-tac-toe":       { type: "Turn-based", bg: "bg-blue-950" },
  dice:                { type: "Instant",    bg: "bg-purple-950" },
  rock_paper_scissors: { type: "Instant",    bg: "bg-orange-950" },
  coin_flip:           { type: "Instant",    bg: "bg-yellow-950" },
  battleship:          { type: "Turn-based", bg: "bg-slate-950" },
  "snakes-ladders":    { type: "Turn-based", bg: "bg-emerald-950" },
  "four-in-a-row":     { type: "Turn-based", bg: "bg-blue-950" },
  "dots-and-boxes":    { type: "Turn-based", bg: "bg-pink-950" },
  "word-chain":        { type: "Turn-based", bg: "bg-indigo-950" },
  "ludo":              { type: "Turn-based", bg: "bg-rose-950" },
  "eight-ball-pool":   { type: "Turn-based", bg: "bg-emerald-900" },
  "word-rush":         { type: "Instant",    bg: "bg-cyan-950" },
  archery:             { type: "Turn-based", bg: "bg-green-950" },
};

export function getGameMeta(slug: string) {
  const normalized = slug.trim().toLowerCase();
  return GAME_META[normalized] ?? { type: "Turn-based" as const, bg: "bg-gray-900" };
}
