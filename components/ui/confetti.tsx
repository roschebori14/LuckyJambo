"use client";

import { useEffect, useMemo, useState } from "react";

interface ConfettiProps {
  /** Toggle true to fire a burst; component auto-clears itself after the animation. */
  fire: boolean;
  durationMs?: number;
}

const COLORS = ["#2D7FFF", "#FFD23F", "#4ADE80", "#F97066", "#C77DFF"];

/**
 * Pure CSS/SVG confetti burst - no canvas-confetti or other dependency,
 * consistent with how toast-provider.tsx is described as "lightweight,
 * dependency-free". Mount wherever a win banner renders and flip
 * `fire` to true; renders nothing when idle.
 */
export default function Confetti({ fire, durationMs = 2200 }: ConfettiProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!fire) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(t);
  }, [fire, durationMs]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.6 + Math.random() * 0.8,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 120,
      })),
    // Regenerate the burst pattern each time it fires, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fire]
  );

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: "-10px",
            left: `${p.left}%`,
            width: 8,
            height: 14,
            background: p.color,
            borderRadius: 2,
            transform: `rotate(${p.rotate}deg)`,
            animation: `lj-confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            "--lj-drift": `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        @keyframes lj-confetti-fall {
          0% { transform: translate(0, -10px) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--lj-drift), 100vh) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
