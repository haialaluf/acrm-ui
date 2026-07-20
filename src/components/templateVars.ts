// Helpers for working with {{N}} variables inside template header/body text.
// Shared by TemplateEditor (insert + submit) and the message preview.

// Unique variable numbers found in text, in order of appearance.
export function getVarNumbers(text: string): number[] {
  const seen = new Set<number>();
  const ordered: number[] = [];
  for (const m of text.matchAll(/\{\{(\d+)\}\}/g)) {
    const n = parseInt(m[1]);
    if (!seen.has(n)) {
      seen.add(n);
      ordered.push(n);
    }
  }
  return ordered;
}

// Renumber variables to a contiguous 1..n sequence. Returns the rewritten text
// and the original variable numbers in their new order.
export function renumberVars(text: string): {
  text: string;
  ordered: number[];
} {
  const matches = Array.from(text.matchAll(/\{\{(\d+)\}\}/g));
  const seen = new Set<number>();
  const ordered: number[] = [];
  for (const m of matches) {
    const n = parseInt(m[1]);
    if (!seen.has(n)) {
      seen.add(n);
      ordered.push(n);
    }
  }
  if (ordered.every((n, i) => n === i + 1)) return { text, ordered };
  const renumber = new Map<number, number>();
  ordered.forEach((old, i) => renumber.set(old, i + 1));
  let result = text;
  for (const [old, _new] of renumber) {
    result = result.replaceAll(`{{${old}}}`, `__VAR_${_new}__`);
  }
  for (let i = 1; i <= renumber.size; i++) {
    result = result.replaceAll(`__VAR_${i}__`, `{{${i}}}`);
  }
  return { text: result, ordered };
}

// Insert text at a position, adding spaces on either side when needed.
export function insertAtPos(
  text: string,
  pos: number,
  insertion: string,
): string {
  const before = text.slice(0, pos);
  const after = text.slice(pos);
  const needsSpaceBefore =
    before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n");
  const needsSpaceAfter =
    after.length > 0 && !after.startsWith(" ") && !after.startsWith("\n");
  return (
    before +
    (needsSpaceBefore ? " " : "") +
    insertion +
    (needsSpaceAfter ? " " : "") +
    after
  );
}
