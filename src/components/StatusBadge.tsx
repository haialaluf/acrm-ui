/**
 * Small tone-based status pill. Generalizes the inline
 * `bg-destructive/20 text-destructive` convention already used in
 * TemplatesList for a single tone, to the multi-tone set the broadcasts page
 * needs (scheduled/sending/sent/cancelled).
 */
const TONE_CLASSES: Record<
  "primary" | "warning" | "success" | "neutral" | "destructive",
  string
> = {
  primary: "bg-primary/20 text-primary",
  warning: "bg-warning/20 text-warning",
  success: "bg-success/20 text-success",
  neutral: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/20 text-destructive",
};

export default function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: keyof typeof TONE_CLASSES;
}) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full capitalize ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}
