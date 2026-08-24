import { useEffect, useMemo, useState } from "react";
import { Check, LinkIcon, MailX, Undo2 } from "lucide-react";
import Spinner from "@/components/Spinner";
import {
  getContext,
  resubscribe,
  unsubscribe,
  type UnsubscribeContext,
} from "./api";
import {
  canChooseLanguage,
  isRtl,
  LANGUAGE_OPTIONS,
  makeT,
  rememberLanguage,
  type Language,
  type Translate,
} from "./i18n";

/**
 * The public opt-out page: unsubscribe.delacrm.com/<token>.
 *
 * The token in the path is the whole credential and the whole route — there is
 * no router, no session and no account behind this page.
 *
 * THE PAGE NEVER UNSUBSCRIBES ON LOAD. Corporate mail scanners (Outlook Safe
 * Links, Proofpoint, Mimecast) fetch every URL in a delivered message, often
 * before a human opens the mail, so an auto-submit here would quietly opt out a
 * whole recipient list. The visitor has to press the button. The same rule is
 * enforced server-side: the GET route mutates nothing at all.
 */

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "error" }
  | { kind: "ready"; ctx: UnsubscribeContext };

export default function App({ initialLang }: { initialLang: Language }) {
  const [lang, setLang] = useState<Language>(initialLang);
  const t = useMemo(() => makeT(lang), [lang]);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);
  /** Set when an undo is refused because its window has closed. */
  const [undoFailed, setUndoFailed] = useState(false);

  // The token IS the route: no router, just the first path segment.
  const token = window.location.pathname.split("/").filter(Boolean)[0] ?? "";

  useEffect(() => {
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.title = t("Unsubscribe");
  }, [lang, t]);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setState({ kind: "invalid" });
      return;
    }

    getContext(token)
      .then((ctx) => {
        if (cancelled) return;
        setState(ctx.valid ? { kind: "ready", ctx } : { kind: "invalid" });
      })
      .catch(() => {
        // A transport failure is not an invalid link — saying so would tell
        // someone their opt-out is impossible when it is merely offline.
        if (!cancelled) setState({ kind: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  function chooseLanguage(next: Language) {
    setLang(next);
    rememberLanguage(next);
  }

  async function submit(action: "unsubscribe" | "resubscribe") {
    setSubmitting(true);
    setUndoFailed(false);
    try {
      const ctx = await (action === "unsubscribe"
        ? unsubscribe(token)
        : resubscribe(token));
      setState({ kind: "ready", ctx });
    } catch {
      // Re-read rather than guess: the server is the authority on whether the
      // undo window is still open, and an optimistic state here could tell
      // someone they are unsubscribed when they are not.
      if (action === "resubscribe") setUndoFailed(true);
      const ctx = await getContext(token).catch(() => null);
      if (ctx?.valid) setState({ kind: "ready", ctx });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-[20px] py-[28px]">
      {canChooseLanguage() && (
        <LanguageToggle lang={lang} onChange={chooseLanguage} />
      )}

      <div className="w-full max-w-[440px]">
        {state.kind === "loading" && (
          <div className="flex justify-center py-[64px] text-muted-foreground">
            <Spinner size={28} />
          </div>
        )}

        {state.kind === "invalid" && (
          <Card
            icon={<LinkIcon className="h-[22px] w-[22px]" />}
            title={t("This link is no longer valid")}
            body={t(
              "It may have been replaced by a newer one. If you still want to stop receiving these emails, reply to any message from us and we'll take care of it.",
            )}
          />
        )}

        {state.kind === "error" && (
          <Card
            icon={<LinkIcon className="h-[22px] w-[22px]" />}
            title={t("We couldn't load this page")}
            body={t("Check your connection and try again.")}
          />
        )}

        {state.kind === "ready" && (
          <Panel
            ctx={state.ctx}
            t={t}
            submitting={submitting}
            undoFailed={undoFailed}
            onSubmit={submit}
          />
        )}
      </div>
    </div>
  );
}

function Panel({
  ctx,
  t,
  submitting,
  undoFailed,
  onSubmit,
}: {
  ctx: UnsubscribeContext;
  t: Translate;
  submitting: boolean;
  undoFailed: boolean;
  onSubmit: (action: "unsubscribe" | "resubscribe") => void;
}) {
  const done = ctx.status === "unsubscribed";

  return (
    <Card
      icon={
        done ? (
          <Check className="h-[22px] w-[22px]" />
        ) : (
          <MailX className="h-[22px] w-[22px]" />
        )
      }
      title={
        done
          ? t("You've been unsubscribed")
          : t("Unsubscribe from these emails?")
      }
      // Whole sentences with a {{1}} slot, never concatenated fragments: Hebrew
      // puts the organization name in a different place, and gluing translated
      // pieces together in English order produces nonsense there.
      body={
        done
          ? t("You won't receive further emails from {{1}}.").replace(
              "{{1}}",
              ctx.organization_name,
            )
          : t(
              "{{1}} will stop sending marketing emails to this address:",
            ).replace("{{1}}", ctx.organization_name)
      }
    >
      {!done && (
        <>
          <div className="mt-[10px] text-[14px] font-medium">
            {ctx.masked_address}
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSubmit("unsubscribe")}
            className="mt-[20px] w-full rounded-[10px] bg-primary px-[16px] py-[11px] text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? t("Working…") : t("Unsubscribe")}
          </button>
        </>
      )}

      {done && ctx.can_undo && (
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit("resubscribe")}
          className="mt-[20px] inline-flex items-center gap-[7px] rounded-[10px] border border-border px-[14px] py-[9px] text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          <Undo2 className="h-[14px] w-[14px]" />
          {submitting ? t("Working…") : t("Undo — I clicked by mistake")}
        </button>
      )}

      {undoFailed && (
        <p className="mt-[14px] text-[13px] text-muted-foreground">
          {t(
            "That undo window has closed. Reply to any message from us if you'd like to start receiving emails again.",
          )}
        </p>
      )}
    </Card>
  );
}

function LanguageToggle({
  lang,
  onChange,
}: {
  lang: Language;
  onChange: (lang: Language) => void;
}) {
  return (
    <div className="fixed top-[16px] end-[16px] z-20 flex rounded-full border border-border bg-card p-[3px] shadow-[0_2px_8px_rgba(0,0,0,.06)]">
      {LANGUAGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-[13px] py-[5px] text-[13px] font-semibold transition-colors ${
            option.value === lang
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Card({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[420px] rounded-[16px] border border-border bg-card p-[24px] text-center">
      <div className="mx-auto mb-[16px] flex h-[48px] w-[48px] items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h1 className="text-[18px] leading-tight font-semibold">{title}</h1>
      <p className="mt-[8px] text-[14px] text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
