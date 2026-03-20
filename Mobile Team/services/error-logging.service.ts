import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { API_CONFIG } from "./config";
import { db, firebaseAuth } from "./firebase";

const LOG_QUEUE_KEY = "gatorguide:error-logs:queue:v1";
const LOG_SCHEMA_VERSION = 1;
const DEDUPE_WINDOW_MS = 30_000;
const REDACTED_VALUE = "[redacted]";
const TRUNCATED_VALUE = "[truncated]";

type ErrorLogSeverity = "error" | "warn" | "info";
type ErrorLogCategory =
  | "app"
  | "auth"
  | "upload"
  | "ai"
  | "firestore"
  | "api"
  | "notifications"
  | "storage"
  | "sync";

type ErrorLogAuthState = "signed_in" | "signed_out";
type ErrorLogDestination = "firestore" | "webhook" | "queue" | "dropped";
type TransportPreference = "firestore-first" | "webhook-first";

export type ErrorLogContext = {
  category: ErrorLogCategory;
  operation: string;
  severity?: ErrorLogSeverity;
  handled?: boolean;
  source?: string;
  screen?: string;
  route?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export type ErrorLogResult = {
  status: "sent" | "queued" | "dropped";
  destination: ErrorLogDestination;
  entryId: string;
};

type ErrorLogEntry = {
  id: string;
  schemaVersion: number;
  timestamp: string;
  severity: ErrorLogSeverity;
  category: ErrorLogCategory;
  operation: string;
  handled: boolean;
  source: string;
  screen: string | null;
  route: string | null;
  tags: string[];
  message: string;
  errorName: string | null;
  errorCode: string | null;
  stack: string | null;
  details: unknown;
  metadata: Record<string, unknown>;
  authState: ErrorLogAuthState;
  userId: string | null;
  platform: string;
  appVersion: string | null;
  buildVersion: string | null;
  appOwnership: string | null;
};

type CaptureOptions = {
  transportPreference?: TransportPreference;
  allowQueue?: boolean;
  bypassDedup?: boolean;
};

type NormalizedError = {
  name: string | null;
  message: string;
  code: string | null;
  stack: string | null;
  details: unknown;
};

function makeEntryId() {
  return `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function trimText(value: unknown, maxLength = 1200) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)} ${TRUNCATED_VALUE}`;
}

function looksSensitiveKey(key: string) {
  return /password|token|secret|authorization|cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|filebase64/i.test(
    key
  );
}

function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 4) return "[depth-limit]";
  if (typeof value === "string") return trimText(value, 1000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeForLog(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 30)
        .map(([key, nestedValue]) => [
          key,
          looksSensitiveKey(key) ? REDACTED_VALUE : sanitizeForLog(nestedValue, depth + 1),
        ])
        .filter(([, nestedValue]) => nestedValue !== undefined)
    );
  }
  return trimText(value, 500);
}

function inferRoute() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return trimText(window.location.pathname, 180) || null;
}

class ErrorLoggingService {
  private flushPromise: Promise<number> | null = null;
  private recentFingerprints = new Map<string, number>();

  private getAppVersion() {
    return trimText(Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? "", 80) || null;
  }

  private getBuildVersion() {
    return trimText(Constants.nativeBuildVersion ?? "", 80) || null;
  }

  private getAppOwnership() {
    return trimText(Constants.appOwnership ?? "", 40) || null;
  }

  private normalizeError(error: unknown): NormalizedError {
    if (error instanceof Error) {
      return {
        name: trimText(error.name, 120) || "Error",
        message: trimText(error.message, 1200) || "Unexpected error",
        code: trimText((error as Error & { code?: unknown }).code, 120) || null,
        stack: trimText(error.stack, 6000) || null,
        details: sanitizeForLog((error as Error & { details?: unknown }).details ?? null),
      };
    }

    if (typeof error === "string") {
      return {
        name: "Error",
        message: trimText(error, 1200) || "Unexpected error",
        code: null,
        stack: null,
        details: null,
      };
    }

    const record = (error ?? {}) as Record<string, unknown>;
    return {
      name: trimText(record.name, 120) || "Error",
      message: trimText(record.message, 1200) || "Unexpected error",
      code: trimText(record.code, 120) || null,
      stack: trimText(record.stack, 6000) || null,
      details: sanitizeForLog(record.details ?? record.cause ?? null),
    };
  }

  private buildFingerprint(entry: ErrorLogEntry) {
    return [
      entry.category,
      entry.operation,
      entry.message,
      entry.errorCode ?? "",
      entry.route ?? "",
      entry.screen ?? "",
    ].join("|");
  }

  private shouldDropDuplicate(entry: ErrorLogEntry, bypassDedup = false) {
    if (bypassDedup) return false;

    const fingerprint = this.buildFingerprint(entry);
    const now = Date.now();
    const lastSeen = this.recentFingerprints.get(fingerprint) ?? 0;
    this.recentFingerprints.set(fingerprint, now);

    for (const [key, seenAt] of this.recentFingerprints.entries()) {
      if (now - seenAt > DEDUPE_WINDOW_MS) {
        this.recentFingerprints.delete(key);
      }
    }

    return now - lastSeen < DEDUPE_WINDOW_MS;
  }

  private buildEntry(error: unknown, context: ErrorLogContext): ErrorLogEntry {
    const normalized = this.normalizeError(error);
    const currentUser = firebaseAuth?.currentUser;
    const source = trimText(context.source, 120) || "app";
    const tags = Array.from(
      new Set((context.tags ?? []).map((tag) => trimText(tag, 80)).filter(Boolean))
    );

    return {
      id: makeEntryId(),
      schemaVersion: LOG_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      severity: context.severity ?? "error",
      category: context.category,
      operation: trimText(context.operation, 160) || "unknown-operation",
      handled: context.handled ?? true,
      source,
      screen: trimText(context.screen, 160) || null,
      route: trimText(context.route, 180) || inferRoute(),
      tags,
      message: normalized.message,
      errorName: normalized.name,
      errorCode: normalized.code,
      stack: normalized.stack,
      details: normalized.details,
      metadata: sanitizeForLog(context.metadata ?? {}) as Record<string, unknown>,
      authState: currentUser?.uid ? "signed_in" : "signed_out",
      userId: currentUser?.uid ?? null,
      platform: Platform.OS,
      appVersion: this.getAppVersion(),
      buildVersion: this.getBuildVersion(),
      appOwnership: this.getAppOwnership(),
    };
  }

  private writeConsole(entry: ErrorLogEntry) {
    const prefix = `[error-log:${entry.category}:${entry.operation}]`;
    const output = {
      id: entry.id,
      message: entry.message,
      code: entry.errorCode,
      source: entry.source,
      screen: entry.screen,
      route: entry.route,
      handled: entry.handled,
      metadata: entry.metadata,
    };

    if (entry.severity === "warn") {
      console.warn(prefix, output);
      return;
    }

    if (entry.severity === "info") {
      console.log(prefix, output);
      return;
    }

    console.error(prefix, output);
  }

  private async readQueue() {
    try {
      const raw = await AsyncStorage.getItem(LOG_QUEUE_KEY);
      if (!raw) return [] as ErrorLogEntry[];
      const parsed = JSON.parse(raw) as ErrorLogEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeQueue(queue: ErrorLogEntry[]) {
    if (queue.length === 0) {
      await AsyncStorage.removeItem(LOG_QUEUE_KEY);
      return;
    }
    await AsyncStorage.setItem(
      LOG_QUEUE_KEY,
      JSON.stringify(queue.slice(-API_CONFIG.logging.maxQueuedErrorLogs))
    );
  }

  private async queueEntry(entry: ErrorLogEntry): Promise<ErrorLogResult> {
    try {
      const queue = await this.readQueue();
      queue.push(entry);
      await this.writeQueue(queue);
      return {
        status: "queued",
        destination: "queue",
        entryId: entry.id,
      };
    } catch {
      return {
        status: "dropped",
        destination: "dropped",
        entryId: entry.id,
      };
    }
  }

  private async sendToFirestore(entry: ErrorLogEntry) {
    const currentUser = firebaseAuth?.currentUser;
    if (!db || !currentUser?.uid) return false;

    await addDoc(collection(db, "supportErrorLogs"), {
      ...entry,
      userId: currentUser.uid,
      createdAt: serverTimestamp(),
      loggerSource: "app-logger",
    });
    return true;
  }

  private async sendToWebhook(entry: ErrorLogEntry) {
    const webhookUrl = API_CONFIG.logging.errorWebhookUrl;
    if (!webhookUrl) return false;

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timestamp: entry.timestamp,
        platform: entry.platform,
        message: entry.message,
        stack: entry.stack ?? "No stack available",
        app: "GatorGuide",
        userId: entry.userId,
        severity: entry.severity,
        category: entry.category,
        operation: entry.operation,
        handled: entry.handled,
        source: entry.source,
        screen: entry.screen,
        route: entry.route,
        errorName: entry.errorName,
        errorCode: entry.errorCode,
        authState: entry.authState,
        appVersion: entry.appVersion,
        buildVersion: entry.buildVersion,
        appOwnership: entry.appOwnership,
        tags: entry.tags,
        details: entry.details,
        metadata: entry.metadata,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`Support log webhook failed: ${response.status} ${details}`.trim());
    }

    return true;
  }

  private async dispatchEntry(
    entry: ErrorLogEntry,
    transportPreference: TransportPreference
  ): Promise<ErrorLogResult | null> {
    const attempts =
      transportPreference === "webhook-first"
        ? [
            { destination: "webhook" as const, fn: () => this.sendToWebhook(entry) },
            { destination: "firestore" as const, fn: () => this.sendToFirestore(entry) },
          ]
        : [
            { destination: "firestore" as const, fn: () => this.sendToFirestore(entry) },
            { destination: "webhook" as const, fn: () => this.sendToWebhook(entry) },
          ];

    for (const attempt of attempts) {
      try {
        const sent = await attempt.fn();
        if (sent) {
          return {
            status: "sent",
            destination: attempt.destination,
            entryId: entry.id,
          };
        }
      } catch (transportError) {
        this.writeConsole(
          this.buildEntry(transportError, {
            category: "app",
            operation: "error-log-transport",
            severity: "warn",
            handled: true,
            source: "error-logging.service",
            metadata: {
              destination: attempt.destination,
              originalEntryId: entry.id,
              originalCategory: entry.category,
              originalOperation: entry.operation,
            },
          })
        );
      }
    }

    return null;
  }

  async captureException(
    error: unknown,
    context: ErrorLogContext,
    options: CaptureOptions = {}
  ): Promise<ErrorLogResult> {
    try {
      const entry = this.buildEntry(error, context);
      this.writeConsole(entry);

      if (this.shouldDropDuplicate(entry, options.bypassDedup)) {
        return {
          status: "dropped",
          destination: "dropped",
          entryId: entry.id,
        };
      }

      const dispatched = await this.dispatchEntry(
        entry,
        options.transportPreference ?? "firestore-first"
      );
      if (dispatched) return dispatched;

      if (options.allowQueue === false) {
        return {
          status: "dropped",
          destination: "dropped",
          entryId: entry.id,
        };
      }

      return this.queueEntry(entry);
    } catch {
      return {
        status: "dropped",
        destination: "dropped",
        entryId: makeEntryId(),
      };
    }
  }

  async captureMessage(
    message: string,
    context: ErrorLogContext,
    options: CaptureOptions = {}
  ) {
    return this.captureException(new Error(message), context, options);
  }

  async flushPendingLogs(options: { transportPreference?: TransportPreference } = {}) {
    if (this.flushPromise) return this.flushPromise;

    this.flushPromise = (async () => {
      try {
        const queue = await this.readQueue();
        if (!queue.length) return 0;

        const remaining: ErrorLogEntry[] = [];
        let flushed = 0;
        for (const entry of queue) {
          const dispatched = await this.dispatchEntry(
            entry,
            options.transportPreference ?? "firestore-first"
          );
          if (dispatched) {
            flushed += 1;
          } else {
            remaining.push(entry);
          }
        }

        await this.writeQueue(remaining);
        return flushed;
      } catch {
        return 0;
      }
    })().finally(() => {
      this.flushPromise = null;
    });

    return this.flushPromise;
  }
}

export const errorLoggingService = new ErrorLoggingService();
