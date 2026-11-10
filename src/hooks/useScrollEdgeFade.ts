import { useCallback, useEffect, useState, type CSSProperties } from "react";

const FADE = "32px";

/** Fades the edges of a horizontal scroller that have more content past them,
 *  so a row that runs off the screen reads as "swipe for more". */
export function useScrollEdgeFade<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [style, setStyle] = useState<CSSProperties | undefined>();

  const update = useCallback(() => {
    if (!el) return;
    // RTL scrollLeft runs from 0 to negative, so measure distance from start.
    const scrolled = Math.abs(el.scrollLeft);
    const moreBefore = scrolled > 1;
    const moreAfter = scrolled + el.clientWidth < el.scrollWidth - 1;
    if (!moreBefore && !moreAfter) return setStyle(undefined);
    const toEnd =
      getComputedStyle(el).direction === "rtl" ? "to left" : "to right";
    const fade = `linear-gradient(${toEnd}, ${moreBefore ? "transparent" : "#000"} 0, #000 ${FADE}, #000 calc(100% - ${FADE}), ${moreAfter ? "transparent" : "#000"} 100%)`;
    // A second, solid layer over the scrollbar keeps the bar itself unfaded.
    const scrollbar = el.offsetHeight - el.clientHeight;
    const mask = {
      image: `${fade}, linear-gradient(#000, #000)`,
      size: `100% 100%, 100% ${scrollbar}px`,
      position: "0 0, 0 100%",
    };
    setStyle({
      maskImage: mask.image,
      maskSize: mask.size,
      maskPosition: mask.position,
      maskRepeat: "no-repeat",
      WebkitMaskImage: mask.image,
      WebkitMaskSize: mask.size,
      WebkitMaskPosition: mask.position,
      WebkitMaskRepeat: "no-repeat",
    });
  }, [el]);

  useEffect(() => {
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [el, update]);

  return { ref: setEl, onScroll: update, style };
}
