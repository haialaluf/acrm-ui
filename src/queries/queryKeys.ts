type NullableId = string | null | undefined;

export const queryKeys = {
  agents: {
    all: (orgId: NullableId) => [orgId, "agents"] as const,
    detail: (orgId: NullableId, id: NullableId) =>
      [orgId, "agents", id] as const,
    current: (orgId: NullableId) => [orgId, "agents", "current"] as const,
    invitations: () => ["invitations"] as const,
  },
  apiKeys: {
    all: (orgId: NullableId) => [orgId, "api_keys"] as const,
    detail: (orgId: NullableId, id: NullableId) =>
      [orgId, "api_keys", id] as const,
  },
  contacts: {
    all: (orgId: NullableId) => [orgId, "contacts"] as const,
    detail: (orgId: NullableId, id: NullableId) =>
      [orgId, "contacts", id] as const,
    byAddress: (orgId: NullableId, address: NullableId) =>
      [orgId, "contacts_addresses", address, "contact"] as const,
    addresses: (orgId: NullableId, contactId: NullableId) =>
      [orgId, "contacts", contactId, "addresses"] as const,
    addressDetail: (orgId: NullableId, address: NullableId) =>
      [orgId, "contacts_addresses", address] as const,
    messageActivity: (orgId: NullableId) =>
      [orgId, "contacts", "message_activity"] as const,
  },
  conversations: {
    /** Paginated sidebar list; every server-side filter is part of the key. */
    page: (orgId: NullableId, filter: string, search: string, tags: string[]) =>
      [orgId, "conversations", "page", filter, search, tags] as const,
    /** Conversation rows of a thread, resolved from its key on a deep link. */
    thread: (orgId: NullableId, threadKey: NullableId) =>
      [orgId, "conversations", "thread", threadKey] as const,
    /** Paginated history of one thread. */
    messages: (orgId: NullableId, threadKey: NullableId) =>
      [orgId, "conversations", "thread", threadKey, "messages"] as const,
  },
  organizations: {
    all: () => ["organizations"] as const,
    detail: (id: NullableId) => ["organizations", id] as const,
    addresses: (orgId: NullableId) =>
      [orgId, "organizations_addresses"] as const,
    addressDetail: (orgId: NullableId, address: NullableId) =>
      [orgId, "organizations_addresses", address] as const,
    messagingLimit: (orgId: NullableId, address: NullableId) =>
      [orgId, "organizations_addresses", address, "messaging_limit"] as const,
    spend: (orgId: NullableId, address: NullableId, days: number) =>
      [orgId, "organizations_addresses", address, "spend", days] as const,
  },
  apiLeads: {
    /** Recent leads posted to the public intake endpoint, newest first. */
    recent: (orgId: NullableId) => [orgId, "leads", "api"] as const,
  },
  emailTemplates: {
    /** List for the org — summaries only, without the project/html payloads. */
    all: (orgId: NullableId) => [orgId, "email_templates"] as const,
    /** One template with its builder project, for the editor. */
    detail: (orgId: NullableId, id: NullableId) =>
      [orgId, "email_templates", id] as const,
  },
  media: {
    /** Listing of the org's `media` bucket, optionally narrowed to one mime
     *  family (`"image/"` for the email builder's picker). */
    all: (orgId: NullableId, mimePrefix?: string) =>
      [orgId, "media", mimePrefix ?? "all"] as const,
  },
  webhooks: {
    all: (orgId: NullableId) => [orgId, "webhooks"] as const,
    detail: (orgId: NullableId, id: NullableId) =>
      [orgId, "webhooks", id] as const,
  },
  calendars: {
    all: (orgId: NullableId) => [orgId, "calendars"] as const,
    detail: (orgId: NullableId, id: NullableId) =>
      [orgId, "calendars", id] as const,
    /** Phones/CalDAV clients connected to one calendar. */
    devices: (orgId: NullableId, calendarId: NullableId) =>
      [orgId, "calendars", calendarId, "devices"] as const,
  },
  broadcasts: {
    /** One row per batch (list_broadcast_batches). */
    batches: (orgId: NullableId) => [orgId, "broadcasts", "batches"] as const,
    /** Recipient list of one batch (broadcast_batch_messages). */
    batchMessages: (
      orgId: NullableId,
      createdAt: NullableId,
      scheduledDate: NullableId,
    ) =>
      [
        orgId,
        "broadcasts",
        "batches",
        createdAt,
        scheduledDate,
        "messages",
      ] as const,
  },
  appointments: {
    all: (orgId: NullableId, calendarId: NullableId) =>
      [orgId, "appointments", calendarId] as const,
  },
  messageTemplates: {
    /** Every approved WhatsApp template in the org, from the local mirror —
     *  unlike useTemplates, which fetches one number's list live from Graph. */
    approved: (orgId: NullableId) =>
      [orgId, "message_templates", "approved"] as const,
  },
  automations: {
    all: (orgId: NullableId) => [orgId, "automations"] as const,
    detail: (orgId: NullableId, id: NullableId) =>
      [orgId, "automations", id] as const,
    /** Entered/completed per automation over 30d (automation_stats). */
    stats: (orgId: NullableId) => [orgId, "automations", "stats"] as const,
    /** Per-step counters for one automation's canvas (automation_step_stats). */
    stepStats: (orgId: NullableId, id: NullableId) =>
      [orgId, "automations", id, "step_stats"] as const,
  },
  onboardingTokens: {
    all: (orgId: NullableId, service: string) =>
      [orgId, "onboarding_tokens", service] as const,
  },
  whatsappHealth: {
    /** Poll + webhook snapshots for one number, newest first. */
    snapshots: (orgId: NullableId, address: NullableId) =>
      [orgId, "whatsapp_health", "snapshots", address] as const,
    /** Per-day sending behaviour for every number (whatsapp_daily_metrics). */
    metrics: (orgId: NullableId, days: number) =>
      [orgId, "whatsapp_health", "metrics", days] as const,
    /** The `message_templates` mirror, not the live Graph fetch in useTemplates. */
    templates: (orgId: NullableId, address: NullableId) =>
      [orgId, "whatsapp_health", "templates", address] as const,
    /** Meta health events from `logs`. */
    events: (orgId: NullableId, address: NullableId) =>
      [orgId, "whatsapp_health", "events", address] as const,
    /** Send counts per template (whatsapp_template_sends). */
    templateSends: (orgId: NullableId, days: number) =>
      [orgId, "whatsapp_health", "template_sends", days] as const,
  },
  emailHealth: {
    /** Poll + webhook snapshots for one sending domain, newest first. */
    snapshots: (orgId: NullableId, address: NullableId) =>
      [orgId, "email_health", "snapshots", address] as const,
    /** Per-day deliverability for every domain (email_daily_metrics). */
    metrics: (orgId: NullableId, days: number) =>
      [orgId, "email_health", "metrics", days] as const,
    /** Bounce/complaint/poll events from `logs`. */
    events: (orgId: NullableId, address: NullableId) =>
      [orgId, "email_health", "events", address] as const,
    /** Addresses this org may no longer email (contacts_addresses). */
    suppressed: (orgId: NullableId, limit: number) =>
      [orgId, "email_health", "suppressed", limit] as const,
  },
  billing: {
    products: () => ["billing", "products"] as const,
    usage: (orgId: NullableId, interval: string) =>
      [orgId, "billing", "usage", interval] as const,
    subscription: (orgId: NullableId) =>
      [orgId, "billing", "subscription"] as const,
    tierLimits: (orgId: NullableId) =>
      [orgId, "billing", "tier_limits"] as const,
    planProducts: (orgId: NullableId) =>
      [orgId, "billing", "plan_products"] as const,
  },
};
