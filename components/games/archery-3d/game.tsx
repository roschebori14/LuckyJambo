"use client";

import dynamic from "next/dynamic";
import GameOverlay from "./overlay";

// @react-three/fiber touches `window`/WebGL at module-evaluation time
// in a few places, and rapier-compat loads a wasm binary - neither
// survives a server render. ssr:false is what keeps this out of the
// server bundle entirely, not just deferred; ssg/server components
// upstream of this file stay untouched.
const ArcheryExperience = dynamic(() => import("./experience"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#1b2e22] text-sm font-semibold uppercase tracking-widest text-[#8fae86]">
      Stringing the bow…
    </div>
  ),
});

export default function ArcheryGame() {
  return (
    <div className="relative h-[80vh] min-h-[520px] w-full overflow-hidden rounded-xl bg-[#1b2e22]">
      <ArcheryExperience />
      <GameOverlay />
    </div>
  );
}
