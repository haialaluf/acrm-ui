import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/supabase/client";
import type { Database, Tables } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import { queryKeys } from "./queryKeys";

export type HealthSnapshotRow = Tables<"whatsapp_health_snapshots">;
export type MessageTemplateRow = Tables<"message_templates">;
export type LogRow = Tables<"logs">;
export type DailyMetricRow =
  Database["public"]["Functions"]["whatsapp_daily_metrics"]["Returns"][number];
export type TemplateSendRow =
  Database["public"]["Functions"]["whatsapp_template_sends"]["Returns"][number];

/**
 * `logs.category` values written by the WhatsApp health path (the webhook's
 * health branches plus the 4-hourly poller). Filtering on these keeps the
 * timeline about the *number* rather than every log line the org ever wrote.
 */
export const HEALTH_LOG_CATEGORIES = [
  "account_update",
  "phone_number_quality_update",
  "message_template_status_update",
  "message_template_quality_update",
  "health_poll",
] as const;

/**
 * Health snapshots for one number, newest first.
 *
 * Deliberately a window rather than a single row: poll rows and webhook rows
 * populate *different* columns (a webhook quality update carries no
 * `account_review_status`, a poll carries no `violation_type`), so current
 * state has to be coalesced across several rows. See `coalesceHealth`.
 */
export function useHealthSnapshots(address: string | null | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.whatsappHealth.snapshots(orgId, address),
    queryFn: async () =>
      await supabase
        .from("whatsapp_health_snapshots")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("organization_address", address!)
        .order("created_at", { ascending: false })
        .limit(60)
        .throwOnError(),
    enabled: !!orgId && !!address,
    select: (data) => data.data ?? [],
  });
}

/**
 * Per-day sending behaviour for every WhatsApp number in the org.
 *
 * Callers pass twice the window they display, so the previous-equal-length
 * window needed for deltas comes out of the same request instead of a second
 * round trip. Rows are *not* zero-filled by the RPC — days with no WhatsApp
 * messages are simply absent. Use `fillDays` before charting.
 */
export function useWhatsAppDailyMetrics(days: number) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.whatsappHealth.metrics(orgId, days),
    queryFn: async () =>
      await supabase
        .rpc("whatsapp_daily_metrics", {
          p_organization_id: orgId!,
          p_days: days,
        })
        .throwOnError(),
    enabled: !!orgId,
    select: (data) => data.data ?? [],
  });
}

/**
 * The `message_templates` mirror kept in sync by the health poller.
 *
 * Not the same source as `useTemplates`, which fetches the Graph API live and
 * returns no `quality_score`, `disable_date` or `rejected_reason` — the three
 * fields this page exists to surface.
 */
export function useMessageTemplatesMirror(address: string | null | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.whatsappHealth.templates(orgId, address),
    queryFn: async () =>
      await supabase
        .from("message_templates")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("organization_address", address!)
        .order("name")
        .throwOnError(),
    enabled: !!orgId && !!address,
    select: (data) => data.data ?? [],
  });
}

/** Meta health events for one number, newest first. */
export function useHealthEvents(address: string | null | undefined) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.whatsappHealth.events(orgId, address),
    queryFn: async () =>
      await supabase
        .from("logs")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("organization_address", address!)
        .in("category", [...HEALTH_LOG_CATEGORIES])
        .order("created_at", { ascending: false })
        .limit(50)
        .throwOnError(),
    enabled: !!orgId && !!address,
    select: (data) => data.data ?? [],
  });
}

/**
 * Send counts per template, reconstructed from `messages`. Meta exposes no
 * per-template send count, so this is the only way to tell a paused template
 * that carried a third of last month's volume from one nobody uses.
 */
export function useTemplateSends(days: number) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useQuery({
    queryKey: queryKeys.whatsappHealth.templateSends(orgId, days),
    queryFn: async () =>
      await supabase
        .rpc("whatsapp_template_sends", {
          p_organization_id: orgId!,
          p_days: days,
        })
        .throwOnError(),
    enabled: !!orgId,
    select: (data) => data.data ?? [],
  });
}
