import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { requestNotificationPermissions } from "@/services/notifications/notification-service";

const PREFIX = "staff-shift-";

type Shift = { _id: string; startTime: string; endTime: string; status?: string; role?: string };

/**
 * A reminder an hour before each upcoming shift, on this phone only.
 * Re-done on every sync so a shift that was removed or moved doesn't keep
 * an old reminder.
 */
export async function syncShiftReminders(shifts: Shift[], fmtTime: (iso: string) => string) {
  if (Platform.OS === "web") return;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((n) => n.identifier.startsWith(PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    const now = Date.now();
    const upcoming = shifts
      .filter((s) => s.status === "scheduled")
      .map((s) => ({ shift: s, at: new Date(s.startTime).getTime() - 60 * 60 * 1000 }))
      .filter(({ at }) => at > now)
      .slice(0, 30); // iOS keeps at most 64 pending notifications per app

    for (const { shift, at } of upcoming) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${shift._id}`,
        content: {
          title: "Your shift starts in an hour",
          body: `${fmtTime(shift.startTime)}–${fmtTime(shift.endTime)}`,
          data: { url: "/my" },
          sound: "default",
          ...(Platform.OS === "android" ? { channelId: "shift-alarms" } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(at),
        },
      });
    }
  } catch (error) {
    console.warn("Couldn't set shift reminders", error);
  }
}

export async function clearShiftReminders() {
  if (Platform.OS === "web") return;
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((n) => n.identifier.startsWith(PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // ignore
  }
}
