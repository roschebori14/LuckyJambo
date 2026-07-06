import "server-only";
import { SOUND_EFFECTS, type SoundEffectName } from "./effect-catalog";

const FREESOUND_API_BASE = "https://freesound.org/apiv2";

// Freesound's *filter* param takes the human-readable license names
// below ("Creative Commons 0", "Attribution"), but the *response*
// field for each sound is a license URL instead, e.g.
//   http://creativecommons.org/publicdomain/zero/1.0/   (CC0)
//   https://creativecommons.org/licenses/by/4.0/         (Attribution)
//   https://creativecommons.org/licenses/by-nc/4.0/      (Attribution-NonCommercial - NOT allowed)
// so results can't be re-checked with the same strings used to build
// the filter - that comparison always fails (the substring never
// appears in a URL), silently discarding every valid result. Match
// against the URL shape instead.
function isAllowedLicense(license: string | undefined | null): boolean {
  if (!license) return false;
  // CC0 - public domain, no attribution required.
  if (license.includes("publicdomain/zero")) return true;
  // Plain Attribution ("by") only - explicitly exclude the
  // NonCommercial ("by-nc") and retired Sampling+ variants, both of
  // which also contain "/licenses/" and would otherwise slip through
  // a looser check.
  if (/\/licenses\/by\/\d/.test(license)) return true;
  return false;
}

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
      "FREESOUND_API_KEY is not set. Add it to .env.local (see .env.example).",
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
  effect: SoundEffectName,
): Promise<ResolvedSound | null> {
  const definition = SOUND_EFFECTS[effect];
  if (!definition) return null;

  if (definition.fallbackId) {
    const pinned = await fetchSoundById(definition.fallbackId);
    if (pinned) return pinned;
  }

  const found = await searchOnce(definition.query);
  if (found) return found;

  // The full, specific query (e.g. "board game piece tap click") can
  // legitimately return nothing - Freesound's text search doesn't
  // guarantee a hit for an arbitrary multi-word phrase, and until now
  // that meant the effect just silently never played, permanently
  // (only a pinned fallbackId could rescue it). Retry with just the
  // first word, which is virtually always a real, common term
  // ("dice", "board", "coin"...) with plenty of results on a library
  // Freesound's size - much more likely to return *something* playable
  // than giving up outright.
  const firstWord = definition.query.split(" ")[0];
  if (firstWord && firstWord !== definition.query) {
    const fallback = await searchOnce(firstWord);
    if (fallback) return fallback;
  }

  return null;
}

async function searchOnce(query: string): Promise<ResolvedSound | null> {
  const params = new URLSearchParams({
    query,
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
    console.error(`Freesound search failed for query "${query}":`, res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as FreesoundSearchResult;
  const match = data.results.find((r) => isAllowedLicense(r.license));
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
    },
  );
  if (!res.ok) return null;
  const s = await res.json();
  if (!isAllowedLicense(s.license)) return null;
  return {
    freesoundId: s.id,
    previewUrl: s.previews["preview-hq-mp3"] ?? s.previews["preview-lq-mp3"],
    name: s.name,
    author: s.username,
    license: s.license,
  };
}
