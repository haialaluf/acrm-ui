import { useSyncExternalStore } from "react";

const QUERY = "(hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/**
 * Whether the pointer can hover — true on a mouse, false on touch.
 *
 * Gates affordances that only a hover can reach. A tooltip is one: on touch it
 * would have to open on tap, and the tap belongs to whatever it sits on.
 */
export function useHoverCapable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
