// Sync-only stub for `@/supabase/client`.
//
// The real module instantiates a live Supabase client at module scope from
// `import.meta.env.VITE_SUPABASE_*`. Inside the static preview bundle
// `import.meta` is `{}`, so importing it throws before any component renders.
// Everything the real module re-exports is kept (those modules carry the row
// types and their runtime constants); only the client value is inert.
export * from "@/supabase/types/whatsapp_webhook_payload_types";
export * from "@/supabase/types/whatsapp_endpoint_types";
export * from "@/supabase/types/whatsapp_template_types";
export * from "@/supabase/types/whatsapp_webhook_message_types";
export * from "@/supabase/types/email_template_types";
export * from "@/supabase/types/instagram_webhook_payload_types";
export * from "@/supabase/types/status_types";
export * from "@/supabase/types/message_types";
export * from "@/supabase/types/extra_types";
export * from "@/supabase/types/automation_types";
export * from "@/supabase/types/contact_source_types";
export * from "@/supabase/types/ui_types";
export * from "@/supabase/types/database_types";

export const supabase = {} as never;
