import { Href } from "expo-router";

export type NotificationType =
  | "SHIFT_REMINDER"
  | "OPEN_SHIFT"
  | "SWAP_REQUEST"
  | "SWAP_ADMIN_APPROVAL"
  | "TIMEOFF_DECISION"
  | "TIMEOFF_REQUEST"
  | "COVERAGE_ALERT";

export type NotificationPayload = {
  id: string; // Unique identifier / hash to prevent re-scheduling
  type: NotificationType;
  title: string;
  body: string;
  url: Href;
  triggerDate?: Date; // If defined, scheduled for this future time. If omitted, sent immediately.
  channelId?: "shift-alarms" | "scheduling-updates";
};

export type NotificationSettings = {
  shiftRemindersEnabled: boolean;
  openShiftsEnabled: boolean;
  swapRequestsEnabled: boolean;
  timeoffDecisionsEnabled: boolean;
  coverageAlertsEnabled: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  shiftRemindersEnabled: true,
  openShiftsEnabled: true,
  swapRequestsEnabled: true,
  timeoffDecisionsEnabled: true,
  coverageAlertsEnabled: true,
};
