import {
  CoverageItem,
  ScheduleItem,
  StaffUser,
  SwapRequestItem,
} from "@/components/staff-portal/schedule/schedule-types";
import {
  TimeOffRequest,
  getStaffName,
} from "@/components/staff-portal/timeoff/timeoff-shared";
import {
  getFacilityRolesFromUser,
  isRoleCompatible,
} from "@/constants/industry-roles";

import { NotificationPayload, NotificationSettings } from "./types";

export function parseBackendDate(
  value: string | Date | undefined,
): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(" ", "T");

  // ISO with offset or Z
  if (/[zZ]$/.test(normalized) || /[+-]\d\d:\d\d$/.test(normalized)) {
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const d = new Date(`${normalized}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Unadorned UTC representation from Mongo/Express
  const d = new Date(`${normalized}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTimeWithTimezone(date: Date, timezone?: string): string {
  try {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone || undefined,
    });
  } catch {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
}

function formatDateWithTimezone(date: Date, timezone?: string): string {
  try {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      timeZone: timezone || undefined,
    });
  } catch {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

export function matchPersonalShiftReminders(
  schedules: ScheduleItem[],
  userId: string,
  settings: NotificationSettings,
  facilityTimezone?: string,
): NotificationPayload[] {
  if (!settings.shiftRemindersEnabled || !userId) {
    return [];
  }

  const now = Date.now();
  const notifications: NotificationPayload[] = [];

  for (const shift of schedules) {
    if (
      !shift._id ||
      shift.status === "cancelled" ||
      shift.status === "completed"
    ) {
      continue;
    }

    const assignedId =
      typeof shift.staffId === "string"
        ? shift.staffId
        : shift.staffId?._id || shift.staffId?.id;

    if (assignedId !== userId) {
      continue;
    }

    const startDate = parseBackendDate(shift.startTime);
    if (!startDate) continue;

    // Shift alarm: 60 minutes before start (in absolute epoch time)
    const alarmTime = new Date(startDate.getTime() - 60 * 60 * 1000);
    if (alarmTime.getTime() > now) {
      const tz = shift.timezone || facilityTimezone;
      const timeDisplay = formatTimeWithTimezone(startDate, tz);
      const roleDisplay = shift.role || "Scheduled";
      const areaDisplay = shift.unitArea ? ` in ${shift.unitArea}` : "";

      notifications.push({
        id: `shift_alarm_${shift._id}_${alarmTime.getTime()}`,
        type: "SHIFT_REMINDER",
        title: "Upcoming Shift in 1 Hour",
        body: `Your ${roleDisplay} shift${areaDisplay} begins at ${timeDisplay}.`,
        url: "/schedule",
        triggerDate: alarmTime,
        channelId: "shift-alarms",
      });
    }
  }

  return notifications;
}

export function matchOpenShifts(
  schedules: ScheduleItem[],
  user: StaffUser,
  facilityPreferences: { roleFamilies?: unknown[] } | null | undefined,
  settings: NotificationSettings,
): NotificationPayload[] {
  if (!settings.openShiftsEnabled || !user) {
    return [];
  }

  const userFacilityRoles = getFacilityRolesFromUser(user, facilityPreferences);
  if (!userFacilityRoles.length) {
    return [];
  }

  const userAreas = new Set(
    Array.isArray(user.allowedAreas)
      ? user.allowedAreas.map((a) =>
          String(a || "")
            .toLowerCase()
            .trim(),
        )
      : [],
  );

  const userCerts = new Set(
    Array.isArray(user.certificationTags)
      ? user.certificationTags.map((c) =>
          String(c || "")
            .toLowerCase()
            .trim(),
        )
      : [],
  );

  const now = Date.now();
  const notifications: NotificationPayload[] = [];

  for (const shift of schedules) {
    if (!shift._id || shift.staffId) {
      continue;
    }

    if (shift.status && shift.status !== "scheduled") {
      continue;
    }

    const startDate = parseBackendDate(shift.startTime);
    if (!startDate || startDate.getTime() <= now) {
      continue;
    }

    // Role check
    const isRoleMatch = userFacilityRoles.some((uRole) =>
      isRoleCompatible(uRole, shift.role),
    );
    if (!isRoleMatch) continue;

    // Area check
    if (shift.unitArea && userAreas.size > 0) {
      const shiftAreaNorm = String(shift.unitArea).toLowerCase().trim();
      if (!userAreas.has(shiftAreaNorm)) {
        continue;
      }
    }

    // Certifications check
    if (shift.certificationTags && shift.certificationTags.length > 0) {
      const hasAllCerts = shift.certificationTags.every((tag) =>
        userCerts.has(String(tag).toLowerCase().trim()),
      );
      if (!hasAllCerts) continue;
    }

    const tz =
      shift.timezone ||
      ((facilityPreferences as Record<string, unknown>)?.facilityTimezone as
        | string
        | undefined);
    const dateDisplay = formatDateWithTimezone(startDate, tz);
    const timeDisplay = formatTimeWithTimezone(startDate, tz);
    const roleDisplay = shift.role || "Open";
    const areaDisplay = shift.unitArea ? ` in ${shift.unitArea}` : "";

    notifications.push({
      id: `open_shift_${shift._id}`,
      type: "OPEN_SHIFT",
      title: "Open Shift Available",
      body: `${roleDisplay} shift${areaDisplay} is available on ${dateDisplay} at ${timeDisplay}.`,
      url: "/schedule",
      channelId: "scheduling-updates",
    });
  }

  return notifications;
}

export function matchSwapRequests(
  swapRequests: SwapRequestItem[],
  userId: string,
  canManageSchedules: boolean,
  settings: NotificationSettings,
): NotificationPayload[] {
  if (!settings.swapRequestsEnabled || !swapRequests.length) {
    return [];
  }

  const notifications: NotificationPayload[] = [];

  for (const swap of swapRequests) {
    if (!swap._id) continue;

    const receiverId =
      typeof swap.receiverStaffId === "string"
        ? swap.receiverStaffId
        : swap.receiverStaffId?._id || swap.receiverStaffId?.id;

    // Staff notification: inbound swap trade request
    if (
      receiverId === userId &&
      (swap.status === "pending" || swap.status === "pending_receiver")
    ) {
      const requesterName =
        typeof swap.requesterStaffId === "object" && swap.requesterStaffId?.name
          ? swap.requesterStaffId.name
          : "A colleague";

      notifications.push({
        id: `swap_inbound_${swap._id}`,
        type: "SWAP_REQUEST",
        title: "New Shift Swap Request",
        body: `${requesterName} requested to trade shifts with you.`,
        url: "/swap-requests",
        channelId: "scheduling-updates",
      });
    }

    // Admin / Scheduler notification: swap awaiting manager approval
    if (canManageSchedules && swap.status === "pending_admin") {
      notifications.push({
        id: `swap_admin_${swap._id}`,
        type: "SWAP_ADMIN_APPROVAL",
        title: "Shift Swap Approval Needed",
        body: "A peer-accepted shift trade is pending administrative approval.",
        url: "/swap-requests",
        channelId: "scheduling-updates",
      });
    }
  }

  return notifications;
}

export function matchTimeOffRequests(
  timeOffRequests: TimeOffRequest[],
  canReviewTimeoff: boolean,
  settings: NotificationSettings,
): NotificationPayload[] {
  if (
    !settings.timeoffDecisionsEnabled ||
    !canReviewTimeoff ||
    !timeOffRequests.length
  ) {
    return [];
  }

  const notifications: NotificationPayload[] = [];

  for (const req of timeOffRequests) {
    if (!req._id || req.status !== "pending") continue;

    const staffName = getStaffName(req);
    notifications.push({
      id: `timeoff_pending_${req._id}`,
      type: "TIMEOFF_DECISION",
      title: "Pending Time-Off Request",
      body: `${staffName} submitted a time-off request requiring review.`,
      url: "/timeoff-decisions",
      channelId: "scheduling-updates",
    });
  }

  return notifications;
}

export function matchCoverageGaps(
  coverage: CoverageItem[],
  canViewCoverage: boolean,
  settings: NotificationSettings,
  facilityTimezone?: string,
): NotificationPayload[] {
  if (!settings.coverageAlertsEnabled || !canViewCoverage || !coverage.length) {
    return [];
  }

  const now = Date.now();
  const next48h = now + 48 * 60 * 60 * 1000;
  const notifications: NotificationPayload[] = [];

  for (const item of coverage) {
    if (!item._id || (item.remaining ?? 0) <= 0) continue;

    const timeStr = item.startTime || item.date;
    if (!timeStr) continue;

    const date = parseBackendDate(timeStr);
    if (!date || date.getTime() < now || date.getTime() > next48h) {
      continue;
    }

    const area = item.unitArea || "Unit";
    const role = item.role || "Staff";
    const dateDisplay = formatDateWithTimezone(date, facilityTimezone);

    notifications.push({
      id: `coverage_gap_${item._id}`,
      type: "COVERAGE_ALERT",
      title: "Understaffed Coverage Warning",
      body: `${area} has ${item.remaining} unfilled ${role} slot(s) on ${dateDisplay}.`,
      url: "/coverage-planning",
      channelId: "scheduling-updates",
    });
  }

  return notifications;
}
