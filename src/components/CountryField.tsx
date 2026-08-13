import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import SelectField from "@/components/SelectField";
import { useTranslation } from "@/hooks/useTranslation";
import {
  COUNTRY_CODES,
  detectRegion,
  detectTimezone,
  regionLabel,
} from "@/utils/calendar";

export type DetectedRegion = { region: string; timezone: string };

/**
 * What the browser says it is, resolved once per mount.
 *
 * Callers need it for more than this field: `resolveTimezone` prefers the
 * browser's exact IANA zone over a country's primary one when the two agree, so
 * the detected pair has to be the same pair the picker was drawn from.
 */
export function useDetectedRegion(): DetectedRegion {
  return useMemo(
    () => ({ region: detectRegion(), timezone: detectTimezone() }),
    [],
  );
}

/**
 * The country picker, shared by the calendar editor and the organization's
 * business profile — the two places that keep working hours and therefore both
 * need to say which clock those hours are on.
 *
 * `touched` lives in here rather than in either form: it exists only to retire
 * the "detected" badge once the user has made the value their own, which is a
 * property of this control and nothing the form around it should have to track.
 */
export default function CountryField({
  value,
  onChange,
  detected,
  saved,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  detected: DetectedRegion;
  // Whether `value` came from storage rather than from detection. The badge is
  // a claim about where the value came from, so it must go the moment the value
  // is a saved choice — `isEdit` for a calendar, "already has a region" for an
  // organization.
  saved?: boolean;
  disabled?: boolean;
}) {
  const { translate: t, currentLanguage } = useTranslation();
  const [touched, setTouched] = useState(false);

  // Countries sorted by localized label, detected one pinned to the top.
  const countries = useMemo(() => {
    const list = COUNTRY_CODES.map((code) => ({
      value: code,
      label: regionLabel(code, currentLanguage),
    }));
    list.sort((a, b) => a.label.localeCompare(b.label, currentLanguage));
    const detectedIdx = list.findIndex((c) => c.value === detected.region);
    if (detectedIdx > 0) {
      const [pinned] = list.splice(detectedIdx, 1);
      list.unshift(pinned);
    }
    return list;
  }, [currentLanguage, detected.region]);

  const showDetected = !saved && !touched && value === detected.region;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-[8px]">
        <div className="label mb-0">{t("Country")}</div>
        {showDetected && (
          <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 rounded-full px-[7px] py-[1px]">
            <CheckCircle2 className="w-[10px] h-[10px]" />
            {t("Detected from browser")}
          </span>
        )}
      </div>
      <SelectField
        label={""}
        value={value}
        onChange={(next) => {
          onChange(next);
          setTouched(true);
        }}
        options={countries}
        disabled={disabled}
      />
      <p className="text-[12px] text-muted-foreground mt-2">
        {t("The time zone and working hours adjust to the selected country.")}
      </p>
    </div>
  );
}
