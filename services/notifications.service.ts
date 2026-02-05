// services/notifications.service.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

class NotificationsService {
  /**
   * Request notification permissions from the device
   * Shows native permission dialog on iOS/Android
   */
  async requestPermissions(): Promise<NotificationPermissionStatus> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
      let finalStatus = existingStatus;
      
      // Only ask if permission has not been determined yet
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
      console.error('Error requesting notification permissions:', error);
      return 'denied';
    }
  }

  /**
   * Check current permission status without requesting
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
      console.error('Error getting notification permissions:', error);
      return 'undetermined';
    }
  }

  /**
   * Configure how notifications are displayed
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
   * Schedule a local notification (for testing or app reminders)
   */
  async scheduleNotification(title: string, body: string, delaySeconds: number = 0) {
    try {
      const trigger: Notifications.TimeIntervalTriggerInput | null = delaySeconds > 0 
        ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds, repeats: false }
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
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling notifications:', error);
    }
  }
}

export const notificationsService = new NotificationsService();
