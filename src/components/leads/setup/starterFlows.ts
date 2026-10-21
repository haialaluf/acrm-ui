import type {
  LeadFlow,
  LeadOutcome,
  LeadPhase,
  LeadStage,
} from "@/supabase/client";

type T = (text: string) => string;

export type StarterId =
  | "scratch"
  | "service"
  | "clinic"
  | "realestate"
  | "course";

export const STARTERS: { id: StarterId; name: string; desc: string }[] = [
  {
    id: "scratch",
    name: "From scratch",
    desc: "One stage per main phase - add the rest yourself.",
  },
  {
    id: "service",
    name: "Service / studio",
    desc: "Call → intro meeting → quote → close",
  },
  {
    id: "clinic",
    name: "Clinic",
    desc: "Inquiry → consultation → treatment",
  },
  {
    id: "realestate",
    name: "Real estate",
    desc: "Inquiry → viewing → negotiation → contract",
  },
  {
    id: "course",
    name: "Courses and training",
    desc: "Left details → advisory call → registration",
  },
];

const stage = (
  id: string,
  name: string,
  phase: LeadPhase,
  hue: number | null,
  requires: string[] = [],
): LeadStage => ({ id, name, phase, hue, requires });

const outcome = (
  o: Partial<LeadOutcome> & Pick<LeadOutcome, "id" | "label" | "icon">,
): LeadOutcome => ({
  to_stage: null,
  counts_attempt: false,
  asks: [],
  next_type: null,
  next_in: "none",
  template: null,
  ...o,
});

const lostReason = (t: T) => ({
  id: "lost_reason",
  label: t("Reason"),
  type: "select" as const,
  options: [
    t("No budget"),
    t("Went with someone else"),
    t("Not a fit for the service"),
    t("Not serious / unreachable"),
    t("Other"),
  ],
});

function commonOutcomes(t: T, open: string, won: string, lost: string) {
  return [
    outcome({
      id: "no_answer",
      label: t("No answer"),
      icon: "phone-missed",
      counts_attempt: true,
      next_type: "call",
      next_in: "1d",
    }),
    outcome({
      id: "callback",
      label: t("Asked us to call back"),
      icon: "clock",
      to_stage: open,
      next_type: "call",
      next_in: "ask",
    }),
    outcome({
      id: "won",
      label: t("Closed"),
      icon: "check",
      to_stage: won,
    }),
    outcome({
      id: "lost",
      label: t("Not relevant"),
      icon: "x",
      to_stage: lost,
    }),
  ];
}

export function starterFlow(id: StarterId, t: T): LeadFlow {
  switch (id) {
    case "scratch":
      return {
        max_attempts: 4,
        stages: [
          stage("new", t("New"), "new", null),
          stage("open", t("In progress"), "open", 55),
          stage("won", t("Customer"), "won", 150),
          stage("lost", t("Not relevant"), "lost", 27),
        ],
        outcomes: commonOutcomes(t, "open", "won", "lost"),
        fields: [],
      };

    case "service": {
      const [noAnswer, callback, won, lost] = commonOutcomes(
        t,
        "follow_up",
        "customer",
        "not_relevant",
      );
      return {
        max_attempts: 4,
        stages: [
          stage("not_contacted", t("Not contacted yet"), "new", null),
          stage("follow_up", t("Follow up"), "open", 95),
          stage("in_sales", t("In sales"), "open", 55),
          stage("quote", t("Quote sent"), "open", 215, ["quote_amount"]),
          stage("customer", t("Customer"), "won", 150, ["deal_amount"]),
          stage("not_relevant", t("Not relevant"), "lost", 27, ["lost_reason"]),
        ],
        outcomes: [
          noAnswer,
          callback,
          outcome({
            id: "good_call",
            label: t("Good call"),
            icon: "message",
            to_stage: "in_sales",
            next_type: "followup",
            next_in: "2d",
          }),
          outcome({
            id: "meeting",
            label: t("Meeting set"),
            icon: "calendar",
            to_stage: "in_sales",
            next_type: "meeting",
            next_in: "ask",
          }),
          outcome({
            id: "quote_sent",
            label: t("Quote sent"),
            icon: "file",
            to_stage: "quote",
            next_type: "followup",
            next_in: "3d",
          }),
          won,
          lost,
        ],
        fields: [
          { id: "quote_amount", label: t("Quote amount"), type: "money" },
          { id: "deal_amount", label: t("Deal amount"), type: "money" },
          lostReason(t),
        ],
      };
    }

    case "clinic": {
      const [noAnswer, callback, won, lost] = commonOutcomes(
        t,
        "inquiry",
        "in_treatment",
        "not_relevant",
      );
      return {
        max_attempts: 3,
        stages: [
          stage("new", t("New inquiry"), "new", null),
          stage("inquiry", t("In touch"), "open", 95),
          stage("consultation", t("Consultation booked"), "open", 215),
          stage("in_treatment", t("In treatment"), "won", 150),
          stage("not_relevant", t("Not relevant"), "lost", 27, ["lost_reason"]),
        ],
        outcomes: [
          noAnswer,
          callback,
          outcome({
            id: "booked",
            label: t("Consultation booked"),
            icon: "calendar",
            to_stage: "consultation",
            next_type: "meeting",
            next_in: "ask",
          }),
          won,
          lost,
        ],
        fields: [lostReason(t)],
      };
    }

    case "realestate": {
      const [noAnswer, callback, won, lost] = commonOutcomes(
        t,
        "in_touch",
        "contract",
        "not_relevant",
      );
      return {
        max_attempts: 4,
        stages: [
          stage("new", t("New inquiry"), "new", null),
          stage("in_touch", t("In touch"), "open", 95),
          stage("viewing", t("Viewing"), "open", 55),
          stage("negotiation", t("Negotiation"), "open", 215, ["offer_amount"]),
          stage("contract", t("Contract signed"), "won", 150),
          stage("not_relevant", t("Not relevant"), "lost", 27, ["lost_reason"]),
        ],
        outcomes: [
          noAnswer,
          callback,
          outcome({
            id: "viewing",
            label: t("Viewing set"),
            icon: "calendar",
            to_stage: "viewing",
            next_type: "meeting",
            next_in: "ask",
          }),
          outcome({
            id: "offer",
            label: t("Made an offer"),
            icon: "file",
            to_stage: "negotiation",
            next_type: "followup",
            next_in: "2d",
          }),
          won,
          lost,
        ],
        fields: [
          { id: "offer_amount", label: t("Offer amount"), type: "money" },
          lostReason(t),
        ],
      };
    }

    case "course": {
      const [noAnswer, callback, won, lost] = commonOutcomes(
        t,
        "advisory",
        "registered",
        "not_relevant",
      );
      return {
        max_attempts: 3,
        stages: [
          stage("new", t("Left details"), "new", null),
          stage("advisory", t("Advisory call"), "open", 95),
          stage("registered", t("Registered"), "won", 150),
          stage("not_relevant", t("Not relevant"), "lost", 27, ["lost_reason"]),
        ],
        outcomes: [noAnswer, callback, won, lost],
        fields: [lostReason(t)],
      };
    }
  }
}
