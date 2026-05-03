import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
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
import CoverageCreateForm from "@/components/staff-portal/coverage/coverage-create-form";
import CoverageEditCountForm from "@/components/staff-portal/coverage/coverage-edit-count-form";
import MonthCalendar from "@/components/staff-portal/shared/month-calendar";
import api from "@/config/api";
import { useAuth } from "@/context/auth-context";

const ROLE_LABELS: Record<string, string> = {
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
  other: "Other",
};

const FILTER_ROLES = [
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

const STATUS_COLORS: Record<string, string> = {
  open: "#f59e0b",
  partial: "#f97316",
  filled: "#10b981",
};

type CoverageItem = {
  _id?: string;
  role?: string;
  requiredCount?: number;
  remaining?: number;
  startTime?: string;
  endTime?: string;
  date?: string;
  note?: string;
};

function getCoverageDayKey(coverageDate?: string) {
  if (!coverageDate) {
    return "";
  }

  const match = coverageDate.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match?.[1]) {
    return match[1];
  }

  const d = new Date(coverageDate);
  if (Number.isNaN(d.getTime())) {
    return "";
  }

  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCoverageDateAsLocal(coverageDate?: string) {
  const dayKey = getCoverageDayKey(coverageDate);
  if (!dayKey) {
    return null;
  }

  return new Date(`${dayKey}T00:00:00`);
}

function toLocal(value?: string) {
  if (!value) {
    return null;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return d;
}

function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCoverageStatusColor(item: CoverageItem) {
  const required = Number(item.requiredCount) || 0;
  const remaining = Number(item.remaining) || 0;

  const status =
    remaining > 0 ? (remaining < required ? "partial" : "open") : "filled";

  return STATUS_COLORS[status] || "#6b7280";
}

export default function CoveragePlanningPage() {
  const { user, isAdmin } = useAuth();

  const [coverages, setCoverages] = useState<CoverageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(toDayKey(new Date()));

  const [openAdd, setOpenAdd] = useState(false);
  const [editingCoverage, setEditingCoverage] = useState<CoverageItem | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCoverages();
  }, []);

  const fetchCoverages = async () => {
    setLoading(true);
    try {
      const res = await api.get("/coverage");
      setCoverages(Array.isArray(res.data) ? res.data : []);
      setError("");
    } catch (err) {
      console.warn("Failed to fetch coverage", err);
      setError("Failed to load coverage data");
    } finally {
      setLoading(false);
    }
  };

  const askDelete = (id?: string) => {
    if (!isAdmin || !id) {
      return;
    }

    setDeleteId(id);
    setConfirmOpen(true);
  };

  const openEdit = (coverage: CoverageItem) => {
    if (!isAdmin || !coverage) {
      return;
    }

    setEditingCoverage(coverage);
  };

  const confirmDelete = async () => {
    if (!deleteId) {
      return;
    }

    try {
      await api.delete(`/coverage/${deleteId}`);
      await fetchCoverages();
    } catch (err) {
      console.warn("Failed to delete coverage", err);
      setError("Failed to delete coverage");
    } finally {
      setConfirmOpen(false);
      setDeleteId(null);
    }
  };

  const displayedCoverages = useMemo(() => {
    const filtered = coverages.filter(
      (c) => selectedRole === "all" || c.role === selectedRole,
    );

    return filtered.sort((a, b) => {
      const da = getCoverageDayKey(a.date || a.startTime);
      const db = getCoverageDayKey(b.date || b.startTime);
      if (db !== da) {
        return db.localeCompare(da);
      }

      return (
        new Date(b.startTime || "").getTime() -
        new Date(a.startTime || "").getTime()
      );
    });
  }, [coverages, selectedRole]);

  const paginated = displayedCoverages.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  const dayMeta = useMemo(() => {
    const meta: Record<string, { count: number; color: string }> = {};

    displayedCoverages.forEach((item) => {
      const key = getCoverageDayKey(item.date || item.startTime);
      if (!key) {
        return;
      }

      const nextCount = (meta[key]?.count || 0) + 1;
      meta[key] = {
        count: nextCount,
        color: getCoverageStatusColor(item),
      };
    });

    return meta;
  }, [displayedCoverages]);

  const selectedDayItems = useMemo(
    () =>
      displayedCoverages.filter(
        (item) =>
          getCoverageDayKey(item.date || item.startTime) === selectedDay,
      ),
    [displayedCoverages, selectedDay],
  );

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Coverage Planning</Text>
            <Text style={styles.subtitle}>Define staffing requirements</Text>
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
                  color={view === "list" ? "#fff" : "#374151"}
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
                  color={view === "calendar" ? "#fff" : "#374151"}
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
              <Pressable style={styles.addBtn} onPress={() => setOpenAdd(true)}>
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.addBtnText}>Add Coverage</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Filter by role</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.roleChips}>
              <RoleFilterChip
                label="All Roles"
                active={selectedRole === "all"}
                onPress={() => {
                  setSelectedRole("all");
                  setPage(0);
                }}
              />
              {FILTER_ROLES.map((role) => (
                <RoleFilterChip
                  key={role}
                  label={ROLE_LABELS[role]}
                  active={selectedRole === role}
                  onPress={() => {
                    setSelectedRole(role);
                    setPage(0);
                  }}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" />
          </View>
        ) : view === "list" ? (
          <View style={styles.listWrap}>
            {paginated.map((c) => {
              const day = parseCoverageDateAsLocal(c.date || c.startTime);
              const start = toLocal(c.startTime);
              const end = toLocal(c.endTime);

              return (
                <View
                  key={c._id || `${c.role}-${c.startTime}`}
                  style={styles.rowCard}
                >
                  <View style={styles.rowTop}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.rowRole}>
                        {ROLE_LABELS[c.role || ""] || c.role || "Role"}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {day?.toLocaleDateString() || "-"} -{" "}
                        {start?.toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        }) || "-"}{" "}
                        -{" "}
                        {end?.toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        }) || "-"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: getCoverageStatusColor(c) },
                      ]}
                    />
                  </View>

                  <Text style={styles.rowNote} numberOfLines={2}>
                    {c.note || "-"}
                  </Text>

                  <View style={styles.rowFooter}>
                    <Text style={styles.countText}>
                      {Number(c.requiredCount) || 0} needed
                    </Text>

                    {isAdmin ? (
                      <View style={styles.rowActions}>
                        <Pressable
                          style={styles.editBtn}
                          onPress={() => openEdit(c)}
                        >
                          <Feather name="edit-2" size={13} color="#fff" />
                          <Text style={styles.editBtnText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          style={styles.deleteBtn}
                          onPress={() => askDelete(c._id)}
                        >
                          <Feather name="trash-2" size={13} color="#fff" />
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}

            {displayedCoverages.length > rowsPerPage ? (
              <View style={styles.paginationRow}>
                <Pressable
                  style={[
                    styles.pageBtn,
                    page === 0 ? styles.pageBtnDisabled : null,
                  ]}
                  disabled={page === 0}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <Text style={styles.pageBtnText}>Previous</Text>
                </Pressable>
                <Text style={styles.pageInfo}>
                  Page {page + 1} of{" "}
                  {Math.max(
                    1,
                    Math.ceil(displayedCoverages.length / rowsPerPage),
                  )}
                </Text>
                <Pressable
                  style={[
                    styles.pageBtn,
                    (page + 1) * rowsPerPage >= displayedCoverages.length
                      ? styles.pageBtnDisabled
                      : null,
                  ]}
                  disabled={
                    (page + 1) * rowsPerPage >= displayedCoverages.length
                  }
                  onPress={() => setPage((p) => p + 1)}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.calendarWrap}>
            <MonthCalendar
              month={calendarMonth}
              selectedDay={selectedDay}
              dayMeta={dayMeta}
              onSelectDay={setSelectedDay}
              onChangeMonth={setCalendarMonth}
            />

            <View style={styles.dayBlock}>
              <Text style={styles.dayTitle}>
                {parseCoverageDateAsLocal(selectedDay)?.toLocaleDateString() ||
                  selectedDay}
              </Text>

              <View style={styles.dayItems}>
                {selectedDayItems.length === 0 ? (
                  <Text style={styles.calendarEmptyText}>
                    No coverage requirements for this day.
                  </Text>
                ) : (
                  selectedDayItems.map((item) => {
                    const start = toLocal(item.startTime);
                    const end = toLocal(item.endTime);
                    return (
                      <Pressable
                        key={item._id || `${item.role}-${item.startTime}`}
                        style={styles.calendarItem}
                        onPress={() => {
                          if (isAdmin) {
                            openEdit(item);
                          }
                        }}
                      >
                        <View
                          style={[
                            styles.calendarColorBar,
                            { backgroundColor: getCoverageStatusColor(item) },
                          ]}
                        />
                        <View style={styles.calendarContent}>
                          <Text style={styles.calendarTitle}>
                            {ROLE_LABELS[item.role || ""] ||
                              item.role ||
                              "Role"}{" "}
                            ({Number(item.requiredCount) || 0})
                          </Text>
                          <Text style={styles.calendarMeta}>
                            {start?.toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            }) || "-"}{" "}
                            -{" "}
                            {end?.toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            }) || "-"}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={openAdd}
        animationType="slide"
        onRequestClose={() => setOpenAdd(false)}
      >
        <View style={styles.modalPage}>
          <CoverageCreateForm
            tenantId={
              typeof user?.tenantId === "string" ? user.tenantId : undefined
            }
            onClose={() => setOpenAdd(false)}
            onSuccess={() => {
              setOpenAdd(false);
              fetchCoverages();
            }}
          />
        </View>
      </Modal>

      <Modal
        visible={Boolean(editingCoverage)}
        animationType="slide"
        onRequestClose={() => setEditingCoverage(null)}
      >
        <View style={styles.modalPage}>
          <CoverageEditCountForm
            coverage={editingCoverage}
            onClose={() => setEditingCoverage(null)}
            onSuccess={() => {
              setEditingCoverage(null);
              fetchCoverages();
            }}
          />
        </View>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete Coverage?"
        message="This action cannot be undone."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
      />
    </SafeAreaView>
  );
}

function RoleFilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.roleFilterChip,
        active ? styles.roleFilterChipActive : null,
      ]}
    >
      <Text
        style={[
          styles.roleFilterChipText,
          active ? styles.roleFilterChipTextActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
    paddingBottom: 28,
    gap: 10,
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
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  toggleBtnActive: {
    backgroundColor: "#2563eb",
  },
  toggleText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 13,
  },
  toggleTextActive: {
    color: "#ffffff",
  },
  addBtn: {
    borderRadius: 8,
    backgroundColor: "#2563eb",
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  error: {
    color: "#b91c1c",
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterCard: {
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 10,
    gap: 8,
  },
  filterLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
  roleChips: {
    flexDirection: "row",
    gap: 6,
  },
  roleFilterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleFilterChipActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  roleFilterChipText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  roleFilterChipTextActive: {
    color: "#1d4ed8",
  },
  loadingWrap: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  listWrap: {
    gap: 8,
  },
  rowCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 8,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowRole: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  rowMeta: {
    color: "#6b7280",
    fontSize: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowNote: {
    color: "#4b5563",
    fontSize: 12,
  },
  rowFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  countText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
  },
  rowActions: {
    flexDirection: "row",
    gap: 6,
  },
  editBtn: {
    borderRadius: 7,
    backgroundColor: "#2563eb",
    minHeight: 30,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  editBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  deleteBtn: {
    borderRadius: 7,
    backgroundColor: "#dc2626",
    minHeight: 30,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  deleteBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  paginationRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  pageBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pageBtnDisabled: {
    opacity: 0.45,
  },
  pageBtnText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  pageInfo: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
  calendarWrap: {
    gap: 10,
  },
  dayBlock: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 8,
  },
  dayTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  dayItems: {
    gap: 6,
  },
  calendarEmptyText: {
    color: "#6b7280",
    fontSize: 12,
  },
  calendarItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    overflow: "hidden",
  },
  calendarColorBar: {
    width: 6,
  },
  calendarContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  calendarTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  calendarMeta: {
    color: "#6b7280",
    fontSize: 12,
  },
  modalPage: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 12,
    paddingTop: 40,
  },
});
