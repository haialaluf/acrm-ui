// WhatsApp sets each message's direction from its first strong-directional
// character — not from the template's language field. Mirror that so the
// preview aligns exactly like the real client (Hebrew/Arabic vs English).

const RTL_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x591, 0x7ff], // Hebrew, Arabic
  [0xfb1d, 0xfdff], // Hebrew presentation, Arabic presentation-A
  [0xfe70, 0xfeff], // Arabic presentation-B
];

const LTR_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x41, 0x5a], // A-Z
  [0x61, 0x7a], // a-z
  [0xc0, 0x24f], // Latin-1 supplement + extended
];

function inRange(c: number, ranges: ReadonlyArray<readonly [number, number]>) {
  return ranges.some(([lo, hi]) => c >= lo && c <= hi);
}

export function firstStrongDir(s: string): "rtl" | "ltr" | null {
  for (const ch of s || "") {
    const c = ch.codePointAt(0)!;
    if (inRange(c, RTL_RANGES)) return "rtl";
    if (inRange(c, LTR_RANGES)) return "ltr";
  }
  return null;
}

/** True if the first strongly-directional character across `texts` is RTL. */
export function detectRtl(...texts: string[]): boolean {
  for (const t of texts) {
    const d = firstStrongDir(t);
    if (d) return d === "rtl";
  }
  return false;
}
