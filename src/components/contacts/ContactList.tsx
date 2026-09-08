import { useEffect, useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ContactWithAddressesRow } from "@/supabase/client";
import ContactListItem from "./ContactListItem";

/**
 * One entry in a contact list. `key` is also the selection key, which is why
 * it is the caller's to choose: the contacts page selects contacts (`id`), the
 * bulk-send wizard selects addresses, so the same contact can appear twice
 * under two keys.
 */
export type ContactRow = {
  kind: "contact";
  key: string;
  contact: ContactWithAddressesRow;
  subtitle: string;
  disabledReason?: string;
};

export type ContactListRow =
  | { kind: "letter"; key: string; letter: string }
  | ContactRow;

const LETTER_HEIGHT = 28;
const ROW_GAP = 4;
const ROW_HEIGHT = 72 + ROW_GAP;
const DENSE_ROW_HEIGHT = 52 + ROW_GAP;

/**
 * The virtualized contact list, shared by the contacts page and the bulk-send
 * recipients step. Only the rows in view are mounted — an org with thousands
 * of contacts used to render every row (and an `<Avatar>` image each) on every
 * keystroke in the filter.
 */
export default function ContactList({
  rows,
  dense,
  selectedKeys,
  onToggle,
  onOpen,
  empty,
  className,
  scrollResetKey,
}: {
  rows: ContactListRow[];
  dense?: boolean;
  /** Present to draw checkboxes; absent means the rows just navigate. */
  selectedKeys?: Set<string>;
  onToggle?: (key: string) => void;
  onOpen?: (key: string) => void;
  empty?: ReactNode;
  className?: string;
  /** Changing this scrolls back to the top. Pass the filter the rows come
   *  from: a shrunken list otherwise keeps the old offset, leaving the user at
   *  the tail of their search results with the rest above them. */
  scrollResetKey?: unknown;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const rowHeight = dense ? DENSE_ROW_HEIGHT : ROW_HEIGHT;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: (i) =>
      rows[i].kind === "letter" ? LETTER_HEIGHT : rowHeight,
    getItemKey: (i) => rows[i].key,
    overscan: 8,
  });

  // Read out here, not inside the JSX: the React Compiler memoizes the list
  // markup on the values it can see, and a `virtualizer.getVirtualItems()`
  // call buried in the tree is not one of them — the window would then stay
  // frozen at whatever it was on mount, so scrolling showed blank space.
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    virtualizer.scrollToOffset(0);
  }, [scrollResetKey, virtualizer]);

  return (
    <div
      ref={scroller}
      className={`grow min-h-0 overflow-y-auto [scrollbar-gutter:stable] w-full px-[10px] ${className ?? ""}`}
    >
      {rows.length === 0 ? (
        empty
      ) : (
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                className="absolute top-0 left-0 w-full"
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.kind === "letter" ? (
                  // Aligned with the avatars: the list's px-[10px] plus the
                  // row's own px-[10px].
                  <div className="h-full flex items-center px-[10px] text-[12px] font-semibold tracking-[0.08em] text-muted-foreground">
                    {row.letter}
                  </div>
                ) : (
                  <div style={{ height: virtualRow.size - ROW_GAP }}>
                    <ContactListItem
                      contact={row.contact}
                      subtitle={row.subtitle}
                      dense={dense}
                      disabledReason={row.disabledReason}
                      selected={selectedKeys?.has(row.key)}
                      onToggle={
                        selectedKeys && onToggle
                          ? () => onToggle(row.key)
                          : undefined
                      }
                      onOpen={onOpen ? () => onOpen(row.key) : undefined}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
