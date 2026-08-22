// Design-system barrel for /design-sync.
//
// This app has no library build: its components are default exports spread
// across `src/components/`, so there is nothing for the converter to bundle
// on its own. This file is that entry — one named export per component that
// renders from props alone (no router, react-query, Supabase or app-context
// dependency). Components bound to app data live in the app, not here.

// ── general ──────────────────────────────────────────────────────────────
export { default as Avatar } from "@/components/Avatar";
export { default as Button } from "@/components/Button";
export { default as ConfirmModal } from "@/components/ConfirmModal";
export { default as CopyButton } from "@/components/CopyButton";
export { default as CountryField } from "@/components/CountryField";
export { default as DisabledSection } from "@/components/DisabledSection";
export { default as EmailSuggestion } from "@/components/EmailSuggestion";
export { default as FaqSection } from "@/components/FaqSection";
export { default as FieldError } from "@/components/FieldError";
export { default as PersonaSection } from "@/components/PersonaSection";
export { default as SearchBar } from "@/components/SearchBar";
export { default as SectionBody } from "@/components/SectionBody";
export { default as SectionField } from "@/components/SectionField";
export { default as SectionFooter } from "@/components/SectionFooter";
export { default as SectionItem } from "@/components/SectionItem";
export { default as SelectField } from "@/components/SelectField";
export { default as Spinner } from "@/components/Spinner";
export { default as StatTile } from "@/components/StatTile";
export { default as StatusBadge } from "@/components/StatusBadge";
export { default as Switch } from "@/components/Switch";
export { default as SwitchField } from "@/components/SwitchField";
export { default as TemplateButtonsField } from "@/components/TemplateButtonsField";
export { default as TextAreaField } from "@/components/TextAreaField";
export { default as WorkingHoursField } from "@/components/WorkingHoursField";

// ── message ──────────────────────────────────────────────────────────────
export { default as BookingLinkPreview } from "@/components/Message/BookingLinkPreview";
export { default as MessageActions } from "@/components/Message/MessageActions";
export { default as ReactionPicker } from "@/components/Message/ReactionPicker";

// ── automations ──────────────────────────────────────────────────────────
export { default as SplitEditor } from "@/components/automations/SplitEditor";
export { Field, Segmented, CheckList, Divider, Callout } from "@/components/automations/Fields";

// ── broadcasts ───────────────────────────────────────────────────────────
export { default as BroadcastCard } from "@/components/broadcasts/BroadcastCard";

// ── bulk send ────────────────────────────────────────────────────────────
export { default as ActionRow } from "@/components/bulkSend/ActionRow";
export { default as Checkbox } from "@/components/bulkSend/Checkbox";
export { default as ContactRow } from "@/components/bulkSend/ContactRow";
export { default as DoneStep } from "@/components/bulkSend/DoneStep";
export { default as EmailVariablesStep } from "@/components/bulkSend/EmailVariablesStep";
export { default as LinkBtn } from "@/components/bulkSend/LinkBtn";
export { default as NavBtn } from "@/components/bulkSend/NavBtn";
export { default as PillSearch } from "@/components/bulkSend/PillSearch";
export { default as QuotaMeter } from "@/components/bulkSend/QuotaMeter";
export { default as Radio } from "@/components/bulkSend/Radio";
export { default as ScheduleEditor } from "@/components/bulkSend/ScheduleEditor";
export { default as SendingStep } from "@/components/bulkSend/SendingStep";
export { default as TemplateStep } from "@/components/bulkSend/TemplateStep";
export { default as WizardHeader } from "@/components/bulkSend/WizardHeader";

// ── calendar ─────────────────────────────────────────────────────────────
export { default as MeetingModal } from "@/components/calendar/MeetingModal";

// ── email template ───────────────────────────────────────────────────────
export { default as SetupTab } from "@/components/emailTemplate/SetupTab";
export { default as StarterGallery } from "@/components/emailTemplate/StarterGallery";
export { default as VariablesTab } from "@/components/emailTemplate/VariablesTab";

// ── message preview ──────────────────────────────────────────────────────
export { default as BubbleButtons } from "@/components/messagePreview/BubbleButtons";
export { default as LiveMessagePreview } from "@/components/messagePreview/LiveMessagePreview";
export { default as MediaHeader } from "@/components/messagePreview/MediaHeader";
export { default as ReadMoreText } from "@/components/messagePreview/ReadMoreText";
export { default as WhatsAppBubble } from "@/components/messagePreview/WhatsAppBubble";
export { default as WhatsAppChatSurface } from "@/components/messagePreview/WhatsAppChatSurface";
export { default as WhatsAppPhoneFrame } from "@/components/messagePreview/WhatsAppPhoneFrame";
export { default as WhatsAppPreview } from "@/components/messagePreview/WhatsAppPreview";

// ── stats ────────────────────────────────────────────────────────────────
export { default as QuotaBar } from "@/components/stats/QuotaBar";
export { default as StatsPanel } from "@/components/stats/StatsPanel";
export { default as UsageChart } from "@/components/stats/UsageChart";

// ── health ───────────────────────────────────────────────────────────────
export { default as AccountFacts } from "@/components/stats/health/AccountFacts";
export { default as ColdChart } from "@/components/stats/health/ColdChart";
export { default as ErrorBreakdown } from "@/components/stats/health/ErrorBreakdown";
export { default as EventsTimeline } from "@/components/stats/health/EventsTimeline";
export { default as HealthHero } from "@/components/stats/health/HealthHero";
export { default as HealthIssues } from "@/components/stats/health/HealthIssues";
export { default as RateTiles } from "@/components/stats/health/RateTiles";
export { default as TemplatesTable } from "@/components/stats/health/TemplatesTable";
export { default as VolumeChart } from "@/components/stats/health/VolumeChart";
export { Card, CardHead, Chip, FilterPill, Delta, Ltr } from "@/components/stats/health/primitives";

// ── email health ─────────────────────────────────────────────────────────
export { default as EmailAccountFacts } from "@/components/stats/health/email/EmailAccountFacts";
export { default as EmailHero } from "@/components/stats/health/email/EmailHero";
export { default as EmailRateTiles } from "@/components/stats/health/email/EmailRateTiles";
export { default as EmailVolumeChart } from "@/components/stats/health/email/EmailVolumeChart";

// ── template editor ──────────────────────────────────────────────────────
export { default as EmojiPickerPopover } from "@/components/templateEditor/EmojiPickerPopover";
export { default as FormatToolbar } from "@/components/templateEditor/FormatToolbar";
export { default as VariableMapper } from "@/components/templateEditor/VariableMapper";

// ── template fill ────────────────────────────────────────────────────────
export { default as EmailVarsEditor } from "@/components/templateFill/EmailVarsEditor";
export { default as SegmentBtn } from "@/components/templateFill/SegmentBtn";
export { default as TemplateVarsEditor } from "@/components/templateFill/TemplateVarsEditor";
export { default as VarCard } from "@/components/templateFill/VarCard";

// ── templates ────────────────────────────────────────────────────────────
export { default as TemplatesList, ChannelToggle, EmailTemplatesList } from "@/components/templates/TemplatesList";
