import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import api from "@/config/api";
import { getBrandColors } from "@/config/branding-colors";
import { getDisplayTimeZone } from "@/config/timezone";
import { getFacilityRolesFromUser } from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";

type TimeBreak = {
  startAt?: string;
  endAt?: string;
};

type TimeEntry = {
  _id?: string;
  staffId?: { name?: string } | string;
  staff?: { name?: string };
  staffName?: string;
  status?: "in_progress" | "completed" | "adjusted" | string;
  clockInAt?: string;
  clockOutAt?: string;
  workedMinutes?: number;
  totals?: {
    workedMinutes?: number;
  };
  breaks?: TimeBreak[];
  scheduleId?: string | { startTime?: string; endTime?: string } | null;
  createdAt?: string;
  attendanceOutcome?: string;
};

type StaffSchedule = {
  status?: string;
  startTime?: string;
  endTime?: string;
};

type TimeTrackingPrefs = {
  enabled?: boolean;
  mode?: "open" | "geofence" | string;
  requireScheduleMatch?: boolean;
  clockInGraceMinutes?: number;
  clockOutGraceMinutes?: number;
};

const STATUS_COLORS: Record<
  string,
  { text: string; bg: string; border: string }
> = {
  in_progress: {
    text: "#92400e",
    bg: "#fef3c7",
    border: "#fcd34d",
  },
  completed: {
    text: "#166534",
    bg: "#dcfce7",
    border: "#86efac",
  },
  adjusted: {
    text: "#1e3a8a",
    bg: "#dbeafe",
    border: "#93c5fd",
  },
  left_early: { text: "#92400e", bg: "#fef3c7", border: "#fcd34d" },
  no_show: { text: "#334155", bg: "#f1f5f9", border: "#cbd5e1" },
  call_out: { text: "#991b1b", bg: "#fee2e2", border: "#fca5a5" },
};

const SOURCE = "mobile";

function toIsoNow() {
  return new Date().toISOString();
}

function formatDateTime(value: unknown, timeZone?: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(
    typeof value === "number" || value instanceof Date ? value : String(value),
  );
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString(undefined, {
    ...(timeZone ? { timeZone } : {}),
  });
}

function formatMinutes(value: unknown) {
  const safe = Number(value || 0);
  if (!Number.isFinite(safe)) {
    return "0m";
  }

  const rounded = Math.max(0, Math.round(safe));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;

  if (!hours) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function formatElapsedFromNow(startAt: string | undefined, now: number) {
  if (!startAt) return "-";
  const start = new Date(startAt).getTime();
  if (!Number.isFinite(start)) return "-";
  return formatMinutes(Math.max(0, Math.floor((now - start) / 60_000)));
}

function getDisplayAttendanceStatus(entry: TimeEntry) {
  return (
    String(entry.attendanceOutcome || entry.status || "unknown").trim() ||
    "unknown"
  );
}

function formatStatusLabel(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getWorkedMinutes(entry: TimeEntry | null) {
  if (!entry) {
    return 0;
  }

  if (Number.isFinite(Number(entry.workedMinutes))) {
    return Number(entry.workedMinutes);
  }

  if (Number.isFinite(Number(entry.totals?.workedMinutes))) {
    return Number(entry.totals?.workedMinutes);
  }

  return 0;
}

function normalizeEntriesFromResponse(data: unknown): TimeEntry[] {
  if (Array.isArray(data)) {
    return data as TimeEntry[];
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { entries?: unknown[] }).entries)
  ) {
    return (data as { entries: TimeEntry[] }).entries;
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { timeEntries?: unknown[] }).timeEntries)
  ) {
    return (data as { timeEntries: TimeEntry[] }).timeEntries;
  }

  if (
    data &&
    typeof data === "object" &&
    (data as { entry?: TimeEntry }).entry
  ) {
    return [(data as { entry: TimeEntry }).entry];
  }

  return [];
}

function normalizeSchedulesFromResponse(data: unknown): StaffSchedule[] {
  if (Array.isArray(data)) return data as StaffSchedule[];
  if (!data || typeof data !== "object") return [];
  const response = data as { schedules?: unknown; items?: unknown };
  if (Array.isArray(response.schedules))
    return response.schedules as StaffSchedule[];
  return Array.isArray(response.items)
    ? (response.items as StaffSchedule[])
    : [];
}

function getActiveEntryFromResponse(data: unknown, entries: TimeEntry[]) {
  if (
    data &&
    typeof data === "object" &&
    (data as { activeEntry?: TimeEntry }).activeEntry
  ) {
    return (data as { activeEntry: TimeEntry }).activeEntry;
  }

  return entries.find((item) => item?.status === "in_progress") || null;
}

function safeSortByClockInDesc(entries: TimeEntry[]) {
  return [...entries].sort((a, b) => {
    const left = new Date(a?.clockInAt || a?.createdAt || "").getTime();
    const right = new Date(b?.clockInAt || b?.createdAt || "").getTime();
    return right - left;
  });
}

function extractMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data
  ) {
    return String(error.response.data.message || fallback);
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function normalizeTrackingMode(mode: unknown) {
  const normalized = String(mode || "open")
    .trim()
    .toLowerCase();
  if (normalized === "geofence") {
    return "geofence";
  }

  if (normalized === "manual") {
    return "open";
  }

  return "open";
}

async function getAttendanceLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      "Location permission is required to clock in or out in geofence mode.",
    );
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error("Turn on location services, then try again.");
  }

  const result = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: result.coords.latitude,
    longitude: result.coords.longitude,
    ...(result.coords.accuracy === null
      ? {}
      : { accuracyMeters: result.coords.accuracy }),
  };
}

function getOpenBreak(entry: TimeEntry | null) {
  if (!entry || !Array.isArray(entry.breaks)) {
    return null;
  }

  return entry.breaks.find((item) => item && !item.endAt) || null;
}

function getBreakSummary(entry: TimeEntry, timeZone?: string) {
  const breaks = Array.isArray(entry.breaks) ? entry.breaks : [];
  if (!breaks.length) return "No breaks yet";
  const open = breaks.find((item) => item && !item.endAt);
  return open
    ? `On break since ${formatDateTime(open.startAt, timeZone)}`
    : `${breaks.length} break${breaks.length === 1 ? "" : "s"} logged`;
}

function formatSessionWindow(schedule: StaffSchedule, timeZone?: string) {
  if (!schedule.startTime || !schedule.endTime) return "Time not available";
  return `${formatDateTime(schedule.startTime, timeZone)} to ${formatDateTime(schedule.endTime, timeZone)}`;
}

function getStatusStyle(status: string) {
  return (
    STATUS_COLORS[status] || {
      text: "#334155",
      bg: "#f1f5f9",
      border: "#cbd5e1",
    }
  );
}

export default function TimeTrackingPage() {
  const {
    user,
    can,
    facilityPreferences,
    fetchFacilityPreferences,
    publicBranding,
  } = useAuth();
  const brand = getBrandColors(publicBranding);
  const displayTimeZone = getDisplayTimeZone(facilityPreferences);
  const isAdmin = can("staff.view");
  const hasFacilityRole =
    getFacilityRolesFromUser(user, facilityPreferences).length > 0;
  const showPersonalTracking = !isAdmin || hasFacilityRole;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [windowNow, setWindowNow] = useState(() => Date.now());

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [staffSchedules, setStaffSchedules] = useState<StaffSchedule[]>([]);
  const [adminEntries, setAdminEntries] = useState<TimeEntry[]>([]);

  const trackingConfig = useMemo(
    () => (facilityPreferences?.timeTracking || {}) as TimeTrackingPrefs,
    [facilityPreferences?.timeTracking],
  );
  const trackingEnabled = Boolean(trackingConfig.enabled);
  const trackingMode = normalizeTrackingMode(trackingConfig.mode);
  const requiresLocation = trackingMode === "geofence";

  const openBreak = useMemo(() => getOpenBreak(activeEntry), [activeEntry]);

  const clockInWindowState = useMemo(() => {
    if (isAdmin || !trackingConfig.requireScheduleMatch) {
      return {
        available: true,
        reason: "",
        nextAvailableAt: null as number | null,
        nextSchedule: null as StaffSchedule | null,
      };
    }

    const windows = staffSchedules
      .filter((schedule) =>
        ["scheduled", "in_progress"].includes(
          String(schedule.status || "").toLowerCase(),
        ),
      )
      .map((schedule) => ({
        schedule,
        start:
          new Date(schedule.startTime || "").getTime() -
          Number(trackingConfig.clockOutGraceMinutes || 0) * 60_000,
        end:
          new Date(schedule.endTime || "").getTime() +
          Number(trackingConfig.clockInGraceMinutes || 0) * 60_000,
      }))
      .filter(
        (window) =>
          Number.isFinite(window.start) && Number.isFinite(window.end),
      )
      .sort((left, right) => left.start - right.start);
    const active = windows.find(
      (window) => windowNow >= window.start && windowNow <= window.end,
    );
    if (active)
      return {
        available: true,
        reason: "",
        nextAvailableAt: null,
        nextSchedule: active.schedule,
      };

    const next = windows.find((window) => window.start > windowNow);
    return {
      available: false,
      reason: next ? "outside_window" : "no_upcoming_schedule",
      nextAvailableAt: next?.start ?? null,
      nextSchedule: next?.schedule ?? null,
    };
  }, [isAdmin, staffSchedules, trackingConfig, windowNow]);

  useEffect(() => {
    const timer = setInterval(() => setWindowNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const loadStaffEntries = useCallback(async () => {
    if (!showPersonalTracking) return;
    const res = await api.get("/time-tracking/me");
    const normalizedEntries = safeSortByClockInDesc(
      normalizeEntriesFromResponse(res.data),
    );
    setEntries(normalizedEntries);
    setActiveEntry(getActiveEntryFromResponse(res.data, normalizedEntries));
  }, [showPersonalTracking]);

  const loadStaffSchedules = useCallback(async () => {
    if (!showPersonalTracking) return;
    try {
      const res = await api.get("/schedules");
      setStaffSchedules(normalizeSchedulesFromResponse(res.data));
    } catch {
      setStaffSchedules([]);
    }
  }, [showPersonalTracking]);

  const loadAdminEntries = useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    const res = await api.get("/time-tracking");
    const normalizedEntries = safeSortByClockInDesc(
      normalizeEntriesFromResponse(res.data),
    );
    setAdminEntries(normalizedEntries);
  }, [isAdmin]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setError("");

    try {
      await fetchFacilityPreferences();
      await loadStaffEntries();
      await loadStaffSchedules();
      await loadAdminEntries();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to refresh time tracking"));
    } finally {
      setRefreshing(false);
    }
  }, [
    fetchFacilityPreferences,
    loadAdminEntries,
    loadStaffEntries,
    loadStaffSchedules,
  ]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await fetchFacilityPreferences();

        await loadStaffEntries();
        await loadStaffSchedules();
        await loadAdminEntries();
      } catch (requestError) {
        if (mounted) {
          setError(
            extractMessage(requestError, "Failed to load time tracking"),
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [
    fetchFacilityPreferences,
    loadAdminEntries,
    loadStaffEntries,
    loadStaffSchedules,
  ]);

  const submitClockIn = async () => {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const location = requiresLocation
        ? await getAttendanceLocation()
        : undefined;
      await api.post("/time-tracking/clock-in", {
        source: SOURCE,
        ...(location ? { location } : {}),
      });
      setSuccess("Clocked in successfully.");
      await refreshAll();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to clock in"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockIn = async () => {
    await submitClockIn();
  };

  const handleStartBreak = async () => {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/time-tracking/breaks/start", {
        at: toIsoNow(),
        type: "rest",
        paid: false,
        source: SOURCE,
      });
      setSuccess("Break started.");
      await refreshAll();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to start break"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndBreak = async () => {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/time-tracking/breaks/end", {
        at: toIsoNow(),
      });
      setSuccess("Break ended.");
      await refreshAll();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to end break"));
    } finally {
      setSubmitting(false);
    }
  };

  const submitClockOut = async () => {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      let location:
        | Awaited<ReturnType<typeof getAttendanceLocation>>
        | undefined;
      if (requiresLocation) {
        try {
          location = await getAttendanceLocation();
        } catch {
          location = undefined;
        }
      }
      await api.post("/time-tracking/clock-out", {
        source: SOURCE,
        ...(location ? { location } : {}),
      });
      setSuccess("Clocked out successfully.");
      await refreshAll();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to clock out"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    await submitClockOut();
  };

  const canClockIn = !activeEntry && clockInWindowState.available;
  const canStartBreak = Boolean(activeEntry) && !openBreak;
  const canEndBreak = Boolean(activeEntry) && Boolean(openBreak);
  const canClockOut = Boolean(activeEntry) && !openBreak;

  if (loading) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  if (!trackingEnabled) {
    return (
      <SafeAreaView style={styles.page}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Time Tracking</Text>
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              Time tracking is currently disabled for your facility.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Time Tracking</Text>
            <Text style={styles.subtitle}>
              Manage attendance and break sessions.
            </Text>
          </View>
          <Pressable
            style={styles.refreshBtn}
            onPress={refreshAll}
            disabled={refreshing || submitting}
          >
            <Feather name="refresh-cw" size={14} color="#1f2937" />
            <Text style={styles.refreshBtnText}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.modeRow}>
          <View
            style={[
              styles.modePill,
              requiresLocation ? styles.modePillInfo : styles.modePillNeutral,
            ]}
          >
            <Text
              style={[
                styles.modePillText,
                requiresLocation
                  ? styles.modePillInfoText
                  : styles.modePillNeutralText,
              ]}
            >
              {requiresLocation ? "Geofence Mode" : "Open Mode"}
            </Text>
          </View>
          <View
            style={[
              styles.modePill,
              activeEntry ? styles.modePillWarn : styles.modePillNeutral,
            ]}
          >
            <Text
              style={[
                styles.modePillText,
                activeEntry
                  ? styles.modePillWarnText
                  : styles.modePillNeutralText,
              ]}
            >
              {activeEntry ? "Active Session" : "No Active Session"}
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {requiresLocation ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              Geofence mode is active. Clock In requires a location inside the
              facility boundary. Clock Out continues if location is unavailable
              or outside the boundary.
            </Text>
          </View>
        ) : (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              Open mode is active. Location capture is not required for
              clock-in/out.
            </Text>
          </View>
        )}

        {showPersonalTracking ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Feather name="clock" size={16} color="#0f172a" />
              <Text style={styles.cardTitle}>My Active Session</Text>
            </View>

            {activeEntry ? (
              <>
                <Text style={styles.metaText}>
                  Started:{" "}
                  {formatDateTime(activeEntry.clockInAt, displayTimeZone)}
                </Text>
                <Text style={styles.metaText}>
                  Elapsed:{" "}
                  {formatElapsedFromNow(activeEntry.clockInAt, windowNow)}
                </Text>
                <Text style={styles.metaText}>
                  Breaks: {getBreakSummary(activeEntry, displayTimeZone)}
                </Text>
                {activeEntry.scheduleId &&
                typeof activeEntry.scheduleId === "object" &&
                activeEntry.scheduleId.startTime &&
                activeEntry.scheduleId.endTime ? (
                  <Text style={styles.metaText}>
                    Shift Window:{" "}
                    {formatSessionWindow(
                      activeEntry.scheduleId,
                      displayTimeZone,
                    )}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.metaText}>
                  No active session right now.
                </Text>
                <Text style={styles.metaText}>
                  {clockInWindowState.nextSchedule
                    ? `Next session: ${formatSessionWindow(clockInWindowState.nextSchedule, displayTimeZone)}`
                    : "No upcoming schedule."}
                </Text>
                {!clockInWindowState.available ? (
                  <Text style={styles.metaText}>
                    {clockInWindowState.reason === "no_upcoming_schedule"
                      ? "Clock In is unavailable because there is no upcoming schedule in your allowed window."
                      : clockInWindowState.nextAvailableAt
                        ? `Clock In will be available at ${formatDateTime(clockInWindowState.nextAvailableAt, displayTimeZone)} based on your shift window.`
                        : "Clock In is unavailable outside your allowed shift window."}
                  </Text>
                ) : (
                  <Text style={styles.metaText}>
                    Clock In is available now.
                  </Text>
                )}
                {entries[0]?.clockOutAt ? (
                  <Text style={styles.metaText}>
                    Last clock-out:{" "}
                    {formatDateTime(entries[0].clockOutAt, displayTimeZone)}
                  </Text>
                ) : null}
              </>
            )}

            {requiresLocation ? (
              <View style={styles.infoBannerAlt}>
                <Text style={styles.infoBannerTextAlt}>
                  Location access is requested only when you clock in or out.
                </Text>
              </View>
            ) : null}

            <View style={styles.actionsWrap}>
              <Pressable
                style={[
                  styles.actionBtn,
                  !canClockIn || submitting
                    ? styles.btnDisabled
                    : { backgroundColor: brand.primary },
                ]}
                disabled={!canClockIn || submitting}
                onPress={handleClockIn}
              >
                <Text
                  style={[
                    styles.actionBtnTextPrimary,
                    canClockIn && !submitting
                      ? { color: brand.onPrimary }
                      : null,
                  ]}
                >
                  {requiresLocation ? "Locate & Clock In" : "Clock In"}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.actionBtn,
                  !canStartBreak || submitting
                    ? styles.btnDisabled
                    : styles.btnSecondary,
                ]}
                disabled={!canStartBreak || submitting}
                onPress={handleStartBreak}
              >
                <Text style={styles.actionBtnTextSecondary}>Start Break</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.actionBtn,
                  !canEndBreak || submitting
                    ? styles.btnDisabled
                    : styles.btnSecondary,
                ]}
                disabled={!canEndBreak || submitting}
                onPress={handleEndBreak}
              >
                <Text style={styles.actionBtnTextSecondary}>End Break</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.actionBtn,
                  !canClockOut || submitting
                    ? styles.btnDisabled
                    : styles.btnDanger,
                ]}
                disabled={!canClockOut || submitting}
                onPress={handleClockOut}
              >
                <Text style={styles.actionBtnTextPrimary}>
                  {requiresLocation ? "Locate & Clock Out" : "Clock Out"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {showPersonalTracking ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>My Time Entries</Text>

            {entries.length === 0 ? (
              <Text style={styles.emptyText}>No time entries yet.</Text>
            ) : (
              <View style={styles.entryList}>
                {entries.slice(0, 10).map((entry, index) => {
                  const breakCount = Array.isArray(entry?.breaks)
                    ? entry.breaks.length
                    : 0;
                  const displayStatus = getDisplayAttendanceStatus(entry);
                  const statusStyle = getStatusStyle(displayStatus);

                  return (
                    <View
                      key={entry._id || `${entry.clockInAt}-${index}`}
                      style={styles.entryCard}
                    >
                      <View style={styles.entryTopRow}>
                        <View style={styles.entryTextWrap}>
                          <Text style={styles.entryTitleText}>
                            {formatDateTime(entry.clockInAt, displayTimeZone)}{" "}
                            to{" "}
                            {formatDateTime(entry.clockOutAt, displayTimeZone)}
                          </Text>
                          <Text style={styles.entryMetaText}>
                            Breaks: {breakCount} | Worked:{" "}
                            {formatMinutes(getWorkedMinutes(entry))}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusTag,
                            {
                              borderColor: statusStyle.border,
                              backgroundColor: statusStyle.bg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusTagText,
                              { color: statusStyle.text },
                            ]}
                          >
                            {formatStatusLabel(displayStatus)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {isAdmin ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Attendance Monitor</Text>

            {adminEntries.length === 0 ? (
              <Text style={styles.emptyText}>
                No entries found for this facility.
              </Text>
            ) : (
              <View style={styles.entryList}>
                {adminEntries.slice(0, 20).map((entry, index) => {
                  const displayStatus = getDisplayAttendanceStatus(entry);
                  const statusStyle = getStatusStyle(displayStatus);
                  const staffName =
                    (typeof entry.staffId === "object" &&
                      entry.staffId?.name) ||
                    entry.staff?.name ||
                    entry.staffName ||
                    "Staff";

                  return (
                    <View
                      key={entry._id || `${entry.clockInAt}-${index}`}
                      style={styles.entryCard}
                    >
                      <View style={styles.entryTopRow}>
                        <View style={styles.entryTextWrap}>
                          <Text style={styles.entryTitleText}>{staffName}</Text>
                          <Text style={styles.entryMetaText}>
                            In:{" "}
                            {formatDateTime(entry.clockInAt, displayTimeZone)}
                          </Text>
                          <Text style={styles.entryMetaText}>
                            Out:{" "}
                            {formatDateTime(entry.clockOutAt, displayTimeZone)}
                          </Text>
                          <Text style={styles.entryMetaText}>
                            Worked: {formatMinutes(getWorkedMinutes(entry))}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusTag,
                            {
                              borderColor: statusStyle.border,
                              backgroundColor: statusStyle.bg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusTagText,
                              { color: statusStyle.text },
                            ]}
                          >
                            {formatStatusLabel(displayStatus)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  refreshBtnText: {
    color: "#1f2937",
    fontSize: 12,
    fontWeight: "700",
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  modePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modePillNeutral: {
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  modePillNeutralText: {
    color: "#334155",
  },
  modePillInfo: {
    borderColor: "#93c5fd",
    backgroundColor: "#dbeafe",
  },
  modePillInfoText: {
    color: "#1d4ed8",
  },
  modePillWarn: {
    borderColor: "#fcd34d",
    backgroundColor: "#fef3c7",
  },
  modePillWarnText: {
    color: "#92400e",
  },
  error: {
    color: "#b91c1c",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  success: {
    color: "#166534",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#86efac",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  infoBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoBannerText: {
    color: "#1e3a8a",
    fontSize: 12,
    lineHeight: 18,
  },
  infoBannerAlt: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  infoBannerTextAlt: {
    color: "#1d4ed8",
    fontSize: 12,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  metaText: {
    color: "#475569",
    fontSize: 12,
  },
  actionsWrap: {
    marginTop: 4,
    gap: 8,
  },
  actionBtn: {
    minHeight: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  btnPrimary: {
    backgroundColor: "#2563eb",
  },
  btnDanger: {
    backgroundColor: "#dc2626",
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  btnDisabled: {
    opacity: 0.6,
    backgroundColor: "#cbd5e1",
    borderColor: "#cbd5e1",
  },
  actionBtnTextPrimary: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  actionBtnTextSecondary: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 12,
  },
  entryList: {
    gap: 8,
  },
  entryCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    padding: 10,
  },
  entryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  entryTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  entryTitleText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  entryMetaText: {
    color: "#475569",
    fontSize: 11,
  },
  statusTag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  qrWrap: {
    width: 220,
    height: 220,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    padding: 8,
  },
  qrImage: {
    width: "100%",
    height: "100%",
  },
  tokenBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    padding: 10,
    gap: 4,
  },
  tokenLabel: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  tokenValue: {
    color: "#0f172a",
    fontSize: 12,
  },
});
