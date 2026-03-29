import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  type Opportunity,
  type UserOpportunityStatus,
  isOpportunityDoneForCurrentCycle,
  OPPORTUNITY_NOTIFICATION_OFFSETS_DAYS,
  resolveOpportunityDueDate,
} from '@/constants/opportunities';
import { STORAGE_KEYS } from '@/constants/schema';
import { errorLoggingService } from './error-logging.service';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export type DeadlineNotificationSyncInput = {
  enabled: boolean;
  deadline?: unknown;
};

export type OpportunityNotificationSyncInput = {
  enabled: boolean;
  opportunities: Opportunity[];
  statuses?: Record<string, UserOpportunityStatus | undefined>;
};

type ManagedNotificationRecord = {
  identifier: string;
  fingerprint: string;
  scheduledFor: string;
};

type ManagedNotificationState = Record<string, ManagedNotificationRecord>;
type ManagedNotificationNamespaces = Record<string, ManagedNotificationState>;

type ReminderPlan = {
  key: string;
  title: string;
  body: string;
  scheduledFor: Date;
  fingerprint: string;
};

const MANAGED_NOTIFICATIONS_STORAGE_KEY = STORAGE_KEYS.notificationsManaged;
const DEADLINE_REMINDER_OFFSETS_DAYS = [7, 1, 0] as const;
const MANAGED_NAMESPACE_DEADLINE = 'deadline';
const MANAGED_NAMESPACE_OPPORTUNITIES = 'opportunities';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasExplicitTime(rawValue: string) {
  return /\d{1,2}:\d{2}|\b(am|pm)\b/i.test(rawValue);
}

function buildLocalDeadlineDate(year: number, month: number, day: number) {
  const parsed = new Date(year, month - 1, day, 9, 0, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function parseDeadlineDate(deadline: unknown): Date | null {
  const rawValue = String(deadline ?? '').trim();
  if (!rawValue) return null;

  const isoDateMatch = rawValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDateMatch) {
    const [, rawYear, rawMonth, rawDay] = isoDateMatch;
    return buildLocalDeadlineDate(Number(rawYear), Number(rawMonth), Number(rawDay));
  }

  const slashDateMatch = rawValue.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (slashDateMatch) {
    const [, rawMonth, rawDay, rawYear] = slashDateMatch;
    const normalizedYear = rawYear.length === 2 ? Number(`20${rawYear}`) : Number(rawYear);
    return buildLocalDeadlineDate(normalizedYear, Number(rawMonth), Number(rawDay));
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return null;

  if (!hasExplicitTime(rawValue)) {
    parsed.setHours(9, 0, 0, 0);
  }

  return parsed;
}

function subtractDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

function formatDeadline(date: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

function buildReminderCopy(offsetDays: (typeof DEADLINE_REMINDER_OFFSETS_DAYS)[number], formattedDeadline: string) {
  if (offsetDays === 7) {
    return {
      title: 'Transfer deadline in one week',
      body: `Your target transfer deadline is ${formattedDeadline}. Open GatorGuide to review your roadmap and documents.`,
    };
  }

  if (offsetDays === 1) {
    return {
      title: 'Transfer deadline tomorrow',
      body: `Your target transfer deadline is ${formattedDeadline}. Take a final look at your roadmap, documents, and applications.`,
    };
  }

  return {
    title: 'Transfer deadline today',
    body: `Your target transfer deadline is ${formattedDeadline}. Open GatorGuide to stay on top of your final checklist.`,
  };
}

function buildDeadlineReminderPlans(deadline: unknown): ReminderPlan[] {
  const parsedDeadline = parseDeadlineDate(deadline);
  if (!parsedDeadline) return [];

  const now = Date.now();
  const formattedDeadline = formatDeadline(parsedDeadline);

  return DEADLINE_REMINDER_OFFSETS_DAYS
    .map((offsetDays) => {
      const scheduledFor = subtractDays(parsedDeadline, offsetDays);
      if (scheduledFor.getTime() <= now) return null;

      const copy = buildReminderCopy(offsetDays, formattedDeadline);
      const fingerprint = JSON.stringify({
        title: copy.title,
        body: copy.body,
        scheduledFor: scheduledFor.toISOString(),
      });

      return {
        key: `deadline-${offsetDays}d`,
        title: copy.title,
        body: copy.body,
        scheduledFor,
        fingerprint,
      };
    })
    .filter((plan): plan is ReminderPlan => !!plan);
}

function buildOpportunityReminderCopy(
  opportunity: Opportunity,
  offsetDays: (typeof OPPORTUNITY_NOTIFICATION_OFFSETS_DAYS)[number],
  formattedDeadline: string
) {
  const title = opportunity.title || 'Opportunity';
  const opportunityTypeLabel =
    opportunity.type === 'college_deadline'
      ? 'college deadline'
      : opportunity.type === 'internship'
        ? 'internship'
        : 'scholarship';

  if (offsetDays === 7) {
    return {
      title: `${title} due in one week`,
      body: `Your ${opportunityTypeLabel} reminder is due ${formattedDeadline}. Open GatorGuide to review the details.`,
    };
  }

  if (offsetDays === 1) {
    return {
      title: `${title} due tomorrow`,
      body: `Your ${opportunityTypeLabel} reminder is due ${formattedDeadline}. Make sure your materials are ready.`,
    };
  }

  return {
    title: `${title} due today`,
    body: `Your ${opportunityTypeLabel} reminder is due ${formattedDeadline}. Open GatorGuide to finish it today.`,
  };
}

function buildOpportunityReminderPlans(
  opportunities: Opportunity[],
  statuses: Record<string, UserOpportunityStatus | undefined> = {}
): ReminderPlan[] {
  const now = Date.now();

  return (opportunities ?? [])
    .flatMap((opportunity) => {
      const dueDate = resolveOpportunityDueDate(opportunity);
      if (!dueDate) return [];
      if (isOpportunityDoneForCurrentCycle(opportunity, statuses[opportunity.opportunityId])) {
        return [];
      }

      const formattedDeadline = formatDeadline(dueDate);

      return OPPORTUNITY_NOTIFICATION_OFFSETS_DAYS.map((offsetDays) => {
        const scheduledFor = subtractDays(dueDate, offsetDays);
        if (scheduledFor.getTime() <= now) return null;

        const copy = buildOpportunityReminderCopy(
          opportunity,
          offsetDays,
          formattedDeadline
        );
        const fingerprint = JSON.stringify({
          title: copy.title,
          body: copy.body,
          scheduledFor: scheduledFor.toISOString(),
        });

        return {
          key: `opportunity:${opportunity.opportunityId}:${offsetDays}d`,
          title: copy.title,
          body: copy.body,
          scheduledFor,
          fingerprint,
        };
      }).filter((plan): plan is ReminderPlan => !!plan);
    })
    .sort((left, right) => left.scheduledFor.getTime() - right.scheduledFor.getTime());
}

class NotificationsService {
  /**
   * Request notification permissions from the device.
   */
  async requestPermissions(): Promise<NotificationPermissionStatus> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        return 'granted';
      } else if (finalStatus === 'denied') {
        return 'denied';
      }

      return 'undetermined';
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: 'notifications',
        operation: 'request-notification-permissions',
        severity: 'warn',
        handled: true,
        source: 'notifications.service',
        metadata: {
          platform: Platform.OS,
        },
      });
      return 'denied';
    }
  }

  /**
   * Check current permission status without requesting.
   */
  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    try {
      const { status } = await Notifications.getPermissionsAsync();

      if (status === 'granted') {
        return 'granted';
      } else if (status === 'denied') {
        return 'denied';
      }

      return 'undetermined';
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: 'notifications',
        operation: 'get-notification-permissions',
        severity: 'warn',
        handled: true,
        source: 'notifications.service',
        metadata: {
          platform: Platform.OS,
        },
      });
      return 'undetermined';
    }
  }

  /**
   * Configure how notifications are displayed.
   */
  configureNotificationHandler() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  /**
   * Schedule a local notification (for testing or app reminders).
   */
  async scheduleNotification(title: string, body: string, delaySeconds: number = 0) {
    try {
      const trigger: Notifications.TimeIntervalTriggerInput | null =
        delaySeconds > 0
          ? {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: delaySeconds,
              repeats: false,
            }
          : null;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
        },
        trigger,
      });

      return id;
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: 'notifications',
        operation: 'schedule-notification',
        severity: 'error',
        handled: true,
        source: 'notifications.service',
        metadata: {
          title,
          delaySeconds,
        },
      });
      return null;
    }
  }

  /**
   * Keep the app-managed deadline reminders in sync with current data.
   */
  async syncDeadlineNotifications(input: DeadlineNotificationSyncInput) {
    if (!input.enabled) {
      await this.clearManagedNotifications(MANAGED_NAMESPACE_DEADLINE);
      return;
    }

    const permissionStatus = await this.getPermissionStatus();
    if (permissionStatus !== 'granted') {
      await this.clearManagedNotifications(MANAGED_NAMESPACE_DEADLINE);
      return;
    }

    const plans = buildDeadlineReminderPlans(input.deadline);
    await this.syncManagedPlans(MANAGED_NAMESPACE_DEADLINE, plans, 'schedule-deadline-notification');
  }

  async syncOpportunityNotifications(input: OpportunityNotificationSyncInput) {
    if (!input.enabled) {
      await this.clearManagedNotifications(MANAGED_NAMESPACE_OPPORTUNITIES);
      return;
    }

    const permissionStatus = await this.getPermissionStatus();
    if (permissionStatus !== 'granted') {
      await this.clearManagedNotifications(MANAGED_NAMESPACE_OPPORTUNITIES);
      return;
    }

    const plans = buildOpportunityReminderPlans(
      input.opportunities,
      input.statuses ?? {}
    );
    await this.syncManagedPlans(
      MANAGED_NAMESPACE_OPPORTUNITIES,
      plans,
      'schedule-opportunity-notification'
    );
  }

  /**
   * Cancel any app-managed notifications and clear local tracking state.
   */
  async clearManagedNotifications(namespace?: string) {
    if (namespace) {
      const existing = await this.loadManagedNotifications(namespace);
      for (const [key, record] of Object.entries(existing)) {
        await this.cancelScheduledNotification(record.identifier, key);
      }
      await this.persistManagedNotifications(namespace, {});
      return;
    }

    const namespaces = await this.loadManagedNotificationNamespaces();
    for (const state of Object.values(namespaces)) {
      for (const [key, record] of Object.entries(state)) {
        await this.cancelScheduledNotification(record.identifier, key);
      }
    }

    await this.persistManagedNotificationNamespaces({});
  }

  /**
   * Cancel all scheduled notifications.
   */
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: 'notifications',
        operation: 'cancel-all-notifications',
        severity: 'warn',
        handled: true,
        source: 'notifications.service',
      });
    }
  }

  private async scheduleDateNotification(plan: ReminderPlan, operation: string) {
    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: plan.title,
          body: plan.body,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: plan.scheduledFor,
        },
      });
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: 'notifications',
        operation,
        severity: 'warn',
        handled: true,
        source: 'notifications.service',
        metadata: {
          notificationKey: plan.key,
          scheduledFor: plan.scheduledFor.toISOString(),
        },
      });
      return null;
    }
  }

  private async cancelScheduledNotification(identifier: string, notificationKey: string) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: 'notifications',
        operation: 'cancel-scheduled-notification',
        severity: 'warn',
        handled: true,
        source: 'notifications.service',
        metadata: {
          identifier,
          notificationKey,
        },
      });
    }
  }

  private async syncManagedPlans(
    namespace: string,
    plans: ReminderPlan[],
    scheduleOperation: string
  ) {
    const existing = await this.loadManagedNotifications(namespace);
    const nextState: ManagedNotificationState = {};
    const nextKeys = new Set(plans.map((plan) => plan.key));

    for (const [key, record] of Object.entries(existing)) {
      if (nextKeys.has(key)) continue;
      await this.cancelScheduledNotification(record.identifier, key);
    }

    for (const plan of plans) {
      const existingRecord = existing[plan.key];
      if (existingRecord?.fingerprint === plan.fingerprint) {
        nextState[plan.key] = existingRecord;
        continue;
      }

      if (existingRecord) {
        await this.cancelScheduledNotification(existingRecord.identifier, plan.key);
      }

      const identifier = await this.scheduleDateNotification(
        plan,
        scheduleOperation
      );
      if (!identifier) continue;

      nextState[plan.key] = {
        identifier,
        fingerprint: plan.fingerprint,
        scheduledFor: plan.scheduledFor.toISOString(),
      };
    }

    await this.persistManagedNotifications(namespace, nextState);
  }

  private async loadManagedNotificationNamespaces(): Promise<ManagedNotificationNamespaces> {
    try {
      const raw = await AsyncStorage.getItem(MANAGED_NOTIFICATIONS_STORAGE_KEY);
      if (!raw) return {};

      const parsed = JSON.parse(raw) as unknown;
      if (!isRecord(parsed)) return {};

      // Backwards compatibility: older builds stored a flat notification map.
      const looksLikeLegacyFlatState = Object.values(parsed).some(
        (value) => isRecord(value) && typeof value.identifier === 'string'
      );
      if (looksLikeLegacyFlatState) {
        return {
          [MANAGED_NAMESPACE_DEADLINE]: this.extractManagedNotificationState(parsed),
        };
      }

      const namespaces = Object.entries(parsed).flatMap(([namespace, value]) => {
        if (!isRecord(value)) return [];
        return [[namespace, this.extractManagedNotificationState(value)] as const];
      });

      return Object.fromEntries(namespaces);
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: 'notifications',
        operation: 'load-managed-notifications',
        severity: 'warn',
        handled: true,
        source: 'notifications.service',
      });
      return {};
    }
  }

  private extractManagedNotificationState(
    value: Record<string, unknown>
  ): ManagedNotificationState {
    const entries = Object.entries(value).flatMap(([key, itemValue]) => {
      if (!isRecord(itemValue)) return [];
      if (typeof itemValue.identifier !== 'string') return [];
      if (typeof itemValue.fingerprint !== 'string') return [];
      if (typeof itemValue.scheduledFor !== 'string') return [];

      return [
        [
          key,
          {
            identifier: itemValue.identifier,
            fingerprint: itemValue.fingerprint,
            scheduledFor: itemValue.scheduledFor,
          } satisfies ManagedNotificationRecord,
        ] as const,
      ];
    });

    return Object.fromEntries(entries);
  }

  private async loadManagedNotifications(namespace: string): Promise<ManagedNotificationState> {
    const namespaces = await this.loadManagedNotificationNamespaces();
    return namespaces[namespace] ?? {};
  }

  private async persistManagedNotificationNamespaces(
    namespaces: ManagedNotificationNamespaces
  ) {
    try {
      if (Object.keys(namespaces).length === 0) {
        await AsyncStorage.removeItem(MANAGED_NOTIFICATIONS_STORAGE_KEY);
        return;
      }

      await AsyncStorage.setItem(
        MANAGED_NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(namespaces)
      );
    } catch (error) {
      void errorLoggingService.captureException(error, {
        category: 'notifications',
        operation: 'persist-managed-notifications',
        severity: 'warn',
        handled: true,
        source: 'notifications.service',
        metadata: {
          count: Object.keys(namespaces).length,
        },
      });
    }
  }

  private async persistManagedNotifications(
    namespace: string,
    state: ManagedNotificationState
  ) {
    const namespaces = await this.loadManagedNotificationNamespaces();
    if (Object.keys(state).length === 0) {
      delete namespaces[namespace];
    } else {
      namespaces[namespace] = state;
    }
    await this.persistManagedNotificationNamespaces(namespaces);
  }
}

export const notificationsService = new NotificationsService();
