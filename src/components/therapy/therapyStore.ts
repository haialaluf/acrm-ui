import { useSyncExternalStore } from "react";
import useBoundStore from "@/stores/useBoundStore";

// Ask AI chats still live in this browser only, per organization. Session
// reports and templates are in the database / patient-data S3 bucket.

export type ReportSection = {
  title: string;
  value: string;
  options?: string[];
  checked?: string[];
  flagged?: boolean;
};

export type SessionReport = {
  id: string;
  contactId: string;
  appointmentId: string | null;
  templateId: string;
  templateName: string;
  createdAt: string;
  durationSeconds: number;
  status: "draft" | "approved";
  sections: ReportSection[];
  transcript: { at: string; speaker: "therapist" | "patient"; text: string }[];
};

export type Citation = {
  label: string;
  kind: "report" | "note" | "session" | "file" | "patient";
  contactId?: string;
  reportId?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  bullets?: { text: string; citation?: Citation }[];
  table?: { head: string[]; rows: { cells: string[]; contactId?: string }[] };
  drafts?: { contactId: string; name: string; text: string }[];
  action?: "draft_reminders";
  basis?: string;
  attachments?: string[];
  createdAt: string;
};

export type ChatThread = {
  id: string;
  scope: string;
  title: string;
  attachments: string[];
  messages: ChatMessage[];
  updatedAt: string;
};

type State = {
  chats: ChatThread[];
};

const EMPTY: State = { chats: [] };
const listeners = new Set<() => void>();
const cache = new Map<string, State>();

function storageKey(orgId: string) {
  return `therapy-preview:${orgId}`;
}

function read(orgId: string): State {
  const cached = cache.get(orgId);
  if (cached) return cached;
  let state = EMPTY;
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>;
      state = { chats: saved.chats ?? [] };
    }
  } catch {
    state = EMPTY;
  }
  cache.set(orgId, state);
  return state;
}

function write(orgId: string, update: (state: State) => State) {
  const next = update(read(orgId));
  cache.set(orgId, next);
  try {
    localStorage.setItem(storageKey(orgId), JSON.stringify(next));
  } catch {
    // Storage can be full or blocked; the in-memory copy still works.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function newId() {
  return crypto.randomUUID();
}

export function useTherapyStore() {
  const orgId = useBoundStore((state) => state.ui.activeOrgId) ?? "none";
  const state = useSyncExternalStore(subscribe, () => read(orgId));

  return {
    ...state,
    saveChat: (chat: ChatThread) =>
      write(orgId, (s) => ({
        ...s,
        chats: [chat, ...s.chats.filter((c) => c.id !== chat.id)],
      })),
    deleteChat: (id: string) =>
      write(orgId, (s) => ({
        ...s,
        chats: s.chats.filter((c) => c.id !== id),
      })),
  };
}
