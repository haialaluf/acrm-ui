import { useEffect, useState } from "react";
import { CalendarDays, LinkIcon } from "lucide-react";
import Spinner from "@/components/Spinner";
import { getLink, type BookingLinkContext } from "./api";
import { makeT, type Language } from "./i18n";

/**
 * The public booking page.
 *
 * This phase deliberately stops at resolving the token: it proves DNS, TLS,
 * the Pages deploy, the SPA fallback, CORS to the edge function and the
 * `GET /:token` contract, without committing to a slot-picker design. The next
 * phase replaces the placeholder body — `api.ts` already covers every route it
 * will need, so no backend work should be required.
 */

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "error" }
  | { kind: "ready"; link: BookingLinkContext };

export default function App({ lang }: { lang: Language }) {
  const t = makeT(lang);
  const [state, setState] = useState<State>({ kind: "loading" });

  // The token IS the route: no router, just the first path segment.
  const token = window.location.pathname.split("/").filter(Boolean)[0] ?? "";

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setState({ kind: "invalid" });
      return;
    }

    getLink(token)
      .then((link) => {
        if (cancelled) return;
        setState(link.valid ? { kind: "ready", link } : { kind: "invalid" });
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

  return (
    <div className="min-h-dvh bg-background text-foreground flex items-center justify-center p-[16px]">
      <div className="w-full max-w-[420px]">
        {state.kind === "loading" && (
          <div className="flex justify-center py-[64px] text-muted-foreground">
            <Spinner size={28} />
          </div>
        )}

        {state.kind === "invalid" && (
          <Card
            icon={<LinkIcon className="w-[22px] h-[22px]" />}
            title={t("Este enlace ya no es válido")}
            body={t(
              "Puede haber caducado o haber sido reemplazado. Pide uno nuevo por WhatsApp y podrás reservar en un momento.",
            )}
          />
        )}

        {state.kind === "error" && (
          <Card
            icon={<LinkIcon className="w-[22px] h-[22px]" />}
            title={t("No pudimos cargar tu reserva")}
            body={t("Revisa tu conexión e inténtalo de nuevo.")}
          />
        )}

        {state.kind === "ready" && <Ready link={state.link} t={t} />}
      </div>
    </div>
  );
}

function Ready({
  link,
  t,
}: {
  link: BookingLinkContext;
  t: (key: string) => string;
}) {
  return (
    <div className="rounded-[16px] border border-border bg-card p-[24px] text-center">
      <div className="mx-auto mb-[16px] flex h-[48px] w-[48px] items-center justify-center rounded-full bg-secondary text-primary">
        <CalendarDays className="h-[24px] w-[24px]" />
      </div>

      {link.contact_first_name && (
        <div className="mb-[4px] text-[14px] text-muted-foreground">
          {t("Hola")} {link.contact_first_name}
        </div>
      )}

      <h1 className="text-[20px] font-semibold leading-tight">
        {link.organization_name}
      </h1>
      <div className="mt-[4px] text-[14px] text-muted-foreground">
        {link.calendar_name} · {link.duration_minutes} {t("minutos")}
      </div>

      <div className="mt-[20px] rounded-[12px] border border-dashed border-input p-[16px] text-[14px] text-muted-foreground">
        {t("Aquí podrás elegir tu horario en unos días.")}
      </div>
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
    <div className="rounded-[16px] border border-border bg-card p-[24px] text-center">
      <div className="mx-auto mb-[16px] flex h-[48px] w-[48px] items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h1 className="text-[18px] font-semibold leading-tight">{title}</h1>
      <p className="mt-[8px] text-[14px] text-muted-foreground">{body}</p>
    </div>
  );
}
