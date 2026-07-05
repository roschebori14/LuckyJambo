// Preset quick-chat messages for use during a live match.
//
// This is intentionally a closed list, not free-text chat - no
// profanity filter, no moderation queue, nothing to abuse. The API
// route re-validates every message against this exact list before
// insert, and the database CHECK constraint in
// supabase/migrations/047_match_chat.sql enforces the same list a
// second time regardless of what calls the insert.
//
// If this list ever changes, 047_match_chat.sql's CHECK constraint
// must be updated in a follow-up migration to match - the two are not
// derived from a single source of truth.
export const MATCH_CHAT_PHRASES = [
  "GG",
  "Nice one!",
  "Well played",
  "Unlucky!",
  "So close!",
  "Good luck!",
  "Rematch?",
  "Nooo!",
] as const;

export const MATCH_CHAT_EMOJI = [
  "👍",
  "🔥",
  "😂",
  "😅",
  "👏",
  "😢",
  "🤝",
  "💪",
] as const;

export const MATCH_CHAT_PRESETS = [
  ...MATCH_CHAT_PHRASES,
  ...MATCH_CHAT_EMOJI,
] as const;

export type MatchChatPreset = (typeof MATCH_CHAT_PRESETS)[number];

export function isMatchChatPreset(value: string): value is MatchChatPreset {
  return (MATCH_CHAT_PRESETS as readonly string[]).includes(value);
}
