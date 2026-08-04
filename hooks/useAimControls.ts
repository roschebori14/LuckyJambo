import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Live aim state, mutated in place every pointermove. This is the
 * "use refs for frame-by-frame calculations" half of the perf
 * requirement: a full drag gesture can fire dozens of pointermove
 * events, and none of them should cause a React re-render. Bow.tsx
 * reads this ref directly inside its own useFrame to animate the
 * pull-back/sway, and the fire handler below reads its final values
 * once, on pointerup, which is the only "infrequent trigger" moment
 * that's allowed to touch React/Zustand state.
 */
export interface AimState {
  isDragging: boolean;
  startX: number;
  startY: number;
  /** Current drag delta in CSS pixels, screen space. */
  dragX: number;
  dragY: number;
  /** 0-1, how far back the string is currently pulled. */
  power: number;
}

export function createAimState(): AimState {
  return {
    isDragging: false,
    startX: 0,
    startY: 0,
    dragX: 0,
    dragY: 0,
    power: 0,
  };
}

// A drag needs to travel this many pixels to reach full draw power -
// tuned for a comfortable thumb-length drag on a phone screen, not a
// full-arm mouse swing.
const MAX_DRAG_PX = 180;
// Below this power a release doesn't count as a shot at all (treats
// a light tap/twitch as "changed my mind", matching every reference
// game's dead zone).
const MIN_RELEASE_POWER = 0.12;

interface UseAimControlsArgs {
  /** Called once, on pointerup, only if the release power cleared the
   * dead zone - this is the single "infrequent trigger" that's
   * allowed to touch Zustand/React state (spawn an arrow, decrement
   * arrowsLeft, etc.). */
  onFire: (aim: { dx: number; dy: number; power: number }) => void;
  /** Gate: while true, drag gestures are ignored entirely (there's
   * already an arrow in flight, or the game is over). Read fresh on
   * every pointerdown rather than baked into a dependency array, so
   * this hook's handlers never need to be recreated. */
  canAim: () => boolean;
}

export function useAimControls({ onFire, canAim }: UseAimControlsArgs) {
  const aimRef = useRef<AimState>(createAimState());

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!canAim()) return;
      const aim = aimRef.current;
      aim.isDragging = true;
      aim.startX = e.clientX;
      aim.startY = e.clientY;
      aim.dragX = 0;
      aim.dragY = 0;
      aim.power = 0;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [canAim],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const aim = aimRef.current;
    if (!aim.isDragging) return;
    aim.dragX = e.clientX - aim.startX;
    aim.dragY = e.clientY - aim.startY;
    // Pulling the bow back reads as dragging DOWN on screen (the same
    // gesture every mobile archery game uses), so power comes from
    // the downward component only - dragging up doesn't "charge" it.
    const pull = Math.max(0, aim.dragY);
    aim.power = Math.min(1, pull / MAX_DRAG_PX);
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const aim = aimRef.current;
      if (!aim.isDragging) return;
      aim.isDragging = false;
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

      if (aim.power >= MIN_RELEASE_POWER) {
        onFire({
          dx: aim.dragX / MAX_DRAG_PX,
          dy: aim.dragY / MAX_DRAG_PX,
          power: aim.power,
        });
      }
      aim.dragX = 0;
      aim.dragY = 0;
      aim.power = 0;
    },
    [onFire],
  );

  return { aimRef, onPointerDown, onPointerMove, onPointerUp };
}
