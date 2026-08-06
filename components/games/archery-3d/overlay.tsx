"use client";

import { useArcheryStore } from "@/store/archery-3d-store";

/**
 * Every value read here changes at most once per shot (score, arrows
 * left, wind), so a normal Zustand subscription - and the re-render
 * it causes - is the *correct* tool, not a perf mistake. The perf
 * requirement this codebase actually cares about is keeping the 3D
 * tree free of per-frame state; this overlay was never in the hot
 * path to begin with.
 */
export default function GameOverlay() {
  const score = useArcheryStore((s) => s.score);
  const arrowsLeft = useArcheryStore((s) => s.arrowsLeft);
  const totalArrows = useArcheryStore((s) => s.totalArrows);
  const wind = useArcheryStore((s) => s.currentWind);
  const lastImpact = useArcheryStore((s) => s.lastImpact);
  const resetGame = useArcheryStore((s) => s.resetGame);

  const windSpeed = Math.sqrt(wind.x * wind.x + wind.z * wind.z);
  const windAngleDeg = (Math.atan2(wind.x, -wind.z) * 180) / Math.PI;
  const windSeverity = windSpeed < 1.5 ? "calm" : windSpeed < 3 ? "breezy" : "strong";
  const windColor =
    windSeverity === "calm" ? "#8fae86" : windSeverity === "breezy" ? "#d6a94a" : "#c1443c";

  const gameOver = arrowsLeft <= 0;

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-[system-ui]">
      {/* Score plate, top-left - leather-tag styling: warm bronze
          number on a dark pine card, a small brass-rivet corner accent. */}
      <div className="absolute left-4 top-4 rounded-lg border border-[#3d5c42] bg-[#1b2e22]/90 px-4 py-2.5 shadow-lg backdrop-blur-sm">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8fae86]">
          Score
        </div>
        <div className="font-serif text-3xl font-bold leading-none text-[#e8c877]">
          {score}
        </div>
      </div>

      {/* Wind compass, top-center - the signature element: a small
          dial whose needle points the true wind direction, colored by
          how much it'll actually matter this shot. */}
      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-1 rounded-lg border border-[#3d5c42] bg-[#1b2e22]/90 px-4 py-2 shadow-lg backdrop-blur-sm">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8fae86]">
          Wind
        </div>
        <div className="flex items-center gap-2">
          <div
            className="relative h-7 w-7 rounded-full border-2"
            style={{ borderColor: windColor }}
          >
            <div
              className="absolute left-1/2 top-1/2 h-3 w-[3px] origin-bottom -translate-x-1/2 -translate-y-full rounded-full"
              style={{
                backgroundColor: windColor,
                transform: `translate(-50%, -100%) rotate(${windAngleDeg}deg)`,
              }}
            />
          </div>
          <span className="font-serif text-lg font-bold" style={{ color: windColor }}>
            {windSpeed.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Arrows left, top-right - a small quiver of tick marks rather
          than a bare number, so "3 of 5" reads at a glance. */}
      <div className="absolute right-4 top-4 rounded-lg border border-[#3d5c42] bg-[#1b2e22]/90 px-4 py-2.5 shadow-lg backdrop-blur-sm">
        <div className="text-right text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8fae86]">
          Arrows
        </div>
        <div className="mt-1 flex items-center justify-end gap-1">
          {Array.from({ length: totalArrows }).map((_, i) => (
            <span
              key={i}
              className="block h-3 w-[3px] rounded-full"
              style={{
                backgroundColor: i < arrowsLeft ? "#e8c877" : "#3d5c42",
              }}
            />
          ))}
        </div>
      </div>

      {/* Transient hit callout */}
      {lastImpact && !gameOver && (
        <div
          key={`${lastImpact.label}-${score}`}
          className="absolute left-1/2 top-1/3 -translate-x-1/2 animate-[archeryPop_1.1s_ease-out_forwards] font-serif text-4xl font-black"
          style={{ color: lastImpact.points > 0 ? "#e8c877" : "#c1443c" }}
        >
          {lastImpact.label}
        </div>
      )}

      {gameOver && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-4 rounded-xl border border-[#3d5c42] bg-[#1b2e22] px-8 py-6 text-center shadow-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8fae86]">
              Round Complete
            </div>
            <div className="font-serif text-5xl font-black text-[#e8c877]">{score}</div>
            <button
              type="button"
              onClick={() => resetGame()}
              className="mt-2 rounded-md bg-[#e8c877] px-5 py-2 text-sm font-bold text-[#1b2e22] transition-transform hover:scale-105"
            >
              Shoot Again
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes archeryPop {
          0% {
            opacity: 0;
            transform: translate(-50%, 0) scale(0.6);
          }
          15% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1.05);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -40px) scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
