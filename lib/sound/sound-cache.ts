import "server-only";
import { resolveEffectFromFreesound, type ResolvedSound } from "./freesound-client";
import { SOUND_EFFECT_NAMES, type SoundEffectName } from "./effect-catalog";

// Process-local cache. Good enough for a single-region Next.js
// deployment; if this ever runs across multiple serverless instances
// with heavy cold-starts, swap this for a `games` table row or a
// small `sound_cache` table the same way other server state in this
// project goes through Supabase rather than in-memory maps - not
// needed at current traffic.
interface CacheEntry {
  sound: ResolvedSound;
  expiresAt: number;
}

const cache = new Map<SoundEffectName, CacheEntry>();
// Prevents duplicate in-flight Freesound calls when many players
// trigger the same effect at once (e.g. everyone's "move" sound
// resolving for the first time right after a deploy).
const inFlight = new Map<SoundEffectName, Promise<ResolvedSound | null>>();

function ttlMs(): number {
  return Number(process.env.FREESOUND_CACHE_TTL ?? 86400) * 1000;
}

export async function getEffectSound(
  effect: SoundEffectName
): Promise<ResolvedSound | null> {
  if (!SOUND_EFFECT_NAMES.includes(effect)) return null;

  const cached = cache.get(effect);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.sound;
  }

  const pending = inFlight.get(effect);
  if (pending) return pending;

  const promise = resolveEffectFromFreesound(effect)
    .then((sound) => {
      if (sound) {
        cache.set(effect, { sound, expiresAt: Date.now() + ttlMs() });
      }
      return sound;
    })
    .finally(() => {
      inFlight.delete(effect);
    });

  inFlight.set(effect, promise);
  return promise;
}

/** Warms the cache for every catalog effect - call this once at server
 * startup (e.g. from instrumentation.ts) so the first player of the
 * day isn't the one eating the Freesound round-trip latency. */
export async function warmSoundCache(): Promise<void> {
  await Promise.all(SOUND_EFFECT_NAMES.map((effect) => getEffectSound(effect)));
}
