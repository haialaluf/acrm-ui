import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { Dropdown, Switch } from "antd";
import { useTranslation } from "@/hooks/useTranslation";
import { useCurrentAgents } from "@/queries/useAgents";
import { useCalendars } from "@/queries/useCalendars";
import { useEmailTemplates } from "@/queries/useEmailTemplates";
import {
  useApprovedTemplates,
  useAutomations,
  useAutomationStats,
  useCreateAutomation,
  useDeleteAutomation,
  useUpdateAutomation,
} from "@/queries/useAutomations";
import { countSteps } from "./tree";
import { type Lookups, triggerInfo } from "./summaries";
import RecipeGallery, { type Recipe } from "./RecipeGallery";
import { inputClass } from "./Fields";

/**
 * The automations list: everything the org has built, and the entry point to
 * building another.
 */

type Tab = "all" | "live" | "paused" | "draft";

const STATUS_DOT: Record<string, string> = {
  live: "bg-success",
  paused: "bg-warning",
  draft: "bg-input",
};

export default function AutomationsList() {
  const { translate: t } = useTranslation();
  const navigate = useNavigate();

  const { data: automations, isLoading } = useAutomations();
  const { data: stats } = useAutomationStats();
  const { data: agents } = useCurrentAgents();
  const { data: templates } = useApprovedTemplates();
  const { data: emailTemplates } = useEmailTemplates();
  const { data: calendars } = useCalendars();

  const createAutomation = useCreateAutomation();
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);

  const lookups: Lookups = useMemo(
    () => ({
      agents: (agents ?? []).map((a) => ({ id: a.id, name: a.name, ai: a.ai })),
      templates: (templates ?? []).map((x) => ({ id: x.id, name: x.name })),
      emailTemplates: (emailTemplates ?? []).map((x) => ({
        id: x.id,
        name: x.name,
      })),
      calendars: (calendars ?? []).map((c) => ({ id: c.id, name: c.name })),
    }),
    [agents, templates, emailTemplates, calendars],
  );

  const counts = useMemo(
    () => ({
      all: automations?.length ?? 0,
      live: automations?.filter((a) => a.status === "live").length ?? 0,
      paused: automations?.filter((a) => a.status === "paused").length ?? 0,
      draft: automations?.filter((a) => a.status === "draft").length ?? 0,
    }),
    [automations],
  );

  const shown = (automations ?? []).filter(
    (automation) =>
      (tab === "all" || automation.status === tab) &&
      automation.name.toLowerCase().includes(search.toLowerCase()),
  );

  const pickRecipe = async (recipe: Recipe) => {
    setGalleryOpen(false);

    const id = await createAutomation.mutateAsync({
      name: t(recipe.title),
      trigger: recipe.trigger,
      steps: recipe.steps,
    });

    void navigate({
      to: "/automations/$automationId",
      params: { automationId: id },
    });
  };

  const TAB_LABELS: Record<Tab, string> = {
    all: t("All"),
    live: t("Live"),
    paused: t("Paused"),
    draft: t("Drafts"),
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header. Title block, then search and the new-automation button on
          their own row — side by side they would fight over a panel that is
          often only ~350px wide, which is what squeezed the search field down
          to its icon. */}
      <div className="shrink-0 px-[18px] pt-[18px]">
        <h1 className="m-0 text-[21px] font-semibold text-card-foreground">
          {t("Automations")}
        </h1>
        <p className="mt-[5px] text-[13px] text-muted-foreground">
          {t(
            "Flows that run on their own — when something happens, before a date, or on a schedule.",
          )}
        </p>

        <div className="mt-3 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-[10px] top-[9px] h-4 w-4 text-muted-foreground" />
            <input
              className={inputClass + " ps-8"}
              placeholder={t("Search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-[9px] border border-primary bg-primary px-[13px] py-[7px] text-[13.5px] text-white hover:opacity-90"
            onClick={() => setGalleryOpen(true)}
          >
            <Plus className="h-[15px] w-[15px]" />
            {t("New automation")}
          </button>
        </div>

        {/* The four tabs plus their counts do not fit a narrow panel either,
            so the strip scrolls sideways rather than wrapping onto a second
            row and pushing the list down. */}
        <div className="mt-[14px] flex gap-[2px] overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(Object.keys(TAB_LABELS) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={
                "-mb-px flex shrink-0 items-center gap-[7px] border-b-2 px-3 py-[9px] text-[13.5px] " +
                (tab === key
                  ? "border-primary font-semibold text-card-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {TAB_LABELS[key]}
              <span className="rounded-[5px] bg-muted px-[5px] py-px text-[11.5px] text-muted-foreground">
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-[18px] pb-10">
        {isLoading ? null : shown.length === 0 ? (
          <div className="px-5 py-[70px] text-center text-muted-foreground">
            {t("No automations here yet.")}
          </div>
        ) : (
          shown.map((automation) => {
            const info = triggerInfo(automation.trigger, lookups, t);
            const stat = stats?.get(automation.id);
            const steps = countSteps(automation.steps);
            const Icon = info.icon;

            return (
              <div
                key={automation.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  navigate({
                    to: "/automations/$automationId",
                    params: { automationId: automation.id },
                  })
                }
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  void navigate({
                    to: "/automations/$automationId",
                    params: { automationId: automation.id },
                  });
                }}
                className="cursor-pointer border-b border-border px-1 py-[13px] hover:bg-primary/5"
              >
                {/* Name and the controls share the first line; everything else
                    stacks under it.

                    The design lays this out as a four-column table, which it
                    can afford at full page width. Here the list lives in the
                    resizable left panel — often ~350px — so fixed column
                    tracks do not fit, and viewport breakpoints cannot tell:
                    `md:` is true on a wide screen even when this panel is
                    narrow. Stacking is the only shape that holds at every
                    panel width, and it is what the neighbouring broadcasts
                    list does for the same reason. */}
                <div className="flex items-center gap-[9px]">
                  <span
                    className={
                      "h-[7px] w-[7px] shrink-0 rounded-full " +
                      (STATUS_DOT[automation.status] ?? "bg-input")
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-card-foreground">
                    {automation.name}
                  </span>

                  <div
                    className="flex shrink-0 items-center gap-[6px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      size="small"
                      checked={automation.status === "live"}
                      // A draft has never been reviewed as a whole; turning it on
                      // is a decision made in the editor, not from a list row.
                      disabled={automation.status === "draft"}
                      onChange={(checked) =>
                        updateAutomation.mutate({
                          id: automation.id,
                          version: automation.version,
                          definitionChanged: false,
                          status: checked ? "live" : "paused",
                        })
                      }
                    />
                    <Dropdown
                      trigger={["click"]}
                      menu={{
                        items: [
                          {
                            key: "delete",
                            danger: true,
                            label: t("Delete"),
                            onClick: () =>
                              deleteAutomation.mutate(automation.id),
                          },
                        ],
                      }}
                    >
                      <button
                        type="button"
                        aria-label={t("More options")}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </Dropdown>
                  </div>
                </div>

                {/* Two lines of detail, each free to use the full width. The
                    trigger sentence is the long one, so it gets two lines
                    before it clips rather than truncating at the first word. */}
                <div className="mt-[6px] flex items-start gap-[6px] ps-4 text-[13px] text-muted-foreground">
                  <Icon className="mt-[3px] h-[13px] w-[13px] shrink-0" />
                  <span className="line-clamp-2">{info.title}</span>
                </div>

                <div className="mt-[3px] ps-4 text-xs tabular-nums text-muted-foreground">
                  {steps === 1
                    ? t("1 step")
                    : t("{{1}} steps").replace("{{1}}", String(steps))}
                  {" · "}
                  {t("{{1}} entered").replace(
                    "{{1}}",
                    (stat?.entered ?? 0).toLocaleString(),
                  )}
                  {" · "}
                  {t("{{1}} completed · last 30d").replace(
                    "{{1}}",
                    (stat?.completed ?? 0).toLocaleString(),
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {galleryOpen && (
        <RecipeGallery
          onPick={(recipe) => void pickRecipe(recipe)}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </div>
  );
}
