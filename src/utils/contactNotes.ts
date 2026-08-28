/**
 * `contacts.notes` is one free-text column shared by the AI agents and whoever
 * is typing in the CRM. Nothing records an author — the only signal is a
 * leading ISO date, which `update_contact` writes on every line it appends and
 * a person never does (see agent-client/tools/update-contact.ts, where the
 * same regex is what stops the overflow trim from deleting someone's typing).
 *
 * These two functions are the whole convention: split the field for display,
 * put it back together on save.
 */
const AGENT_LINE = /^\d{4}-\d{2}-\d{2} /;

export interface AgentNote {
  /** `2026-08-20`, exactly as stored. */
  date: string;
  text: string;
}

export interface SplitNotes {
  /** Agent-written lines, newest first. */
  agent: AgentNote[];
  /** Everything a person typed, as the one block they edit. */
  human: string;
}

export function splitNotes(notes: string | null | undefined): SplitNotes {
  const lines = (notes ?? "").split("\n");

  return {
    agent: lines
      .filter((line) => AGENT_LINE.test(line))
      .map((line) => ({ date: line.slice(0, 10), text: line.slice(11) }))
      // Stored oldest-first, because the tool appends. Read newest-first,
      // because the newest line is the one that is current.
      .reverse(),
    human: lines
      .filter((line) => !AGENT_LINE.test(line))
      .join("\n")
      .trim(),
  };
}

/**
 * The field to store, given the original and the edited human block.
 *
 * The human block is put back where it was rather than appended, because the
 * agents are told "when two lines conflict, the later one is current" — moving
 * someone's line below a dated one would silently change which fact the model
 * treats as true.
 */
export function joinNotes(
  original: string | null | undefined,
  human: string,
): string {
  const lines = (original ?? "").split("\n");
  const agentLines = lines.filter((line) => AGENT_LINE.test(line));
  const humanLines = human.trim() ? human.trim().split("\n") : [];

  if (humanLines.length === 0) return agentLines.join("\n");

  // How many agent lines stood before the human text, so it lands back in the
  // same place among them.
  const firstHuman = lines.findIndex((line) => !AGENT_LINE.test(line));
  const at =
    firstHuman === -1
      ? agentLines.length
      : lines.slice(0, firstHuman).filter((line) => AGENT_LINE.test(line))
          .length;

  return [
    ...agentLines.slice(0, at),
    ...humanLines,
    ...agentLines.slice(at),
  ].join("\n");
}
