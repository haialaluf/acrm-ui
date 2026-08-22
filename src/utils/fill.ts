/**
 * `{n}`-style interpolation on top of a translated string — e.g.
 * `fill(t, "{n} of {m} rows", { n: 3, m: 10 })`.
 */
export function fill(
  t: (key: string) => string,
  key: string,
  vars: Record<string, string | number>,
): string {
  let s = t(key);
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
