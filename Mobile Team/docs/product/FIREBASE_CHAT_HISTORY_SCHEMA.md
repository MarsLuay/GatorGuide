# Firebase Chat History Schema

This document locks the Firestore contract for persisted assistant chat history without committing the app to a final read/write implementation yet.

Read/write helpers are intentionally deferred until the shared chat assistant architecture is finalized. For now, this schema exists so future persistence work has a single source of truth for document shape, ownership, and retention behavior.

## Canonical Firestore Path

- Session documents live at `chatHistory/{sessionId}`.
- Message documents live at `chatHistory/{sessionId}/messages/{messageId}`.
- Both session and message documents carry `userId` so ownership stays explicit even when querying outside the parent path.

## Current Assistant Scope

- The only shipped assistant surface today is roadmap chat.
- Use `assistantKey: "roadmap-assistant"` and `assistantSurface: "roadmap-chat"` for the current roadmap assistant flow.
- Future assistants can add new `assistantKey` and `assistantSurface` values after the broader assistant architecture is finalized.

## Session Document

Required shape:

```ts
type ChatHistorySessionDocument = {
  schemaVersion: "2026-03-29.v1";
  sessionId: string;
  userId: string;
  assistantKey: string;
  assistantSurface: string;
  title: string | null;
  status: "active" | "archived";
  source: {
    screen: string | null;
    route: string | null;
  } | null;
  contextSchemaVersion: string | null;
  lastOutputFormat: "text" | "recommendation_explanations_json" | null;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  latestMessageAt: Timestamp | null;
  latestMessageRole: "user" | "assistant" | "system" | null;
  latestMessagePreview: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  retention: {
    policy: "ttl_365d";
    expiresAt: Timestamp;
    deleteOnAccountDeletion: true;
  };
};
```

Notes:

- `source.screen` and `source.route` should match the UI surface that opened the session when available.
- `contextSchemaVersion` should capture the AI context schema version used to produce assistant responses.
- `latestMessagePreview` should stay trimmed and safe for list rendering.

## Message Document

Required shape:

```ts
type ChatHistoryMessageDocument = {
  schemaVersion: "2026-03-29.v1";
  sessionId: string;
  messageId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "committed" | "superseded" | "deleted";
  source: "client" | "live" | "cached" | "cached-stale" | "stub" | "imported";
  sourceRef: {
    screen: string | null;
    route: string | null;
  } | null;
  createdAt: Timestamp;
  clientCreatedAt: string | null;
  updatedAt: Timestamp;
  retention: {
    policy: "ttl_365d";
    expiresAt: Timestamp;
    deleteOnAccountDeletion: true;
  };
  modelMetadata: {
    provider: string | null;
    model: string | null;
    gateway: string | null;
    outputFormat: "text" | "recommendation_explanations_json" | null;
    requestId: string | null;
    contextSchemaVersion: string | null;
  } | null;
};
```

Notes:

- User-authored messages should use `source: "client"` and `modelMetadata: null`.
- Assistant messages should capture live/cache/stub provenance through `source`.
- `modelMetadata` is optional for non-generated messages but required as a field so the document shape stays stable.

## Ownership And Security

- Sessions and messages are owner-only.
- `userId` must equal `request.auth.uid` on both session and message writes.
- `sessionId` must match the parent session document ID.
- `messageId` must match the message document ID.

The Firestore rules and rules tests now enforce this contract.

## Retention Strategy

- Default policy: `ttl_365d`.
- Every session document stores `retention.expiresAt`.
- Every message document also stores its own `retention.expiresAt`.

Why both levels:

- Firestore TTL does not cascade into subcollections.
- Storing `expiresAt` on both session and message docs makes future TTL cleanup possible for each level independently.

Delete behavior:

- Chat history is deleted immediately during account deletion cleanup.
- TTL is the backstop for stale sessions that remain in Firestore during normal account lifetime.

## Deferred Work

These items stay intentionally out of scope until assistant architecture is finalized:

- Client read/write helper service
- Offline queueing and reconciliation for chat history writes
- Cross-surface chat session reuse rules
- Multi-assistant routing and shared thread UX
- Session summarization or archival jobs
