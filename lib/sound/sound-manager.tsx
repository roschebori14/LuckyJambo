"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SOUND_EFFECTS, type SoundEffectName } from "./effect-catalog";

const MUTE_STORAGE_KEY = "lj_sound_muted";
const VOLUME_STORAGE_KEY = "lj_sound_volume";

interface SoundContextValue {
  play: (effect: SoundEffectName) => void;
  muted: boolean;
  toggleMute: () => void;
  volume: number; // 0-1 master volume, multiplied with each effect's own volume
  setVolume: (v: number) => void;
}

const SoundContext = createContext<SoundContextValue>({
  play: () => {},
  muted: false,
  toggleMute: () => {},
  volume: 1,
  setVolume: () => {},
});

/**
 * Mount once near the root of the authenticated app, right alongside
 * ToastProvider (see (protected)/layout.tsx). Everything below in the
 * tree can then call `useSound().play("match-win")` etc.
 *
 * How a sound gets from Freesound to the speaker:
 *   1. play(effect) is called from game/UI code.
 *   2. If we've never resolved this effect this session, we fetch
 *      /api/sound/resolve?effect=... (server proxies + caches the
 *      actual Freesound lookup - the API key never reaches this file).
 *   3. The returned preview URL is used to build one <audio> element,
 *      cached in `audioCache` keyed by effect name, so the browser
 *      only downloads each clip once per page load no matter how many
 *      times it's played (repeated `.play()` calls on the same
 *      element after resetting currentTime, not repeated fetches).
 *   4. Mute + master volume are persisted to localStorage so a
 *      player's preference survives a reload/new tab.
 */
export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const audioCache = useRef<Map<SoundEffectName, HTMLAudioElement>>(new Map());
  const resolving = useRef<Map<SoundEffectName, Promise<string | null>>>(new Map());
  const hydrated = useRef(false);

  // Hydrate persisted preferences once on mount (client-only; avoids
  // SSR mismatch since localStorage doesn't exist on the server).
  useEffect(() => {
    try {
      const storedMute = localStorage.getItem(MUTE_STORAGE_KEY);
      if (storedMute !== null) setMuted(storedMute === "1");
      const storedVolume = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (storedVolume !== null) setVolumeState(Number(storedVolume));
    } catch {
      // localStorage can throw in some privacy modes; sound just
      // falls back to session-only defaults.
    } finally {
      hydrated.current = true;
    }
  }, []);

  const resolveUrl = useCallback(async (effect: SoundEffectName): Promise<string | null> => {
    const inflight = resolving.current.get(effect);
    if (inflight) return inflight;

    const promise = fetch(`/api/sound/resolve?effect=${effect}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => (json?.success ? (json.url as string) : null))
      .catch(() => null)
      .finally(() => {
        resolving.current.delete(effect);
      });

    resolving.current.set(effect, promise);
    return promise;
  }, []);

  const play = useCallback(
    (effect: SoundEffectName) => {
      if (muted) return;
      const definition = SOUND_EFFECTS[effect];
      if (!definition) return;

      const cached = audioCache.current.get(effect);
      if (cached) {
        cached.volume = Math.min(1, Math.max(0, definition.volume * volume));
        cached.currentTime = 0;
        cached.play().catch(() => {
          // Autoplay-policy rejections etc. are non-fatal for a sound
          // effect - silently drop rather than throwing in game code.
        });
        return;
      }

      resolveUrl(effect).then((url) => {
        if (!url) return;
        const audio = new Audio(url);
        audio.preload = "auto";
        audio.volume = Math.min(1, Math.max(0, definition.volume * volume));
        audioCache.current.set(effect, audio);
        audio.play().catch(() => {});
      });
    },
    [muted, volume, resolveUrl]
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ play, muted, toggleMute, volume, setVolume }),
    [play, muted, toggleMute, volume, setVolume]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  return useContext(SoundContext);
}
