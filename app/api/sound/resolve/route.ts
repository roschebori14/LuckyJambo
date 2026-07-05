import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectSound } from "@/lib/sound/sound-cache";
import { SOUND_EFFECT_NAMES, type SoundEffectName } from "@/lib/sound/effect-catalog";

/**
 * GET /api/sound/resolve?effect=match-win
 *
 * Returns a playable preview URL for one catalog sound effect. This is
 * the ONLY thing the browser ever talks to for sound - the Freesound
 * API key stays server-side in freesound-client.ts, and results are
 * cached in-process (sound-cache.ts) so this doesn't hammer Freesound
 * every time a player wins a match.
 *
 * Auth-gated the same as every other API route here: sound effects
 * aren't sensitive, but there's no reason for this to be reachable by
 * an unauthenticated request either.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    const effect = req.nextUrl.searchParams.get("effect") as SoundEffectName | null;
    if (!effect || !SOUND_EFFECT_NAMES.includes(effect)) {
      return NextResponse.json(
        { success: false, message: "Unknown or missing 'effect' query param" },
        { status: 400 }
      );
    }

    const sound = await getEffectSound(effect);
    if (!sound) {
      return NextResponse.json(
        { success: false, message: `No sound resolved for "${effect}"` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      effect,
      url: sound.previewUrl,
      attribution: { name: sound.name, author: sound.author, license: sound.license },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve sound";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
