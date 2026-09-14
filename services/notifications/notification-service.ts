import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { ImperativeRouter } from "expo-router";
import { Platform } from "react-native";

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationPayload,
  NotificationSettings,
} from "./types";

// Configure foreground presentation behavior safely
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

const SETTINGS_KEY_PREFIX = "wisershifts_notif_settings_";
const SCHEDULED_HASHES_PREFIX = "wisershifts_scheduled_hashes_";

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("shift-alarms", {
        name: "Shift Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0284c7",
        sound: "default",
      });

      await Notifications.setNotificationChannelAsync("scheduling-updates", {
        name: "Scheduling & Swap Updates",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: "default",
      });
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  } catch (error) {
    console.warn("Failed to request notification permissions:", error);
    return false;
  }
}

export async function getNotificationSettings(
  userId?: string,
): Promise<NotificationSettings> {
  if (!userId) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }

  try {
    const raw = await AsyncStorage.getItem(`${SETTINGS_KEY_PREFIX}${userId}`);
    if (!raw) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return {
      shiftRemindersEnabled:
        typeof parsed.shiftRemindersEnabled === "boolean"
          ? parsed.shiftRemindersEnabled
          : DEFAULT_NOTIFICATION_SETTINGS.shiftRemindersEnabled,
      openShiftsEnabled:
        typeof parsed.openShiftsEnabled === "boolean"
          ? parsed.openShiftsEnabled
          : DEFAULT_NOTIFICATION_SETTINGS.openShiftsEnabled,
      swapRequestsEnabled:
        typeof parsed.swapRequestsEnabled === "boolean"
          ? parsed.swapRequestsEnabled
          : DEFAULT_NOTIFICATION_SETTINGS.swapRequestsEnabled,
      timeoffDecisionsEnabled:
        typeof parsed.timeoffDecisionsEnabled === "boolean"
          ? parsed.timeoffDecisionsEnabled
          : DEFAULT_NOTIFICATION_SETTINGS.timeoffDecisionsEnabled,
      coverageAlertsEnabled:
        typeof parsed.coverageAlertsEnabled === "boolean"
          ? parsed.coverageAlertsEnabled
          : DEFAULT_NOTIFICATION_SETTINGS.coverageAlertsEnabled,
    };
  } catch (error) {
    console.warn("Failed to load notification settings:", error);
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
}

export async function saveNotificationSettings(
  userId: string,
  settings: NotificationSettings,
): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(
      `${SETTINGS_KEY_PREFIX}${userId}`,
      JSON.stringify(settings),
    );
  } catch (error) {
    console.warn("Failed to save notification settings:", error);
  }
}

export async function getScheduledHashes(userId: string): Promise<Set<string>> {
  if (!userId) return new Set();
  try {
    const raw = await AsyncStorage.getItem(
      `${SCHEDULED_HASHES_PREFIX}${userId}`,
    );
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export async function saveScheduledHashes(
  userId: string,
  hashes: Set<string>,
): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(
      `${SCHEDULED_HASHES_PREFIX}${userId}`,
      JSON.stringify(Array.from(hashes)),
    );
  } catch (error) {
    console.warn("Failed to save scheduled hashes:", error);
  }
}

export async function cancelAllUserNotifications(
  userId?: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (userId) {
      await AsyncStorage.removeItem(`${SCHEDULED_HASHES_PREFIX}${userId}`);
    }
  } catch (error) {
    console.warn("Failed to cancel scheduled notifications:", error);
  }
}

export async function scheduleNotification(
  payload: NotificationPayload,
): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const content: Notifications.NotificationContentInput = {
      title: payload.title,
      body: payload.body,
      data: {
        url: payload.url,
        type: payload.type,
      },
      sound: "default",
    };

    if (payload.channelId && Platform.OS === "android") {
      // expo-notifications supports channelId in NotificationContentInput
      (content as Record<string, unknown>).channelId = payload.channelId;
    }

    if (payload.triggerDate) {
      const now = Date.now();
      const triggerMs = payload.triggerDate.getTime();
      const secondsUntil = Math.floor((triggerMs - now) / 1000);

      // If already past trigger date, skip scheduling
      if (secondsUntil <= 0) {
        return null;
      }

      return await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntil,
          repeats: false,
        },
      });
    }

    // Trigger immediately
    return await Notifications.scheduleNotificationAsync({
      content,
      trigger: null,
    });
  } catch (error) {
    console.warn("Failed to schedule notification:", error);
    return null;
  }
}

export function subscribeToNotificationClicks(router: ImperativeRouter) {
  if (Platform.OS === "web") {
    return () => {};
  }

  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response.notification.request.content.data;
        if (data && typeof data.url === "string") {
          router.push(data.url as never);
        }
      } catch (error) {
        console.warn("Failed to navigate from notification click:", error);
      }
    });

  return () => {
    responseSubscription.remove();
  };
}
