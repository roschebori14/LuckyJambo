import "server-only";
import { SOUND_EFFECTS, type SoundEffectName } from "./effect-catalog";

const FREESOUND_API_BASE = "https://freesound.org/apiv2";

// Only license terms that are safe to bundle into a commercial product
// without per-sound attribution bookkeeping getting out of hand.
// (Freesound's "Attribution" license still legally requires crediting
// the author - see /legal/attribution for how this project surfaces
// that - but it does NOT restrict commercial use, unlike NC variants.)
const ALLOWED_LICENSES = [
  "Creative Commons 0",
  "Attribution",
];

interface FreesoundSearchResult {
  results: Array<{
    id: number;
    name: string;
    license: string;
    username: string;
    previews: {
      "preview-hq-mp3": string;
      "preview-lq-mp3": string;
    };
  }>;
}

export interface ResolvedSound {
  freesoundId: number;
  previewUrl: string;
  name: string;
  author: string;
  license: string;
}

function apiKey(): string {
  const key = process.env.FREESOUND_API_KEY;
  if (!key) {
    throw new Error(
      "FREESOUND_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }
  return key;
}

/**
 * Resolves one catalog effect to a playable preview URL by querying
 * Freesound's text search, filtered to short, appropriately-licensed
 * clips. Server-side only - the API key never leaves this module.
 *
 * Callers should go through resolveAndCacheEffect() in sound-cache.ts
 * rather than calling this directly on every request, since Freesound
 * rate-limits are generous but not unlimited (60 req/min on a basic
 * API key at time of writing - re-verify on the Freesound dashboard).
 */
export async function resolveEffectFromFreesound(
  effect: SoundEffectName
): Promise<ResolvedSound | null> {
  const definition = SOUND_EFFECTS[effect];
  if (!definition) return null;

  if (definition.fallbackId) {
    const pinned = await fetchSoundById(definition.fallbackId);
    if (pinned) return pinned;
  }

  const params = new URLSearchParams({
    query: definition.query,
    filter: `duration:[0.1 TO 4] license:("Creative Commons 0" OR "Attribution")`,
    sort: "rating_desc",
    fields: "id,name,license,username,previews",
    page_size: "5",
  });

  const res = await fetch(`${FREESOUND_API_BASE}/search/text/?${params}`, {
    headers: { Authorization: `Token ${apiKey()}` },
    // Freesound content doesn't change minute to minute; let Next.js
    // cache this at the fetch layer in addition to our own cache.
    next: { revalidate: Number(process.env.FREESOUND_CACHE_TTL ?? 86400) },
  });

  if (!res.ok) {
    console.error(`Freesound search failed for "${effect}":`, res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as FreesoundSearchResult;
  const match = data.results.find((r) => ALLOWED_LICENSES.some((l) => r.license.includes(l)));
  if (!match) return null;

  return {
    freesoundId: match.id,
    previewUrl: match.previews["preview-hq-mp3"] ?? match.previews["preview-lq-mp3"],
    name: match.name,
    author: match.username,
    license: match.license,
  };
}

async function fetchSoundById(id: number): Promise<ResolvedSound | null> {
  const res = await fetch(
    `${FREESOUND_API_BASE}/sounds/${id}/?fields=id,name,license,username,previews`,
    {
      headers: { Authorization: `Token ${apiKey()}` },
      next: { revalidate: Number(process.env.FREESOUND_CACHE_TTL ?? 86400) },
    }
  );
  if (!res.ok) return null;
  const s = await res.json();
  if (!ALLOWED_LICENSES.some((l) => (s.license as string)?.includes(l))) return null;
  return {
    freesoundId: s.id,
    previewUrl: s.previews["preview-hq-mp3"] ?? s.previews["preview-lq-mp3"],
    name: s.name,
    author: s.username,
    license: s.license,
  };
}
