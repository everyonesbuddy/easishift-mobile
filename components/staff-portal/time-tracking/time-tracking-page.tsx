import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import QrScannerDialog from "@/components/shared/qr-scanner-dialog";
import api from "@/config/api";
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
  attendanceOutcome?: "in_progress" | "completed" | "left_early" | string;
  clockInAt?: string;
  clockOutAt?: string;
  breaks?: TimeBreak[];
  scheduleId?:
    | {
        _id?: string;
        role?: string;
        startTime?: string;
        endTime?: string;
        status?: string;
      }
    | string
    | null;
  createdAt?: string;
};

type ScheduleSummary = {
  _id?: string;
  role?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
};

type TimeTrackingPrefs = {
  enabled?: boolean;
  mode?: string;
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
  left_early: {
    text: "#5b21b6",
    bg: "#ede9fe",
    border: "#c4b5fd",
  },
  no_show: {
    text: "#991b1b",
    bg: "#fee2e2",
    border: "#fecaca",
  },
};

const SOURCE = "mobile";
const QR_STATION_POLL_INTERVAL_MS = 5000;

function toIsoNow() {
  return new Date().toISOString();
}

function formatDateTime(value: unknown) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
}

function getAttendanceStatus(entry: TimeEntry) {
  const outcome = String(entry.attendanceOutcome || "").trim();
  if (outcome) {
    return outcome;
  }

  return String(entry.status || "unknown");
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

  return fallback;
}

function normalizeTrackingMode(mode: unknown) {
  const normalized = String(mode || "open")
    .trim()
    .toLowerCase();
  if (normalized === "geofence") {
    return "qr";
  }

  if (normalized === "manual") {
    return "open";
  }

  return normalized === "qr" ? "qr" : "open";
}

function getOpenBreak(entry: TimeEntry | null) {
  if (!entry || !Array.isArray(entry.breaks)) {
    return null;
  }

  return entry.breaks.find((item) => item && !item.endAt) || null;
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

function isScheduleClockInEligible(
  schedule: ScheduleSummary | null,
  clockInGraceMinutes: number,
  clockOutGraceMinutes: number,
) {
  if (!schedule?.startTime || !schedule?.endTime) {
    return false;
  }

  const start = new Date(schedule.startTime);
  const end = new Date(schedule.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  const now = new Date();
  const earlyBoundary = new Date(
    start.getTime() - clockOutGraceMinutes * 60 * 1000,
  );
  const lateBoundary = new Date(
    end.getTime() + clockInGraceMinutes * 60 * 1000,
  );

  return now >= earlyBoundary && now <= lateBoundary;
}

export default function TimeTrackingPage() {
  const { user, isAdmin, facilityPreferences, fetchFacilityPreferences } =
    useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [nextSchedule, setNextSchedule] = useState<ScheduleSummary | null>(
    null,
  );
  const [adminEntries, setAdminEntries] = useState<TimeEntry[]>([]);
  const [qrScanAction, setQrScanAction] = useState<
    "clock-in" | "clock-out" | null
  >(null);
  const [qrStationToken, setQrStationToken] = useState("");
  const [qrTokenVersion, setQrTokenVersion] = useState<number | null>(null);

  const trackingConfig = (facilityPreferences?.timeTracking ||
    {}) as TimeTrackingPrefs;
  const trackingEnabled = Boolean(trackingConfig.enabled);
  const trackingMode = normalizeTrackingMode(trackingConfig.mode);
  const requiresQrToken = trackingMode === "qr";
  const requireScheduleMatch = Boolean(trackingConfig.requireScheduleMatch);
  const clockInGraceMinutes = Number.isFinite(
    Number(trackingConfig.clockInGraceMinutes),
  )
    ? Number(trackingConfig.clockInGraceMinutes)
    : 15;
  const clockOutGraceMinutes = Number.isFinite(
    Number(trackingConfig.clockOutGraceMinutes),
  )
    ? Number(trackingConfig.clockOutGraceMinutes)
    : 30;

  const openBreak = useMemo(() => getOpenBreak(activeEntry), [activeEntry]);

  const loadStaffEntries = useCallback(async () => {
    const res = await api.get("/time-tracking/me");
    const normalizedEntries = safeSortByClockInDesc(
      normalizeEntriesFromResponse(res.data),
    );
    setEntries(normalizedEntries);
    setActiveEntry(getActiveEntryFromResponse(res.data, normalizedEntries));
  }, []);

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

  const loadNextSchedule = useCallback(async () => {
    if (isAdmin || !user?._id) {
      setNextSchedule(null);
      return;
    }

    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const res = await api.get("/schedules", {
        params: {
          staffId: user._id,
          from: windowStart.toISOString(),
        },
      });

      const schedules = Array.isArray(res.data)
        ? (res.data as ScheduleSummary[])
        : [];

      const next = schedules
        .filter((item) => {
          const status = String(item?.status || "scheduled").toLowerCase();
          return ["scheduled", "in_progress"].includes(status);
        })
        .filter((item) => {
          if (!item?.startTime || !item?.endTime) {
            return false;
          }

          const start = new Date(item.startTime).getTime();
          const end = new Date(item.endTime).getTime();
          return (
            Number.isFinite(start) &&
            Number.isFinite(end) &&
            end >= windowStart.getTime()
          );
        })
        .sort(
          (a, b) =>
            new Date(a.startTime || "").getTime() -
            new Date(b.startTime || "").getTime(),
        )
        .find((item) => {
          const end = new Date(item.endTime || "").getTime();
          return end >= now.getTime();
        });

      setNextSchedule(next || null);
    } catch {
      setNextSchedule(null);
    }
  }, [isAdmin, user?._id]);

  const applyNextQrToken = useCallback((payload: unknown) => {
    const source =
      payload && typeof payload === "object"
        ? (payload as {
            nextQrToken?: unknown;
            token?: unknown;
            nextQrTokenVersion?: unknown;
            tokenVersion?: unknown;
          })
        : {};

    const nextToken = String(source.nextQrToken || source.token || "").trim();
    const nextVersionRaw =
      source.nextQrTokenVersion !== undefined
        ? source.nextQrTokenVersion
        : source.tokenVersion;

    if (nextToken) {
      setQrStationToken(nextToken);
    }

    if (nextVersionRaw !== undefined && nextVersionRaw !== null) {
      const nextVersion = Number(nextVersionRaw);
      setQrTokenVersion(Number.isFinite(nextVersion) ? nextVersion : null);
    }
  }, []);

  const refreshQrStationToken = useCallback(async () => {
    setRefreshing(true);
    setError("");

    try {
      const tokenRes = await api.post("/time-tracking/qr-token");
      applyNextQrToken(tokenRes.data);
      setSuccess("QR token rotated successfully.");
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to rotate QR token"));
    } finally {
      setRefreshing(false);
    }
  }, [applyNextQrToken]);

  const syncCurrentQrStationToken = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      try {
        const tokenRes = await api.get("/time-tracking/qr-token/current");
        applyNextQrToken(tokenRes.data);
      } catch (requestError) {
        if (!silent) {
          setError(
            extractMessage(requestError, "Failed to fetch current QR token"),
          );
        }
      }
    },
    [applyNextQrToken],
  );

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setError("");

    try {
      const latestPrefs = await fetchFacilityPreferences();
      await loadStaffEntries();
      await loadAdminEntries();
      await loadNextSchedule();

      const latestMode = normalizeTrackingMode(
        (latestPrefs?.timeTracking as TimeTrackingPrefs | undefined)?.mode,
      );

      if (isAdmin && latestMode === "qr") {
        await syncCurrentQrStationToken({ silent: true });
      }

      if (isAdmin && latestMode !== "qr") {
        setQrStationToken("");
        setQrTokenVersion(null);
      }
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to refresh time tracking"));
    } finally {
      setRefreshing(false);
    }
  }, [
    fetchFacilityPreferences,
    isAdmin,
    loadAdminEntries,
    loadNextSchedule,
    loadStaffEntries,
    syncCurrentQrStationToken,
  ]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const latestPrefs = await fetchFacilityPreferences();
        const latestMode = normalizeTrackingMode(
          (latestPrefs?.timeTracking as TimeTrackingPrefs | undefined)?.mode,
        );

        await loadStaffEntries();
        await loadAdminEntries();
        await loadNextSchedule();

        if (isAdmin && latestMode === "qr") {
          await syncCurrentQrStationToken({ silent: true });
        } else if (mounted) {
          setQrStationToken("");
          setQrTokenVersion(null);
        }
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
    isAdmin,
    loadAdminEntries,
    loadNextSchedule,
    loadStaffEntries,
    syncCurrentQrStationToken,
  ]);

  useEffect(() => {
    if (!isAdmin || !requiresQrToken || !trackingEnabled) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      syncCurrentQrStationToken({ silent: true });
    }, QR_STATION_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAdmin, requiresQrToken, syncCurrentQrStationToken, trackingEnabled]);

  const submitClockIn = async (qrToken = "") => {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post("/time-tracking/clock-in", {
        at: toIsoNow(),
        source: SOURCE,
        ...(requiresQrToken ? { qrToken: String(qrToken || "").trim() } : {}),
      });
      applyNextQrToken(res.data);
      setSuccess("Clocked in successfully.");
      await refreshAll();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to clock in"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockIn = async () => {
    if (requiresQrToken) {
      setQrScanAction("clock-in");
      return;
    }

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

  const submitClockOut = async (qrToken = "") => {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post("/time-tracking/clock-out", {
        at: toIsoNow(),
        source: SOURCE,
        ...(requiresQrToken ? { qrToken: String(qrToken || "").trim() } : {}),
      });
      applyNextQrToken(res.data);
      setSuccess("Clocked out successfully.");
      await refreshAll();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to clock out"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    if (requiresQrToken) {
      setQrScanAction("clock-out");
      return;
    }

    await submitClockOut();
  };

  const handleQrScanned = async (token: string) => {
    const action = qrScanAction;
    const trimmedToken = String(token || "").trim();
    setQrScanAction(null);

    if (!trimmedToken) {
      setError("Invalid QR code. Please try again.");
      return;
    }

    if (action === "clock-in") {
      await submitClockIn(trimmedToken);
      return;
    }

    if (action === "clock-out") {
      await submitClockOut(trimmedToken);
    }
  };

  const scheduleEligibleForClockIn = isScheduleClockInEligible(
    nextSchedule,
    clockInGraceMinutes,
    clockOutGraceMinutes,
  );
  const canClockIn =
    !activeEntry && (!requireScheduleMatch || scheduleEligibleForClockIn);
  const canStartBreak = Boolean(activeEntry) && !openBreak;
  const canEndBreak = Boolean(activeEntry) && Boolean(openBreak);
  const canClockOut = Boolean(activeEntry) && !openBreak;
  const showClockInDisabledHint =
    !activeEntry && requireScheduleMatch && !canClockIn;
  const showQrClockInHint = requiresQrToken && !showClockInDisabledHint;
  const linkedSchedule =
    activeEntry?.scheduleId && typeof activeEntry.scheduleId === "object"
      ? activeEntry.scheduleId
      : null;

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
              requiresQrToken ? styles.modePillInfo : styles.modePillNeutral,
            ]}
          >
            <Text
              style={[
                styles.modePillText,
                requiresQrToken
                  ? styles.modePillInfoText
                  : styles.modePillNeutralText,
              ]}
            >
              {requiresQrToken ? "QR Mode" : "Open Mode"}
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

        {requiresQrToken ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>
              QR mode is active. Staff must scan a valid facility QR code to
              clock in and clock out.
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

        {!isAdmin ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Feather name="clock" size={16} color="#0f172a" />
              <Text style={styles.cardTitle}>My Active Session</Text>
            </View>

            {activeEntry ? (
              <>
                <Text style={styles.metaText}>Session Status: In Progress</Text>
                <Text style={styles.metaText}>
                  Clock In: {formatDateTime(activeEntry.clockInAt)}
                </Text>
                <Text style={styles.metaText}>
                  Open Break:{" "}
                  {openBreak
                    ? `Started ${formatDateTime(openBreak.startAt)}`
                    : "No"}
                </Text>

                {linkedSchedule ? (
                  <View style={styles.sessionDetailBox}>
                    <Text style={styles.sessionDetailTitle}>Linked Shift</Text>
                    <Text style={styles.metaText}>
                      Role: {linkedSchedule.role || "-"}
                    </Text>
                    <Text style={styles.metaText}>
                      Start: {formatDateTime(linkedSchedule.startTime)}
                    </Text>
                    <Text style={styles.metaText}>
                      End: {formatDateTime(linkedSchedule.endTime)}
                    </Text>
                    <Text style={styles.metaText}>
                      Shift Status: {String(linkedSchedule.status || "-")}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.metaText}>
                    Linked Shift: None (open clock session)
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.metaText}>
                  No active session right now.
                </Text>

                {nextSchedule ? (
                  <View style={styles.sessionDetailBox}>
                    <Text style={styles.sessionDetailTitle}>Next Shift</Text>
                    <Text style={styles.metaText}>
                      Role: {nextSchedule.role || "-"}
                    </Text>
                    <Text style={styles.metaText}>
                      Start: {formatDateTime(nextSchedule.startTime)}
                    </Text>
                    <Text style={styles.metaText}>
                      End: {formatDateTime(nextSchedule.endTime)}
                    </Text>
                    <Text style={styles.metaText}>
                      Status: {String(nextSchedule.status || "scheduled")}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.metaText}>
                    No upcoming scheduled shift found.
                  </Text>
                )}
              </>
            )}

            {showQrClockInHint ? (
              <View style={styles.infoBannerAlt}>
                <Text style={styles.infoBannerTextAlt}>
                  QR mode: tap Clock In or Clock Out to open your camera and
                  scan when you are in your allowed shift window.
                </Text>
              </View>
            ) : null}

            {showClockInDisabledHint ? (
              <View style={styles.infoBannerAlt}>
                <Text style={styles.infoBannerTextAlt}>
                  Clock in is disabled until you are within your allowed shift
                  window.
                </Text>
              </View>
            ) : null}

            <View style={styles.actionsWrap}>
              <Pressable
                style={[
                  styles.actionBtn,
                  !canClockIn || submitting
                    ? styles.btnDisabled
                    : styles.btnPrimary,
                ]}
                disabled={!canClockIn || submitting}
                onPress={handleClockIn}
              >
                <Text style={styles.actionBtnTextPrimary}>
                  {requiresQrToken ? "Scan to Clock In" : "Clock In"}
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
                  {requiresQrToken ? "Scan to Clock Out" : "Clock Out"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!isAdmin ? (
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
                  const displayStatus = getAttendanceStatus(entry);
                  const statusStyle = getStatusStyle(displayStatus);

                  return (
                    <View
                      key={entry._id || `${entry.clockInAt}-${index}`}
                      style={styles.entryCard}
                    >
                      <View style={styles.entryTopRow}>
                        <View style={styles.entryTextWrap}>
                          <Text style={styles.entryTitleText}>
                            {formatDateTime(entry.clockInAt)} to{" "}
                            {formatDateTime(entry.clockOutAt)}
                          </Text>
                          <Text style={styles.entryMetaText}>
                            Breaks: {breakCount}
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
                            {displayStatus.replace("_", " ")}
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

        {isAdmin && requiresQrToken ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>QR Station</Text>
            <Text style={styles.metaText}>
              Display this token as a QR code at your attendance station.
            </Text>

            {qrStationToken ? (
              <View style={styles.qrWrap}>
                <Image
                  source={{
                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(qrStationToken)}`,
                  }}
                  style={styles.qrImage}
                />
              </View>
            ) : null}

            <View style={styles.tokenBox}>
              <Text style={styles.tokenLabel}>Current QR Token</Text>
              <Text selectable style={styles.tokenValue}>
                {qrStationToken || "No token available"}
              </Text>
            </View>

            {Number.isFinite(Number(qrTokenVersion)) ? (
              <Text style={styles.metaText}>
                Token version: {Number(qrTokenVersion)}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.actionBtn,
                refreshing || submitting
                  ? styles.btnDisabled
                  : styles.btnSecondary,
              ]}
              disabled={refreshing || submitting}
              onPress={refreshQrStationToken}
            >
              <Text style={styles.actionBtnTextSecondary}>Rotate QR Token</Text>
            </Pressable>
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
                  const displayStatus = getAttendanceStatus(entry);
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
                            In: {formatDateTime(entry.clockInAt)}
                          </Text>
                          <Text style={styles.entryMetaText}>
                            Out: {formatDateTime(entry.clockOutAt)}
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
                            {displayStatus.replace("_", " ")}
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

      <QrScannerDialog
        open={Boolean(qrScanAction)}
        onClose={() => setQrScanAction(null)}
        onScan={handleQrScanned}
        title={
          qrScanAction === "clock-out"
            ? "Scan to Clock Out"
            : "Scan to Clock In"
        }
        description="Allow camera access, then point at your facility attendance QR code."
      />
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
  sessionDetailBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  sessionDetailTitle: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
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
