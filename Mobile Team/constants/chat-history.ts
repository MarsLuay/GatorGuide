type ValueOf<T> = T[keyof T];

export const CHAT_HISTORY_SCHEMA_VERSION = "2026-03-29.v1" as const;

export const CHAT_HISTORY_ROOT_PATH = "chatHistory/{sessionId}" as const;

export const CHAT_HISTORY_RETENTION = {
  policy: "ttl_365d",
  sessionTtlDays: 365,
  messageTtlDays: 365,
  deleteOnAccountDeletion: true,
} as const;

export const CHAT_HISTORY_ASSISTANT_KEYS = {
  roadmap: "roadmap-assistant",
} as const;

export type ChatHistoryAssistantKey = ValueOf<typeof CHAT_HISTORY_ASSISTANT_KEYS>;

export const CHAT_HISTORY_ASSISTANT_SURFACES = {
  roadmap: "roadmap-chat",
} as const;

export type ChatHistoryAssistantSurface = ValueOf<typeof CHAT_HISTORY_ASSISTANT_SURFACES>;

export const CHAT_HISTORY_SESSION_STATUSES = {
  active: "active",
  archived: "archived",
} as const;

export type ChatHistorySessionStatus = ValueOf<typeof CHAT_HISTORY_SESSION_STATUSES>;

export const CHAT_HISTORY_MESSAGE_ROLES = {
  user: "user",
  assistant: "assistant",
  system: "system",
} as const;

export type ChatHistoryMessageRole = ValueOf<typeof CHAT_HISTORY_MESSAGE_ROLES>;

export const CHAT_HISTORY_MESSAGE_STATUSES = {
  committed: "committed",
  superseded: "superseded",
  deleted: "deleted",
} as const;

export type ChatHistoryMessageStatus = ValueOf<typeof CHAT_HISTORY_MESSAGE_STATUSES>;

export const CHAT_HISTORY_MESSAGE_SOURCES = {
  client: "client",
  live: "live",
  cached: "cached",
  cachedStale: "cached-stale",
  stub: "stub",
  imported: "imported",
} as const;

export type ChatHistoryMessageSource = ValueOf<typeof CHAT_HISTORY_MESSAGE_SOURCES>;

export const CHAT_HISTORY_OUTPUT_FORMATS = {
  text: "text",
  recommendationExplanationsJson: "recommendation_explanations_json",
} as const;

export type ChatHistoryOutputFormat = ValueOf<typeof CHAT_HISTORY_OUTPUT_FORMATS>;

export type ChatHistorySourceRef = {
  screen: string | null;
  route: string | null;
};

export type ChatHistoryRetentionDocument<TTimestamp = string> = {
  policy: typeof CHAT_HISTORY_RETENTION.policy;
  expiresAt: TTimestamp;
  deleteOnAccountDeletion: typeof CHAT_HISTORY_RETENTION.deleteOnAccountDeletion;
};

export type ChatHistorySessionDocument<TTimestamp = string> = {
  schemaVersion: typeof CHAT_HISTORY_SCHEMA_VERSION;
  sessionId: string;
  userId: string;
  assistantKey: string;
  assistantSurface: string;
  title: string | null;
  status: ChatHistorySessionStatus;
  source: ChatHistorySourceRef | null;
  contextSchemaVersion: string | null;
  lastOutputFormat: ChatHistoryOutputFormat | null;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  latestMessageAt: TTimestamp | null;
  latestMessageRole: ChatHistoryMessageRole | null;
  latestMessagePreview: string | null;
  createdAt: TTimestamp;
  updatedAt: TTimestamp;
  retention: ChatHistoryRetentionDocument<TTimestamp>;
};

export type ChatHistoryMessageModelMetadata = {
  provider: string | null;
  model: string | null;
  gateway: string | null;
  outputFormat: ChatHistoryOutputFormat | null;
  requestId: string | null;
  contextSchemaVersion: string | null;
};

export type ChatHistoryMessageDocument<TTimestamp = string> = {
  schemaVersion: typeof CHAT_HISTORY_SCHEMA_VERSION;
  sessionId: string;
  messageId: string;
  userId: string;
  role: ChatHistoryMessageRole;
  content: string;
  status: ChatHistoryMessageStatus;
  source: ChatHistoryMessageSource;
  sourceRef: ChatHistorySourceRef | null;
  createdAt: TTimestamp;
  clientCreatedAt: string | null;
  updatedAt: TTimestamp;
  retention: ChatHistoryRetentionDocument<TTimestamp>;
  modelMetadata: ChatHistoryMessageModelMetadata | null;
};
