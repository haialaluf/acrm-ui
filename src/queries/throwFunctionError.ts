import { FunctionsHttpError } from "@supabase/supabase-js";

// Edge functions return errors as JSON `{ error: string }`. For non-2xx
// responses supabase-js exposes the raw Response on `error.context`, so we read
// the body to surface the real message (e.g. Meta's rejection reason).
export async function throwFunctionError(error: unknown): Promise<never> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    throw new Error(body?.error || error.message);
  }
  throw error;
}
