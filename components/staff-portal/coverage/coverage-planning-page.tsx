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
import {
  getCertificationTagDisplayName,
  getRoleColor,
  getRoleDisplayName,
  getRoleOptionsFromFacilityPreferences,
  getShiftTagDisplayName,
  getShiftTypeDisplayName,
  getUnitAreaDisplayName,
  isRoleCompatible,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";

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
  unitArea?: string;
  shiftType?: string;
  shiftTag?: string;
  requiredCertificationTags?: string[];
};

type FacilityPreferences = {
  roleFamilies?: string[];
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

function toLocal(utc?: string) {
  if (!utc) {
    return null;
  }

  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return d;
}

function toDayKey(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function spansOvernight(coverage: CoverageItem) {
  const start = toLocal(coverage.startTime);
  const end = toLocal(coverage.endTime);

  if (!start || !end) {
    return false;
  }

  return start.toDateString() !== end.toDateString();
}

function formatCoverageDateLabel(coverage: CoverageItem) {
  const start = toLocal(coverage.startTime);

  if (!start) {
    return (
      parseCoverageDateAsLocal(
        coverage.date || coverage.startTime,
      )?.toLocaleDateString() || "-"
    );
  }

  const startLabel = start.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (!spansOvernight(coverage)) {
    return startLabel;
  }

  const nextDay = new Date(start);
  nextDay.setDate(nextDay.getDate() + 1);

  const endLabel = nextDay.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startLabel} - ${endLabel}`;
}

function formatCoverageTimeLabel(coverage: CoverageItem) {
  const start = toLocal(coverage.startTime);
  const end = toLocal(coverage.endTime);

  if (!start || !end) {
    return "";
  }

  const startDateLabel = start.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const endDateLabel = end.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const startLabel = start.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const endLabel = end.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${startDateLabel} ${startLabel} - ${endDateLabel} ${endLabel}`;
}

function formatRequiredCertTags(coverage: CoverageItem) {
  if (!Array.isArray(coverage.requiredCertificationTags)) {
    return "-";
  }

  const tags = coverage.requiredCertificationTags
    .map((tag) => getCertificationTagDisplayName(tag))
    .filter((tag) => tag !== "-");

  return tags.length ? tags.join(", ") : "-";
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
  const [facilityPreferences, setFacilityPreferences] =
    useState<FacilityPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "calendar">("table");
  const [selectedRole, setSelectedRole] = useState("all");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(toDayKey(new Date()));

  const [openAdd, setOpenAdd] = useState(false);
  const [editingCoverage, setEditingCoverage] = useState<CoverageItem | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedCoverage, setSelectedCoverage] = useState<CoverageItem | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [selectedCoverageIds, setSelectedCoverageIds] = useState<string[]>([]);

  const [page, setPage] = useState(0);
  const [rowsPerPage] = useState(10);
  const [error, setError] = useState("");

  const roleOptions = useMemo(() => {
    return getRoleOptionsFromFacilityPreferences(facilityPreferences).map(
      (item) => item.value,
    );
  }, [facilityPreferences]);

  const filterRoleOptions = useMemo(() => {
    const existingRoles = coverages
      .map((c) => c.role)
      .filter(Boolean) as string[];
    return Array.from(new Set([...roleOptions, ...existingRoles]));
  }, [coverages, roleOptions]);

  useEffect(() => {
    fetchCoverages();
  }, []);

  const fetchCoverages = async () => {
    setLoading(true);
    try {
      const [coverageResult, facilityResult] = await Promise.allSettled([
        api.get("/coverage"),
        api.get("/facility-preferences"),
      ]);

      const nextCoverages =
        coverageResult.status === "fulfilled" &&
        Array.isArray(coverageResult.value.data)
          ? coverageResult.value.data
          : [];
      setCoverages(nextCoverages);

      if (
        facilityResult.status === "fulfilled" &&
        facilityResult.value.data &&
        typeof facilityResult.value.data === "object"
      ) {
        setFacilityPreferences(
          facilityResult.value.data as FacilityPreferences,
        );
      } else {
        setFacilityPreferences(null);
      }

      setSelectedCoverageIds((prev) =>
        prev.filter((id) =>
          nextCoverages.some((coverage: CoverageItem) => coverage._id === id),
        ),
      );
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

  const openDetails = (coverage: CoverageItem) => {
    if (!coverage) {
      return;
    }

    setSelectedCoverage(coverage);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedCoverage(null);
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

  const toggleCoverageSelection = (id?: string) => {
    if (!id) {
      return;
    }

    setSelectedCoverageIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const displayedCoverages = useMemo(() => {
    const filtered = coverages.filter(
      (c) => selectedRole === "all" || isRoleCompatible(c.role, selectedRole),
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

  const paginatedIds = paginated
    .map((coverage) => coverage._id)
    .filter((id): id is string => typeof id === "string");

  const allPaginatedSelected =
    paginatedIds.length > 0 &&
    paginatedIds.every((id) => selectedCoverageIds.includes(id));

  const toggleSelectAllPaginated = () => {
    if (allPaginatedSelected) {
      setSelectedCoverageIds((prev) =>
        prev.filter((id) => !paginatedIds.includes(id)),
      );
      return;
    }

    setSelectedCoverageIds((prev) =>
      Array.from(new Set([...prev, ...paginatedIds])),
    );
  };

  const confirmBulkDelete = async () => {
    if (!selectedCoverageIds.length) {
      setBulkConfirmOpen(false);
      return;
    }

    try {
      await api.delete("/coverage/bulk", {
        data: { ids: selectedCoverageIds },
      });
      await fetchCoverages();
      setSelectedCoverageIds([]);
    } catch (err: unknown) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Failed to delete selected coverage";

      setError(msg || "Failed to delete selected coverage");
    } finally {
      setBulkConfirmOpen(false);
    }
  };

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

  const totalPages = Math.max(
    1,
    Math.ceil(displayedCoverages.length / rowsPerPage),
  );

  const getRoleChipStyles = (role?: string) => {
    const roleColor = getRoleColor(role);
    return {
      backgroundColor: `${roleColor}22`,
      borderColor: `${roleColor}55`,
      borderWidth: 1,
    };
  };

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
                  view === "table" ? styles.toggleBtnActive : null,
                ]}
                onPress={() => setView("table")}
              >
                <Feather
                  name="list"
                  size={14}
                  color={view === "table" ? "#fff" : "#374151"}
                />
                <Text
                  style={[
                    styles.toggleText,
                    view === "table" ? styles.toggleTextActive : null,
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
              <View style={styles.adminActionRow}>
                {view === "table" ? (
                  <Pressable
                    style={[
                      styles.bulkDeleteBtn,
                      selectedCoverageIds.length === 0
                        ? styles.bulkDeleteBtnDisabled
                        : null,
                    ]}
                    disabled={selectedCoverageIds.length === 0}
                    onPress={() => setBulkConfirmOpen(true)}
                  >
                    <Text style={styles.bulkDeleteBtnText}>
                      Delete Selected ({selectedCoverageIds.length})
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={styles.addBtn}
                  onPress={() => setOpenAdd(true)}
                >
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={styles.addBtnText}>Add Coverage</Text>
                </Pressable>
              </View>
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
              {filterRoleOptions.map((role) => (
                <RoleFilterChip
                  key={role}
                  label={getRoleDisplayName(role)}
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
        ) : view === "table" ? (
          <View style={styles.listWrap}>
            {isAdmin ? (
              <Pressable
                style={styles.selectAllRow}
                onPress={toggleSelectAllPaginated}
              >
                <Feather
                  name={allPaginatedSelected ? "check-square" : "square"}
                  size={16}
                  color={allPaginatedSelected ? "#1d4ed8" : "#6b7280"}
                />
                <Text style={styles.selectAllText}>
                  Select all on this page
                </Text>
              </Pressable>
            ) : null}

            {paginated.map((c) => {
              const id = c._id || `${c.role}-${c.startTime}`;
              const checked = !!c._id && selectedCoverageIds.includes(c._id);

              return (
                <View key={id} style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <View style={styles.rowLeft}>
                      <View style={styles.rowRoleLine}>
                        {isAdmin && c._id ? (
                          <Pressable
                            onPress={() => toggleCoverageSelection(c._id)}
                            style={styles.rowCheckbox}
                          >
                            <Feather
                              name={checked ? "check-square" : "square"}
                              size={16}
                              color={checked ? "#1d4ed8" : "#6b7280"}
                            />
                          </Pressable>
                        ) : null}

                        <Text style={styles.rowRole}>
                          {getRoleDisplayName(c.role)}
                        </Text>
                      </View>

                      <Text style={styles.rowMeta}>
                        {formatCoverageDateLabel(c)} •{" "}
                        {formatCoverageTimeLabel(c)}
                      </Text>
                      <Text style={styles.rowMeta}>
                        Unit Area: {getUnitAreaDisplayName(c.unitArea)}
                      </Text>
                      <Text style={styles.rowMeta}>
                        Shift Type: {getShiftTypeDisplayName(c.shiftType)}
                      </Text>
                      <Text style={styles.rowMeta}>
                        Shift Slot: {getShiftTagDisplayName(c.shiftTag)}
                      </Text>
                      <Text style={styles.rowMeta}>
                        Cert Tags: {formatRequiredCertTags(c)}
                      </Text>
                      {spansOvernight(c) ? (
                        <Text style={styles.overnightText}>
                          Overnight shift
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.rowRight}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: getCoverageStatusColor(c) },
                        ]}
                      />
                      <Text style={styles.countText}>
                        {Number(c.requiredCount) || 0} needed
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.rowNote} numberOfLines={2}>
                    {c.note || "-"}
                  </Text>

                  {isAdmin ? (
                    <View style={styles.rowActions}>
                      <Pressable
                        style={styles.viewBtn}
                        onPress={() => openDetails(c)}
                      >
                        <Feather name="eye" size={13} color="#fff" />
                        <Text style={styles.viewBtnText}>View</Text>
                      </Pressable>
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
                  Page {page + 1} of {totalPages}
                </Text>
                <Pressable
                  style={[
                    styles.pageBtn,
                    page + 1 >= totalPages ? styles.pageBtnDisabled : null,
                  ]}
                  disabled={page + 1 >= totalPages}
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
                        onPress={() => openDetails(item)}
                      >
                        <View
                          style={[
                            styles.calendarColorBar,
                            { backgroundColor: getCoverageStatusColor(item) },
                          ]}
                        />
                        <View style={styles.calendarContent}>
                          <Text style={styles.calendarTitle}>
                            {getRoleDisplayName(item.role)} (
                            {Number(item.requiredCount) || 0})
                            {item.unitArea
                              ? ` • ${getUnitAreaDisplayName(item.unitArea)}`
                              : ""}
                            {item.shiftType
                              ? ` • ${getShiftTypeDisplayName(item.shiftType)}`
                              : ""}
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
        visible={detailsOpen}
        animationType="slide"
        onRequestClose={closeDetails}
      >
        <View style={styles.modalPage}>
          <ScrollView contentContainerStyle={styles.detailCard}>
            {selectedCoverage ? (
              <>
                <View style={styles.detailHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailTitle}>Coverage Details</Text>
                    <Text style={styles.detailSubtitle}>
                      {getRoleDisplayName(selectedCoverage.role)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={closeDetails}
                    style={styles.closeDetailBtn}
                  >
                    <Feather name="x" size={18} color="#6b7280" />
                  </Pressable>
                </View>

                <View
                  style={[
                    styles.detailRolePill,
                    getRoleChipStyles(selectedCoverage.role),
                  ]}
                >
                  <Text
                    style={[
                      styles.detailRoleText,
                      { color: getRoleColor(selectedCoverage.role) },
                    ]}
                  >
                    {getRoleDisplayName(selectedCoverage.role)}
                  </Text>
                </View>

                <View style={styles.detailGrid}>
                  <DetailRow
                    label="Date"
                    value={formatCoverageDateLabel(selectedCoverage)}
                  />
                  <DetailRow
                    label="Time"
                    value={formatCoverageTimeLabel(selectedCoverage)}
                  />
                  <DetailRow
                    label="Required Staff"
                    value={String(selectedCoverage.requiredCount ?? "-")}
                  />
                  <DetailRow
                    label="Remaining"
                    value={String(selectedCoverage.remaining ?? "-")}
                  />
                  <DetailRow
                    label="Unit Area"
                    value={
                      getUnitAreaDisplayName(selectedCoverage.unitArea) || "-"
                    }
                  />
                  <DetailRow
                    label="Shift Type"
                    value={
                      getShiftTypeDisplayName(selectedCoverage.shiftType) || "-"
                    }
                  />
                  <DetailRow
                    label="Shift Slot"
                    value={
                      getShiftTagDisplayName(selectedCoverage.shiftTag) || "-"
                    }
                  />
                </View>

                <DetailRow
                  label="Required Certification Tags"
                  value={formatRequiredCertTags(selectedCoverage)}
                />

                <View>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>
                    {selectedCoverage.note || "-"}
                  </Text>
                </View>

                {spansOvernight(selectedCoverage) ? (
                  <Text style={styles.overnightText}>Overnight shift</Text>
                ) : null}

                {isAdmin ? (
                  <View style={styles.detailActionRow}>
                    <Pressable
                      style={styles.editBtn}
                      onPress={() => {
                        closeDetails();
                        openEdit(selectedCoverage);
                      }}
                    >
                      <Feather name="edit-2" size={13} color="#fff" />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={() => {
                        closeDetails();
                        askDelete(selectedCoverage._id);
                      }}
                    >
                      <Feather name="trash-2" size={13} color="#fff" />
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

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

      <ConfirmDialog
        open={bulkConfirmOpen}
        title="Delete Selected Coverage?"
        message={`Delete ${selectedCoverageIds.length} selected coverage item(s)? This action cannot be undone.`}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "-"}</Text>
    </View>
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
  adminActionRow: {
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
  bulkDeleteBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dc2626",
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "#fff5f5",
  },
  bulkDeleteBtnDisabled: {
    opacity: 0.45,
  },
  bulkDeleteBtnText: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 13,
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
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectAllText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
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
    justifyContent: "space-between",
    gap: 8,
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  rowRoleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowCheckbox: {
    paddingVertical: 2,
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
  overnightText: {
    marginTop: 1,
    color: "#0284c7",
    fontSize: 12,
    fontWeight: "600",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  countText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  rowNote: {
    color: "#4b5563",
    fontSize: 12,
  },
  viewBtn: {
    borderRadius: 7,
    backgroundColor: "#475569",
    minHeight: 30,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  viewBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  rowActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
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
  detailCard: {
    gap: 12,
    paddingBottom: 24,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  detailTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },
  detailSubtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 2,
  },
  closeDetailBtn: {
    padding: 8,
  },
  detailRolePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailRoleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailItem: {
    minWidth: "48%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f8fafc",
    gap: 4,
  },
  detailLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  detailActionRow: {
    flexDirection: "row",
    gap: 8,
  },
});
