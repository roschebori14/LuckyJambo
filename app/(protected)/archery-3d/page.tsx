import type { Metadata } from "next";
import { Target } from "lucide-react";
import ArcheryGame from "@/components/games/archery-3d/game";

export const metadata: Metadata = {
  title: "Archery (3D prototype)",
};

// This page itself is a server component (the default for App
// Router) - it's game.tsx, one level down, that's marked
// "use client" and owns the dynamic(..., { ssr: false }) import.
// Keeping the page a plain server component costs nothing and is one
// less client boundary than necessary. Auth is already handled by
// (protected)/layout.tsx's requireAuth(), so nothing extra is needed
// here for that.
export default function Archery3dPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="lj-page-header -mx-4 -mt-4 px-4 pb-5 pt-4 md:-mx-6 md:-mt-6 md:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white">
          <Target size={24} style={{ color: "var(--lj-cyan)" }} /> Archery (3D prototype)
        </h1>
        <p className="mt-1 text-sm text-[var(--lj-muted)]">
          R3F + Rapier physics prototype - single-player, not yet wired into
          matchmaking. Drag down from the bow to draw, release to shoot.
        </p>
      </div>
      <ArcheryGame />
    </div>
  );
}
