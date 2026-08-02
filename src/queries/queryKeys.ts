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
  onboardingTokens: {
    all: (orgId: NullableId, service: string) =>
      [orgId, "onboarding_tokens", service] as const,
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
