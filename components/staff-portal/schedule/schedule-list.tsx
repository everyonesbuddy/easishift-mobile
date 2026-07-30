import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import ConfirmDialog from "@/components/shared/confirm-dialog";
import MonthCalendar from "@/components/staff-portal/shared/month-calendar";
import api from "@/config/api";
import {
  getCertificationTagDisplayName,
  getRoleColor,
  getRoleDisplayName,
  getRoleOptionsFromFacilityPreferences,
  getRolesForIndustry,
  getShiftTagDisplayName,
  getShiftTypeDisplayName,
  getUnitAreaDisplayName,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";

import AutoGenerateScheduleForm from "./auto-generate-schedule-form";
import ScheduleForm from "./schedule-form";
import {
  extractStaffId,
  extractStaffName,
  formatLocal,
  ScheduleItem,
  StaffUser,
  STATUS_COLORS,
} from "./schedule-types";
import ShiftSwapRequestModal from "./shift-swap-request-modal";

const STATUS_FILTERS = [
  "",
  "scheduled",
  "in_progress",
  "completed",
  "left_early",
  "no_show",
  "call_out",
] as const;

function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getScheduleCalendarDayKey(schedule: ScheduleItem) {
  const source = schedule.startTime || schedule.createdAt;
  if (!source) {
    return "";
  }

  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return toDayKey(parsed);
}

function getScheduleCalendarDayKeys(schedule: ScheduleItem) {
  const primaryKey = getScheduleCalendarDayKey(schedule);
  if (!primaryKey) {
    return [];
  }

  const keys = [primaryKey];
  const start = new Date(schedule?.startTime || "");
  const end = new Date(schedule?.endTime || "");

  if (
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    start.toDateString() !== end.toDateString()
  ) {
    const endKey = toDayKey(end);
    if (endKey && endKey !== primaryKey) {
      keys.push(endKey);
    }
  }

  return keys;
}

function getTimeKey(value?: string) {
  if (!value) {
    return "";
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isOvernightShift(schedule: ScheduleItem) {
  const start = new Date(schedule?.startTime || "");
  const end = new Date(schedule?.endTime || "");

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  return start.toDateString() !== end.toDateString();
}

function formatScheduleTimeRange(
  schedule: ScheduleItem,
  { withNextDayHint = true }: { withNextDayHint?: boolean } = {},
) {
  const start = new Date(schedule?.startTime || "");
  const end = new Date(schedule?.endTime || "");

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "";
  }

  const startLabel = start.toLocaleTimeString("default", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const endLabel = end.toLocaleTimeString("default", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isOvernightShift(schedule) && withNextDayHint) {
    return `${startLabel} - ${endLabel} next day`;
  }

  return `${startLabel} - ${endLabel}`;
}

function formatCertificationTags(schedule: ScheduleItem) {
  if (!Array.isArray(schedule?.certificationTags)) {
    return "-";
  }

  const tags = schedule.certificationTags
    .map((tag) => getCertificationTagDisplayName(tag))
    .filter((tag) => tag !== "-");

  return tags.length ? tags.join(", ") : "-";
}

function formatScheduleDateRange(schedule: ScheduleItem) {
  const start = new Date(schedule?.startTime || "");
  const end = new Date(schedule?.endTime || "");

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "-";
  }

  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (!isOvernightShift(schedule)) {
    return startLabel;
  }

  const endLabel = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startLabel} - ${endLabel}`;
}

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function ScheduleListPage() {
  const router = useRouter();
  const { user, isAdmin, tenant, facilityPreferences } = useAuth();

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [open, setOpen] = useState(false);
  const [openAutoModal, setOpenAutoModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(
    null,
  );
  const [view, setView] = useState<"list" | "calendar" | "roster">("list");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(toDayKey(new Date()));
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [staffVisibility, setStaffVisibility] = useState<"mine" | "all">(
    "mine",
  );
  const [shiftTimeFilter, setShiftTimeFilter] = useState("");
  const [filterPickerOpen, setFilterPickerOpen] = useState<
    "visibility" | "role" | "status" | "shift" | null
  >(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapSchedule, setSwapSchedule] = useState<ScheduleItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [calendarDetailsOpen, setCalendarDetailsOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(
    null,
  );

  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const timeTrackingEnabled = Boolean(
    (facilityPreferences as { timeTracking?: { enabled?: boolean } } | null)
      ?.timeTracking?.enabled,
  );

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/schedules");
      const raw = Array.isArray(res.data) ? (res.data as ScheduleItem[]) : [];

      const sorted = raw.sort((a, b) => {
        const aTime = new Date(a.startTime || a.createdAt || "").getTime();
        const bTime = new Date(b.startTime || b.createdAt || "").getTime();
        return bTime - aTime;
      });

      setSchedules(sorted);
      setSelectedScheduleIds((prev) =>
        prev.filter((id) => sorted.some((schedule) => schedule._id === id)),
      );
      setError("");
    } catch (requestError) {
      console.warn("Failed to fetch schedules", requestError);
      setError("Failed to load schedules.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await api.get("/auth/users");
      setStaff(Array.isArray(res.data) ? (res.data as StaffUser[]) : []);
    } catch (requestError) {
      console.warn("Failed to fetch staff", requestError);
      setStaff([]);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
    fetchStaff();
  }, [fetchSchedules, fetchStaff]);

  const openEdit = (schedule: ScheduleItem) => {
    setEditingSchedule(schedule);
    setOpen(true);
  };

  const openDetails = (schedule: ScheduleItem) => {
    setSelectedSchedule(schedule);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedSchedule(null);
  };

  const openCreate = () => {
    if (!isAdmin) {
      return;
    }

    setEditingSchedule(null);
    setOpen(true);
  };

  const closeModal = (refresh = false) => {
    setOpen(false);
    setEditingSchedule(null);

    if (refresh) {
      fetchSchedules();
    }
  };

  const askDelete = (id?: string) => {
    if (!isAdmin || !id) {
      return;
    }

    setDeleteId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) {
      return;
    }

    try {
      await api.delete(`/schedules/${deleteId}`);
      await fetchSchedules();
    } catch (requestError) {
      console.warn("Failed to delete schedule", requestError);
      setError("Failed to delete schedule.");
    } finally {
      setConfirmOpen(false);
      setDeleteId(null);
    }
  };

  const toggleScheduleSelection = (id?: string) => {
    if (!id || !isAdmin) {
      return;
    }

    setSelectedScheduleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAllPaginated = () => {
    if (!isAdmin) {
      return;
    }

    const paginatedIds = paginated
      .map((schedule) => schedule._id || "")
      .filter(Boolean);
    const allSelected =
      paginatedIds.length > 0 &&
      paginatedIds.every((id) => selectedScheduleIds.includes(id));

    if (allSelected) {
      setSelectedScheduleIds((prev) =>
        prev.filter((id) => !paginatedIds.includes(id)),
      );
      return;
    }

    setSelectedScheduleIds((prev) =>
      Array.from(new Set([...prev, ...paginatedIds])),
    );
  };

  const confirmBulkDelete = async () => {
    if (!isAdmin || selectedScheduleIds.length === 0) {
      setBulkConfirmOpen(false);
      return;
    }

    try {
      await api.delete("/schedules/bulk", {
        data: { ids: selectedScheduleIds },
      });
      await fetchSchedules();
      setSelectedScheduleIds([]);
    } catch (requestError) {
      console.warn("Failed to bulk delete schedules", requestError);
      setError("Failed to delete selected schedules.");
    } finally {
      setBulkConfirmOpen(false);
    }
  };

  const roleFilterOptions = useMemo<string[]>(() => {
    const facilityRoleValues = getRoleOptionsFromFacilityPreferences(
      facilityPreferences,
    ).map((option) => option.value);

    const industryRoles = facilityRoleValues.length
      ? facilityRoleValues
      : getRolesForIndustry(tenant?.industry);
    const scheduleRoles = schedules
      .map((schedule) => schedule.role)
      .filter((role): role is string => Boolean(role));
    const staffRoles = staff
      .map((member) => member.role)
      .filter((role): role is string => Boolean(role));

    return [
      "all",
      ...Array.from(
        new Set([...industryRoles, ...scheduleRoles, ...staffRoles]),
      ),
    ];
  }, [facilityPreferences, schedules, staff, tenant?.industry]);

  const legendRoles = useMemo(
    () =>
      roleFilterOptions
        .filter((roleOption) => roleOption !== "all")
        .slice(0, 8),
    [roleFilterOptions],
  );

  const uniqueShiftTimes = useMemo(() => {
    const seen = new Set<string>();
    const options: { key: string; label: string }[] = [];

    schedules.forEach((schedule) => {
      if (!schedule.startTime || !schedule.endTime) {
        return;
      }

      const startKey = getTimeKey(schedule.startTime);
      const endKey = getTimeKey(schedule.endTime);
      if (!startKey || !endKey) {
        return;
      }

      const key = `${startKey}|${endKey}`;
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      const overnightLabel = isOvernightShift(schedule) ? " (+1 day)" : "";

      options.push({
        key,
        label: `${formatScheduleTimeRange(schedule, { withNextDayHint: false })}${overnightLabel}`,
      });
    });

    return options.sort((a, b) => a.key.localeCompare(b.key));
  }, [schedules]);

  const selectedRoleLabel =
    roleFilter === "all" ? "All Roles" : getRoleDisplayName(roleFilter);
  const selectedStatusLabel = statusFilter
    ? statusFilter.replace("_", " ").toUpperCase()
    : "All Statuses";
  const selectedVisibilityLabel =
    staffVisibility === "mine" ? "My Schedule" : "Everyone";
  const selectedShiftTimeLabel =
    uniqueShiftTimes.find((option) => option.key === shiftTimeFilter)?.label ||
    "All Times";

  const filteredSchedules = useMemo(
    () =>
      schedules.filter((schedule) => {
        if (
          !isAdmin &&
          staffVisibility === "mine" &&
          String(extractStaffId(schedule)) !== String(user?._id || "")
        ) {
          return false;
        }

        if (roleFilter !== "all" && schedule.role !== roleFilter) {
          return false;
        }

        if (statusFilter && schedule.status !== statusFilter) {
          return false;
        }

        if (shiftTimeFilter) {
          const [startKey, endKey] = shiftTimeFilter.split("|");
          if (
            getTimeKey(schedule.startTime) !== startKey ||
            getTimeKey(schedule.endTime) !== endKey
          ) {
            return false;
          }
        }

        return true;
      }),
    [
      schedules,
      isAdmin,
      roleFilter,
      shiftTimeFilter,
      staffVisibility,
      statusFilter,
      user?._id,
    ],
  );

  useEffect(() => {
    setPage(0);
  }, [roleFilter, statusFilter, staffVisibility, shiftTimeFilter]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredSchedules.length / rowsPerPage),
  );
  const paginated = filteredSchedules.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  const paginatedScheduleIds = paginated
    .map((schedule) => schedule._id || "")
    .filter(Boolean);
  const allPaginatedSelected =
    paginatedScheduleIds.length > 0 &&
    paginatedScheduleIds.every((id) => selectedScheduleIds.includes(id));

  const dayMeta = useMemo(() => {
    const meta: Record<string, { count: number; color: string }> = {};

    filteredSchedules.forEach((schedule) => {
      const dayKeys = getScheduleCalendarDayKeys(schedule);
      if (dayKeys.length === 0) {
        return;
      }
      const color = STATUS_COLORS[schedule.status || "scheduled"] || "#6b7280";
      dayKeys.forEach((key) => {
        meta[key] = {
          count: (meta[key]?.count || 0) + 1,
          color,
        };
      });
    });

    return meta;
  }, [filteredSchedules]);

  const selectedDayEntries = useMemo(
    () =>
      filteredSchedules.filter((schedule) =>
        getScheduleCalendarDayKeys(schedule).includes(selectedDay),
      ),
    [filteredSchedules, selectedDay],
  );

  const selectedDayLabel = useMemo(() => {
    const [year, month, day] = selectedDay.split("-").map(Number);
    const parsed = new Date(year, (month || 1) - 1, day || 1);

    if (Number.isNaN(parsed.getTime())) {
      return selectedDay;
    }

    return parsed.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedDay]);

  const monthYear = calendarMonth.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const monthDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const total = new Date(year, month + 1, 0).getDate();
    const days: string[] = [];

    for (let day = 1; day <= total; day += 1) {
      days.push(toDayKey(new Date(year, month, day)));
    }

    return days;
  }, [calendarMonth]);

  const canManageSchedule = (schedule: ScheduleItem) => {
    if (isAdmin) {
      return true;
    }

    return String(extractStaffId(schedule)) === String(user?._id || "");
  };

  const handleCalendarDaySelect = (dayKey: string) => {
    setSelectedDay(dayKey);
    setCalendarDetailsOpen(true);
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Staff Scheduling</Text>
            <Text style={styles.subtitle}>Manage shifts and swap requests</Text>
          </View>

          <View style={styles.headerActions}>
            <View style={styles.toggleWrap}>
              <Pressable
                style={[
                  styles.toggleBtn,
                  view === "list" ? styles.toggleBtnActive : null,
                ]}
                onPress={() => setView("list")}
              >
                <Feather
                  name="list"
                  size={14}
                  color={view === "list" ? "#ffffff" : "#374151"}
                />
                <Text
                  style={[
                    styles.toggleText,
                    view === "list" ? styles.toggleTextActive : null,
                  ]}
                >
                  List
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.toggleBtn,
                  view === "calendar" ? styles.toggleBtnActive : null,
                ]}
                onPress={() => setView("calendar")}
              >
                <Feather
                  name="calendar"
                  size={14}
                  color={view === "calendar" ? "#ffffff" : "#374151"}
                />
                <Text
                  style={[
                    styles.toggleText,
                    view === "calendar" ? styles.toggleTextActive : null,
                  ]}
                >
                  Calendar
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.toggleBtn,
                  view === "roster" ? styles.toggleBtnActive : null,
                ]}
                onPress={() => setView("roster")}
              >
                <Feather
                  name="printer"
                  size={14}
                  color={view === "roster" ? "#ffffff" : "#374151"}
                />
                <Text
                  style={[
                    styles.toggleText,
                    view === "roster" ? styles.toggleTextActive : null,
                  ]}
                >
                  Roster
                </Text>
              </Pressable>
            </View>

            {isAdmin ? (
              <Pressable
                style={[styles.actionBtn, styles.aiBtn]}
                onPress={() => setOpenAutoModal(true)}
              >
                <Feather name="cpu" size={14} color="#ffffff" />
                <Text style={styles.actionText}>Review AI Draft Schedules</Text>
              </Pressable>
            ) : null}

            {isAdmin && view === "list" ? (
              <Pressable
                style={[
                  styles.actionBtn,
                  selectedScheduleIds.length > 0
                    ? styles.bulkDeleteBtn
                    : styles.bulkDeleteBtnDisabled,
                ]}
                onPress={() => {
                  if (selectedScheduleIds.length > 0) {
                    setBulkConfirmOpen(true);
                  }
                }}
              >
                <Feather name="trash-2" size={14} color="#ffffff" />
                <Text style={styles.actionText}>
                  Delete Selected ({selectedScheduleIds.length})
                </Text>
              </Pressable>
            ) : null}

            {!isAdmin && timeTrackingEnabled ? (
              <Pressable
                style={[styles.actionBtn, styles.clockBtn]}
                onPress={() =>
                  router.push(
                    "/time-tracking" as Parameters<typeof router.push>[0],
                  )
                }
              >
                <Feather name="clock" size={14} color="#0f172a" />
                <Text style={styles.clockText}>Clock In/Out</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[
                styles.actionBtn,
                isAdmin ? styles.manualBtn : styles.pickupBtn,
              ]}
              onPress={() => {
                if (isAdmin) {
                  openCreate();
                } else {
                  setEditingSchedule(null);
                  setOpen(true);
                }
              }}
            >
              <Feather name="plus" size={14} color="#ffffff" />
              <Text style={styles.actionText}>
                {isAdmin ? "Manual Schedule" : "Pick Up Shift"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Filter</Text>

          <View style={styles.filterFieldsWrap}>
            {!isAdmin ? (
              <View style={styles.filterField}>
                <Text style={styles.filterFieldLabel}>Schedule</Text>
                <Pressable
                  style={styles.filterSelect}
                  onPress={() => setFilterPickerOpen("visibility")}
                >
                  <Text style={styles.filterSelectText} numberOfLines={1}>
                    {selectedVisibilityLabel}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#6b7280" />
                </Pressable>
              </View>
            ) : null}

            {isAdmin ? (
              <View style={styles.filterField}>
                <Text style={styles.filterFieldLabel}>Role</Text>
                <Pressable
                  style={styles.filterSelect}
                  onPress={() => setFilterPickerOpen("role")}
                >
                  <Text style={styles.filterSelectText} numberOfLines={1}>
                    {selectedRoleLabel}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#6b7280" />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.filterField}>
              <Text style={styles.filterFieldLabel}>Status</Text>
              <Pressable
                style={styles.filterSelect}
                onPress={() => setFilterPickerOpen("status")}
              >
                <Text style={styles.filterSelectText} numberOfLines={1}>
                  {selectedStatusLabel}
                </Text>
                <Feather name="chevron-down" size={16} color="#6b7280" />
              </Pressable>
            </View>

            {uniqueShiftTimes.length > 0 ? (
              <View style={styles.filterField}>
                <Text style={styles.filterFieldLabel}>Shift Time</Text>
                <Pressable
                  style={styles.filterSelect}
                  onPress={() => setFilterPickerOpen("shift")}
                >
                  <Text style={styles.filterSelectText} numberOfLines={1}>
                    {selectedShiftTimeLabel}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#6b7280" />
                </Pressable>
              </View>
            ) : null}
          </View>

          <Pressable
            style={styles.clearFiltersBtn}
            onPress={() => {
              setRoleFilter("all");
              setStatusFilter("");
              setShiftTimeFilter("");
              setStaffVisibility("mine");
            }}
          >
            <Feather name="rotate-ccw" size={13} color="#475569" />
            <Text style={styles.clearFiltersText}>Reset Filters</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator size="small" color="#1d4ed8" />
          </View>
        ) : view === "list" ? (
          <>
            {isAdmin && paginated.length > 0 ? (
              <View style={styles.bulkRow}>
                <Pressable
                  style={styles.bulkSelectBtn}
                  onPress={toggleSelectAllPaginated}
                >
                  <Text style={styles.bulkSelectText}>
                    {allPaginatedSelected ? "Unselect page" : "Select page"} (
                    {selectedScheduleIds.length} selected)
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {paginated.length === 0 ? (
              <View style={styles.centerCard}>
                <Text style={styles.emptyText}>
                  No schedules found for this filter.
                </Text>
              </View>
            ) : (
              <View style={styles.listWrap}>
                {paginated.map((schedule) => {
                  const status = schedule.status || "scheduled";
                  const isSelected =
                    Boolean(schedule._id) &&
                    selectedScheduleIds.includes(String(schedule._id));

                  return (
                    <View key={schedule._id} style={styles.scheduleCard}>
                      <View style={styles.scheduleHeader}>
                        <View style={styles.staffRow}>
                          {isAdmin ? (
                            <Pressable
                              style={[
                                styles.checkbox,
                                isSelected ? styles.checkboxActive : null,
                              ]}
                              onPress={() =>
                                toggleScheduleSelection(
                                  String(schedule._id || ""),
                                )
                              }
                            >
                              {isSelected ? (
                                <Feather
                                  name="check"
                                  size={13}
                                  color="#1d4ed8"
                                />
                              ) : null}
                            </Pressable>
                          ) : null}
                          <View
                            style={[
                              styles.roleDot,
                              {
                                backgroundColor:
                                  getRoleColor(schedule.role) || "#6b7280",
                              },
                            ]}
                          />
                          <View style={styles.staffTextWrap}>
                            <Text style={styles.staffName}>
                              {extractStaffName(schedule)}
                            </Text>
                            <Text style={styles.staffMeta}>
                              {getRoleDisplayName(schedule.role)} |{" "}
                              {formatLocal(schedule.startTime)}
                            </Text>
                            <Text style={styles.staffMeta}>
                              Ends: {formatLocal(schedule.endTime)}
                            </Text>
                            <Text style={styles.staffMeta}>
                              Unit Area:{" "}
                              {getUnitAreaDisplayName(schedule.unitArea)}
                            </Text>
                            <Text style={styles.staffMeta}>
                              Shift:{" "}
                              {getShiftTypeDisplayName(schedule.shiftType)} |{" "}
                              {getShiftTagDisplayName(schedule.shiftTag)}
                            </Text>
                            <Text style={styles.staffMeta}>
                              Cert Tags: {formatCertificationTags(schedule)}
                            </Text>
                            {isOvernightShift(schedule) ? (
                              <Text style={styles.overnightText}>
                                Overnight shift
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        <View
                          style={[
                            styles.statusPill,
                            {
                              borderColor: STATUS_COLORS[status] || "#9ca3af",
                              backgroundColor: `${STATUS_COLORS[status] || "#9ca3af"}22`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              { color: STATUS_COLORS[status] || "#6b7280" },
                            ]}
                          >
                            {status.replace("_", " ").toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.notesText}>
                        {schedule.notes || "-"}
                      </Text>

                      <View style={styles.cardActions}>
                        <Pressable
                          style={[styles.cardBtn, styles.viewBtn]}
                          onPress={() => openDetails(schedule)}
                        >
                          <Feather name="eye" size={13} color="#374151" />
                          <Text style={styles.viewText}>View</Text>
                        </Pressable>

                        {canManageSchedule(schedule) ? (
                          <Pressable
                            style={[styles.cardBtn, styles.editBtn]}
                            onPress={() => openEdit(schedule)}
                          >
                            <Feather name="edit-2" size={13} color="#0c4a6e" />
                            <Text style={styles.editText}>Edit</Text>
                          </Pressable>
                        ) : null}

                        {!isAdmin &&
                        canManageSchedule(schedule) &&
                        status === "scheduled" ? (
                          <Pressable
                            style={[styles.cardBtn, styles.swapBtn]}
                            onPress={() => {
                              setSwapSchedule(schedule);
                              setSwapModalOpen(true);
                            }}
                          >
                            <Feather name="repeat" size={13} color="#ffffff" />
                            <Text style={styles.swapText}>Swap Shift</Text>
                          </Pressable>
                        ) : null}

                        {isAdmin ? (
                          <Pressable
                            style={[styles.cardBtn, styles.deleteBtn]}
                            onPress={() => askDelete(schedule._id)}
                          >
                            <Feather name="trash-2" size={13} color="#ffffff" />
                            <Text style={styles.deleteText}>Delete</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.paginationRow}>
              <Pressable
                style={[
                  styles.pageBtn,
                  page <= 0 ? styles.pageBtnDisabled : null,
                ]}
                disabled={page <= 0}
                onPress={() => setPage((prev) => Math.max(0, prev - 1))}
              >
                <Text style={styles.pageBtnText}>Prev</Text>
              </Pressable>
              <Text style={styles.pageText}>
                Page {page + 1} of {pageCount}
              </Text>
              <Pressable
                style={[
                  styles.pageBtn,
                  page + 1 >= pageCount ? styles.pageBtnDisabled : null,
                ]}
                disabled={page + 1 >= pageCount}
                onPress={() =>
                  setPage((prev) => Math.min(pageCount - 1, prev + 1))
                }
              >
                <Text style={styles.pageBtnText}>Next</Text>
              </Pressable>
            </View>
          </>
        ) : view === "roster" ? (
          <View style={styles.calendarWrap}>
            <View style={styles.rosterHeader}>
              <Text style={styles.dayTitle}>{monthYear}</Text>
              <View style={styles.rosterActions}>
                <Pressable
                  style={styles.rosterBtn}
                  onPress={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() - 1,
                        1,
                      ),
                    )
                  }
                >
                  <Text style={styles.rosterBtnText}>Previous</Text>
                </Pressable>
                <Pressable
                  style={styles.rosterBtn}
                  onPress={() => setCalendarMonth(new Date())}
                >
                  <Text style={styles.rosterBtnText}>Today</Text>
                </Pressable>
                <Pressable
                  style={styles.rosterBtn}
                  onPress={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() + 1,
                        1,
                      ),
                    )
                  }
                >
                  <Text style={styles.rosterBtnText}>Next</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.dayGroup}>
              {monthDays.map((dayKey) => {
                const date = parseLocalDateKey(dayKey);
                const shiftsOnDay = filteredSchedules.filter(
                  (schedule) => getScheduleCalendarDayKey(schedule) === dayKey,
                );

                return (
                  <View key={dayKey} style={styles.rosterRow}>
                    <Text style={styles.rosterDayText}>
                      {date.toLocaleDateString("default", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <View style={styles.rosterShiftWrap}>
                      {shiftsOnDay.length === 0 ? (
                        <Text style={styles.calendarEmptyText}>No shifts</Text>
                      ) : (
                        shiftsOnDay.map((shift, index) => (
                          <View
                            key={`${shift._id || "shift"}-${index}`}
                            style={styles.rosterShiftPill}
                          >
                            <View
                              style={[
                                styles.roleDot,
                                { backgroundColor: getRoleColor(shift.role) },
                              ]}
                            />
                            <Text style={styles.rosterShiftText}>
                              {extractStaffName(shift)} •{" "}
                              {getRoleDisplayName(shift.role)} •{" "}
                              {formatScheduleTimeRange(shift, {
                                withNextDayHint: false,
                              })}
                              {isOvernightShift(shift) ? " (+1 day)" : ""}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {legendRoles.length > 0 ? (
              <View style={styles.legendWrap}>
                <Text style={styles.legendTitle}>Role Legend:</Text>
                {legendRoles.map((roleOption) => (
                  <View key={roleOption} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendColor,
                        { backgroundColor: getRoleColor(roleOption) },
                      ]}
                    />
                    <Text style={styles.legendText}>
                      {getRoleDisplayName(roleOption)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.calendarWrap}>
            <MonthCalendar
              month={calendarMonth}
              selectedDay={selectedDay}
              dayMeta={dayMeta}
              onSelectDay={handleCalendarDaySelect}
              onChangeMonth={setCalendarMonth}
            />

            <Text style={styles.calendarHintText}>
              Tap a day to view schedule details.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={calendarDetailsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarDetailsOpen(false)}
      >
        <Pressable
          style={styles.calendarDetailsBackdrop}
          onPress={() => setCalendarDetailsOpen(false)}
        >
          <Pressable style={styles.calendarDetailsCard} onPress={() => {}}>
            <View style={styles.calendarDetailsHeader}>
              <View style={styles.detailsHeaderText}>
                <Text style={styles.detailsTitle}>Day Schedules</Text>
                <Text style={styles.detailsSubtitle}>{selectedDayLabel}</Text>
              </View>
              <Pressable
                style={styles.closeAction}
                onPress={() => setCalendarDetailsOpen(false)}
              >
                <Feather name="x" size={20} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.calendarDetailsBody}>
              {selectedDayEntries.length === 0 ? (
                <Text style={styles.calendarEmptyText}>
                  No schedules on this day.
                </Text>
              ) : (
                selectedDayEntries.map((entry) => (
                  <Pressable
                    key={entry._id}
                    style={styles.dayEntry}
                    onPress={() => {
                      setCalendarDetailsOpen(false);
                      openDetails(entry);
                    }}
                  >
                    <View style={styles.dayEntryTop}>
                      <Text style={styles.dayEntryStaff}>
                        {extractStaffName(entry)}
                      </Text>
                      <Text
                        style={[
                          styles.dayEntryStatus,
                          {
                            color:
                              STATUS_COLORS[entry.status || "scheduled"] ||
                              "#6b7280",
                          },
                        ]}
                      >
                        {(entry.status || "scheduled")
                          .replace("_", " ")
                          .toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.dayEntryMeta}>
                      {getRoleDisplayName(entry.role)}
                    </Text>
                    <Text style={styles.dayEntryMeta}>
                      Start: {formatLocal(entry.startTime)}
                    </Text>
                    <Text style={styles.dayEntryMeta}>
                      End: {formatLocal(entry.endTime)}
                    </Text>
                    {isOvernightShift(entry) ? (
                      <>
                        <Text style={styles.overnightText}>
                          Overnight shift
                        </Text>
                        <Text style={styles.dayEntrySpanMeta}>
                          Spans: {formatScheduleDateRange(entry)}
                        </Text>
                      </>
                    ) : null}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={detailsOpen}
        animationType="slide"
        onRequestClose={closeDetails}
      >
        <SafeAreaView style={styles.modalPage}>
          {selectedSchedule ? (
            <ScrollView contentContainerStyle={styles.detailsScroll}>
              <View style={styles.detailsCard}>
                <View style={styles.detailsHeader}>
                  <View style={styles.detailsHeaderText}>
                    <Text style={styles.detailsTitle}>Schedule Details</Text>
                    <Text style={styles.detailsSubtitle}>
                      Review shift details before editing or swapping.
                    </Text>
                  </View>
                  <Pressable style={styles.closeAction} onPress={closeDetails}>
                    <Feather name="x" size={20} color="#6b7280" />
                  </Pressable>
                </View>

                <View style={styles.detailGroup}>
                  <Text style={styles.detailLabel}>Staff</Text>
                  <Text style={styles.detailValue}>
                    {extractStaffName(selectedSchedule)}
                  </Text>
                </View>

                <View style={styles.detailGroup}>
                  <Text style={styles.detailLabel}>Role</Text>
                  <Text style={styles.detailValue}>
                    {getRoleDisplayName(selectedSchedule.role)}
                  </Text>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailGroup}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>
                      {formatScheduleDateRange(selectedSchedule)}
                    </Text>
                  </View>

                  <View style={styles.detailGroup}>
                    <Text style={styles.detailLabel}>Time</Text>
                    <Text style={styles.detailValue}>
                      {formatScheduleTimeRange(selectedSchedule)}
                    </Text>
                  </View>

                  <View style={styles.detailGroup}>
                    <Text style={styles.detailLabel}>Unit Area</Text>
                    <Text style={styles.detailValue}>
                      {getUnitAreaDisplayName(selectedSchedule.unitArea) || "-"}
                    </Text>
                  </View>

                  <View style={styles.detailGroup}>
                    <Text style={styles.detailLabel}>Shift Type</Text>
                    <Text style={styles.detailValue}>
                      {getShiftTypeDisplayName(selectedSchedule.shiftType) ||
                        "-"}
                    </Text>
                  </View>

                  <View style={styles.detailGroup}>
                    <Text style={styles.detailLabel}>Shift Slot</Text>
                    <Text style={styles.detailValue}>
                      {getShiftTagDisplayName(selectedSchedule.shiftTag) || "-"}
                    </Text>
                  </View>

                  <View style={styles.detailGroup}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text style={styles.detailValue}>
                      {(selectedSchedule.status || "scheduled")
                        .replace("_", " ")
                        .toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailGroup}>
                  <Text style={styles.detailLabel}>Certification Tags</Text>
                  <Text style={styles.detailValue}>
                    {formatCertificationTags(selectedSchedule)}
                  </Text>
                </View>

                <View style={styles.detailGroup}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>
                    {selectedSchedule.notes || "-"}
                  </Text>
                </View>

                {isOvernightShift(selectedSchedule) ? (
                  <Text style={styles.overnightText}>Overnight shift</Text>
                ) : null}

                <View style={styles.detailsActions}>
                  {canManageSchedule(selectedSchedule) ? (
                    <Pressable
                      style={[styles.cardBtn, styles.editBtn]}
                      onPress={() => {
                        closeDetails();
                        openEdit(selectedSchedule);
                      }}
                    >
                      <Feather name="edit-2" size={13} color="#0c4a6e" />
                      <Text style={styles.editText}>Edit Schedule</Text>
                    </Pressable>
                  ) : null}

                  {!isAdmin &&
                  canManageSchedule(selectedSchedule) &&
                  selectedSchedule.status === "scheduled" ? (
                    <Pressable
                      style={[styles.cardBtn, styles.swapBtn]}
                      onPress={() => {
                        closeDetails();
                        setSwapSchedule(selectedSchedule);
                        setSwapModalOpen(true);
                      }}
                    >
                      <Feather name="repeat" size={13} color="#ffffff" />
                      <Text style={styles.swapText}>Swap Shift</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => closeModal()}
      >
        <SafeAreaView style={styles.modalPage}>
          <ScheduleForm
            onSuccess={() => closeModal(true)}
            onClose={() => closeModal()}
            schedule={editingSchedule}
            staffList={staff}
            initialStaffId={
              !isAdmin && !editingSchedule ? String(user?._id || "") : ""
            }
            disableStaffSelect={!isAdmin && !editingSchedule}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={openAutoModal}
        animationType="slide"
        onRequestClose={() => setOpenAutoModal(false)}
      >
        <SafeAreaView style={styles.modalPage}>
          <AutoGenerateScheduleForm
            onClose={() => setOpenAutoModal(false)}
            onSuccess={() => fetchSchedules()}
            schedules={schedules}
          />
        </SafeAreaView>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete Schedule?"
        message="This action cannot be undone."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        title="Delete Selected Schedules?"
        message={`Delete ${selectedScheduleIds.length} selected schedule item(s)? This action cannot be undone.`}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
      />

      <ShiftSwapRequestModal
        open={swapModalOpen}
        onClose={() => {
          setSwapModalOpen(false);
          setSwapSchedule(null);
        }}
        onSuccess={fetchSchedules}
        schedule={swapSchedule}
        staffList={staff}
      />

      <PickerModal
        open={filterPickerOpen !== null}
        title={
          filterPickerOpen === "visibility"
            ? "Schedule Scope"
            : filterPickerOpen === "role"
              ? "Filter by Role"
              : filterPickerOpen === "status"
                ? "Filter by Status"
                : "Filter by Shift Time"
        }
        value={
          filterPickerOpen === "visibility"
            ? staffVisibility
            : filterPickerOpen === "role"
              ? roleFilter
              : filterPickerOpen === "status"
                ? statusFilter
                : shiftTimeFilter
        }
        onClose={() => setFilterPickerOpen(null)}
        onSelect={(value) => {
          if (filterPickerOpen === "visibility") {
            setStaffVisibility(value as "mine" | "all");
            return;
          }

          if (filterPickerOpen === "role") {
            setRoleFilter(value);
            return;
          }

          if (filterPickerOpen === "status") {
            setStatusFilter(value);
            return;
          }

          setShiftTimeFilter(value);
        }}
        options={
          filterPickerOpen === "visibility"
            ? [
                { value: "mine", label: "My Schedule" },
                { value: "all", label: "Everyone" },
              ]
            : filterPickerOpen === "role"
              ? roleFilterOptions.map((roleValue) => ({
                  value: roleValue,
                  label:
                    roleValue === "all"
                      ? "All Roles"
                      : getRoleDisplayName(roleValue),
                }))
              : filterPickerOpen === "status"
                ? STATUS_FILTERS.map((statusValue) => ({
                    value: statusValue,
                    label: statusValue
                      ? statusValue.replace("_", " ").toUpperCase()
                      : "All Statuses",
                  }))
                : [
                    { value: "", label: "All Times" },
                    ...uniqueShiftTimes.map((option) => ({
                      value: option.key,
                      label: option.label,
                    })),
                  ]
        }
      />
    </SafeAreaView>
  );
}

function PickerModal({
  open,
  title,
  value,
  onClose,
  onSelect,
  options,
}: {
  open: boolean;
  title: string;
  value: string;
  onClose: () => void;
  onSelect: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerCard} onPress={() => {}}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.pickerList}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value || "all"}
                  style={[
                    styles.pickerItem,
                    selected ? styles.pickerItemActive : null,
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      selected ? styles.pickerItemTextActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Feather name="check" size={16} color="#2563eb" />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 16,
    paddingTop: 28,
    paddingBottom: 20,
    gap: 12,
  },
  headerRow: {
    gap: 10,
  },
  headerTextWrap: {
    gap: 2,
  },
  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
  },
  headerActions: {
    gap: 8,
  },
  toggleWrap: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f3f4f6",
    flexDirection: "row",
    overflow: "hidden",
  },
  toggleBtn: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  toggleBtnActive: {
    backgroundColor: "#2563eb",
  },
  toggleText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  toggleTextActive: {
    color: "#ffffff",
  },
  actionBtn: {
    minHeight: 38,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  actionText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  aiBtn: {
    backgroundColor: "#1d4ed8",
  },
  bulkDeleteBtn: {
    backgroundColor: "#dc2626",
  },
  bulkDeleteBtnDisabled: {
    backgroundColor: "#9ca3af",
  },
  manualBtn: {
    backgroundColor: "#111827",
  },
  pickupBtn: {
    backgroundColor: "#111827",
  },
  clockBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  clockText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
  filterCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 8,
  },
  filterLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
  },
  filterFieldsWrap: {
    gap: 10,
  },
  filterField: {
    gap: 6,
  },
  filterFieldLabel: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  filterSelect: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  filterSelectText: {
    flex: 1,
    color: "#111827",
    fontSize: 13,
  },
  clearFiltersBtn: {
    minHeight: 34,
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clearFiltersText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  pillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  pillActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  pillText: {
    color: "#374151",
    fontSize: 11,
    fontWeight: "700",
  },
  pillTextActive: {
    color: "#1d4ed8",
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  pickerCard: {
    maxHeight: "70%",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 8,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeBtn: {
    padding: 8,
    marginRight: 2,
  },
  pickerTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  pickerList: {
    gap: 6,
  },
  pickerItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerItemActive: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  pickerItemText: {
    color: "#111827",
    fontSize: 13,
  },
  pickerItemTextActive: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  error: {
    color: "#b91c1c",
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  centerCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
  },
  listWrap: {
    gap: 10,
  },
  bulkRow: {
    alignItems: "flex-start",
  },
  bulkSelectBtn: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bulkSelectText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  scheduleCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  staffRow: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
    alignItems: "flex-start",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxActive: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 5,
  },
  staffTextWrap: {
    flex: 1,
    gap: 2,
  },
  staffName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  staffMeta: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 17,
  },
  overnightText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "600",
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  notesText: {
    color: "#374151",
    fontSize: 12,
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cardBtn: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: "#bae6fd",
    backgroundColor: "#f0f9ff",
  },
  editText: {
    color: "#0c4a6e",
    fontSize: 12,
    fontWeight: "700",
  },
  viewBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  viewText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  swapBtn: {
    backgroundColor: "#7c3aed",
  },
  swapText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  deleteBtn: {
    backgroundColor: "#dc2626",
  },
  deleteText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 2,
  },
  pageBtn: {
    minHeight: 34,
    minWidth: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  pageBtnDisabled: {
    opacity: 0.5,
  },
  pageBtnText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  pageText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
  },
  calendarWrap: {
    gap: 10,
  },
  calendarHintText: {
    color: "#64748b",
    fontSize: 12,
  },
  calendarDetailsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.38)",
    justifyContent: "center",
    padding: 18,
  },
  calendarDetailsCard: {
    maxHeight: "82%",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10,
  },
  calendarDetailsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  calendarDetailsBody: {
    gap: 8,
    paddingBottom: 4,
  },
  rosterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  rosterActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  rosterBtn: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  rosterBtnText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  rosterRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
    marginBottom: 8,
    gap: 6,
  },
  rosterDayText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  rosterShiftWrap: {
    gap: 6,
  },
  rosterShiftPill: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rosterShiftText: {
    color: "#374151",
    fontSize: 12,
    flex: 1,
  },
  legendWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  legendTitle: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    color: "#374151",
    fontSize: 12,
  },
  dayGroup: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 8,
  },
  dayTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  dayEntry: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    padding: 8,
    gap: 3,
  },
  dayEntryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  dayEntryStaff: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  dayEntryStatus: {
    fontSize: 11,
    fontWeight: "800",
  },
  dayEntryMeta: {
    color: "#6b7280",
    fontSize: 12,
  },
  dayEntrySpanMeta: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "600",
  },
  calendarEmptyText: {
    color: "#6b7280",
    fontSize: 12,
  },
  modalPage: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 14,
    paddingTop: 28,
  },
  detailsScroll: {
    paddingBottom: 20,
  },
  detailsCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 12,
  },
  detailsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  detailsHeaderText: {
    flex: 1,
    gap: 2,
  },
  closeAction: {
    padding: 6,
  },
  detailsTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  detailsSubtitle: {
    color: "#6b7280",
    fontSize: 12,
  },
  detailGroup: {
    gap: 3,
  },
  detailLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailsActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 4,
  },
  detailsActionBtn: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
