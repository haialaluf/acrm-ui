import { useSyncExternalStore } from "react";

// Mirrors Tailwind's `md` breakpoint, so JS and `md:` classes switch together.
const QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
