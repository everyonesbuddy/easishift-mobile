import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import api from "@/config/api";

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
};

function pad2(n: number) {
  return `${n}`.padStart(2, "0");
}

function getLocalDayKey(date: Date | string) {
  const d = new Date(date);
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
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDayLabel(value: string | Date) {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function formatTime(value: string | Date) {
  const d = new Date(value);
  return d
    .toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/\s/g, "");
}

function getRoleDisplayName(role?: string) {
  const labels: Record<string, string> = {
    doctor: "Doctor",
    nurse: "Nurse",
    rn: "RN",
    lpn: "LPN",
    cna: "CNA",
    med_aide: "Med Aide",
    caregiver: "Caregiver",
    activity_aide: "Activity Aide",
    dietary_aide: "Dietary Aide",
    housekeeper: "Housekeeper",
    receptionist: "Receptionist",
    billing: "Billing",
    staff: "Staff",
    admin: "Admin",
    other: "Other",
  };
  if (!role) {
    return "Staff";
  }
  return labels[role] ?? role;
}

function getRoleColor(role?: string) {
  switch (role) {
    case "doctor":
      return "#1e88e5";
    case "nurse":
      return "#66bb6a";
    case "rn":
      return "#26a69a";
    case "lpn":
      return "#ffb74d";
    case "cna":
      return "#ffa726";
    case "med_aide":
      return "#ab47bc";
    case "caregiver":
      return "#43a047";
    case "activity_aide":
      return "#26c6da";
    case "dietary_aide":
      return "#fdd835";
    case "housekeeper":
      return "#78909c";
    case "receptionist":
      return "#ffb74d";
    case "billing":
      return "#ab47bc";
    default:
      return "#90a4ae";
  }
}

function splitShiftByDay(
  input: { startTime: Date; endTime: Date } & Record<string, unknown>,
) {
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
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
  const [loading, setLoading] = useState(true);

  const weekDays = useMemo(() => getWeekDays(), []);
  const weekDayKeys = useMemo(
    () => new Set(weekDays.map((d) => getLocalDayKey(d))),
    [weekDays],
  );

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

        setSchedules(Array.isArray(scheduleRes.data) ? scheduleRes.data : []);
        setCoverage(Array.isArray(coverageRes.data) ? coverageRes.data : []);
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
        dayKey: part.dayKey as string,
        startTime: part.start as Date,
        endTime: part.end as Date,
        role: c.role,
        requiredCount: c.requiredCount ?? 0,
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
        dayKey: part.dayKey as string,
        start: part.start as Date,
        end: part.end as Date,
        staffRole: typeof s.staffId === "object" ? s.staffId?.role : s.role,
      }));
    });
  }, [schedules]);

  const rolesWithCoverage = useMemo(() => {
    const setRoles = new Set(
      coverageNormalized
        .map((item) => item.role)
        .filter((role): role is string => typeof role === "string"),
    );
    return Array.from(setRoles.values());
  }, [coverageNormalized]);

  const consolidatedCoverageWithStaffing = useMemo(() => {
    if (!isAdmin) {
      return [];
    }

    return coverageNormalized
      .filter((cov) => weekDayKeys.has(cov.dayKey))
      .filter(
        (cov) =>
          selectedCoverageRole === "all" || cov.role === selectedCoverageRole,
      )
      .sort((a, b) =>
        a.dayKey === b.dayKey
          ? a.startTime.getTime() - b.startTime.getTime()
          : a.dayKey.localeCompare(b.dayKey),
      )
      .map((cov, idx) => {
        const assignedCount = schedulesNormalized.filter((s) => {
          const scheduleRole = s.staffRole || s.role;
          return (
            s.dayKey === cov.dayKey &&
            s.start.getTime() === cov.startTime.getTime() &&
            s.status !== "call_out" &&
            scheduleRole === cov.role
          );
        }).length;

        const required = cov.requiredCount || 0;

        return {
          id: cov._id || `${cov.dayKey}-${cov.role || "role"}-${idx}`,
          role: cov.role,
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
    coverageNormalized,
    schedulesNormalized,
    weekDayKeys,
  ]);

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
      .sort((a, b) => b.hours - a.hours)
      .filter(
        (row) =>
          selectedOvertimeRole === "all" || row.role === selectedOvertimeRole,
      );
  }, [isAdmin, schedulesNormalized, selectedOvertimeRole, weekDayKeys]);

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
              Current-week coverage and staffing status
            </Text>

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

            {consolidatedCoverageWithStaffing.length === 0 ? (
              <EmptyBlock text="No coverage slots found for this filter." />
            ) : (
              <View style={styles.listWrap}>
                {consolidatedCoverageWithStaffing.map((slot) => {
                  const bg = slot.isUnderstaffed
                    ? "#ffebee"
                    : slot.isOverstaffed
                      ? "#fff8e1"
                      : "#e8f5e9";

                  return (
                    <View
                      key={slot.id}
                      style={[styles.infoRow, { backgroundColor: bg }]}
                    >
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
                        </View>
                        <Text style={styles.infoMuted}>
                          {formatDayLabel(slot.dayKey)}{" "}
                          {formatDate(slot.dayKey)} •{" "}
                          {formatTime(slot.shiftStart)} -{" "}
                          {formatTime(slot.shiftEnd)}
                        </Text>
                      </View>

                      <Text style={styles.infoCount}>
                        {slot.assignedCount}/{slot.requiredStaff}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Weekly Overtime Tracker</Text>
            <Text style={styles.panelSub}>Scheduled hours this week</Text>

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

            {weeklyOvertimeData.length === 0 ? (
              <EmptyBlock text="No matching staff for this filter." />
            ) : (
              <View style={styles.listWrap}>
                {weeklyOvertimeData.map((row) => {
                  const bg = row.isOvertime
                    ? "#ffebee"
                    : row.isNearOvertime
                      ? "#fff8e1"
                      : "#e8f5e9";

                  return (
                    <View
                      key={row.staffId}
                      style={[styles.infoRow, { backgroundColor: bg }]}
                    >
                      <View style={styles.infoLeft}>
                        <Text style={styles.infoTitle}>{row.staffName}</Text>
                        <Text style={styles.infoMuted}>{row.roleLabel}</Text>
                      </View>
                      <Text style={styles.infoCount}>{row.hours}h</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Today&apos;s Shift</Text>
            {todayShift ? (
              <View style={[styles.infoRow, { backgroundColor: "#e3f2fd" }]}>
                <View style={styles.infoLeft}>
                  <Text style={styles.infoTitle}>
                    {formatDate(todayShift.dayKey)}
                  </Text>
                  <Text style={styles.infoMuted}>
                    {getRoleDisplayName(todayShift.staffRole)} •{" "}
                    {formatTime(todayShift.start)} -{" "}
                    {formatTime(todayShift.end)}
                  </Text>
                </View>
                <Feather name="calendar" size={18} color="#1565c0" />
              </View>
            ) : (
              <EmptyBlock text="No shift scheduled for today." />
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Upcoming Shifts</Text>
            {upcomingShifts.length === 0 ? (
              <EmptyBlock text="No upcoming shifts." />
            ) : (
              <View style={styles.listWrap}>
                {upcomingShifts.map((shift) => (
                  <View
                    key={
                      shift._id || `${shift.dayKey}-${shift.start.getTime()}`
                    }
                    style={[styles.infoRow, { backgroundColor: "#fafafa" }]}
                  >
                    <View style={styles.infoLeft}>
                      <Text style={styles.infoTitle}>
                        {formatDate(shift.dayKey)}
                      </Text>
                      <Text style={styles.infoMuted}>
                        {getRoleDisplayName(shift.staffRole)} •{" "}
                        {formatTime(shift.start)} - {formatTime(shift.end)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.roleDot,
                        { backgroundColor: getRoleColor(shift.staffRole) },
                      ]}
                    />
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
});
