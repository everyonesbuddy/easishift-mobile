import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import api from "@/config/api";
import {
  getRoleDisplayName,
  getRoleOptionsForIndustry,
  getRoleOptionsFromFacilityPreferences,
  getShiftTagDisplayName,
  getShiftTypeDisplayName,
  getUnitAreaDisplayName,
  isRoleCompatible,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";

import { CoverageItem, StaffUser } from "./schedule-types";

type Props = {
  onSuccess?: () => void;
  onClose?: () => void;
};

type DraftAssignment = {
  _id?: string;
  assignmentId?: string;
  role?: string;
  unitArea?: string;
  shiftType?: string;
  shiftTag?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  state?: string;
  staffId?: { _id?: string; name?: string } | string | null;
  warnings?: {
    projectedWeekMinutes?: number;
    overtimeMinutes?: number;
    consecutiveDaysIfAssigned?: number;
  };
};

type DraftSchedule = {
  _id?: string;
  status?: string;
  createdAt?: string;
  assignments?: DraftAssignment[];
  summary?: { generatedAssignmentCount?: number };
  facilityPolicy?: { weeklyOvertimeThresholdHours?: number };
};

type EditForm = {
  staffId: string;
  startTime: string;
  endTime: string;
  notes: string;
  state: string;
  force: boolean;
};

const DRAFT_EDITABLE_STATES = new Set(["proposed", "locked", "removed"]);
const ASSIGNMENT_STATES = ["proposed", "locked", "removed"];

function formatDatePart(value?: string) {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimePart(value?: string) {
  if (!value) return "--:--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTimeWindow(startTime?: string, endTime?: string) {
  return `${formatDatePart(startTime)} | ${formatTimePart(startTime)} - ${formatTimePart(endTime)}`;
}

function toDateTimeLocalInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoFromLocalInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function getAssignmentId(assignment: DraftAssignment) {
  return String(assignment?.assignmentId || assignment?._id || "");
}

function isPublishableState(state?: string) {
  return state === "proposed" || state === "locked";
}

function getWarningChips(assignment: DraftAssignment, thresholdHours: number) {
  const warnings = assignment?.warnings || {};
  const chips: { key: string; label: string; tone: "danger" | "warning" }[] =
    [];
  const projectedWeekMinutes = Number(warnings.projectedWeekMinutes) || 0;
  const thresholdMinutes = Number(thresholdHours || 40) * 60;
  const closeWindowMinutes = Math.max(0, thresholdMinutes - 4 * 60);

  if (projectedWeekMinutes >= thresholdMinutes) {
    chips.push({ key: "over40", label: "40h+ projected", tone: "danger" });
  } else if (projectedWeekMinutes >= closeWindowMinutes) {
    chips.push({ key: "near40", label: "Close to 40h", tone: "warning" });
  }

  if (Number(warnings.overtimeMinutes) > 0) {
    chips.push({ key: "overtime", label: "Overtime risk", tone: "warning" });
  }

  if (Number(warnings.consecutiveDaysIfAssigned) >= 5) {
    chips.push({ key: "streak", label: "Consecutive days", tone: "warning" });
  }

  return chips;
}

function PickerModal({
  open,
  title,
  value,
  options,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtnSmall}>
              <Feather name="x" size={18} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalList}>
            {options.length === 0 ? (
              <Text style={styles.emptyInline}>No options available.</Text>
            ) : (
              options.map((option) => {
                const selected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    disabled={option.disabled}
                    style={[
                      styles.modalItem,
                      selected ? styles.modalItemSelected : null,
                      option.disabled ? styles.modalItemDisabled : null,
                    ]}
                    onPress={() => {
                      onSelect(option.value);
                      onClose();
                    }}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        selected ? styles.modalItemTextSelected : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {selected ? (
                      <Feather name="check" size={15} color="#1d4ed8" />
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PickerField({
  title,
  value,
  placeholder,
  options,
  disabled,
  onChange,
}: {
  title: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    options.find((item) => item.value === value)?.label || value || placeholder;

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{title}</Text>
      <Pressable
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        style={[
          styles.selectField,
          disabled ? styles.selectFieldDisabled : null,
        ]}
      >
        <Text
          style={[styles.selectText, !value ? styles.selectTextMuted : null]}
        >
          {selectedLabel}
        </Text>
        <Feather name="chevron-down" size={15} color="#6b7280" />
      </Pressable>

      <PickerModal
        open={open}
        title={title}
        value={value}
        options={options}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

export default function AutoGenerateScheduleForm({
  onSuccess,
  onClose,
}: Props) {
  const { tenant } = useAuth();

  const [coverages, setCoverages] = useState<CoverageItem[]>([]);
  const [selectedCoverageIds, setSelectedCoverageIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [fetchingCoverages, setFetchingCoverages] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [drafts, setDrafts] = useState<DraftSchedule[]>([]);
  const [activeDraftId, setActiveDraftId] = useState("");
  const [activeDraft, setActiveDraft] = useState<DraftSchedule | null>(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [loadingDraftDetail, setLoadingDraftDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>(
    [],
  );
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [editForm, setEditForm] = useState<EditForm>({
    staffId: "",
    startTime: "",
    endTime: "",
    notes: "",
    state: "proposed",
    force: false,
  });

  const [facilityPreferences, setFacilityPreferences] = useState<{
    roleFamilies?: unknown[];
  } | null>(null);

  const roleOptions = useMemo(() => {
    const facilityOptions =
      getRoleOptionsFromFacilityPreferences(facilityPreferences);
    if (facilityOptions.length > 0) {
      return facilityOptions;
    }
    return getRoleOptionsForIndustry(tenant?.industry);
  }, [facilityPreferences, tenant?.industry]);

  const roleFilterOptions = useMemo(
    () => [
      { value: "", label: "All Roles" },
      ...roleOptions.map((item) => ({ value: item.value, label: item.label })),
    ],
    [roleOptions],
  );

  const selectableCoverageIds = useMemo(
    () =>
      coverages
        .filter((coverage) => Number(coverage.remaining) > 0)
        .map((coverage) => String(coverage._id || ""))
        .filter(Boolean),
    [coverages],
  );

  const selectedSelectableCount = useMemo(
    () =>
      selectedCoverageIds.filter((id) => selectableCoverageIds.includes(id))
        .length,
    [selectedCoverageIds, selectableCoverageIds],
  );

  const allSelectableSelected =
    selectableCoverageIds.length > 0 &&
    selectedSelectableCount === selectableCoverageIds.length;
  const hasSomeSelectableSelected =
    selectedSelectableCount > 0 && !allSelectableSelected;

  const staffById = useMemo(() => {
    const map = new Map<string, StaffUser>();
    staffList.forEach((staff) => {
      if (staff?._id) {
        map.set(String(staff._id), staff);
      }
    });
    return map;
  }, [staffList]);

  const activeAssignments = useMemo(() => {
    const assignments = Array.isArray(activeDraft?.assignments)
      ? activeDraft.assignments
      : [];

    return [...assignments].sort(
      (a, b) =>
        new Date(a.startTime || "").getTime() -
        new Date(b.startTime || "").getTime(),
    );
  }, [activeDraft]);

  const publishableAssignments = useMemo(
    () =>
      activeAssignments.filter((assignment) =>
        isPublishableState(assignment.state),
      ),
    [activeAssignments],
  );

  const publishableAssignmentIdSet = useMemo(
    () =>
      new Set(
        publishableAssignments.map((assignment) => getAssignmentId(assignment)),
      ),
    [publishableAssignments],
  );

  const selectedPublishableCount = selectedAssignmentIds.filter((id) =>
    publishableAssignmentIdSet.has(id),
  ).length;

  const overtimeThresholdHours =
    Number(activeDraft?.facilityPolicy?.weeklyOvertimeThresholdHours) || 40;

  const allPublishableSelected =
    publishableAssignments.length > 0 &&
    publishableAssignments.every((assignment) =>
      selectedAssignmentIds.includes(getAssignmentId(assignment)),
    );

  const somePublishableSelected =
    selectedPublishableCount > 0 && !allPublishableSelected;

  const assignmentsByDay = useMemo(() => {
    const grouped = new Map<string, DraftAssignment[]>();

    activeAssignments.forEach((assignment) => {
      const start = new Date(assignment.startTime || "");
      const dayLabel = Number.isNaN(start.getTime())
        ? "Unknown date"
        : start.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          });

      if (!grouped.has(dayLabel)) {
        grouped.set(dayLabel, []);
      }

      grouped.get(dayLabel)?.push(assignment);
    });

    return Array.from(grouped.entries()).map(([dayLabel, assignments]) => ({
      dayLabel,
      assignments,
    }));
  }, [activeAssignments]);

  const loadCoverages = async () => {
    setFetchingCoverages(true);
    try {
      const res = await api.get("/coverage/unfilled-auto");
      const now = new Date();
      const upcoming = (Array.isArray(res.data) ? res.data : [])
        .filter(
          (coverage) =>
            new Date(coverage.endTime || "") >= now &&
            (!selectedRole || isRoleCompatible(selectedRole, coverage.role)),
        )
        .map((coverage) => {
          const requiredCount = Number(coverage.requiredCount) || 0;
          const assignedCount = Number(coverage.assignedCount);
          const directRemaining = Number(coverage.remaining);
          const computedRemaining = Number.isFinite(assignedCount)
            ? Math.max(0, requiredCount - assignedCount)
            : Math.max(0, requiredCount);

          return {
            ...coverage,
            requiredCount,
            remaining: Number.isFinite(directRemaining)
              ? Math.max(0, directRemaining)
              : computedRemaining,
          } as CoverageItem;
        });

      setCoverages(upcoming);
      setSelectedCoverageIds((prev) =>
        prev.filter((id) =>
          upcoming.some((coverage) => String(coverage._id || "") === id),
        ),
      );
    } catch (err) {
      console.warn("Failed to fetch coverage", err);
      setCoverages([]);
    } finally {
      setFetchingCoverages(false);
    }
  };

  const loadStaff = async () => {
    try {
      const res = await api.get("/auth/users");
      setStaffList(Array.isArray(res.data) ? (res.data as StaffUser[]) : []);
    } catch (err) {
      console.warn("Failed to fetch staff", err);
      setStaffList([]);
    }
  };

  const loadDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const res = await api.get("/schedules/draft-schedules", {
        params: { status: "all", limit: 25 },
      });

      const list = (Array.isArray(res.data) ? res.data : []).filter((draft) =>
        ["draft", "partially_published"].includes(String(draft?.status || "")),
      ) as DraftSchedule[];

      setDrafts(list);

      const stillExists = list.some((draft) => draft._id === activeDraftId);
      if (!activeDraftId && list[0]?._id) {
        setActiveDraftId(String(list[0]._id));
      } else if (activeDraftId && !stillExists) {
        setActiveDraftId(String(list[0]?._id || ""));
      }
    } catch (err) {
      console.warn("Failed to fetch drafts", err);
      setDrafts([]);
      setActiveDraftId("");
      setActiveDraft(null);
    } finally {
      setLoadingDrafts(false);
    }
  };

  const loadDraftDetail = async (draftId: string) => {
    if (!draftId) {
      setActiveDraft(null);
      setSelectedAssignmentIds([]);
      setEditingAssignmentId("");
      return;
    }

    setLoadingDraftDetail(true);
    try {
      const res = await api.get(`/schedules/draft-schedules/${draftId}`);
      const draft = (res.data || null) as DraftSchedule | null;
      setActiveDraft(draft);

      const publishableIds = (draft?.assignments || [])
        .filter((assignment) => isPublishableState(assignment.state))
        .map((assignment) => getAssignmentId(assignment));

      setSelectedAssignmentIds((prev) =>
        prev.filter((id) => publishableIds.includes(id)),
      );
      setEditingAssignmentId("");
    } catch (err) {
      console.warn("Failed to fetch draft detail", err);
      setActiveDraft(null);
      setSelectedAssignmentIds([]);
      setEditingAssignmentId("");
    } finally {
      setLoadingDraftDetail(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function loadFacilityPreferences() {
      try {
        const res = await api.get("/facility-preferences");
        if (!mounted) return;
        setFacilityPreferences(
          (res.data || null) as { roleFamilies?: unknown[] } | null,
        );
      } catch {
        if (!mounted) return;
        setFacilityPreferences(null);
      }
    }

    loadFacilityPreferences();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    loadCoverages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole]);

  useEffect(() => {
    loadStaff();
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDraftDetail(activeDraftId);
  }, [activeDraftId]);

  const toggleCoverageSelection = (id: string) => {
    setSelectedCoverageIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleToggleAllCoverageSelection = (checked: boolean) => {
    if (checked) {
      setSelectedCoverageIds((prev) =>
        Array.from(new Set([...prev, ...selectableCoverageIds])),
      );
      return;
    }

    setSelectedCoverageIds((prev) =>
      prev.filter((id) => !selectableCoverageIds.includes(id)),
    );
  };

  const handleCreateDraft = async () => {
    if (!selectedCoverageIds.length) {
      setErrorMsg("Select at least one coverage.");
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");
    setCreatingDraft(true);

    try {
      const res = await api.post("/schedules/auto-generate", {
        coverageIds: selectedCoverageIds,
      });

      const responseData = res?.data || {};
      const newDraftId =
        responseData?.draftSchedule?.draftId ||
        responseData?.draftSchedule?._id;
      const didCreateDraft = Boolean(
        responseData?.draftCreated ?? Boolean(newDraftId),
      );

      setSuccessMsg(
        String(
          responseData?.message ||
            (didCreateDraft
              ? "Draft created successfully."
              : "Generation completed."),
        ),
      );

      await Promise.all([loadCoverages(), loadDrafts()]);
      setSelectedCoverageIds([]);
      if (newDraftId) {
        setActiveDraftId(String(newDraftId));
      }
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to create AI draft."
          : "Failed to create AI draft.";

      setErrorMsg(message);
    } finally {
      setCreatingDraft(false);
    }
  };

  const beginEditAssignment = (assignment: DraftAssignment) => {
    const assignmentId = getAssignmentId(assignment);
    setEditingAssignmentId(assignmentId);
    setEditForm({
      staffId: String(
        typeof assignment?.staffId === "string"
          ? assignment.staffId
          : assignment?.staffId?._id || "",
      ),
      startTime: toDateTimeLocalInput(assignment?.startTime),
      endTime: toDateTimeLocalInput(assignment?.endTime),
      notes: assignment?.notes || "",
      state: assignment?.state || "proposed",
      force: false,
    });
  };

  const cancelEditAssignment = () => {
    setEditingAssignmentId("");
    setEditForm({
      staffId: "",
      startTime: "",
      endTime: "",
      notes: "",
      state: "proposed",
      force: false,
    });
  };

  const handleSaveAssignment = async () => {
    if (!activeDraftId || !editingAssignmentId) return;

    const payload: {
      staffId?: string;
      notes?: string;
      state?: string;
      force?: boolean;
      startTime?: string;
      endTime?: string;
    } = {
      staffId: editForm.staffId || undefined,
      notes: editForm.notes,
      state: editForm.state,
      force: editForm.force,
    };

    const startIso = toIsoFromLocalInput(editForm.startTime);
    const endIso = toIsoFromLocalInput(editForm.endTime);

    if (startIso) payload.startTime = startIso;
    if (endIso) payload.endTime = endIso;

    setActionLoading(`save:${editingAssignmentId}`);
    try {
      await api.patch(
        `/schedules/draft-schedules/${activeDraftId}/assignments/${editingAssignmentId}`,
        payload,
      );

      setSuccessMsg("Draft assignment updated.");
      await loadDraftDetail(activeDraftId);
      cancelEditAssignment();
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to update draft assignment."
          : "Failed to update draft assignment.";

      setErrorMsg(message);
    } finally {
      setActionLoading("");
    }
  };

  const handleStateQuickUpdate = async (
    assignment: DraftAssignment,
    nextState: string,
  ) => {
    const assignmentId = getAssignmentId(assignment);
    if (!activeDraftId || !assignmentId) return;

    setActionLoading(`state:${assignmentId}`);
    try {
      await api.patch(
        `/schedules/draft-schedules/${activeDraftId}/assignments/${assignmentId}`,
        { state: nextState },
      );

      setSuccessMsg("Draft updated.");
      await loadDraftDetail(activeDraftId);
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to update assignment state."
          : "Failed to update assignment state.";

      setErrorMsg(message);
    } finally {
      setActionLoading("");
    }
  };

  const toggleAssignmentSelection = (assignmentId: string) => {
    setSelectedAssignmentIds((prev) =>
      prev.includes(assignmentId)
        ? prev.filter((id) => id !== assignmentId)
        : [...prev, assignmentId],
    );
  };

  const handleToggleAllPublishableSelection = (checked: boolean) => {
    const publishableIds = publishableAssignments.map((assignment) =>
      getAssignmentId(assignment),
    );

    if (checked) {
      setSelectedAssignmentIds((prev) =>
        Array.from(new Set([...prev, ...publishableIds])),
      );
      return;
    }

    setSelectedAssignmentIds((prev) =>
      prev.filter((id) => !publishableIds.includes(id)),
    );
  };

  const handlePublishSelected = async () => {
    if (!activeDraftId || selectedPublishableCount <= 0) return;

    setActionLoading("publish:selected");
    try {
      await api.post(`/schedules/draft-schedules/${activeDraftId}/publish`, {
        assignmentIds: selectedAssignmentIds.filter((id) =>
          publishableAssignmentIdSet.has(id),
        ),
      });

      setSuccessMsg("Selected assignments published.");
      await Promise.all([
        loadDraftDetail(activeDraftId),
        loadDrafts(),
        loadCoverages(),
      ]);
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to publish selected assignments."
          : "Failed to publish selected assignments.";

      setErrorMsg(message);
    } finally {
      setActionLoading("");
    }
  };

  const handlePublishAll = async () => {
    if (!activeDraftId || publishableAssignments.length <= 0) return;

    setActionLoading("publish:all");
    try {
      await api.post(`/schedules/draft-schedules/${activeDraftId}/publish`);

      setSuccessMsg("All publishable assignments published.");
      await Promise.all([
        loadDraftDetail(activeDraftId),
        loadDrafts(),
        loadCoverages(),
      ]);
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to publish assignments."
          : "Failed to publish assignments.";

      setErrorMsg(message);
    } finally {
      setActionLoading("");
    }
  };

  const handleDiscardDraft = async () => {
    if (!activeDraftId) return;

    setActionLoading("discard");
    try {
      await api.post(`/schedules/draft-schedules/${activeDraftId}/discard`);
      setSuccessMsg("Draft discarded.");
      await Promise.all([loadDrafts(), loadCoverages()]);
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to discard draft."
          : "Failed to discard draft.";

      setErrorMsg(message);
    } finally {
      setActionLoading("");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Draft Schedule Board</Text>
          <Text style={styles.subtitle}>
            Create drafts from open coverage, edit assignments, and publish.
          </Text>
        </View>

        {onClose ? (
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Feather name="x" size={20} color="#6b7280" />
          </Pressable>
        ) : null}
      </View>

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      {successMsg ? <Text style={styles.success}>{successMsg}</Text> : null}

      <View style={styles.metricsRow}>
        <View style={styles.metricChip}>
          <Text style={styles.metricText}>
            {selectableCoverageIds.length} open coverage
          </Text>
        </View>
        <View style={styles.metricChip}>
          <Text style={styles.metricText}>{drafts.length} active drafts</Text>
        </View>
        <View style={styles.metricChip}>
          <Text style={styles.metricText}>
            {publishableAssignments.length} publishable
          </Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Create Draft from Open Coverage
          </Text>
          <View style={styles.metricChip}>
            <Text style={styles.metricText}>
              {selectableCoverageIds.length} open
            </Text>
          </View>
        </View>

        <PickerField
          title="Role Filter"
          value={selectedRole}
          placeholder="All Roles"
          options={roleFilterOptions}
          onChange={setSelectedRole}
        />

        {fetchingCoverages ? (
          <ActivityIndicator size="small" color="#1d4ed8" />
        ) : (
          <>
            <Pressable
              style={styles.selectAllBtn}
              onPress={() =>
                handleToggleAllCoverageSelection(!allSelectableSelected)
              }
            >
              <View
                style={[
                  styles.checkbox,
                  allSelectableSelected || hasSomeSelectableSelected
                    ? styles.checkboxActive
                    : null,
                ]}
              >
                {allSelectableSelected ? (
                  <Feather name="check" size={13} color="#1d4ed8" />
                ) : hasSomeSelectableSelected ? (
                  <Feather name="minus" size={13} color="#1d4ed8" />
                ) : null}
              </View>
              <Text style={styles.selectAllText}>
                Select all ({selectedSelectableCount}/
                {selectableCoverageIds.length})
              </Text>
            </Pressable>

            <View style={styles.listWrap}>
              {coverages.map((coverage) => {
                const id = String(coverage._id || "");
                const selected = selectedCoverageIds.includes(id);
                const disabled = Number(coverage.remaining) <= 0;
                const scheduledCount = Number.isFinite(
                  Number(coverage.assignedCount),
                )
                  ? Math.max(0, Number(coverage.assignedCount))
                  : Math.max(
                      0,
                      Number(coverage.requiredCount) -
                        Number(coverage.remaining || 0),
                    );

                return (
                  <Pressable
                    key={id || `${coverage.startTime}-${coverage.role}`}
                    style={[
                      styles.coverageCard,
                      selected ? styles.coverageCardSelected : null,
                      disabled ? styles.coverageCardDisabled : null,
                    ]}
                    onPress={() => {
                      if (!disabled && id) {
                        toggleCoverageSelection(id);
                      }
                    }}
                  >
                    <View style={styles.coverageLeft}>
                      <View
                        style={[
                          styles.checkbox,
                          selected ? styles.checkboxActive : null,
                        ]}
                      >
                        {selected ? (
                          <Feather name="check" size={13} color="#1d4ed8" />
                        ) : null}
                      </View>
                      <View style={styles.coverageTextWrap}>
                        <Text style={styles.coverageTitle}>
                          {formatDatePart(coverage.startTime || coverage.date)}{" "}
                          · {getRoleDisplayName(coverage.role)}
                        </Text>
                        <Text style={styles.coverageMeta}>
                          {formatTimePart(coverage.startTime)}-
                          {formatTimePart(coverage.endTime)}
                          {coverage.unitArea
                            ? ` · ${getUnitAreaDisplayName(coverage.unitArea)}`
                            : ""}
                          {coverage.shiftType
                            ? ` · ${getShiftTypeDisplayName(coverage.shiftType)}`
                            : ""}
                          {coverage.shiftTag
                            ? ` · ${getShiftTagDisplayName(coverage.shiftTag)}`
                            : ""}
                        </Text>
                        <Text style={styles.coverageMetaMuted}>
                          {Number(coverage.requiredCount) || 0} required /{" "}
                          {scheduledCount} scheduled
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}

              {coverages.length === 0 ? (
                <Text style={styles.emptyInline}>
                  No unfilled coverage found.
                </Text>
              ) : null}
            </View>

            <Pressable
              style={[
                styles.primaryAction,
                creatingDraft ? styles.actionDisabled : null,
              ]}
              disabled={creatingDraft}
              onPress={handleCreateDraft}
            >
              {creatingDraft ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.primaryActionText}>
                  Create Draft with AI
                </Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Draft Schedules</Text>
          <Pressable
            style={styles.secondaryAction}
            onPress={loadDrafts}
            disabled={loadingDrafts}
          >
            <Text style={styles.secondaryActionText}>
              {loadingDrafts ? "Refreshing..." : "Refresh"}
            </Text>
          </Pressable>
        </View>

        {drafts.length === 0 ? (
          <Text style={styles.emptyInline}>No active drafts yet.</Text>
        ) : (
          <View style={styles.listWrap}>
            {drafts.map((draft) => {
              const selected = String(draft._id || "") === activeDraftId;
              const generated = Number(
                draft?.summary?.generatedAssignmentCount || 0,
              );
              return (
                <Pressable
                  key={String(draft._id || generated)}
                  onPress={() => setActiveDraftId(String(draft._id || ""))}
                  style={[
                    styles.draftCard,
                    selected ? styles.draftCardSelected : null,
                  ]}
                >
                  <View style={styles.draftCardTop}>
                    <Text style={styles.draftCardTitle}>
                      Created {formatDatePart(draft.createdAt)}
                    </Text>
                    <Text style={styles.badgeText}>
                      {String(draft.status || "draft")
                        .replace("_", " ")
                        .toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.draftCardMeta}>
                    {generated} generated assignment(s)
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {activeDraftId ? (
        <View style={styles.workspaceCard}>
          {loadingDraftDetail ? (
            <ActivityIndicator size="small" color="#1d4ed8" />
          ) : (
            <>
              <View style={styles.workspaceTop}>
                <Text style={styles.sectionTitle}>
                  Draft Workspace ({publishableAssignments.length} publishable)
                </Text>
                <View style={styles.workspaceActions}>
                  <Pressable
                    style={styles.secondaryActionDanger}
                    onPress={handleDiscardDraft}
                    disabled={Boolean(actionLoading)}
                  >
                    <Text style={styles.secondaryActionDangerText}>
                      {actionLoading === "discard"
                        ? "Discarding..."
                        : "Discard"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.secondaryAction}
                    onPress={handlePublishSelected}
                    disabled={
                      Boolean(actionLoading) || selectedPublishableCount <= 0
                    }
                  >
                    <Text style={styles.secondaryActionText}>
                      {actionLoading === "publish:selected"
                        ? "Publishing..."
                        : `Publish Selected (${selectedPublishableCount})`}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.primaryActionSmall}
                    onPress={handlePublishAll}
                    disabled={
                      Boolean(actionLoading) ||
                      publishableAssignments.length <= 0
                    }
                  >
                    <Text style={styles.primaryActionText}>
                      {actionLoading === "publish:all"
                        ? "Publishing..."
                        : "Publish All"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={styles.selectAllBtn}
                onPress={() =>
                  handleToggleAllPublishableSelection(!allPublishableSelected)
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    allPublishableSelected || somePublishableSelected
                      ? styles.checkboxActive
                      : null,
                  ]}
                >
                  {allPublishableSelected ? (
                    <Feather name="check" size={13} color="#1d4ed8" />
                  ) : somePublishableSelected ? (
                    <Feather name="minus" size={13} color="#1d4ed8" />
                  ) : null}
                </View>
                <Text style={styles.selectAllText}>
                  Select all publishable ({selectedPublishableCount}/
                  {publishableAssignments.length})
                </Text>
              </Pressable>

              <Text style={styles.infoText}>
                Overtime threshold: {overtimeThresholdHours}h. Close to
                threshold appears when projected weekly load is within 4h.
              </Text>

              {activeAssignments.length === 0 ? (
                <Text style={styles.emptyInline}>
                  This draft has no assignments.
                </Text>
              ) : (
                assignmentsByDay.map((group) => (
                  <View key={group.dayLabel} style={styles.dayGroup}>
                    <Text style={styles.dayLabel}>{group.dayLabel}</Text>

                    {group.assignments.map((assignment) => {
                      const assignmentId = getAssignmentId(assignment);
                      const chips = getWarningChips(
                        assignment,
                        overtimeThresholdHours,
                      );
                      const isEditable = DRAFT_EDITABLE_STATES.has(
                        String(assignment?.state || ""),
                      );
                      const isEditing = editingAssignmentId === assignmentId;

                      const staffId = String(
                        typeof assignment?.staffId === "string"
                          ? assignment.staffId
                          : assignment?.staffId?._id || "",
                      );

                      const staffName =
                        (typeof assignment?.staffId === "object" &&
                          assignment?.staffId?.name) ||
                        staffById.get(staffId)?.name ||
                        "Unknown";

                      const selected =
                        selectedAssignmentIds.includes(assignmentId);

                      return (
                        <View
                          key={
                            assignmentId ||
                            `${staffName}-${assignment.startTime}`
                          }
                          style={[
                            styles.assignmentCard,
                            selected ? styles.assignmentCardSelected : null,
                          ]}
                        >
                          <View style={styles.assignmentTop}>
                            <View style={styles.assignmentMain}>
                              <Pressable
                                style={[
                                  styles.checkbox,
                                  selected ? styles.checkboxActive : null,
                                ]}
                                disabled={!isPublishableState(assignment.state)}
                                onPress={() => {
                                  if (isPublishableState(assignment.state)) {
                                    toggleAssignmentSelection(assignmentId);
                                  }
                                }}
                              >
                                {selected ? (
                                  <Feather
                                    name="check"
                                    size={13}
                                    color="#1d4ed8"
                                  />
                                ) : null}
                              </Pressable>

                              <View style={styles.assignmentTextWrap}>
                                <Text style={styles.assignmentTitle}>
                                  {staffName} ·{" "}
                                  {getRoleDisplayName(assignment.role)}
                                </Text>
                                <Text style={styles.assignmentMeta}>
                                  {formatDateTimeWindow(
                                    assignment.startTime,
                                    assignment.endTime,
                                  )}
                                  {assignment.unitArea
                                    ? ` · ${getUnitAreaDisplayName(assignment.unitArea)}`
                                    : ""}
                                  {assignment.shiftType
                                    ? ` · ${getShiftTypeDisplayName(assignment.shiftType)}`
                                    : ""}
                                  {assignment.shiftTag
                                    ? ` · ${getShiftTagDisplayName(assignment.shiftTag)}`
                                    : ""}
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.badgeText}>
                              {String(assignment.state || "").toUpperCase()}
                            </Text>
                          </View>

                          {chips.length > 0 ? (
                            <View style={styles.warningChipWrap}>
                              {chips.map((chip) => (
                                <View
                                  key={`${assignmentId}-${chip.key}`}
                                  style={[
                                    styles.warningChip,
                                    chip.tone === "danger"
                                      ? styles.warningChipDanger
                                      : styles.warningChipWarn,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.warningChipText,
                                      chip.tone === "danger"
                                        ? styles.warningChipDangerText
                                        : styles.warningChipWarnText,
                                    ]}
                                  >
                                    {chip.label}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          ) : null}

                          {isEditable ? (
                            <View style={styles.assignmentActionRow}>
                              {!isEditing ? (
                                <Pressable
                                  style={styles.smallAction}
                                  onPress={() =>
                                    beginEditAssignment(assignment)
                                  }
                                >
                                  <Text style={styles.smallActionText}>
                                    Edit
                                  </Text>
                                </Pressable>
                              ) : null}

                              {assignment.state !== "locked" ? (
                                <Pressable
                                  style={styles.smallAction}
                                  disabled={Boolean(actionLoading)}
                                  onPress={() =>
                                    handleStateQuickUpdate(assignment, "locked")
                                  }
                                >
                                  <Text style={styles.smallActionText}>
                                    Lock
                                  </Text>
                                </Pressable>
                              ) : (
                                <Pressable
                                  style={styles.smallAction}
                                  disabled={Boolean(actionLoading)}
                                  onPress={() =>
                                    handleStateQuickUpdate(
                                      assignment,
                                      "proposed",
                                    )
                                  }
                                >
                                  <Text style={styles.smallActionText}>
                                    Unlock
                                  </Text>
                                </Pressable>
                              )}

                              {assignment.state !== "removed" ? (
                                <Pressable
                                  style={styles.smallActionDanger}
                                  disabled={Boolean(actionLoading)}
                                  onPress={() =>
                                    handleStateQuickUpdate(
                                      assignment,
                                      "removed",
                                    )
                                  }
                                >
                                  <Text style={styles.smallActionDangerText}>
                                    Remove
                                  </Text>
                                </Pressable>
                              ) : (
                                <Pressable
                                  style={styles.smallAction}
                                  disabled={Boolean(actionLoading)}
                                  onPress={() =>
                                    handleStateQuickUpdate(
                                      assignment,
                                      "proposed",
                                    )
                                  }
                                >
                                  <Text style={styles.smallActionText}>
                                    Restore
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                          ) : null}

                          {isEditing ? (
                            <View style={styles.editCard}>
                              <PickerField
                                title="Staff"
                                value={editForm.staffId}
                                placeholder="Select staff"
                                options={staffList
                                  .filter((member) => Boolean(member._id))
                                  .map((member) => ({
                                    value: String(member._id),
                                    label:
                                      member.name ||
                                      member._id ||
                                      "Unknown staff",
                                  }))}
                                onChange={(value) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    staffId: value,
                                  }))
                                }
                              />

                              <View style={styles.editRow}>
                                <View style={styles.fieldGroup}>
                                  <Text style={styles.fieldLabel}>Start</Text>
                                  <TextInput
                                    value={editForm.startTime}
                                    onChangeText={(text) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        startTime: text,
                                      }))
                                    }
                                    style={styles.input}
                                    placeholder="YYYY-MM-DDTHH:mm"
                                  />
                                </View>

                                <View style={styles.fieldGroup}>
                                  <Text style={styles.fieldLabel}>End</Text>
                                  <TextInput
                                    value={editForm.endTime}
                                    onChangeText={(text) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        endTime: text,
                                      }))
                                    }
                                    style={styles.input}
                                    placeholder="YYYY-MM-DDTHH:mm"
                                  />
                                </View>
                              </View>

                              <PickerField
                                title="State"
                                value={editForm.state}
                                placeholder="Select state"
                                options={ASSIGNMENT_STATES.map((state) => ({
                                  value: state,
                                  label:
                                    state.charAt(0).toUpperCase() +
                                    state.slice(1),
                                }))}
                                onChange={(value) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    state: value,
                                  }))
                                }
                              />

                              <View style={styles.fieldGroup}>
                                <Text style={styles.fieldLabel}>Notes</Text>
                                <TextInput
                                  value={editForm.notes}
                                  onChangeText={(text) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      notes: text,
                                    }))
                                  }
                                  style={[styles.input, styles.notesInput]}
                                  multiline
                                />
                              </View>

                              <View style={styles.switchRow}>
                                <Text style={styles.fieldLabel}>
                                  Force override checks
                                </Text>
                                <Switch
                                  value={editForm.force}
                                  onValueChange={(value) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      force: value,
                                    }))
                                  }
                                />
                              </View>

                              <View style={styles.editActions}>
                                <Pressable
                                  style={styles.primaryActionSmall}
                                  disabled={
                                    actionLoading ===
                                    `save:${editingAssignmentId}`
                                  }
                                  onPress={handleSaveAssignment}
                                >
                                  <Text style={styles.primaryActionText}>
                                    {actionLoading ===
                                    `save:${editingAssignmentId}`
                                      ? "Saving..."
                                      : "Save"}
                                  </Text>
                                </Pressable>

                                <Pressable
                                  style={styles.secondaryAction}
                                  onPress={cancelEditAssignment}
                                >
                                  <Text style={styles.secondaryActionText}>
                                    Cancel
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ))
              )}
            </>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  closeBtn: {
    padding: 8,
    marginRight: 2,
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricChip: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f0f9ff",
  },
  metricText: {
    color: "#1e3a8a",
    fontSize: 11,
    fontWeight: "700",
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 12,
    backgroundColor: "#f8fbff",
    padding: 12,
    gap: 10,
  },
  workspaceCard: {
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  rolesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rolePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  rolePillActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  rolePillText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  rolePillTextActive: {
    color: "#1d4ed8",
  },
  fieldLabel: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  listWrap: {
    gap: 8,
  },
  coverageCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 8,
  },
  coverageCardSelected: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  coverageCardDisabled: {
    opacity: 0.6,
  },
  coverageLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#9ca3af",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    marginTop: 2,
  },
  checkboxActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  coverageTextWrap: {
    flex: 1,
    gap: 2,
  },
  coverageTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  coverageMeta: {
    color: "#6b7280",
    fontSize: 12,
  },
  coverageMetaMuted: {
    color: "#64748b",
    fontSize: 11,
  },
  draftCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 6,
  },
  draftCardSelected: {
    borderColor: "#1d4ed8",
    backgroundColor: "#eff6ff",
  },
  draftCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  draftCardTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  draftCardMeta: {
    color: "#6b7280",
    fontSize: 12,
  },
  badgeText: {
    color: "#374151",
    fontSize: 10,
    fontWeight: "800",
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  workspaceTop: {
    gap: 8,
  },
  workspaceActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayGroup: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
    gap: 8,
  },
  dayLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  assignmentCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 8,
  },
  assignmentCardSelected: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  assignmentTop: {
    gap: 8,
  },
  assignmentMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  assignmentTextWrap: {
    flex: 1,
    gap: 2,
  },
  assignmentTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  assignmentMeta: {
    color: "#6b7280",
    fontSize: 12,
  },
  warningChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  warningChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  warningChipWarn: {
    borderColor: "#fbbf24",
    backgroundColor: "#fffbeb",
  },
  warningChipDanger: {
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
  },
  warningChipText: {
    fontSize: 10,
    fontWeight: "700",
  },
  warningChipWarnText: {
    color: "#b45309",
  },
  warningChipDangerText: {
    color: "#b91c1c",
  },
  assignmentActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  smallAction: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  smallActionText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  smallActionDanger: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  smallActionDangerText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  editCard: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    backgroundColor: "#f8fbff",
    padding: 10,
    gap: 8,
  },
  editRow: {
    flexDirection: "row",
    gap: 8,
  },
  fieldGroup: {
    flex: 1,
    gap: 6,
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    color: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  switchRow: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  selectField: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectFieldDisabled: {
    backgroundColor: "#f3f4f6",
    opacity: 0.75,
  },
  selectText: {
    color: "#111827",
    fontSize: 12,
    flex: 1,
  },
  selectTextMuted: {
    color: "#94a3b8",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    maxHeight: "85%",
    padding: 12,
    gap: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  closeBtnSmall: {
    padding: 8,
  },
  modalList: {
    gap: 6,
  },
  modalItem: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  modalItemSelected: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  modalItemDisabled: {
    opacity: 0.55,
  },
  modalItemText: {
    color: "#374151",
    fontSize: 12,
    flex: 1,
  },
  modalItemTextSelected: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  selectAllBtn: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectAllText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  infoText: {
    color: "#1e40af",
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  emptyInline: {
    color: "#6b7280",
    fontSize: 12,
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
  success: {
    color: "#065f46",
    backgroundColor: "#d1fae5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  primaryAction: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#b45309",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryActionSmall: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryActionText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  secondaryAction: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryActionDanger: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryActionDangerText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  actionDisabled: {
    opacity: 0.6,
  },
});
