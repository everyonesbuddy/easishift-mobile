import { useCallback, useEffect, useRef } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";

import {
  CoverageItem,
  ScheduleItem,
  SwapRequestItem,
} from "@/components/staff-portal/schedule/schedule-types";
import {
  TimeOffRequest,
  normalizeTimeOffPayload,
} from "@/components/staff-portal/timeoff/timeoff-shared";
import api from "@/config/api";
import { getDisplayTimeZone } from "@/config/timezone";
import { getFacilityRolesFromUser } from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";
import {
  matchCoverageGaps,
  matchOpenShifts,
  matchPersonalShiftReminders,
  matchSwapRequests,
  matchTimeOffRequests,
} from "@/services/notifications/notification-matcher";
import {
  getNotificationSettings,
  getScheduledHashes,
  requestNotificationPermissions,
  saveScheduledHashes,
  scheduleNotification,
} from "@/services/notifications/notification-service";
import { NotificationPayload } from "@/services/notifications/types";

export function useNotificationsSync() {
  const { user, can, facilityPreferences } = useAuth();
  const isSyncingRef = useRef(false);

  const userId = typeof user?._id === "string" ? user._id : "";
  const canManageSchedules = can("schedule.manage");
  const canViewCoverage = can("coverage.view") || canManageSchedules;
  const canReviewTimeoff = can("timeoff.review");
  const canUseSwap = can("shift_swap.use") || canManageSchedules;
  const hasSchedulableRole =
    getFacilityRolesFromUser(user, facilityPreferences).length > 0;

  const syncNotifications = useCallback(async () => {
    if (!userId || Platform.OS === "web" || isSyncingRef.current) {
      return;
    }

    try {
      isSyncingRef.current = true;

      const granted = await requestNotificationPermissions();
      if (!granted) {
        return;
      }

      const settings = await getNotificationSettings(userId);
      const scheduledHashes = await getScheduledHashes(userId);

      // Collect data needed based on permissions
      const requests: Promise<unknown>[] = [];

      // 1. Schedules
      const shouldFetchSchedules =
        hasSchedulableRole || can("schedule.view") || can("schedule.view_own");
      const schedulePromise = shouldFetchSchedules
        ? api.get("/schedules").catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] });
      requests.push(schedulePromise);

      // 2. Swaps
      const swapPromise = canUseSwap
        ? api
            .get(
              canManageSchedules
                ? "/schedules/swap-requests"
                : "/schedules/swap-requests?view=inbox",
            )
            .catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] });
      requests.push(swapPromise);

      // 3. Timeoff (Admin)
      const timeoffPromise = canReviewTimeoff
        ? api.get("/timeoff").catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] });
      requests.push(timeoffPromise);

      // 4. Coverage (Admin / Scheduler)
      const coveragePromise = canViewCoverage
        ? api.get("/coverage").catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] });
      requests.push(coveragePromise);

      const [schedRes, swapRes, timeoffRes, covRes] = (await Promise.all(
        requests,
      )) as [
        { data: unknown },
        { data: unknown },
        { data: unknown },
        { data: unknown },
      ];

      const schedules = Array.isArray(schedRes?.data)
        ? (schedRes.data as ScheduleItem[])
        : [];
      const swaps = Array.isArray(swapRes?.data)
        ? (swapRes.data as SwapRequestItem[])
        : [];
      const timeoffs = normalizeTimeOffPayload(
        timeoffRes?.data,
      ) as TimeOffRequest[];
      const coverages = Array.isArray(covRes?.data)
        ? (covRes.data as CoverageItem[])
        : [];

      const facilityTz = getDisplayTimeZone(
        facilityPreferences as {
          facilityTimezone?: string;
          facilityTimezoneConfirmed?: boolean;
        } | null,
      );

      // Generate notification payloads
      const payloads: NotificationPayload[] = [
        ...matchPersonalShiftReminders(schedules, userId, settings, facilityTz),
        ...matchOpenShifts(
          schedules,
          user as never,
          facilityPreferences,
          settings,
          facilityTz,
        ),
        ...matchSwapRequests(swaps, userId, canManageSchedules, settings),
        ...matchTimeOffRequests(timeoffs, canReviewTimeoff, settings),
        ...matchCoverageGaps(coverages, canViewCoverage, settings, facilityTz),
      ];

      // Schedule any not-yet-scheduled notifications
      let hasNewSchedules = false;
      for (const payload of payloads) {
        if (!scheduledHashes.has(payload.id)) {
          const result = await scheduleNotification(payload);
          if (result !== null) {
            scheduledHashes.add(payload.id);
            hasNewSchedules = true;
          }
        }
      }

      if (hasNewSchedules) {
        await saveScheduledHashes(userId, scheduledHashes);
      }
    } catch (syncError) {
      console.warn("Error during notification sync:", syncError);
    } finally {
      isSyncingRef.current = false;
    }
  }, [
    userId,
    user,
    can,
    canManageSchedules,
    canViewCoverage,
    canReviewTimeoff,
    canUseSwap,
    hasSchedulableRole,
    facilityPreferences,
  ]);

  // Initial sync on mount and when userId changes
  useEffect(() => {
    if (userId) {
      void syncNotifications();
    }
  }, [userId, syncNotifications]);

  // Sync on app foreground transition
  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && userId) {
        void syncNotifications();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => {
      subscription.remove();
    };
  }, [userId, syncNotifications]);

  return { syncNotifications };
}
