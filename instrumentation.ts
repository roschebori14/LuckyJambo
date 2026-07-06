// Next.js instrumentation hook - runs once when the server starts
// (each serverless instance's cold start, or once for a long-running
// node server). Stable since Next 15, no experimental flag needed on
// Next 16.
//
// warmSoundCache() (lib/sound/sound-cache.ts) has existed since the
// sound system was built specifically for this purpose - "so the
// first player of the day isn't the one eating the Freesound
// round-trip latency" per its own doc comment - but nothing ever
// actually called it. Every effect was purely lazily resolved on its
// first play() anywhere, which is exactly why a first-time sound
// (like a dice roll) could take a few seconds to actually play: that
// one request was doing a live Freesound search before anything could
// play at all. This makes the one-time cost happen at server startup
// instead of during someone's dice roll.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmSoundCache } = await import("@/lib/sound/sound-cache");
    warmSoundCache().catch((error) => {
      console.error("Sound cache warm-up failed (non-fatal, effects still resolve lazily):", error);
    });
  }
}
