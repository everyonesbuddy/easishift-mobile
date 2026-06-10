import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import api from "@/config/api";
import {
  getRoleColor,
  getRoleDisplayName,
  getUnitAreaDisplayName,
  isRoleCompatible,
} from "@/constants/industry-roles";

type Props = {
  isAdmin: boolean;
  userId?: string;
};

type Shift = {
  _id?: string;
  startTime?: string | Date;
  endTime?: string | Date;
  status?: string;
  notes?: string;
  role?: string;
  staffId?:
    | string
    | {
        _id?: string;
        role?: string;
        name?: string;
        firstName?: string;
        lastName?: string;
      };
};

type Coverage = {
  _id?: string;
  startTime?: string | Date;
  endTime?: string | Date;
  role?: string;
  requiredCount?: number;
  unitArea?: string;
};

function pad2(n: number) {
  return `${n}`.padStart(2, "0");
}

function parseBackendDate(value: string | Date) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return new Date(trimmed);
  }

  const normalized = trimmed.replace(" ", "T");

  if (/[zZ]$/.test(normalized) || /[+-]\d\d:\d\d$/.test(normalized)) {
    return new Date(normalized);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(`${normalized}T00:00:00Z`);
  }

  return new Date(`${normalized}Z`);
}

function parseLocalDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day);
}

function getLocalDayKey(date: Date | string) {
  const d = parseBackendDate(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const diff = d.getDate() - d.getDay();
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays() {
  const sunday = startOfWeek(new Date());
  return Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + index);
    day.setHours(0, 0, 0, 0);
    return day;
  });
}

function formatDate(value: string | Date) {
  const d =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseLocalDayKey(value)
      : parseBackendDate(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatDayLabel(value: string | Date) {
  const d =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseLocalDayKey(value)
      : parseBackendDate(value);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function formatTime(value: string | Date) {
  const d = parseBackendDate(value);
  return d
    .toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s/g, "");
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function splitShiftByDay(
  input: { startTime: Date; endTime: Date } & Record<string, unknown>,
) {
  const start = parseBackendDate(input.startTime);
  const end = parseBackendDate(input.endTime);
  const parts: Record<string, unknown>[] = [];

  let current = new Date(start);
  while (current < end) {
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);
    const endPart = end < dayEnd ? end : dayEnd;

    parts.push({
      ...input,
      start: new Date(current),
      end: new Date(endPart),
      dayKey: getLocalDayKey(current),
    });

    current = new Date(endPart.getTime() + 1);
  }

  return parts;
}

export default function ScheduleAndCoverageCharts({ isAdmin, userId }: Props) {
  const [schedules, setSchedules] = useState<Shift[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [selectedCoverageRole, setSelectedCoverageRole] = useState("all");
  const [selectedOvertimeRole, setSelectedOvertimeRole] = useState("all");
  const [coverageStartDate, setCoverageStartDate] = useState("");
  const [coverageEndDate, setCoverageEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  const weekDays = useMemo(() => getWeekDays(), []);
  const weekDayKeys = useMemo(
    () => new Set(weekDays.map((d) => getLocalDayKey(d))),
    [weekDays],
  );

  const weekRangeLabel = useMemo(() => {
    if (!weekDays.length) return "";
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const firstLabel = weekDays[0].toLocaleDateString(undefined, {
      weekday: "short",
      ...opts,
    });
    const lastLabel = weekDays[6].toLocaleDateString(undefined, {
      weekday: "short",
      ...opts,
    });
    return `${firstLabel} – ${lastLabel}`;
  }, [weekDays]);

  useEffect(() => {
    if (!weekDays.length) return;
    if (!coverageStartDate) setCoverageStartDate(getLocalDayKey(weekDays[0]));
    if (!coverageEndDate) setCoverageEndDate(getLocalDayKey(weekDays[6]));
  }, [weekDays, coverageStartDate, coverageEndDate]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const scheduleURL = isAdmin
          ? "/schedules"
          : `/schedules?staffId=${userId ?? ""}`;
        const [scheduleRes, coverageRes] = await Promise.all([
          api.get(scheduleURL),
          api.get("/coverage"),
        ]);

        setSchedules(
          Array.isArray(scheduleRes.data)
            ? scheduleRes.data.map((item) => ({
                ...item,
                startTime: item?.startTime
                  ? parseBackendDate(item.startTime)
                  : item?.startTime,
                endTime: item?.endTime
                  ? parseBackendDate(item.endTime)
                  : item?.endTime,
              }))
            : [],
        );
        setCoverage(
          Array.isArray(coverageRes.data)
            ? coverageRes.data.map((item) => ({
                ...item,
                startTime: item?.startTime
                  ? parseBackendDate(item.startTime)
                  : item?.startTime,
                endTime: item?.endTime
                  ? parseBackendDate(item.endTime)
                  : item?.endTime,
              }))
            : [],
        );
      } catch (error) {
        console.warn("Failed to load dashboard charts", error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAdmin, userId]);

  const coverageNormalized = useMemo(() => {
    return coverage.flatMap((c) => {
      if (!c.startTime || !c.endTime) {
        return [];
      }

      return splitShiftByDay({
        ...c,
        startTime: new Date(c.startTime),
        endTime: new Date(c.endTime),
      }).map((part) => ({
        ...part,
        _id: c._id,
        dayKey: part.dayKey as string,
        startTime: part.start as Date,
        endTime: part.end as Date,
        role: c.role,
        requiredCount: c.requiredCount ?? 0,
        unitArea: c.unitArea,
      }));
    });
  }, [coverage]);

  const schedulesNormalized = useMemo(() => {
    return schedules.flatMap((s) => {
      if (!s.startTime || !s.endTime) {
        return [];
      }

      return splitShiftByDay({
        ...s,
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
      }).map((part) => ({
        ...part,
        _id: s._id,
        dayKey: part.dayKey as string,
        start: part.start as Date,
        end: part.end as Date,
        role: s.role,
        status: s.status,
        staffId: s.staffId,
        notes: s.notes,
        staffRole: typeof s.staffId === "object" ? s.staffId?.role : s.role,
      }));
    });
  }, [schedules]);

  const rolesWithCoverage = useMemo(() => {
    const allRoles = Array.from(
      new Set([
        ...coverageNormalized.map((item) => item.role),
        ...schedulesNormalized.map((item) => item.staffRole || item.role),
      ]),
    ).filter((r): r is string => typeof r === "string" && Boolean(r));

    const setCoverageRoles = new Set(
      coverageNormalized
        .map((c) => c.role)
        .filter((r): r is string => typeof r === "string"),
    );

    return allRoles.filter((r) =>
      Array.from(setCoverageRoles).some((coverageRole) =>
        isRoleCompatible(r, coverageRole),
      ),
    );
  }, [coverageNormalized, schedulesNormalized]);

  const consolidatedCoverageWithStaffing = useMemo(() => {
    if (!isAdmin) {
      return [];
    }

    const startKey =
      coverageStartDate && coverageEndDate
        ? coverageStartDate <= coverageEndDate
          ? coverageStartDate
          : coverageEndDate
        : coverageStartDate || coverageEndDate;

    const endKey =
      coverageStartDate && coverageEndDate
        ? coverageStartDate <= coverageEndDate
          ? coverageEndDate
          : coverageStartDate
        : coverageEndDate || coverageStartDate;

    return coverageNormalized
      .filter((cov) => {
        const inRole =
          selectedCoverageRole === "all" ||
          isRoleCompatible(cov.role, selectedCoverageRole);
        const inStartRange = startKey ? cov.dayKey >= startKey : true;
        const inEndRange = endKey ? cov.dayKey <= endKey : true;
        return inRole && inStartRange && inEndRange;
      })
      .sort((a, b) =>
        a.dayKey === b.dayKey
          ? a.startTime.getTime() - b.startTime.getTime()
          : a.dayKey.localeCompare(b.dayKey),
      )
      .map((cov, idx) => {
        const assignedCount = schedulesNormalized.filter((s) => {
          const scheduleRole = s.staffRole || s.role;
          const coverageEndMs = cov.endTime.getTime();
          const hasCoverageUnitArea = Boolean(cov.unitArea);
          const unitAreaMatches = hasCoverageUnitArea
            ? normalizeText((s as Record<string, unknown>).unitArea) ===
              normalizeText(cov.unitArea)
            : true;
          return (
            s.dayKey === cov.dayKey &&
            s.start.getTime() === cov.startTime.getTime() &&
            s.end.getTime() === coverageEndMs &&
            s.status !== "call_out" &&
            unitAreaMatches &&
            isRoleCompatible(scheduleRole, cov.role)
          );
        }).length;

        const required = cov.requiredCount || 0;
        const rowKey = [
          cov._id || "coverage",
          cov.dayKey,
          cov.startTime.getTime(),
          cov.endTime.getTime(),
          idx,
        ].join("-");

        return {
          id: rowKey,
          role: cov.role,
          unitArea: cov.unitArea || "",
          dayKey: cov.dayKey,
          shiftStart: cov.startTime,
          shiftEnd: cov.endTime,
          assignedCount,
          requiredStaff: required,
          isUnderstaffed: assignedCount < required,
          isOverstaffed: assignedCount > required,
        };
      });
  }, [
    isAdmin,
    selectedCoverageRole,
    coverageStartDate,
    coverageEndDate,
    coverageNormalized,
    schedulesNormalized,
  ]);

  const consolidatedCoverageSummary = useMemo(() => {
    return consolidatedCoverageWithStaffing.reduce(
      (acc, slot) => {
        if (slot.isUnderstaffed) {
          acc.understaffed += 1;
        } else if (slot.isOverstaffed) {
          acc.overstaffed += 1;
        } else {
          acc.fullyStaffed += 1;
        }
        acc.total += 1;
        return acc;
      },
      { understaffed: 0, fullyStaffed: 0, overstaffed: 0, total: 0 },
    );
  }, [consolidatedCoverageWithStaffing]);

  const weeklyOvertimeData = useMemo(() => {
    if (!isAdmin) {
      return [];
    }

    const totals = new Map<
      string,
      { staffId: string; staffName: string; role?: string; hours: number }
    >();

    schedulesNormalized
      .filter((s) => weekDayKeys.has(s.dayKey) && s.status !== "call_out")
      .forEach((s) => {
        const staffRef = s.staffId;
        const id =
          typeof staffRef === "string"
            ? staffRef
            : staffRef?._id || `${s.staffRole || "staff"}-${s.dayKey}`;

        const name =
          typeof staffRef === "object"
            ? staffRef?.name ||
              [staffRef?.firstName, staffRef?.lastName]
                .filter(Boolean)
                .join(" ") ||
              "Unknown Staff"
            : "Unknown Staff";

        const shiftHours =
          (s.end.getTime() - s.start.getTime()) / (1000 * 60 * 60);

        if (!totals.has(id)) {
          totals.set(id, {
            staffId: id,
            staffName: name,
            role: s.staffRole,
            hours: 0,
          });
        }

        const row = totals.get(id);
        if (row) {
          row.hours += shiftHours;
        }
      });

    return Array.from(totals.values())
      .map((row) => {
        const rounded = Math.round(row.hours * 10) / 10;
        return {
          ...row,
          hours: rounded,
          roleLabel: getRoleDisplayName(row.role),
          isNearOvertime: rounded >= 36 && rounded < 40,
          isOvertime: rounded >= 40,
        };
      })
      .sort((a, b) => b.hours - a.hours);
  }, [isAdmin, schedulesNormalized, weekDayKeys]);

  const filteredWeeklyOvertimeData = useMemo(() => {
    if (!isAdmin) return [];
    return weeklyOvertimeData.filter(
      (row) =>
        selectedOvertimeRole === "all" ||
        isRoleCompatible(row.role, selectedOvertimeRole),
    );
  }, [isAdmin, weeklyOvertimeData, selectedOvertimeRole]);

  const overtimeSummary = useMemo(() => {
    if (!isAdmin || filteredWeeklyOvertimeData.length === 0) {
      return { nearCount: 0, overtimeCount: 0 };
    }
    return {
      nearCount: filteredWeeklyOvertimeData.filter((w) => w.isNearOvertime)
        .length,
      overtimeCount: filteredWeeklyOvertimeData.filter((w) => w.isOvertime)
        .length,
    };
  }, [isAdmin, filteredWeeklyOvertimeData]);

  const todayKey = getLocalDayKey(new Date());

  const todayShift = useMemo(() => {
    if (isAdmin) {
      return null;
    }

    return schedulesNormalized.find(
      (s) => s.dayKey === todayKey && s.status !== "call_out",
    );
  }, [isAdmin, schedulesNormalized, todayKey]);

  const upcomingShifts = useMemo(() => {
    if (isAdmin) {
      return [];
    }

    return schedulesNormalized
      .filter((s) => s.dayKey > todayKey && s.status !== "call_out")
      .sort((a, b) =>
        a.dayKey === b.dayKey
          ? a.start.getTime() - b.start.getTime()
          : a.dayKey.localeCompare(b.dayKey),
      )
      .slice(0, 8);
  }, [isAdmin, schedulesNormalized, todayKey]);

  function getCoverageStatusStyle(
    isUnderstaffed: boolean,
    isOverstaffed: boolean,
  ) {
    if (isUnderstaffed)
      return { bg: "#FEF2F2", accent: "#DC2626", label: "Understaffed" };
    if (isOverstaffed)
      return { bg: "#FFFBEB", accent: "#D97706", label: "Overstaffed" };
    return { bg: "#ECFDF5", accent: "#16A34A", label: "Balanced" };
  }

  function getRelativeDateString(dayKey: string) {
    const d = parseLocalDayKey(dayKey);
    const now = new Date();
    const diff = Math.round(
      (d.getTime() -
        new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff > 1 && diff < 7) return `${diff} days`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatDurationHours(start: Date, end: Date) {
    const h = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (!Number.isFinite(h) || h <= 0) return "";
    return `${Math.round(h * 10) / 10}h`;
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isAdmin ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Coverage Overview</Text>
            <Text style={styles.panelSub}>
              Filter by date range and role, then review each coverage slot
            </Text>

            <View style={styles.dateRangeRow}>
              <TextInput
                value={coverageStartDate}
                onChangeText={setCoverageStartDate}
                placeholder="Start YYYY-MM-DD"
                style={styles.dateInput}
                placeholderTextColor="#94a3b8"
              />
              <TextInput
                value={coverageEndDate}
                onChangeText={setCoverageEndDate}
                placeholder="End YYYY-MM-DD"
                style={styles.dateInput}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsRow}
            >
              <RoleChip
                label="All Roles"
                active={selectedCoverageRole === "all"}
                onPress={() => setSelectedCoverageRole("all")}
              />
              {rolesWithCoverage.map((role) => (
                <RoleChip
                  key={role}
                  label={getRoleDisplayName(role)}
                  active={selectedCoverageRole === role}
                  onPress={() => setSelectedCoverageRole(role)}
                />
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.summaryChipsRow}
            >
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipText}>
                  Slots: {consolidatedCoverageSummary.total}
                </Text>
              </View>
              <View style={[styles.summaryChip, styles.summaryChipRed]}>
                <Text
                  style={[styles.summaryChipText, styles.summaryChipTextRed]}
                >
                  Understaffed: {consolidatedCoverageSummary.understaffed}
                </Text>
              </View>
              <View style={[styles.summaryChip, styles.summaryChipGreen]}>
                <Text
                  style={[styles.summaryChipText, styles.summaryChipTextGreen]}
                >
                  Fully staffed: {consolidatedCoverageSummary.fullyStaffed}
                </Text>
              </View>
              <View style={[styles.summaryChip, styles.summaryChipYellow]}>
                <Text
                  style={[styles.summaryChipText, styles.summaryChipTextYellow]}
                >
                  Overstaffed: {consolidatedCoverageSummary.overstaffed}
                </Text>
              </View>
            </ScrollView>

            {consolidatedCoverageWithStaffing.length === 0 ? (
              <EmptyBlock text="No coverage requirements in this range." />
            ) : (
              <OverflowScrollView
                maxHeight={340}
                contentContainerStyle={styles.listWrap}
              >
                {consolidatedCoverageWithStaffing.map((slot) => {
                  const status = getCoverageStatusStyle(
                    slot.isUnderstaffed,
                    slot.isOverstaffed,
                  );
                  const pct =
                    slot.requiredStaff > 0
                      ? (slot.assignedCount / slot.requiredStaff) * 100
                      : 0;

                  return (
                    <View
                      key={slot.id}
                      style={[styles.covCard, { backgroundColor: status.bg }]}
                    >
                      <View style={styles.covCardTop}>
                        <View style={styles.infoLeft}>
                          <View style={styles.rowTop}>
                            <View
                              style={[
                                styles.roleDot,
                                { backgroundColor: getRoleColor(slot.role) },
                              ]}
                            />
                            <Text style={styles.infoTitle}>
                              {getRoleDisplayName(slot.role)}
                            </Text>
                            <Text style={styles.covDate}>
                              {formatDate(slot.dayKey)}
                            </Text>
                          </View>
                          <Text style={styles.infoMuted}>
                            {formatTime(slot.shiftStart)} –{" "}
                            {formatTime(slot.shiftEnd)}
                          </Text>
                          {slot.unitArea ? (
                            <Text style={styles.infoMuted}>
                              Unit Area: {getUnitAreaDisplayName(slot.unitArea)}
                            </Text>
                          ) : null}
                        </View>
                        <View
                          style={[
                            styles.statusChip,
                            { borderColor: status.accent },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusChipText,
                              { color: status.accent },
                            ]}
                          >
                            {status.label}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.progressSection}>
                        <View style={styles.progressLabelRow}>
                          <Text style={styles.progressLabel}>
                            Assigned vs required
                          </Text>
                          <Text style={styles.progressCount}>
                            {slot.assignedCount} / {slot.requiredStaff}
                          </Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${Math.min(100, pct)}%`,
                                backgroundColor: status.accent,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </OverflowScrollView>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Weekly Overtime Tracker</Text>
            <Text style={styles.panelSub}>
              Scheduled hours this week ({weekRangeLabel})
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsRow}
            >
              <RoleChip
                label="All Roles"
                active={selectedOvertimeRole === "all"}
                onPress={() => setSelectedOvertimeRole("all")}
              />
              {rolesWithCoverage.map((role) => (
                <RoleChip
                  key={role}
                  label={getRoleDisplayName(role)}
                  active={selectedOvertimeRole === role}
                  onPress={() => setSelectedOvertimeRole(role)}
                />
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.summaryChipsRow}
            >
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipText}>
                  Staff tracked: {filteredWeeklyOvertimeData.length}
                </Text>
              </View>
              <View style={[styles.summaryChip, styles.summaryChipYellow]}>
                <Text
                  style={[styles.summaryChipText, styles.summaryChipTextYellow]}
                >
                  Near overtime: {overtimeSummary.nearCount}
                </Text>
              </View>
              <View style={[styles.summaryChip, styles.summaryChipRed]}>
                <Text
                  style={[styles.summaryChipText, styles.summaryChipTextRed]}
                >
                  Overtime: {overtimeSummary.overtimeCount}
                </Text>
              </View>
            </ScrollView>

            {filteredWeeklyOvertimeData.length === 0 ? (
              <EmptyBlock text="No matching staff for this filter." />
            ) : (
              <OverflowScrollView
                maxHeight={240}
                contentContainerStyle={styles.listWrap}
              >
                {filteredWeeklyOvertimeData.map((row) => {
                  const accent = row.isOvertime
                    ? "#f44336"
                    : row.isNearOvertime
                      ? "#f9a825"
                      : "#66bb6a";
                  const bg = row.isOvertime
                    ? "#ffebee"
                    : row.isNearOvertime
                      ? "#fff8e1"
                      : "#e8f5e9";
                  const statusLabel = row.isOvertime
                    ? "Overtime"
                    : row.isNearOvertime
                      ? "Near 40h"
                      : "Within target";

                  return (
                    <View
                      key={row.staffId}
                      style={[styles.covCard, { backgroundColor: bg }]}
                    >
                      <View style={styles.covCardTop}>
                        <View style={styles.infoLeft}>
                          <Text style={styles.infoTitle}>{row.staffName}</Text>
                          <Text style={styles.infoMuted}>{row.roleLabel}</Text>
                        </View>
                        <View>
                          <Text style={[styles.infoCount, { color: accent }]}>
                            {row.hours}h
                          </Text>
                          <Text style={[styles.statusLabel, { color: accent }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(100, (row.hours / 40) * 100)}%`,
                              backgroundColor: accent,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </OverflowScrollView>
            )}
          </View>
        </>
      ) : (
        <>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Today&apos;s Shift</Text>
            {todayShift ? (
              <View
                style={[
                  styles.covCard,
                  {
                    backgroundColor: "#e3f2fd",
                    borderLeftWidth: 4,
                    borderLeftColor: "#1e88e5",
                  },
                ]}
              >
                <View style={styles.covCardTop}>
                  <View style={styles.infoLeft}>
                    <Text style={styles.infoTitle}>
                      {formatDate(todayShift.dayKey)}
                    </Text>
                    <Text style={styles.infoMuted}>
                      {getRoleDisplayName(todayShift.staffRole)}
                    </Text>
                  </View>
                  <View style={styles.roleTag}>
                    <Text style={styles.roleTagText}>Today</Text>
                  </View>
                </View>
                <View style={styles.shiftTimeRow}>
                  <Feather name="clock" size={13} color="#475569" />
                  <Text style={styles.infoMuted}>
                    {formatTime(todayShift.start)} –{" "}
                    {formatTime(todayShift.end)}
                  </Text>
                </View>
              </View>
            ) : (
              <EmptyBlock text="No shift scheduled for today." />
            )}
          </View>

          <View style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <Text style={styles.panelTitle}>Upcoming Shifts</Text>
              <Text style={styles.panelSub}>
                {upcomingShifts.length} shifts
              </Text>
            </View>
            {upcomingShifts.length === 0 ? (
              <EmptyBlock text="No upcoming shifts." />
            ) : (
              <View style={styles.listWrap}>
                {upcomingShifts.map((shift) => (
                  <View
                    key={[
                      shift._id || "shift",
                      shift.dayKey,
                      shift.start.getTime(),
                      shift.end.getTime(),
                      shift.staffRole || shift.role || "role",
                    ].join("-")}
                    style={[styles.covCard, { backgroundColor: "#F8FAFC" }]}
                  >
                    <View style={styles.covCardTop}>
                      <View style={styles.infoLeft}>
                        <Text style={styles.infoTitle}>
                          {formatDate(shift.dayKey)}
                        </Text>
                        <Text style={styles.infoMuted}>
                          {getRelativeDateString(shift.dayKey)}
                        </Text>
                      </View>
                      <View style={styles.roleTag}>
                        <Text style={styles.roleTagText}>
                          {getRoleDisplayName(shift.staffRole)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.shiftTimeRow}>
                      <Feather name="clock" size={13} color="#475569" />
                      <Text style={styles.infoMuted}>
                        {formatTime(shift.start)} – {formatTime(shift.end)}
                      </Text>
                      <Text style={styles.durationText}>
                        ({formatDurationHours(shift.start, shift.end)})
                      </Text>
                      <View
                        style={[
                          styles.roleDot,
                          { backgroundColor: getRoleColor(shift.staffRole) },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function RoleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, active ? styles.chipActive : null]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Feather name="calendar" size={34} color="#9ca3af" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function OverflowScrollView({
  children,
  contentContainerStyle,
  maxHeight,
}: {
  children: React.ReactNode;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  maxHeight: number;
}) {
  const [containerHeight, setContainerHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const canScroll = contentHeight > containerHeight + 1;

  return (
    <ScrollView
      nestedScrollEnabled
      scrollEnabled={canScroll}
      showsVerticalScrollIndicator={canScroll}
      persistentScrollbar={canScroll}
      indicatorStyle="black"
      style={[styles.scrollPanel, { maxHeight }]}
      contentContainerStyle={contentContainerStyle}
      onLayout={(event) => setContainerHeight(event.nativeEvent.layout.height)}
      onContentSizeChange={(_, height) => setContentHeight(height)}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    gap: 12,
  },
  loadingWrap: {
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 14,
    gap: 10,
  },
  panelTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  panelSub: {
    color: "#6b7280",
    fontSize: 13,
  },
  chipsRow: {
    flexGrow: 0,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginRight: 8,
    backgroundColor: "#ffffff",
  },
  chipActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  chipText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#1d4ed8",
    fontWeight: "600",
  },
  listWrap: {
    gap: 8,
  },
  scrollPanel: {
    paddingRight: 2,
  },
  infoRow: {
    padding: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  infoLeft: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  infoTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  infoMuted: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  infoCount: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 13,
  },
  dateRangeRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  summaryChipsRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 2,
  },
  summaryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
  },
  summaryChipRed: { backgroundColor: "#FEF2F2" },
  summaryChipGreen: { backgroundColor: "#ECFDF5" },
  summaryChipYellow: { backgroundColor: "#FFFBEB" },
  summaryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  summaryChipTextRed: { color: "#B91C1C" },
  summaryChipTextGreen: { color: "#166534" },
  summaryChipTextYellow: { color: "#92400E" },
  covCard: {
    borderRadius: 10,
    padding: 11,
    gap: 8,
  },
  covCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  covDate: {
    color: "#64748b",
    fontSize: 12,
  },
  statusChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#ffffff",
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
  },
  progressSection: {
    gap: 4,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    color: "#64748b",
    fontSize: 11,
  },
  progressCount: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: 7,
    borderRadius: 999,
  },
  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
  },
  roleTagText: {
    color: "#1E3A8A",
    fontSize: 11,
    fontWeight: "700",
  },
  shiftTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  durationText: {
    color: "#64748b",
    fontSize: 12,
  },
});
