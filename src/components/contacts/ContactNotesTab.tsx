import { useState } from "react";
import dayjs from "dayjs";
import { Bot, Pencil, Trash2, User } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgent } from "@/queries/useAgents";
import {
  type ContactNote,
  useAddContactNote,
  useContactNotes,
  useDeleteContactNote,
  useEditContactNote,
} from "@/queries/useContactNotes";
import type { ContactWithAddressesRow } from "@/supabase/client";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";

type Filter = "all" | "agent" | "user";

const PAGE = 10;

/**
 * Every note on the contact, newest first, AI and human together. Agent notes
 * are read-only; a person can edit or delete their own notes and the unsigned
 * ones carried over from the old free-text field (the same rule the
 * contact_notes RLS policies enforce).
 */
export default function ContactNotesTab({
  contact,
}: {
  contact: ContactWithAddressesRow;
}) {
  const { translate: t } = useTranslation();
  const { data: notes } = useContactNotes(contact.id);
  const { data: me } = useCurrentAgent();
  const addNote = useAddContactNote(contact.id);
  const deleteNote = useDeleteContactNote(contact.id);

  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [deleting, setDeleting] = useState<ContactNote | null>(null);

  // A contact opened by URL can belong to another of the user's orgs, where
  // `me` (the active org's agent row) is not a valid author.
  const myAgentId =
    me && me.organization_id === contact.organization_id ? me.id : null;

  const canChange = (note: ContactNote) =>
    note.author_type === "user" &&
    (note.agent_id === null || note.agent_id === myAgentId);

  const visible = (notes ?? []).filter(
    (note) => filter === "all" || note.author_type === filter,
  );

  function add() {
    const body = draft.trim();
    if (!body) return;

    addNote.mutate(
      { organizationId: contact.organization_id, agentId: myAgentId, body },
      { onSuccess: () => setDraft("") },
    );
  }

  return (
    <div className="flex flex-col gap-[20px] px-[20px] pt-[20px] pb-[20px]">
      <div className="flex items-center gap-[7px] w-fit bg-accent text-accent-foreground rounded-full ps-[10px] pe-[12px] py-[6px] text-[12px]">
        <Bot className="w-[14px] h-[14px]" />
        {t("Your AI agents read everything here")}
      </div>

      <div className="flex flex-col gap-[10px]">
        <textarea
          className="text border border-input rounded-[12px] px-[14px] py-[12px] min-h-[92px]"
          rows={3}
          placeholder={t("Add a note about this contact")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="flex items-center justify-between gap-[12px]">
          {addNote.error ? (
            <p className="text-destructive text-[13px]">
              {t("Could not save the note. Please try again.")}
            </p>
          ) : (
            <span />
          )}
          <Button
            type="button"
            className="primary px-[18px]"
            invalid={!draft.trim()}
            loading={addNote.isPending}
            onClick={add}
          >
            {t("Add note")}
          </Button>
        </div>
      </div>

      <div className="flex gap-[8px]">
        {(["all", "agent", "user"] as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            className={
              "rounded-full px-[12px] py-[5px] text-[13px] border " +
              (filter === key
                ? "bg-accent text-accent-foreground border-transparent"
                : "text-muted-foreground border-border")
            }
            onClick={() => {
              setFilter(key);
              setShown(PAGE);
            }}
          >
            {t(key === "all" ? "All" : key === "agent" ? "Agents" : "Team")}
          </button>
        ))}
      </div>

      {notes && visible.length === 0 && (
        <p className="text-muted-foreground text-[14px]">{t("No notes yet")}</p>
      )}

      <div className="flex flex-col">
        {visible.slice(0, shown).map((note, idx) => (
          <div key={note.id}>
            {idx > 0 && <div className="h-px bg-border my-[16px]" />}
            <NoteItem
              contactId={contact.id}
              note={note}
              editable={canChange(note)}
              onDelete={() => setDeleting(note)}
            />
          </div>
        ))}
      </div>

      {visible.length > shown && (
        <button
          type="button"
          className="text-primary text-[14px] w-fit"
          onClick={() => setShown(shown + PAGE)}
        >
          {t("Show more")}
        </button>
      )}

      {deleting && (
        <ConfirmModal
          open
          title={t("Delete note?")}
          body={<span>{deleting.body}</span>}
          confirmLabel={t("Delete")}
          loading={deleteNote.isPending}
          onConfirm={() =>
            deleteNote.mutate(deleting.id, {
              onSuccess: () => setDeleting(null),
            })
          }
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function NoteItem({
  contactId,
  note,
  editable,
  onDelete,
}: {
  contactId: string;
  note: ContactNote;
  editable: boolean;
  onDelete: () => void;
}) {
  const { translate: t } = useTranslation();
  const editNote = useEditContactNote(contactId);
  const [editing, setEditing] = useState<string | null>(null);

  const isAgent = note.author_type === "agent";
  const Icon = isAgent ? Bot : User;
  const author =
    note.agent?.name ?? (isAgent ? t("AI agent") : t("Team member"));

  function save() {
    const body = editing?.trim();
    if (!body) return;
    if (body === note.body) return setEditing(null);

    editNote.mutate(
      { id: note.id, body },
      { onSuccess: () => setEditing(null) },
    );
  }

  return (
    <div className="flex gap-[10px]">
      <Icon className="w-[16px] h-[16px] mt-[3px] shrink-0 text-muted-foreground" />
      <div className="grow min-w-0">
        <div className="flex items-center gap-[8px]">
          <div className="grow min-w-0 truncate text-[12px] text-muted-foreground">
            {author} · {dayjs(note.created_at).format("D MMM YYYY, HH:mm")}
          </div>
          {editable && editing === null && (
            <>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                title={t("Edit")}
                onClick={() => setEditing(note.body)}
              >
                <Pencil className="w-[15px] h-[15px]" />
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                title={t("Delete")}
                onClick={onDelete}
              >
                <Trash2 className="w-[15px] h-[15px]" />
              </button>
            </>
          )}
        </div>

        {editing === null ? (
          <div className="text-[15px] leading-relaxed mt-[3px] whitespace-pre-wrap break-words">
            {note.body}
          </div>
        ) : (
          <div className="flex flex-col gap-[8px] mt-[6px]">
            <textarea
              className="text border border-input rounded-[12px] px-[14px] py-[10px]"
              rows={3}
              value={editing}
              onChange={(e) => setEditing(e.target.value)}
            />
            {editNote.error && (
              <p className="text-destructive text-[13px]">
                {t("Could not save the note. Please try again.")}
              </p>
            )}
            <div className="flex gap-[8px] justify-end">
              <Button
                type="button"
                className="secondary px-[14px]"
                onClick={() => setEditing(null)}
              >
                {t("Cancel")}
              </Button>
              <Button
                type="button"
                className="primary px-[14px]"
                invalid={!editing.trim()}
                loading={editNote.isPending}
                onClick={save}
              >
                {t("Save")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
