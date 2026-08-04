"use client";

import dynamic from "next/dynamic";
import GameOverlay from "./GameOverlay";

// @react-three/fiber touches `window`/WebGL at module-evaluation time
// in a few places, and rapier-compat loads a wasm binary - neither
// survives a server render. ssr:false is what keeps this out of the
// server bundle entirely, not just deferred; ssg/server components
// upstream of this file stay untouched.
const ArcheryExperience = dynamic(() => import("./ArcheryExperience"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#1b2e22] text-sm font-semibold uppercase tracking-widest text-[#8fae86]">
      Stringing the bow…
    </div>
  ),
});

export default function ArcheryGame() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#1b2e22]">
      <ArcheryExperience />
      <GameOverlay />
    </div>
  );
}
