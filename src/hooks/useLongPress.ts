import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/** How long a touch has to rest before it counts as a long press. */
const HOLD_MS = 450;

/** Movement past this many pixels is a scroll, not a press. */
const SLOP_PX = 8;

/**
 * Long-press for touch input, the way WhatsApp opens a message's actions.
 *
 * Mouse and pen are deliberately ignored: on a pointer device the same
 * affordance is revealed by hover, and arming a timer on mousedown would fire
 * during an ordinary text selection drag.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    origin.current = null;
  }, []);

  // A press held while the component unmounts (thread switch) must not fire.
  useEffect(() => cancel, [cancel]);

  return {
    onPointerDown: (event: ReactPointerEvent) => {
      if (event.pointerType !== "touch") return;

      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        onLongPress();
        cancel();
      }, HOLD_MS);
    },
    onPointerMove: (event: ReactPointerEvent) => {
      if (!origin.current) return;

      const { x, y } = origin.current;

      if (
        Math.abs(event.clientX - x) > SLOP_PX ||
        Math.abs(event.clientY - y) > SLOP_PX
      ) {
        cancel();
      }
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
  };
}
