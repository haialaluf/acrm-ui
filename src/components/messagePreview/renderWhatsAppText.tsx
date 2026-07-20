import { Fragment, type ReactNode } from "react";

/* Parses WhatsApp's own formatting syntax into real styled React nodes (no
   dangerouslySetInnerHTML):
     *bold*  _italic_  ~strike~  ```mono```  `code`
     "- "/"* " bullets, "1. " numbered lists, "> " block quotes
   and substitutes {{n}} placeholders with sample values (a chip when blank).
   Bold = text wrapped in `*`. Nesting is "first opened, last closed":
   bold ⊃ italic ⊃ strike ⊃ variables, with mono/code taking priority. */

type Nodes = ReactNode[];

function splitNodes(
  str: string,
  regex: RegExp,
  onMatch: (m: RegExpExecArray, key: string) => ReactNode,
  onText: (t: string, key: string) => Nodes,
  kp: string,
): Nodes {
  const out: Nodes = [];
  let last = 0;
  let idx = 0;
  const re = new RegExp(
    regex.source,
    regex.flags.includes("g") ? regex.flags : regex.flags + "g",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last)
      out.push(...onText(str.slice(last, m.index), kp + "-t" + idx));
    out.push(onMatch(m, kp + "-m" + idx));
    last = m.index + m[0].length;
    idx++;
    if (m[0] === "") re.lastIndex++;
  }
  if (last < str.length) out.push(...onText(str.slice(last), kp + "-t" + idx));
  return out;
}

function lvlVars(s: string, vars: string[], kp: string): Nodes {
  return splitNodes(
    s,
    /\{\{(\d+)\}\}/g,
    (m, k) => {
      const v = vars && vars[Number(m[1]) - 1];
      return v ? (
        <span key={k} className="wa-var">
          {v}
        </span>
      ) : (
        <span key={k} className="wa-var empty">
          {m[0]}
        </span>
      );
    },
    (t, k) => [<Fragment key={k}>{t}</Fragment>],
    kp,
  );
}
function lvlStrike(s: string, vars: string[], kp: string): Nodes {
  return splitNodes(
    s,
    /~([^~\n]+)~/g,
    (m, k) => <s key={k}>{lvlVars(m[1], vars, k)}</s>,
    (t, k) => lvlVars(t, vars, k),
    kp,
  );
}
function lvlItalic(s: string, vars: string[], kp: string): Nodes {
  return splitNodes(
    s,
    /_([^_\n]+)_/g,
    (m, k) => <em key={k}>{lvlStrike(m[1], vars, k)}</em>,
    (t, k) => lvlStrike(t, vars, k),
    kp,
  );
}
function lvlBold(s: string, vars: string[], kp: string): Nodes {
  return splitNodes(
    s,
    /\*([^*\n]+)\*/g,
    (m, k) => <strong key={k}>{lvlItalic(m[1], vars, k)}</strong>,
    (t, k) => lvlItalic(t, vars, k),
    kp,
  );
}
function lvlCode(s: string, vars: string[], kp: string): Nodes {
  return splitNodes(
    s,
    /`([^`\n]+)`/g,
    (m, k) => (
      <code key={k} className="wa-code">
        {m[1]}
      </code>
    ),
    (t, k) => lvlBold(t, vars, k),
    kp,
  );
}

/** Inline-only formatting (header text, a single line). */
export function renderInline(s: string, vars: string[], kp = "i"): Nodes {
  return splitNodes(
    s,
    /```([\s\S]+?)```/g,
    (m, k) => (
      <code key={k} className="wa-mono">
        {m[1]}
      </code>
    ),
    (t, k) => lvlCode(t, vars, k),
    kp,
  );
}

/** Block-level: bullet/numbered lists, block quotes, paragraphs. */
export function renderBlocks(text: string, vars: string[]): Nodes {
  const lines = (text || "").split("\n");
  const blocks: Nodes = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={"q" + i} className="wa-quote">
          {q.map((l, j) => (
            <div key={j} dir="auto">
              {renderInline(l, vars, "q" + i + j)}
            </div>
          ))}
        </blockquote>,
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={"u" + i} className="wa-ul">
          {items.map((l, j) => (
            <li key={j} dir="auto">
              {renderInline(l, vars, "u" + i + j)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={"o" + i} className="wa-ol">
          {items.map((l, j) => (
            <li key={j} dir="auto">
              {renderInline(l, vars, "o" + i + j)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }
    blocks.push(
      <div
        key={"l" + i}
        className={"wa-line" + (line.trim() === "" ? " empty" : "")}
        dir="auto"
      >
        {line.trim() === "" ? " " : renderInline(line, vars, "l" + i)}
      </div>,
    );
    i++;
  }
  return blocks;
}
