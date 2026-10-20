import { useCallback, useEffect } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

const PREFIX = "formDraft:";

function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearFormDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Storage unavailable (private mode, blocked site data) - nothing to clear.
  }
}

/**
 * Mirrors a react-hook-form's values into localStorage so a refresh or an
 * accidental navigation doesn't lose them, and restores them on mount.
 *
 * The draft survives until it is explicitly discarded: call `clearDraft` (or
 * `clearFormDraft` from outside the form, e.g. a header's back button) on
 * cancel, back, or a successful submit. Pass `key: undefined` to disable.
 */
export function useFormDraft<T extends FieldValues>(
  key: string | undefined,
  { watch, reset }: Pick<UseFormReturn<T>, "watch" | "reset">,
) {
  useEffect(() => {
    if (!key) return;

    const draft = readDraft<T>(key);
    // keepDefaultValues so the restored form reads as dirty and can be submitted.
    if (draft) reset(draft, { keepDefaultValues: true });

    const subscription = watch((values) => {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(values));
      } catch {
        // Quota exceeded or storage blocked - the form still works, unsaved.
      }
    });
    return () => subscription.unsubscribe();
  }, [key, watch, reset]);

  return useCallback(() => {
    if (key) clearFormDraft(key);
  }, [key]);
}
