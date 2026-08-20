import { Calendar, Plus, Sun, X, Zap } from "lucide-react";
import {
  isBranching,
  type AutomationStep,
  type AutomationTrigger,
} from "@/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { useAccess, type OutboundChannel } from "@/hooks/useAccess";

/**
 * "Start from a recipe": prebuilt flows, opened as real editable definitions.
 *
 * Every recipe is an ordinary trigger + steps pair — nothing is locked, and
 * picking one creates a normal draft. They exist because a blank canvas with
 * eleven step types and three trigger kinds is a bad first screen, not because
 * the shapes are special.
 */

export type Recipe = {
  id: string;
  /** English source strings — the i18n keys. */
  title: string;
  description: string;
  kind: "lead" | "date" | "schedule" | "blank";
  art: "split" | "branch" | "line" | "blank";
  trigger: AutomationTrigger;
  steps: AutomationStep[];
};

const id = () => crypto.randomUUID().slice(0, 8);

/**
 * The channels a recipe would send on, branches included.
 *
 * Read so the gallery can withhold a recipe the organization cannot actually
 * run: picking one creates a real draft, and a draft seeded with a step whose
 * channel is not connected is a worse first screen than one recipe fewer.
 * Filtering here rather than editing the recipes keeps each one a single
 * coherent flow instead of a set of per-channel variants.
 */
function channelsUsed(steps: AutomationStep[]): Set<OutboundChannel> {
  const used = new Set<OutboundChannel>();

  const walk = (list: AutomationStep[]) => {
    for (const step of list) {
      if (step.type === "template") used.add("whatsapp");
      if (step.type === "email") used.add("email");
      if (isBranching(step)) {
        for (const branch of step.branches) walk(branch.steps);
      }
    }
  };

  walk(steps);
  return used;
}

export function recipes(): Recipe[] {
  return [
    {
      id: "split",
      title: "Split-test your first reply",
      description:
        "Wait a few minutes after a lead lands, send one of two templates to a share of them, hold back the rest, then route everyone to a rep.",
      kind: "lead",
      art: "split",
      trigger: { kind: "event", event: "lead_created", sources: [] },
      steps: [
        { id: id(), type: "wait", amount: 10, unit: "minutes" },
        {
          id: id(),
          type: "split",
          rejoin: true,
          branches: [
            {
              id: id(),
              name: "Variant A",
              pct: 50,
              steps: [
                { id: id(), type: "template", templateId: "", variables: [] },
              ],
            },
            {
              id: id(),
              name: "Variant B",
              pct: 40,
              steps: [
                { id: id(), type: "template", templateId: "", variables: [] },
              ],
            },
            { id: id(), name: "Holdout", pct: 10, steps: [] },
          ],
        },
        { id: id(), type: "assign", mode: "roundrobin", agentIds: [] },
      ],
    },
    {
      id: "reminder",
      title: "Remind before a meeting",
      description:
        "One day before a scheduled meeting, send a WhatsApp reminder — or fall back to email for anyone not reachable on WhatsApp.",
      kind: "date",
      art: "branch",
      trigger: {
        kind: "date",
        anchor: "appointment_start",
        offsetAmount: 1,
        offsetUnit: "days",
        offsetDir: "before",
        calendarIds: [],
      },
      steps: [
        {
          id: id(),
          type: "condition",
          rejoin: false,
          branches: [
            {
              id: id(),
              name: "Reachable on WhatsApp",
              rule: {
                all: [
                  {
                    field: "conversation.window24h",
                    op: "eq",
                    value: true,
                  },
                ],
              },
              steps: [
                { id: id(), type: "template", templateId: "", variables: [] },
              ],
            },
            {
              id: id(),
              name: "Everyone else",
              steps: [{ id: id(), type: "email", emailTemplateId: "" }],
            },
          ],
        },
      ],
    },
    {
      id: "sweep",
      title: "Daily AI follow-up sweep",
      description:
        "Twice a day, pick up every open conversation matching your tags and let an AI agent chase the missing details.",
      kind: "schedule",
      art: "line",
      trigger: {
        kind: "schedule",
        times: ["10:00", "18:00"],
        days: ["Sun", "Mon", "Tue", "Wed", "Thu"],
        tz: "Asia/Jerusalem",
      },
      steps: [
        // The sweep reaches every open conversation, so the flow says who it
        // is for in a step. Outside the 24-hour window an agent can only send
        // approved templates, which makes a free-form follow-up a no-op — this
        // is where that used to live as a trigger checkbox.
        {
          id: id(),
          type: "filter",
          rule: {
            all: [{ field: "conversation.window24h", op: "eq", value: true }],
          },
        },
        {
          id: id(),
          type: "assign",
          mode: "specific",
          agentIds: [],
          prompt:
            "Look at this conversation. If it stopped in the middle and some data is still required from the user, send him a follow-up question and kindly remind him to send you the remaining info.",
        },
      ],
    },
    {
      id: "welcome",
      title: "Welcome and qualify",
      description:
        "Greet a new contact, tag by where they came from, and hand the conversation to a rep.",
      kind: "lead",
      art: "line",
      trigger: { kind: "event", event: "conversation_started", sources: [] },
      steps: [
        { id: id(), type: "template", templateId: "", variables: [] },
        { id: id(), type: "tag", op: "add", tags: [] },
        { id: id(), type: "assign", mode: "roundrobin", agentIds: [] },
      ],
    },
    {
      id: "quote",
      title: "Quote sent — 3 day nudge",
      description:
        "When a contact is tagged as quoted, wait three days and write again if they have not replied.",
      kind: "lead",
      art: "line",
      trigger: { kind: "event", event: "tag_added", tags: [] },
      steps: [
        { id: id(), type: "wait", amount: 3, unit: "days" },
        {
          id: id(),
          type: "filter",
          rule: {
            all: [{ field: "conversation.window24h", op: "eq", value: false }],
          },
        },
        { id: id(), type: "template", templateId: "", variables: [] },
      ],
    },
    {
      id: "blank",
      title: "Start from scratch",
      description:
        "An empty flow. Pick your trigger and build the steps yourself.",
      kind: "blank",
      art: "blank",
      trigger: { kind: "event", event: "lead_created", sources: [] },
      steps: [],
    },
  ];
}

const KIND_LABELS: Record<Recipe["kind"], string> = {
  lead: "When a lead arrives",
  date: "Before a date",
  schedule: "On a schedule",
  blank: "Blank",
};

const KIND_ICONS = {
  lead: Zap,
  date: Calendar,
  schedule: Sun,
  blank: Plus,
};

/** A miniature of the flow's shape — enough to tell a split from a branch. */
function RecipeArt({ art }: { art: Recipe["art"] }) {
  const box = (filled?: boolean) => (
    <div
      className={
        "h-[10px] w-[10px] rounded-[3px] " +
        (filled ? "bg-primary" : "bg-flow-line")
      }
    />
  );
  const line = <div className="h-[9px] w-[2px] bg-flow-line" />;

  if (art === "split") {
    return (
      <div className="flex flex-col items-center gap-1">
        {box(true)}
        {line}
        <div className="flex items-center gap-[5px]">
          {box()}
          {box()}
          {box()}
        </div>
        {line}
        {box()}
      </div>
    );
  }

  if (art === "branch") {
    return (
      <div className="flex flex-col items-center gap-1">
        {box(true)}
        {line}
        <div className="flex items-center gap-[5px]">
          {box()}
          {box()}
        </div>
      </div>
    );
  }

  if (art === "line") {
    return (
      <div className="flex flex-col items-center gap-1">
        {box(true)}
        {line}
        {box()}
        {line}
        {box()}
      </div>
    );
  }

  return <Plus className="h-[22px] w-[22px] text-muted-foreground" />;
}

export default function RecipeGallery({
  onPick,
  onClose,
}: {
  onPick: (recipe: Recipe) => void;
  onClose: () => void;
}) {
  const { translate: t } = useTranslation();
  const { allows } = useAccess();
  // A recipe is offered only when *every* channel it sends on is connected —
  // the one allOf rule in the app, composed here rather than complicating the
  // table, which is anyOf throughout. The sweep and blank recipes send on none,
  // so the gallery is never empty.
  const all = recipes().filter((recipe) =>
    [...channelsUsed(recipe.steps)].every((channel) =>
      allows(`channel.${channel}`),
    ),
  );
  const order: Recipe["kind"][] = ["lead", "date", "schedule", "blank"];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-8"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-[980px] flex-col overflow-hidden rounded-[18px] bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-7 pb-4 pt-6">
          <div>
            <h2 className="m-0 text-xl font-semibold text-card-foreground">
              {t("Start from a recipe")}
            </h2>
            <p className="mt-[5px] text-[13.5px] text-muted-foreground">
              {t(
                "Each one opens as a real, editable flow — nothing is locked.",
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("Close")}
            className="rounded-lg border border-border bg-card p-[6px] hover:bg-muted"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 grid-cols-1 content-start gap-4 overflow-auto px-7 pb-7 pt-[22px] sm:grid-cols-2 lg:grid-cols-3">
          {order
            .flatMap((kind) => all.filter((recipe) => recipe.kind === kind))
            .map((recipe) => {
              const Icon = KIND_ICONS[recipe.kind];

              return (
                <button
                  key={recipe.id}
                  type="button"
                  className="flex flex-col overflow-hidden rounded-[13px] border border-border bg-card text-start transition-all hover:-translate-y-px hover:border-primary hover:shadow-md"
                  onClick={() => onPick(recipe)}
                >
                  <div className="flex h-[104px] shrink-0 items-center justify-center border-b border-border bg-muted">
                    <RecipeArt art={recipe.art} />
                  </div>
                  <div className="px-[15px] pb-4 pt-[14px]">
                    <div className="mb-2 flex items-center gap-[6px] text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
                      <Icon className="h-3 w-3" />
                      {t(KIND_LABELS[recipe.kind])}
                    </div>
                    <div className="text-[14.5px] font-semibold text-card-foreground">
                      {t(recipe.title)}
                    </div>
                    <div className="mt-[5px] text-[12.5px] leading-relaxed text-muted-foreground">
                      {t(recipe.description)}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
