import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronDown, Copy, Smartphone } from "lucide-react";
import Spinner from "@/components/Spinner";
import { getSyncContext, type SyncContext } from "./api";
import type { Translate } from "./i18n";

/**
 * calendar.delacrm.com/sync/<token> — the page a phone lands on after scanning
 * the QR from the calendar board.
 *
 * Its job is a decision, not a form: confirm which calendar is about to be
 * added to this device, then hand iOS a configuration profile. iOS has no URL
 * scheme for adding a CalDAV account, so the profile is the only route that
 * does not make the user type a server address by hand — and every other
 * platform gets those settings from the "set up manually" panel below.
 */

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "error" }
  | { kind: "ready"; sync: SyncContext };

export default function Sync({ token, t }: { token: string; t: Translate }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setState({ kind: "invalid" });
      return;
    }

    getSyncContext(token)
      .then((sync) => {
        if (cancelled) return;
        setState(sync.valid ? { kind: "ready", sync } : { kind: "invalid" });
      })
      .catch(() => {
        // A transport failure is not an invalid link — saying so would send
        // someone with a perfectly good link away for good.
        if (!cancelled) setState({ kind: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === "loading") {
    return (
      <div className="flex justify-center py-[64px] text-muted-foreground">
        <Spinner size={28} />
      </div>
    );
  }

  if (state.kind !== "ready") {
    return (
      <Card
        title={
          state.kind === "invalid"
            ? t("This link is no longer valid")
            : t("We couldn't load this calendar")
        }
        body={
          state.kind === "invalid"
            ? t(
                "It may have been reset or replaced. Ask for a new code and you'll be able to connect in a moment.",
              )
            : t("Check your connection and try again.")
        }
      />
    );
  }

  const { sync } = state;

  return (
    <div className="mx-auto w-full max-w-[440px] rounded-[16px] border border-border bg-card p-[24px]">
      <div className="mx-auto mb-[16px] flex h-[48px] w-[48px] items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CalendarDays className="h-[22px] w-[22px]" />
      </div>

      <h1 className="text-center text-[18px] leading-tight font-semibold">
        {sync.calendar_name}
      </h1>
      <p className="mt-[4px] text-center text-[14px] text-muted-foreground">
        {sync.organization_name}
      </p>

      {/* The colour lives on the inner span, not the anchor: global.css has an
          unlayered `a { color: inherit }`, and unlayered CSS beats Tailwind's
          layered utilities whatever their specificity — so
          `text-primary-foreground` on the <a> itself silently does nothing. */}
      <a
        href={sync.profile_url}
        className="mt-[22px] flex w-full items-center justify-center rounded-full bg-primary px-[18px] py-[11px] hover:bg-primary/90"
      >
        <span className="flex items-center gap-2 text-[15px] font-semibold text-primary-foreground">
          <Smartphone className="h-[17px] w-[17px]" />
          {t("Add to iPhone or iPad")}
        </span>
      </a>

      <ol className="mt-[18px] flex flex-col gap-[8px] text-[13px] text-muted-foreground">
        <Step n="1" text={t("Tap the button above, then Allow.")} />
        <Step
          n="2"
          text={t("Open Settings — you'll see “Profile Downloaded” near the top.")}
        />
        <Step n="3" text={t("Tap it, then Install, and enter your passcode.")} />
      </ol>

      {/* Said plainly and up front: iOS shows this in red, and a user who was
          not expecting it reads it as "this is unsafe" and stops. */}
      <p className="mt-[14px] text-[12px] text-muted-foreground">
        {t(
          "iOS marks the profile “Unverified” because it is not signed by Apple. That is expected.",
        )}
      </p>

      <ManualSetup sync={sync} t={t} />
    </div>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <li className="flex gap-[10px]">
      <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
        {n}
      </span>
      <span className="pt-[1px]">{text}</span>
    </li>
  );
}

/** Raw CalDAV settings for Android (DAVx⁵), macOS and Thunderbird. */
function ManualSetup({ sync, t }: { sync: SyncContext; t: Translate }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-[20px] border-t border-border pt-[14px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-[13px] text-muted-foreground hover:text-foreground"
      >
        {t("Set up manually (Android, Mac, other apps)")}
        <ChevronDown
          className={`h-[16px] w-[16px] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-[12px] flex flex-col gap-[10px]">
          <Field label={t("Server address")} value={sync.server_url} t={t} />
          <Field label={t("Username")} value={sync.username} t={t} />
          <Field label={t("Password")} value={sync.password} t={t} />
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  t,
}: {
  label: string;
  value: string;
  t: Translate;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-[4px]">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 rounded-[10px] border border-border bg-background px-3 py-[8px]">
        <span className="grow truncate text-[13px]" dir="ltr">
          {value}
        </span>
        <button
          type="button"
          onClick={copy}
          title={copied ? t("Copied") : t("Copy")}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <Check className="h-[15px] w-[15px]" />
          ) : (
            <Copy className="h-[15px] w-[15px]" />
          )}
        </button>
      </div>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-[420px] rounded-[16px] border border-border bg-card p-[24px] text-center">
      <div className="mx-auto mb-[16px] flex h-[48px] w-[48px] items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CalendarDays className="h-[22px] w-[22px]" />
      </div>
      <h1 className="text-[18px] leading-tight font-semibold">{title}</h1>
      <p className="mt-[8px] text-[14px] text-muted-foreground">{body}</p>
    </div>
  );
}
