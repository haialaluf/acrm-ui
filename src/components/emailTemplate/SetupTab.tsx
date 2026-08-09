import { Check, Lock, Link as LinkIcon } from "lucide-react";
import { ConfigProvider, Segmented } from "antd";
import { useTranslation } from "@/hooks/useTranslation";
import type {
  EmailOrganizationAddressExtra,
  EmailTemplateExtra,
} from "@/supabase/client";

const segmentedTheme = {
  components: {
    Segmented: {
      trackBg: "var(--muted)",
      itemColor: "var(--muted-foreground)",
      itemHoverColor: "var(--foreground)",
      itemSelectedBg: "var(--background)",
      itemSelectedColor: "var(--primary)",
    },
  },
};

/** Roughly where most inboxes truncate a subject line. Not a hard limit — the
 *  counter turns amber rather than blocking, because a long subject is a
 *  judgement call, not an error. */
const SUBJECT_BUDGET = 60;

/** A `{{n}}` costs the recipient roughly a name's worth of characters, not the
 *  five the token occupies, so measure the token as filled text. */
function visibleLength(text: string): number {
  return text.replace(/\{\{\s*\d+\s*\}\}/g, "xxxxxxxx").length;
}

const FONTS = ["Helvetica", "Georgia", "Verdana", "Tahoma", "Arial"];

export default function SetupTab({
  subject,
  onSubject,
  preheader,
  onPreheader,
  extra,
  onExtra,
  dir,
  domain,
  domainExtra,
}: {
  subject: string;
  onSubject: (value: string) => void;
  preheader: string;
  onPreheader: (value: string) => void;
  extra: EmailTemplateExtra;
  onExtra: (patch: Partial<EmailTemplateExtra>) => void;
  /** The direction actually in force, resolved by the builder — which falls
   *  back to the UI language, not to `ltr`. Passed in rather than re-derived
   *  here: while this control derived its own default, an untouched template in
   *  a Hebrew workspace composed right-to-left while this said left-to-right. */
  dir: "ltr" | "rtl";
  domain?: string;
  domainExtra: EmailOrganizationAddressExtra | null;
}) {
  const { translate: t } = useTranslation();
  const subjectLength = visibleLength(subject);

  return (
    <div className="flex flex-col gap-[22px]">
      <Section title={t("Inbox line")}>
        <Field
          label={t("Subject")}
          aside={
            <span
              className={
                subjectLength > SUBJECT_BUDGET
                  ? "text-warning-strong"
                  : "text-muted-foreground"
              }
            >
              {subjectLength}/{SUBJECT_BUDGET}
            </span>
          }
        >
          <textarea
            className="w-full rounded-[9px] border border-border bg-popover text-foreground text-[14px] leading-[1.5] p-[9px_10px] outline-none focus:border-primary resize-y"
            rows={2}
            dir="auto"
            value={subject}
            onChange={(e) => onSubject(e.target.value)}
          />
        </Field>

        <Field label={t("Preheader")}>
          <textarea
            className="w-full rounded-[9px] border border-border bg-popover text-foreground text-[14px] leading-[1.5] p-[9px_10px] outline-none focus:border-primary resize-y"
            rows={2}
            dir="auto"
            value={preheader}
            onChange={(e) => onPreheader(e.target.value)}
          />
          <Hint>
            {t(
              "The grey line after the subject in most inboxes. Left empty, clients pull the first words of the email.",
            )}
          </Hint>
        </Field>
      </Section>

      <Section title={t("Sender")}>
        <div className="grid grid-cols-2 gap-[12px]">
          <Field label={t("From name")}>
            <input
              className="w-full rounded-[9px] border border-border bg-popover text-foreground text-[14px] p-[8px_10px] outline-none focus:border-primary"
              value={extra.from_name ?? ""}
              placeholder={domainExtra?.default_from_name ?? ""}
              onChange={(e) => onExtra({ from_name: e.target.value })}
            />
          </Field>
          <Field label={t("Reply-to")}>
            <input
              className="w-full rounded-[9px] border border-border bg-popover text-foreground text-[14px] p-[8px_10px] outline-none focus:border-primary"
              dir="ltr"
              value={extra.reply_to ?? ""}
              placeholder={domainExtra?.default_from_address ?? ""}
              onChange={(e) => onExtra({ reply_to: e.target.value })}
            />
          </Field>
        </div>

        {domain && (
          <div className="flex gap-[9px] items-start rounded-[10px] bg-success/10 p-[10px_12px] text-[12.5px] leading-[1.5] text-success-strong">
            <Check size={14} className="mt-[2px] shrink-0" />
            <div>
              <b dir="ltr">{domain}</b> {t("verified in Amazon SES")}
              <div className="text-muted-foreground text-[11.5px] mt-[3px]">
                {t("Sending from a verified domain, not a single address.")}
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title={t("Language & direction")}>
        <ConfigProvider theme={segmentedTheme}>
          <Segmented<"ltr" | "rtl">
            block
            value={dir}
            onChange={(next) => onExtra({ dir: next })}
            options={[
              { value: "ltr", label: t("Left to right") },
              { value: "rtl", label: t("Right to left") },
            ]}
          />
        </ConfigProvider>
        <Hint>
          {t(
            "Sets the direction of the email body — independent of the language you use the app in.",
          )}
        </Hint>
      </Section>

      <Section title={t("Body")}>
        <div className="grid grid-cols-2 gap-[12px]">
          <Field label={t("Width")}>
            <input
              className="w-full rounded-[9px] border border-border bg-popover text-foreground text-[14px] p-[8px_10px] outline-none focus:border-primary"
              dir="ltr"
              value={extra.width ?? 600}
              onChange={(e) =>
                onExtra({ width: parseInt(e.target.value, 10) || 600 })
              }
            />
          </Field>
          <Field label={t("Font")}>
            <select
              className="w-full rounded-[9px] border border-border bg-popover text-foreground text-[14px] p-[8px_10px] outline-none focus:border-primary"
              value={extra.font ?? "Helvetica"}
              onChange={(e) => onExtra({ font: e.target.value })}
            >
              {FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-[12px]">
          <ColorField
            label={t("Page")}
            value={extra.pageBg ?? "#eceee9"}
            onChange={(pageBg) => onExtra({ pageBg })}
          />
          <ColorField
            label={t("Content")}
            value={extra.bodyBg ?? "#ffffff"}
            onChange={(bodyBg) => onExtra({ bodyBg })}
          />
        </div>
      </Section>

      <Section title={t("Compliance")}>
        <div className="flex flex-col gap-[12px]">
          <ComplianceRow
            icon={<Lock size={14} />}
            title={t("Every email ends with the same footer")}
            body={t(
              "Your business name, address and an unsubscribe link are added at send time. It is not part of the design and cannot be edited — check Preview to see it.",
            )}
          />
          <ComplianceRow
            icon={<LinkIcon size={14} />}
            title={t("One-click unsubscribe")}
            body={t(
              "List-Unsubscribe headers are added at send time — nothing to place in the design.",
            )}
          />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-[10px]">
      <div className="text-[11px] tracking-[0.06em] uppercase text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex justify-between items-baseline text-[12px] text-muted-foreground mb-[6px]">
        <span>{label}</span>
        {aside}
      </div>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11.5px] text-muted-foreground leading-[1.55] mt-[6px]">
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-[8px] rounded-[9px] border border-border bg-popover p-[5px_9px]">
        <input
          type="color"
          className="w-[24px] h-[24px] border-none p-0 bg-transparent cursor-pointer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="font-mono text-[12px] text-muted-foreground" dir="ltr">
          {value}
        </span>
      </div>
    </Field>
  );
}

function ComplianceRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-[9px] items-start text-[12.5px] leading-[1.5]">
      <span className="mt-[2px] shrink-0 text-muted-foreground">{icon}</span>
      <div>
        <b className="block font-semibold mb-[2px]">{title}</b>
        <span className="text-muted-foreground">{body}</span>
      </div>
    </div>
  );
}
