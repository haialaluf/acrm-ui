import { useEffect, useMemo, useState } from "react";
import { LinkIcon } from "lucide-react";
import Spinner from "@/components/Spinner";
import {
  cancelAppointment,
  getLink,
  type BookingAppointment,
  type BookingLinkContext,
} from "./api";
import Confirmation from "./Confirmation";
import Scheduler from "./Scheduler";
import {
  canChooseLanguage,
  isRtl,
  LANGUAGE_OPTIONS,
  makeT,
  rememberLanguage,
  type Language,
} from "./i18n";

/**
 * The public booking page: calendar.delacrm.com/<token>.
 *
 * The token in the path is the whole credential and the whole route — there is
 * no router, no session and no account behind this page. Everything it can
 * show comes from `GET /booking/:token`: the company, the calendar, and the
 * contact's own appointment if they already have one.
 */

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "error" }
  | { kind: "ready"; link: BookingLinkContext };

export default function App({ initialLang }: { initialLang: Language }) {
  const [lang, setLang] = useState<Language>(initialLang);
  const t = useMemo(() => makeT(lang), [lang]);
  const [state, setState] = useState<State>({ kind: "loading" });
  /** The visitor's appointment, once they have one. */
  const [appointment, setAppointment] = useState<BookingAppointment | null>(
    null,
  );
  /** Set while they are picking a new time for an appointment they already have. */
  const [rescheduleOf, setRescheduleOf] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // The token IS the route: no router, just the first path segment.
  const token = window.location.pathname.split("/").filter(Boolean)[0] ?? "";

  useEffect(() => {
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.title = t("Reservar cita");
  }, [lang, t]);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setState({ kind: "invalid" });
      return;
    }

    getLink(token)
      .then((link) => {
        if (cancelled) return;
        if (!link.valid) {
          setState({ kind: "invalid" });
          return;
        }
        setState({ kind: "ready", link });
        setAppointment(link.appointment);
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

  function chooseLanguage(next: Language) {
    setLang(next);
    rememberLanguage(next);
  }

  async function cancel() {
    if (!appointment) return;
    setCancelling(true);
    try {
      await cancelAppointment(token, appointment.id);
      setAppointment(null);
      setRescheduleOf(null);
    } catch {
      // Nothing to undo: the appointment simply stands, and the page still
      // shows it. Trying again is the whole recovery path.
    } finally {
      setCancelling(false);
    }
  }

  const booked = state.kind === "ready" && appointment && !rescheduleOf;

  return (
    <div className="flex min-h-dvh items-center justify-center px-[20px] py-[28px] max-md:items-stretch max-md:p-0">
      {canChooseLanguage() && (
        <LanguageToggle lang={lang} onChange={chooseLanguage} />
      )}

      <div className="w-full max-w-[960px]">
        {state.kind === "loading" && (
          <div className="flex justify-center py-[64px] text-muted-foreground">
            <Spinner size={28} />
          </div>
        )}

        {state.kind === "invalid" && (
          <Card
            icon={<LinkIcon className="h-[22px] w-[22px]" />}
            title={t("Este enlace ya no es válido")}
            body={t(
              "Puede haber caducado o haber sido reemplazado. Pide uno nuevo por WhatsApp y podrás reservar en un momento.",
            )}
          />
        )}

        {state.kind === "error" && (
          <Card
            icon={<LinkIcon className="h-[22px] w-[22px]" />}
            title={t("No pudimos cargar tu reserva")}
            body={t("Revisa tu conexión e inténtalo de nuevo.")}
          />
        )}

        {state.kind === "ready" && (
          <div
            className={`grid overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,.04),0_12px_40px_rgba(0,0,0,.10)] max-md:min-h-dvh max-md:rounded-none max-md:border-0 ${
              booked
                ? "grid-cols-1"
                : "min-h-[540px] grid-cols-1 md:grid-cols-[312px_1fr]"
            }`}
          >
            {booked ? (
              <Confirmation
                link={state.link}
                appointment={appointment}
                lang={lang}
                t={t}
                onReschedule={() => setRescheduleOf(appointment.id)}
                onCancel={cancel}
                cancelling={cancelling}
              />
            ) : (
              <Scheduler
                token={token}
                link={state.link}
                lang={lang}
                t={t}
                rescheduleOf={rescheduleOf}
                onBooked={(next) => {
                  setAppointment(next);
                  setRescheduleOf(null);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
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
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-[420px] rounded-[16px] border border-border bg-card p-[24px] text-center">
      <div className="mx-auto mb-[16px] flex h-[48px] w-[48px] items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h1 className="text-[18px] leading-tight font-semibold">{title}</h1>
      <p className="mt-[8px] text-[14px] text-muted-foreground">{body}</p>
    </div>
  );
}
