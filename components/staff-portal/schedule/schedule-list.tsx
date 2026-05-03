import { Feather } from "@expo/vector-icons";
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
import { useAuth } from "@/context/auth-context";

import AutoGenerateScheduleForm from "./auto-generate-schedule-form";
import ScheduleForm from "./schedule-form";
import {
  extractStaffId,
  extractStaffName,
  formatLocal,
  getRoleDisplayName,
  ROLE_COLORS,
  ScheduleItem,
  StaffUser,
  STATUS_COLORS,
} from "./schedule-types";
import ShiftSwapRequestModal from "./shift-swap-request-modal";

const FILTER_ROLES = [
  "all",
  "doctor",
  "nurse",
  "rn",
  "lpn",
  "cna",
  "med_aide",
  "caregiver",
  "activity_aide",
  "dietary_aide",
  "housekeeper",
  "receptionist",
  "billing",
] as const;

const STATUS_FILTERS = ["", "scheduled", "completed", "call_out"] as const;

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

export default function ScheduleListPage() {
  const { user, isAdmin } = useAuth();

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [open, setOpen] = useState(false);
  const [openAutoModal, setOpenAutoModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(
    null,
  );
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(toDayKey(new Date()));
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapSchedule, setSwapSchedule] = useState<ScheduleItem | null>(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/schedules");
      const raw = Array.isArray(res.data) ? (res.data as ScheduleItem[]) : [];

      const userId = String(user?._id || "");
      const filtered = isAdmin
        ? raw
        : raw.filter((schedule) => String(extractStaffId(schedule)) === userId);

      const sorted = filtered.sort((a, b) => {
        const aTime = new Date(a.startTime || a.createdAt || "").getTime();
        const bTime = new Date(b.startTime || b.createdAt || "").getTime();
        return bTime - aTime;
      });

      setSchedules(sorted);
      setError("");
    } catch (requestError) {
      console.warn("Failed to fetch schedules", requestError);
      setError("Failed to load schedules.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?._id]);

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

  const filteredSchedules = useMemo(
    () =>
      schedules.filter((schedule) => {
        if (roleFilter !== "all" && schedule.role !== roleFilter) {
          return false;
        }

        if (statusFilter && schedule.status !== statusFilter) {
          return false;
        }

        return true;
      }),
    [schedules, roleFilter, statusFilter],
  );

  useEffect(() => {
    setPage(0);
  }, [roleFilter, statusFilter]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredSchedules.length / rowsPerPage),
  );
  const paginated = filteredSchedules.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  const dayMeta = useMemo(() => {
    const meta: Record<string, { count: number; color: string }> = {};

    filteredSchedules.forEach((schedule) => {
      const key = getScheduleCalendarDayKey(schedule);
      if (!key) {
        return;
      }
      const color = STATUS_COLORS[schedule.status || "scheduled"] || "#6b7280";
      meta[key] = {
        count: (meta[key]?.count || 0) + 1,
        color,
      };
    });

    return meta;
  }, [filteredSchedules]);

  const selectedDayEntries = useMemo(
    () =>
      filteredSchedules.filter(
        (schedule) => getScheduleCalendarDayKey(schedule) === selectedDay,
      ),
    [filteredSchedules, selectedDay],
  );

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
            </View>

            {isAdmin ? (
              <Pressable
                style={[styles.actionBtn, styles.aiBtn]}
                onPress={() => setOpenAutoModal(true)}
              >
                <Feather name="cpu" size={14} color="#ffffff" />
                <Text style={styles.actionText}>AI Generated Schedule</Text>
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

          {isAdmin ? (
            <View style={styles.pillsWrap}>
              {FILTER_ROLES.map((role) => {
                const selected = roleFilter === role;
                return (
                  <Pressable
                    key={role}
                    style={[styles.pill, selected ? styles.pillActive : null]}
                    onPress={() => setRoleFilter(role)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        selected ? styles.pillTextActive : null,
                      ]}
                    >
                      {role === "all" ? "All Roles" : getRoleDisplayName(role)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.pillsWrap}>
            {STATUS_FILTERS.map((status) => {
              const selected = statusFilter === status;
              return (
                <Pressable
                  key={status || "all"}
                  style={[styles.pill, selected ? styles.pillActive : null]}
                  onPress={() => setStatusFilter(status)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selected ? styles.pillTextActive : null,
                    ]}
                  >
                    {status ? status.replace("_", " ").toUpperCase() : "All"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator size="small" color="#1d4ed8" />
          </View>
        ) : view === "list" ? (
          <>
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

                  return (
                    <View key={schedule._id} style={styles.scheduleCard}>
                      <View style={styles.scheduleHeader}>
                        <View style={styles.staffRow}>
                          <View
                            style={[
                              styles.roleDot,
                              {
                                backgroundColor:
                                  ROLE_COLORS[schedule.role || ""] || "#6b7280",
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
                          style={[styles.cardBtn, styles.editBtn]}
                          onPress={() => openEdit(schedule)}
                        >
                          <Feather name="edit-2" size={13} color="#0c4a6e" />
                          <Text style={styles.editText}>Edit</Text>
                        </Pressable>

                        {!isAdmin && status === "scheduled" ? (
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
        ) : (
          <View style={styles.calendarWrap}>
            <MonthCalendar
              month={calendarMonth}
              selectedDay={selectedDay}
              dayMeta={dayMeta}
              onSelectDay={setSelectedDay}
              onChangeMonth={setCalendarMonth}
            />

            <View style={styles.dayGroup}>
              <Text style={styles.dayTitle}>{selectedDay}</Text>

              {selectedDayEntries.length === 0 ? (
                <Text style={styles.calendarEmptyText}>
                  No schedules on this day.
                </Text>
              ) : (
                selectedDayEntries.map((entry) => (
                  <Pressable
                    key={entry._id}
                    style={styles.dayEntry}
                    onPress={() => openEdit(entry)}
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
                      {getRoleDisplayName(entry.role)} |{" "}
                      {formatLocal(entry.startTime)}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

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
    </SafeAreaView>
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
  manualBtn: {
    backgroundColor: "#111827",
  },
  pickupBtn: {
    backgroundColor: "#111827",
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
});
