import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Database, supabase } from "@/supabase/client";
import useBoundStore from "@/stores/useBoundStore";
import type { SessionReport } from "@/components/therapy/therapyStore";
import {
  DEFAULT_TEMPLATES,
  type ReportTemplate,
  type TemplateSection,
} from "@/components/therapy/templates";
import { queryKeys } from "./queryKeys";
import { throwFunctionError } from "./throwFunctionError";

export type SessionReportRow =
  Database["public"]["Tables"]["session_reports"]["Row"];

type ReportContent = Pick<SessionReport, "sections" | "transcript">;

function toReport(
  row: SessionReportRow,
  content: ReportContent,
): SessionReport {
  return {
    id: row.id,
    contactId: row.contact_id,
    appointmentId: row.appointment_id,
    templateId: row.template_id ?? "",
    templateName: row.template_name,
    createdAt: row.created_at,
    durationSeconds: row.duration_seconds ?? 0,
    status: row.status === "approved" ? "approved" : "draft",
    sections: content.sections ?? [],
    transcript: content.transcript ?? [],
  };
}

async function fetchReport(id: string): Promise<SessionReport> {
  const { data, error } = await supabase.functions.invoke<
    SessionReportRow & { content: ReportContent }
  >(`patient-data/reports/${id}`, { method: "GET" });
  if (error) await throwFunctionError(error);
  return toReport(data!, data!.content);
}

/** Labels only (no content), for lists and practice-wide questions. */
export function useSessionReportRows(contactId?: string) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  return useQuery({
    queryKey: contactId
      ? queryKeys.sessionReports.contact(orgId, contactId)
      : queryKeys.sessionReports.org(orgId),
    queryFn: async () => {
      let query = supabase
        .from("session_reports")
        .select()
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (contactId) query = query.eq("contact_id", contactId);
      const { data } = await query.throwOnError();
      return data ?? [];
    },
    enabled: !!orgId,
  });
}

export function useSessionReport(reportId: string) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  return useQuery({
    queryKey: queryKeys.sessionReports.detail(orgId, reportId),
    queryFn: () => fetchReport(reportId),
    enabled: !!orgId && !!reportId,
    staleTime: Infinity,
  });
}

/** Full content of every report on one patient, for Ask AI. */
export function useContactReportContents(contactId: string) {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  const { data: rows } = useSessionReportRows(contactId);
  return useQuery({
    queryKey: [
      ...queryKeys.sessionReports.contents(orgId, contactId),
      rows?.map((r) => `${r.id}:${r.updated_at}`),
    ],
    queryFn: () => Promise.all((rows ?? []).map((r) => fetchReport(r.id))),
    enabled: !!orgId && !!rows,
  });
}

export function useSaveSessionReport() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (
      report: Omit<SessionReport, "id" | "createdAt"> & {
        id?: string;
      },
    ) => {
      const { data, error } = await supabase.functions.invoke<SessionReportRow>(
        "patient-data/reports",
        {
          method: "POST",
          body: {
            id: report.id,
            contactId: report.contactId,
            appointmentId: report.appointmentId,
            templateId: report.templateId || null,
            templateName: report.templateName,
            durationSeconds: report.durationSeconds,
            status: report.status,
            content: {
              sections: report.sections,
              transcript: report.transcript,
            },
          },
        },
      );
      if (error) await throwFunctionError(error);
      return toReport(data!, report);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(
        queryKeys.sessionReports.detail(orgId, saved.id),
        saved,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sessionReports.org(orgId),
        predicate: (q) => q.queryKey[2] !== "detail",
      });
    },
  });
}

export function useDeleteSessionReport() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase.functions.invoke(
        `patient-data/reports/${reportId}`,
        { method: "DELETE" },
      );
      if (error) await throwFunctionError(error);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.sessionReports.org(orgId),
      }),
  });
}

//===================================
// Report templates
//===================================

type TemplateRow = Database["public"]["Tables"]["report_templates"]["Row"];

function toTemplate(row: TemplateRow): ReportTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sections: (row.sections as unknown as TemplateSection[]) ?? [],
  };
}

/** A practice starts with the built-in templates the first time it looks. */
export function useReportTemplates() {
  const orgId = useBoundStore((state) => state.ui.activeOrgId);
  return useQuery({
    queryKey: queryKeys.reportTemplates.all(orgId),
    queryFn: async () => {
      const { data } = await supabase
        .from("report_templates")
        .select()
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: true })
        .throwOnError();
      if (data && data.length > 0) return data.map(toTemplate);

      const { data: seeded } = await supabase
        .from("report_templates")
        .insert(
          DEFAULT_TEMPLATES.map((tpl) => ({
            organization_id: orgId!,
            name: tpl.name,
            description: tpl.description,
            sections: tpl.sections as unknown as TemplateRow["sections"],
          })),
        )
        .select()
        .throwOnError();
      return (seeded ?? []).map(toTemplate);
    },
    enabled: !!orgId,
  });
}

export function useSaveReportTemplate() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (
      template: Partial<ReportTemplate> & { name: string },
    ) => {
      const { data } = await supabase
        .from("report_templates")
        .upsert({
          ...(template.id ? { id: template.id } : {}),
          organization_id: orgId!,
          name: template.name,
          description: template.description ?? "",
          sections: (template.sections ??
            []) as unknown as TemplateRow["sections"],
        })
        .select()
        .single()
        .throwOnError();
      return toTemplate(data);
    },
    onSuccess: (saved) =>
      queryClient.setQueryData<ReportTemplate[]>(
        queryKeys.reportTemplates.all(orgId),
        (old) =>
          old?.some((t) => t.id === saved.id)
            ? old.map((t) => (t.id === saved.id ? saved : t))
            : [...(old ?? []), saved],
      ),
  });
}

export function useDeleteReportTemplate() {
  const queryClient = useQueryClient();
  const orgId = useBoundStore((state) => state.ui.activeOrgId);

  return useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("report_templates")
        .delete()
        .eq("id", id)
        .throwOnError();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.reportTemplates.all(orgId),
      }),
  });
}
