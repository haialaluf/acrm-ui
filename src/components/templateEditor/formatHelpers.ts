// Textarea/input mutations behind the formatting toolbar. Each restores the
// caret/selection after React re-renders so typing feels native. Bold = the
// selection wrapped in `*` (WhatsApp syntax); lists/quote toggle a line prefix.

type El = HTMLTextAreaElement | HTMLInputElement | null;
type SetV = (v: string) => void;

/** Wrap the current selection in `mark` … `markEnd` (or insert the markers at
    the caret when nothing is selected). */
export function surround(
  el: El,
  value: string,
  setValue: SetV,
  mark: string,
  markEnd: string = mark,
) {
  if (!el) return;
  const s = el.selectionStart ?? value.length;
  const e = el.selectionEnd ?? s;
  const inner = value.slice(s, e);
  const next = value.slice(0, s) + mark + inner + markEnd + value.slice(e);
  setValue(next);
  const p1 = s + mark.length;
  const p2 = p1 + inner.length;
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(p1, inner ? p2 : p1);
  });
}

/** Toggle/replace a prefix across every line the selection touches. */
export function linePrefix(
  el: El,
  value: string,
  setValue: SetV,
  makePrefix: (line: string, i: number) => string,
) {
  if (!el) return;
  const s = el.selectionStart ?? 0;
  const e = el.selectionEnd ?? s;
  const start = value.lastIndexOf("\n", s - 1) + 1;
  let end = value.indexOf("\n", e);
  if (end === -1) end = value.length;
  const block = value.slice(start, end);
  const out = block
    .split("\n")
    .map((l, i) => makePrefix(l, i))
    .join("\n");
  const next = value.slice(0, start) + out + value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start, start + out.length);
  });
}

/** Insert `text` at the caret. With `pad`, add spaces around it when adjacent
    to non-space (used for variables; emoji insert without padding). */
export function insertAtCursor(
  el: El,
  value: string,
  setValue: SetV,
  text: string,
  pad = false,
) {
  const pos = el ? (el.selectionStart ?? value.length) : value.length;
  const before = value.slice(0, pos);
  const after = value.slice(pos);
  const sb = pad && before && !/\s$/.test(before) ? " " : "";
  const sa = pad && after && !/^\s/.test(after) ? " " : "";
  const next = before + sb + text + sa + after;
  setValue(next);
  const caret = pos + sb.length + text.length;
  requestAnimationFrame(() => {
    if (!el) return;
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}
