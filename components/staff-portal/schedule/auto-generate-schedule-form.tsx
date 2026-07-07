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

import MonthCalendar from "@/components/staff-portal/shared/month-calendar";
import api from "@/config/api";
import {
  getRoleDisplayName,
  getShiftTagDisplayName,
  getShiftTypeDisplayName,
  getUnitAreaDisplayName,
  isRoleCompatible,
} from "@/constants/industry-roles";

import { CoverageItem, ScheduleItem, StaffUser } from "./schedule-types";

type Props = {
  onSuccess?: () => void;
  onClose?: () => void;
  schedules?: ScheduleItem[];
};

type DraftAssignment = {
  _id?: string;
  assignmentId?: string;
  coverageId?: { _id?: string } | string | null;
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
  __workspaceDraftId?: string;
  __calendarDraftId?: string;
};

type DraftSchedule = {
  _id?: string;
  status?: string;
  createdAt?: string;
  assignments?: DraftAssignment[];
  summary?: { generatedAssignmentCount?: number };
  facilityPolicy?: { weeklyOvertimeThresholdHours?: number };
  coverageSnapshot?: CoverageItem[];
  coverages?: CoverageItem[];
  sourceCoverages?: CoverageItem[];
  inputCoverages?: CoverageItem[];
  requestedCoverages?: CoverageItem[];
  coverageIds?: string[];
  sourceCoverageIds?: string[];
  inputCoverageIds?: string[];
};

type EditForm = {
  staffId: string;
  startTime: string;
  endTime: string;
  notes: string;
  state: string;
  force: boolean;
};

type CoverageCandidate = {
  coverageKey: string;
  rawCoverageId: string;
  draftScope: string;
  start: Date;
  end: Date;
  startTime: string;
  endTime: string;
  role: string;
  unitArea: string;
  shiftType: string;
  shiftTag: string;
  requiredCertificationTags: string[];
  requiredCount: number;
  spotsRemaining: number;
};

type WarningChip = {
  key: string;
  label: string;
  tone: "danger" | "warning";
};

const DRAFT_EDITABLE_STATES = new Set([
  "proposed",
  "locked",
  "removed",
  "unfilled",
]);

const ASSIGNMENT_STATES = ["proposed", "unfilled", "locked", "removed"];

const DRAFT_STATE_META: Record<
  string,
  { label: string; bg: string; border: string; text: string; accent: string }
> = {
  proposed: {
    label: "Proposed",
    bg: "#dbeafe",
    border: "#93c5fd",
    text: "#1e3a8a",
    accent: "#1d4ed8",
  },
  locked: {
    label: "Locked",
    bg: "#ccfbf1",
    border: "#5eead4",
    text: "#115e59",
    accent: "#0f766e",
  },
  removed: {
    label: "Removed",
    bg: "#f3f4f6",
    border: "#d1d5db",
    text: "#374151",
    accent: "#6b7280",
  },
  unfilled: {
    label: "Unfilled",
    bg: "#ffedd5",
    border: "#fdba74",
    text: "#9a3412",
    accent: "#ea580c",
  },
  published: {
    label: "Published",
    bg: "#dcfce7",
    border: "#86efac",
    text: "#166534",
    accent: "#15803d",
  },
};

const COVERAGE_STATUS_META: Record<
  string,
  { label: string; bg: string; border: string; text: string }
> = {
  unfilled: {
    label: "Needs coverage",
    bg: "#ffedd5",
    border: "#fdba74",
    text: "#9a3412",
  },
  partial: {
    label: "Partially filled",
    bg: "#fef3c7",
    border: "#fcd34d",
    text: "#92400e",
  },
  full: {
    label: "Fully filled",
    bg: "#dcfce7",
    border: "#86efac",
    text: "#166534",
  },
  pastGap: {
    label: "Past gap",
    bg: "#f3f4f6",
    border: "#d1d5db",
    text: "#4b5563",
  },
  pastCovered: {
    label: "Past covered",
    bg: "#e5e7eb",
    border: "#d1d5db",
    text: "#4b5563",
  },
};

function getDraftStateMeta(state?: string) {
  return (
    DRAFT_STATE_META[String(state || "").toLowerCase()] || {
      label: String(state || "Draft"),
      bg: "#e2e8f0",
      border: "#cbd5e1",
      text: "#0f172a",
      accent: "#334155",
    }
  );
}

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
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getLocalDayKey(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCoverageId(coverage: CoverageItem) {
  return String(coverage?._id || "");
}

function getAssignmentCoverageId(assignment: DraftAssignment) {
  if (typeof assignment?.coverageId === "string") {
    return assignment.coverageId;
  }

  return String(assignment?.coverageId?._id || "");
}

function getAssignmentId(assignment: DraftAssignment) {
  return String(assignment?.assignmentId || assignment?._id || "");
}

function getScopedAssignmentId(draftId: string, assignmentId: string) {
  return `${String(draftId || "")}:${String(assignmentId || "")}`;
}

function splitScopedAssignmentId(scopedId: string) {
  const [draftId = "", ...assignmentParts] = String(scopedId || "").split(":");
  return {
    draftId,
    assignmentId: assignmentParts.join(":"),
  };
}

function normalizeTag(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function toNormalizedSet(values: unknown) {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeTag(value))
      .filter(Boolean),
  );
}

function doesCoverageMatchStaffTags(staff: StaffUser, coverage: CoverageItem) {
  const allowedAreas = toNormalizedSet(staff?.allowedAreas);
  const allowedShiftTypes = toNormalizedSet(staff?.allowedShiftTypes);
  const certificationTags = toNormalizedSet(staff?.certificationTags);

  const hasTagRestrictions =
    allowedAreas.size > 0 ||
    allowedShiftTypes.size > 0 ||
    certificationTags.size > 0;

  if (!hasTagRestrictions) {
    return true;
  }

  if (allowedAreas.size > 0) {
    const coverageArea = normalizeTag(coverage?.unitArea);
    if (!coverageArea || !allowedAreas.has(coverageArea)) {
      return false;
    }
  }

  if (allowedShiftTypes.size > 0) {
    const coverageShiftType = normalizeTag(coverage?.shiftType);
    const coverageShiftTag = normalizeTag(coverage?.shiftTag);

    if (!coverageShiftType) {
      return false;
    }

    const exactShiftSlot = coverageShiftTag
      ? `${coverageShiftType}:${coverageShiftTag}`
      : "";
    const matchesByType = Array.from(allowedShiftTypes).some((allowed) =>
      allowed.startsWith(`${coverageShiftType}:`),
    );

    const isShiftMatch =
      (exactShiftSlot && allowedShiftTypes.has(exactShiftSlot)) ||
      allowedShiftTypes.has(coverageShiftType) ||
      (!coverageShiftTag && matchesByType);

    if (!isShiftMatch) {
      return false;
    }
  }

  if (certificationTags.size > 0) {
    const coverageCertTags = (
      Array.isArray(coverage?.requiredCertificationTags)
        ? coverage.requiredCertificationTags
        : []
    )
      .map((tag) => normalizeTag(tag))
      .filter(Boolean);

    const hasRequiredCerts = coverageCertTags.every((tag) =>
      certificationTags.has(tag),
    );

    if (!hasRequiredCerts) {
      return false;
    }
  }

  return true;
}

function isLiveScheduleMatchingCoverage(
  schedule: ScheduleItem,
  coverage: CoverageItem,
) {
  if (!schedule || !coverage) return false;
  if (String(schedule.status || "").toLowerCase() === "call_out") return false;

  const scheduleStartMs = new Date(schedule.startTime || "").getTime();
  const scheduleEndMs = new Date(schedule.endTime || "").getTime();
  const coverageStartMs = new Date(coverage.startTime || "").getTime();
  const coverageEndMs = new Date(coverage.endTime || "").getTime();

  if (
    Number.isNaN(scheduleStartMs) ||
    Number.isNaN(scheduleEndMs) ||
    Number.isNaN(coverageStartMs) ||
    Number.isNaN(coverageEndMs)
  ) {
    return false;
  }

  if (scheduleStartMs !== coverageStartMs || scheduleEndMs !== coverageEndMs) {
    return false;
  }

  if (!isRoleCompatible(schedule.role, coverage.role)) {
    return false;
  }

  const coverageUnit = normalizeTag(coverage.unitArea);
  const scheduleUnit = normalizeTag(schedule.unitArea);
  if (coverageUnit && coverageUnit !== scheduleUnit) {
    return false;
  }

  const coverageShiftType = normalizeTag(coverage.shiftType);
  const scheduleShiftType = normalizeTag(schedule.shiftType);
  if (coverageShiftType && coverageShiftType !== scheduleShiftType) {
    return false;
  }

  const coverageShiftTag = normalizeTag(coverage.shiftTag);
  const scheduleShiftTag = normalizeTag(schedule.shiftTag);
  if (coverageShiftTag && coverageShiftTag !== scheduleShiftTag) {
    return false;
  }

  return true;
}

function buildCoverageSignature(coverage: Partial<CoverageItem>) {
  const startMs = new Date(coverage?.startTime || "").getTime();
  const endMs = new Date(coverage?.endTime || "").getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "";
  }

  return [
    startMs,
    endMs,
    normalizeTag(coverage?.role),
    normalizeTag(coverage?.unitArea),
    normalizeTag(coverage?.shiftType),
    normalizeTag(coverage?.shiftTag),
  ].join("|");
}

function isPublishableState(state?: string) {
  return ["proposed", "locked"].includes(String(state || "").toLowerCase());
}

function getWarningChips(
  assignment: DraftAssignment,
  thresholdHours: number,
): WarningChip[] {
  const warnings = assignment?.warnings || {};
  const chips: WarningChip[] = [];
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

function isCoverageCandidate(
  value: CoverageCandidate | null,
): value is CoverageCandidate {
  return value !== null;
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
                    key={`${title}-${option.value || "empty"}`}
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
                        option.disabled ? styles.modalItemTextDisabled : null,
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
          if (!disabled) {
            setOpen(true);
          }
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

function LegendPill({
  dotColor,
  backgroundColor,
  borderColor,
  textColor,
  label,
}: {
  dotColor: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  label: string;
}) {
  return (
    <View style={[styles.legendPill, { backgroundColor, borderColor }]}>
      <View style={[styles.legendDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.legendText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export default function AutoGenerateScheduleForm({
  onSuccess,
  onClose,
  schedules = [],
}: Props) {
  const [coverages, setCoverages] = useState<CoverageItem[]>([]);
  const [drafts, setDrafts] = useState<DraftSchedule[]>([]);
  const [activeDraftId, setActiveDraftId] = useState("");
  const [activeDraft, setActiveDraft] = useState<DraftSchedule | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [selectedDraftDetails, setSelectedDraftDetails] = useState<
    { draftId: string; draft: DraftSchedule | null }[]
  >([]);
  const [loadingSelectedDrafts, setLoadingSelectedDrafts] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [loadingDraftDetail, setLoadingDraftDetail] = useState(false);
  const [fetchingCoverages, setFetchingCoverages] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [coverageActionLoadingId, setCoverageActionLoadingId] = useState("");
  const [assignmentActionLoadingId, setAssignmentActionLoadingId] =
    useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>(
    [],
  );
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [editingAssignmentDraftId, setEditingAssignmentDraftId] = useState("");
  const [draftViewMode, setDraftViewMode] = useState<"calendar" | "list">(
    "calendar",
  );
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(
    getLocalDayKey(new Date()),
  );
  const [dayDetailsOpen, setDayDetailsOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    staffId: "",
    startTime: "",
    endTime: "",
    notes: "",
    state: "proposed",
    force: false,
  });

  const liveSchedules = useMemo(
    () => (Array.isArray(schedules) ? schedules : []),
    [schedules],
  );

  const staffById = useMemo(() => {
    const map = new Map<string, StaffUser>();
    staffList.forEach((staff) => {
      if (staff?._id) {
        map.set(String(staff._id), staff);
      }
    });
    return map;
  }, [staffList]);

  const workspaceDraftDetails = useMemo(() => {
    if (selectedDraftDetails.length > 0) {
      return selectedDraftDetails;
    }

    if (activeDraft?._id) {
      return [{ draftId: String(activeDraft._id), draft: activeDraft }];
    }

    return [] as { draftId: string; draft: DraftSchedule | null }[];
  }, [activeDraft, selectedDraftDetails]);

  const workspaceAssignments = useMemo(() => {
    const assignments = workspaceDraftDetails.flatMap(({ draft, draftId }) =>
      (Array.isArray(draft?.assignments) ? draft.assignments : []).map(
        (assignment) => ({
          ...assignment,
          __workspaceDraftId: String(draftId || ""),
        }),
      ),
    );

    return [...assignments].sort(
      (a, b) =>
        new Date(a.startTime || "").getTime() -
        new Date(b.startTime || "").getTime(),
    );
  }, [workspaceDraftDetails]);

  const calendarAssignments = useMemo(() => {
    const assignments = selectedDraftDetails.flatMap(({ draft, draftId }) =>
      (Array.isArray(draft?.assignments) ? draft.assignments : []).map(
        (assignment) => ({
          ...assignment,
          __calendarDraftId: String(draftId || ""),
        }),
      ),
    );

    return [...assignments].sort(
      (a, b) =>
        new Date(a.startTime || "").getTime() -
        new Date(b.startTime || "").getTime(),
    );
  }, [selectedDraftDetails]);

  const publishableAssignments = useMemo(
    () =>
      workspaceAssignments.filter((assignment) =>
        isPublishableState(assignment.state),
      ),
    [workspaceAssignments],
  );

  const publishableAssignmentIdSet = useMemo(
    () =>
      new Set(
        publishableAssignments.map((assignment) =>
          getScopedAssignmentId(
            String(assignment.__workspaceDraftId || ""),
            getAssignmentId(assignment),
          ),
        ),
      ),
    [publishableAssignments],
  );

  const selectedPublishableCount = selectedAssignmentIds.filter((id) =>
    publishableAssignmentIdSet.has(id),
  ).length;

  const allPublishableSelected =
    publishableAssignments.length > 0 &&
    publishableAssignments.every((assignment) =>
      selectedAssignmentIds.includes(
        getScopedAssignmentId(
          String(assignment.__workspaceDraftId || ""),
          getAssignmentId(assignment),
        ),
      ),
    );

  const somePublishableSelected =
    selectedPublishableCount > 0 && !allPublishableSelected;

  const overtimeThresholdHours =
    Number(activeDraft?.facilityPolicy?.weeklyOvertimeThresholdHours) || 40;

  const assignmentsByDay = useMemo(() => {
    const grouped = new Map<string, DraftAssignment[]>();

    workspaceAssignments.forEach((assignment) => {
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
  }, [workspaceAssignments]);

  const proposedCountByCoverageKey = useMemo(() => {
    const counts = new Map<string, number>();

    calendarAssignments
      .filter((assignment) => String(assignment?.state || "") === "proposed")
      .forEach((assignment) => {
        const rawCoverageId = getAssignmentCoverageId(assignment);
        if (!rawCoverageId) return;
        const coverageKey = `${String(assignment.__calendarDraftId || "")}:${rawCoverageId}`;
        counts.set(coverageKey, (counts.get(coverageKey) || 0) + 1);
      });

    return counts;
  }, [calendarAssignments]);

  const draftCoverageCandidates = useMemo(() => {
    const source = selectedDraftDetails.flatMap(({ draft, draftId }) => {
      const direct = [
        draft?.coverageSnapshot,
        draft?.coverages,
        draft?.sourceCoverages,
        draft?.inputCoverages,
        draft?.requestedCoverages,
      ].find((item) => Array.isArray(item) && item.length > 0);

      if (direct) {
        return direct.map((coverage) => ({ coverage, draftId }));
      }

      const draftCoverageIds = [
        ...(Array.isArray(draft?.coverageIds) ? draft.coverageIds : []),
        ...(Array.isArray(draft?.sourceCoverageIds)
          ? draft.sourceCoverageIds
          : []),
        ...(Array.isArray(draft?.inputCoverageIds)
          ? draft.inputCoverageIds
          : []),
      ]
        .map((id) => String(id))
        .filter(Boolean);

      if (draftCoverageIds.length > 0) {
        return coverages
          .filter((coverage) =>
            draftCoverageIds.includes(String(coverage?._id || "")),
          )
          .map((coverage) => ({ coverage, draftId }));
      }

      return [] as { coverage: CoverageItem; draftId: string }[];
    });

    return source
      .map(({ coverage, draftId }) => {
        const rawCoverageId = getCoverageId(coverage);
        const draftScope = String(draftId || "");
        const coverageKey = `${draftScope}:${rawCoverageId}`;
        const startTime = coverage?.startTime;
        const endTime = coverage?.endTime;
        const start = new Date(startTime || "");
        const end = new Date(endTime || "");

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return null;
        }

        return {
          coverageKey,
          rawCoverageId,
          draftScope,
          start,
          end,
          startTime: startTime || "",
          endTime: endTime || "",
          role: String(coverage?.role || ""),
          unitArea: String(coverage?.unitArea || ""),
          shiftType: String(coverage?.shiftType || ""),
          shiftTag: String(coverage?.shiftTag || ""),
          requiredCertificationTags: Array.isArray(
            coverage?.requiredCertificationTags,
          )
            ? coverage.requiredCertificationTags
            : [],
          requiredCount: toFiniteNumber(coverage?.requiredCount, 0),
          spotsRemaining: toFiniteNumber(
            coverage?.remaining,
            toFiniteNumber(coverage?.requiredCount, 0),
          ),
        } satisfies CoverageCandidate;
      })
      .filter(isCoverageCandidate);
  }, [coverages, selectedDraftDetails]);

  const draftCoverageIdSet = useMemo(
    () =>
      new Set(
        draftCoverageCandidates
          .map((coverage) => String(coverage.rawCoverageId || ""))
          .filter(Boolean),
      ),
    [draftCoverageCandidates],
  );

  const draftCoverageSignatureSet = useMemo(
    () =>
      new Set(
        draftCoverageCandidates
          .map((coverage) =>
            buildCoverageSignature({
              startTime: coverage.startTime,
              endTime: coverage.endTime,
              role: coverage.role,
              unitArea: coverage.unitArea,
              shiftType: coverage.shiftType,
              shiftTag: coverage.shiftTag,
            }),
          )
          .filter(Boolean),
      ),
    [draftCoverageCandidates],
  );

  const openCoverageItems = useMemo(() => {
    return coverages
      .filter((coverage) => {
        const coverageId = getCoverageId(coverage);
        const coverageSignature = buildCoverageSignature(coverage);
        const representedByDraftId =
          Boolean(coverageId) && draftCoverageIdSet.has(coverageId);
        const representedBySignature =
          Boolean(coverageSignature) &&
          draftCoverageSignatureSet.has(coverageSignature);

        return !representedByDraftId && !representedBySignature;
      })
      .map((coverage) => {
        const requiredCount = Number(coverage?.requiredCount) || 0;
        const liveAssignedCount = liveSchedules.filter((schedule) =>
          isLiveScheduleMatchingCoverage(schedule, coverage),
        ).length;
        const reportedAssignedCount = Number(coverage?.assignedCount);
        const assignedCount = Number.isFinite(reportedAssignedCount)
          ? Math.max(reportedAssignedCount, liveAssignedCount)
          : liveAssignedCount;
        const openCount = Math.max(0, requiredCount - assignedCount);

        return {
          coverage,
          coverageId: getCoverageId(coverage),
          signature: buildCoverageSignature(coverage),
          requiredCount,
          assignedCount,
          openCount,
        };
      })
      .filter((item) => item.openCount > 0)
      .filter((item, index, list) => {
        return (
          list.findIndex((candidate) => {
            if (item.coverageId && candidate.coverageId) {
              return item.coverageId === candidate.coverageId;
            }

            return item.signature && candidate.signature
              ? item.signature === candidate.signature
              : false;
          }) === index
        );
      });
  }, [coverages, draftCoverageIdSet, draftCoverageSignatureSet, liveSchedules]);

  const coverageDetailsByDay = useMemo(() => {
    const detailsByDay = new Map<
      string,
      (CoverageCandidate & {
        proposedCount: number;
        openCount: number;
        fillStatus: string;
        matchingStaffCount: number;
      })[]
    >();

    draftCoverageCandidates.forEach((coverage) => {
      const proposedCount =
        proposedCountByCoverageKey.get(coverage.coverageKey) || 0;
      const requiredCount = Math.max(0, coverage.requiredCount);
      const openCount = Math.max(0, requiredCount - proposedCount);
      const fillStatus =
        openCount <= 0 ? "full" : proposedCount > 0 ? "partial" : "unfilled";
      const matchingStaffCount = staffList.filter((staff) => {
        if (!isRoleCompatible(staff?.role, coverage?.role)) return false;
        return doesCoverageMatchStaffTags(staff, coverage);
      }).length;

      const dayKey = getLocalDayKey(coverage.start);
      if (!dayKey) return;

      if (!detailsByDay.has(dayKey)) {
        detailsByDay.set(dayKey, []);
      }

      detailsByDay.get(dayKey)?.push({
        ...coverage,
        proposedCount,
        openCount,
        fillStatus,
        matchingStaffCount,
      });
    });

    detailsByDay.forEach((entries) => {
      entries.sort((a, b) => a.start.getTime() - b.start.getTime());
    });

    return detailsByDay;
  }, [draftCoverageCandidates, proposedCountByCoverageKey, staffList]);

  const openCoverageByDay = useMemo(() => {
    const grouped = new Map<string, typeof openCoverageItems>();

    openCoverageItems.forEach((item) => {
      const dayKey = getLocalDayKey(item.coverage.startTime || "");
      if (!dayKey) return;
      if (!grouped.has(dayKey)) {
        grouped.set(dayKey, []);
      }
      grouped.get(dayKey)?.push(item);
    });

    return grouped;
  }, [openCoverageItems]);

  const activitySummaryByDay = useMemo(() => {
    const activity = new Map<
      string,
      {
        liveCount: number;
        proposedCount: number;
        unfilledDraftCount: number;
        removedCount: number;
        openCoverageCount: number;
        openCoverageSlots: number;
      }
    >();

    const ensureDay = (dayKey: string) => {
      if (!dayKey) return null;
      if (!activity.has(dayKey)) {
        activity.set(dayKey, {
          liveCount: 0,
          proposedCount: 0,
          unfilledDraftCount: 0,
          removedCount: 0,
          openCoverageCount: 0,
          openCoverageSlots: 0,
        });
      }

      return activity.get(dayKey) || null;
    };

    liveSchedules.forEach((schedule) => {
      const row = ensureDay(getLocalDayKey(schedule.startTime || ""));
      if (!row) return;
      row.liveCount += 1;
    });

    calendarAssignments.forEach((assignment) => {
      const row = ensureDay(getLocalDayKey(assignment.startTime || ""));
      if (!row) return;

      const state = String(assignment.state || "").toLowerCase();
      if (state === "proposed" || state === "locked") {
        row.proposedCount += 1;
      } else if (state === "unfilled") {
        row.unfilledDraftCount += 1;
      } else if (state === "removed") {
        row.removedCount += 1;
      }
    });

    openCoverageItems.forEach((item) => {
      const row = ensureDay(getLocalDayKey(item.coverage.startTime || ""));
      if (!row) return;
      row.openCoverageCount += 1;
      row.openCoverageSlots += item.openCount;
    });

    return activity;
  }, [calendarAssignments, liveSchedules, openCoverageItems]);

  const calendarDayMeta = useMemo(() => {
    const entries: Record<string, { count: number; color: string }> = {};

    Array.from(activitySummaryByDay.entries()).forEach(([dayKey, summary]) => {
      let color = "#94a3b8";

      if (summary.openCoverageCount > 0 || summary.unfilledDraftCount > 0) {
        color = "#ea580c";
      } else if (summary.proposedCount > 0) {
        color = "#2563eb";
      } else if (summary.liveCount > 0) {
        color = "#0f172a";
      }

      entries[dayKey] = {
        count:
          summary.liveCount +
          summary.proposedCount +
          summary.unfilledDraftCount +
          summary.openCoverageCount,
        color,
      };
    });

    return entries;
  }, [activitySummaryByDay]);

  const selectedDaySummary = activitySummaryByDay.get(selectedDay) || null;
  const selectedDayOpenCoverage = openCoverageByDay.get(selectedDay) || [];
  const selectedDayLabel = useMemo(() => {
    const parsed = new Date(`${selectedDay}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return "Selected Day";
    }

    return parsed.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedDay]);
  const selectedDayAssignments = useMemo(() => {
    return workspaceAssignments.filter(
      (assignment) =>
        getLocalDayKey(assignment.startTime || "") === selectedDay,
    );
  }, [selectedDay, workspaceAssignments]);
  const selectedDayLiveSchedules = useMemo(() => {
    return liveSchedules.filter(
      (schedule) => getLocalDayKey(schedule.startTime || "") === selectedDay,
    );
  }, [liveSchedules, selectedDay]);

  const handleCalendarDaySelect = (dayKey: string) => {
    setSelectedDay(dayKey);

    const hasData =
      Boolean(activitySummaryByDay.get(dayKey)) ||
      (openCoverageByDay.get(dayKey) || []).length > 0 ||
      liveSchedules.some(
        (schedule) => getLocalDayKey(schedule.startTime || "") === dayKey,
      ) ||
      workspaceAssignments.some(
        (assignment) => getLocalDayKey(assignment.startTime || "") === dayKey,
      );

    setDayDetailsOpen(hasData);
  };

  const loadCoverages = async () => {
    setFetchingCoverages(true);
    try {
      const res = await api.get("/coverage/unfilled-auto");
      const now = new Date();
      const upcoming = (Array.isArray(res.data) ? res.data : [])
        .filter((coverage) => new Date(coverage.endTime || "") >= now)
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
    } catch (err) {
      console.warn("Failed to fetch coverages", err);
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

      const nextSelectedIds = list
        .map((draft) => String(draft._id || ""))
        .filter(Boolean);
      setSelectedDraftIds(nextSelectedIds);

      const stillExists = list.some(
        (draft) => String(draft._id || "") === activeDraftId,
      );
      if (!activeDraftId && list[0]?._id) {
        setActiveDraftId(String(list[0]._id));
      } else if (activeDraftId && !stillExists) {
        setActiveDraftId(String(list[0]?._id || ""));
      }
    } catch (err) {
      console.warn("Failed to fetch drafts", err);
      setDrafts([]);
      setSelectedDraftIds([]);
      setActiveDraftId("");
      setActiveDraft(null);
    } finally {
      setLoadingDrafts(false);
    }
  };

  const loadDraftDetail = async (draftId: string) => {
    if (!draftId) {
      setActiveDraft(null);
      setEditingAssignmentId("");
      setEditingAssignmentDraftId("");
      return;
    }

    setLoadingDraftDetail(true);
    try {
      const res = await api.get(`/schedules/draft-schedules/${draftId}`);
      const draft = (res.data || null) as DraftSchedule | null;
      setActiveDraft(draft);

      const draftScope = String(draftId || "");
      const publishableIds = (draft?.assignments || [])
        .filter((assignment) => isPublishableState(assignment.state))
        .map((assignment) =>
          getScopedAssignmentId(draftScope, getAssignmentId(assignment)),
        );

      setSelectedAssignmentIds((prev) =>
        prev.filter((id) => {
          if (!id.startsWith(`${draftScope}:`)) return true;
          return publishableIds.includes(id);
        }),
      );
      setEditingAssignmentId("");
      setEditingAssignmentDraftId("");
    } catch (err) {
      console.warn("Failed to fetch draft detail", err);
      setActiveDraft(null);
      setSelectedAssignmentIds((prev) =>
        prev.filter((id) => !id.startsWith(`${String(draftId || "")}:`)),
      );
      setEditingAssignmentId("");
      setEditingAssignmentDraftId("");
    } finally {
      setLoadingDraftDetail(false);
    }
  };

  const loadSelectedDraftDetails = async (draftIds: string[]) => {
    const ids = Array.from(new Set((draftIds || []).filter(Boolean)));
    if (ids.length === 0) {
      setSelectedDraftDetails([]);
      return;
    }

    setLoadingSelectedDrafts(true);
    try {
      const responses = await Promise.all(
        ids.map((draftId) => api.get(`/schedules/draft-schedules/${draftId}`)),
      );

      setSelectedDraftDetails(
        responses
          .map((response, index) => ({
            draftId: ids[index],
            draft: (response.data || null) as DraftSchedule | null,
          }))
          .filter((item) => Boolean(item.draft)),
      );
    } catch (err) {
      console.warn("Failed to load selected draft details", err);
      setSelectedDraftDetails([]);
    } finally {
      setLoadingSelectedDrafts(false);
    }
  };

  useEffect(() => {
    loadCoverages();
    loadStaff();
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadDraftDetail(activeDraftId);
  }, [activeDraftId]);

  useEffect(() => {
    void loadSelectedDraftDetails(selectedDraftIds);
  }, [selectedDraftIds]);

  useEffect(() => {
    if (!errorMsg && !successMsg) {
      return;
    }

    const timeout = setTimeout(() => {
      setErrorMsg("");
      setSuccessMsg("");
    }, 3200);

    return () => clearTimeout(timeout);
  }, [errorMsg, successMsg]);

  const beginEditAssignment = (
    assignment: DraftAssignment,
    draftIdOverride?: string,
  ) => {
    const assignmentId = getAssignmentId(assignment);
    const draftId =
      String(
        draftIdOverride ||
          assignment?.__workspaceDraftId ||
          assignment?.__calendarDraftId ||
          activeDraftId ||
          "",
      ) || "";

    setEditingAssignmentId(assignmentId);
    setEditingAssignmentDraftId(draftId);
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
    setDraftViewMode("list");
  };

  const cancelEditAssignment = () => {
    setEditingAssignmentId("");
    setEditingAssignmentDraftId("");
    setEditForm({
      staffId: "",
      startTime: "",
      endTime: "",
      notes: "",
      state: "proposed",
      force: false,
    });
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
      getScopedAssignmentId(
        String(assignment.__workspaceDraftId || ""),
        getAssignmentId(assignment),
      ),
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

  const handleSaveAssignment = async () => {
    const targetDraftId = String(
      editingAssignmentDraftId || activeDraftId || "",
    );
    if (!targetDraftId || !editingAssignmentId) return;

    setErrorMsg("");
    setSuccessMsg("");

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
        `/schedules/draft-schedules/${targetDraftId}/assignments/${editingAssignmentId}`,
        payload,
      );
      setSuccessMsg("Draft assignment updated.");
      await Promise.all([
        targetDraftId === String(activeDraftId || "")
          ? loadDraftDetail(activeDraftId)
          : Promise.resolve(),
        loadSelectedDraftDetails(selectedDraftIds),
        loadDrafts(),
      ]);
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
    draftIdOverride?: string,
  ) => {
    const assignmentId = getAssignmentId(assignment);
    const targetDraftId =
      String(
        draftIdOverride ||
          assignment?.__workspaceDraftId ||
          activeDraftId ||
          "",
      ) || "";
    if (!targetDraftId || !assignmentId) return;

    setErrorMsg("");
    setSuccessMsg("");
    setActionLoading(`state:${assignmentId}`);
    try {
      await api.patch(
        `/schedules/draft-schedules/${targetDraftId}/assignments/${assignmentId}`,
        { state: nextState },
      );
      setSuccessMsg("Draft updated.");
      await Promise.all([
        targetDraftId === String(activeDraftId || "")
          ? loadDraftDetail(activeDraftId)
          : Promise.resolve(),
        loadSelectedDraftDetails(selectedDraftIds),
        loadDrafts(),
      ]);
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to update draft assignment state."
          : "Failed to update draft assignment state.";

      setErrorMsg(message);
    } finally {
      setActionLoading("");
    }
  };

  const handlePublishSelected = async () => {
    if (selectedPublishableCount <= 0) return;

    const idsToPublish = selectedAssignmentIds.filter((id) =>
      publishableAssignmentIdSet.has(id),
    );

    const assignmentIdsByDraft = idsToPublish.reduce<Record<string, string[]>>(
      (acc, scopedId) => {
        const { draftId, assignmentId } = splitScopedAssignmentId(scopedId);
        if (!draftId || !assignmentId) return acc;
        if (!acc[draftId]) acc[draftId] = [];
        acc[draftId].push(assignmentId);
        return acc;
      },
      {},
    );

    const draftIds = Object.keys(assignmentIdsByDraft);
    if (draftIds.length === 0) return;

    setErrorMsg("");
    setSuccessMsg("");
    setActionLoading("publish:selected");
    try {
      await Promise.all(
        draftIds.map((draftId) =>
          api.post(`/schedules/draft-schedules/${draftId}/publish`, {
            assignmentIds: assignmentIdsByDraft[draftId],
          }),
        ),
      );

      setSuccessMsg("Selected draft assignments published.");
      await Promise.all([
        activeDraftId ? loadDraftDetail(activeDraftId) : Promise.resolve(),
        loadSelectedDraftDetails(selectedDraftIds),
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
    if (publishableAssignments.length <= 0) return;

    const assignmentIdsByDraft = publishableAssignments.reduce<
      Record<string, string[]>
    >((acc, assignment) => {
      const draftId = String(assignment.__workspaceDraftId || "");
      const assignmentId = getAssignmentId(assignment);
      if (!draftId || !assignmentId) return acc;
      if (!acc[draftId]) acc[draftId] = [];
      acc[draftId].push(assignmentId);
      return acc;
    }, {});

    const draftIds = Object.keys(assignmentIdsByDraft);
    if (draftIds.length === 0) return;

    setErrorMsg("");
    setSuccessMsg("");
    setActionLoading("publish:all");
    try {
      await Promise.all(
        draftIds.map((draftId) =>
          api.post(`/schedules/draft-schedules/${draftId}/publish`, {
            assignmentIds: assignmentIdsByDraft[draftId],
          }),
        ),
      );

      setSuccessMsg("All publishable draft assignments published.");
      await Promise.all([
        activeDraftId ? loadDraftDetail(activeDraftId) : Promise.resolve(),
        loadSelectedDraftDetails(selectedDraftIds),
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
              ?.data?.message || "Failed to publish draft assignments."
          : "Failed to publish draft assignments.";

      setErrorMsg(message);
    } finally {
      setActionLoading("");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPublishableCount <= 0) return;

    const idsToDelete = selectedAssignmentIds.filter((id) =>
      publishableAssignmentIdSet.has(id),
    );

    const parsedTargets = idsToDelete
      .map((scopedId) => splitScopedAssignmentId(scopedId))
      .filter((target) => target.draftId && target.assignmentId);

    if (parsedTargets.length === 0) return;

    setErrorMsg("");
    setSuccessMsg("");
    setActionLoading("delete:selected");
    try {
      await Promise.all(
        parsedTargets.map((target) =>
          api.patch(
            `/schedules/draft-schedules/${target.draftId}/assignments/${target.assignmentId}`,
            { state: "removed" },
          ),
        ),
      );

      setSuccessMsg("Selected draft assignments removed.");
      await Promise.all([
        activeDraftId ? loadDraftDetail(activeDraftId) : Promise.resolve(),
        loadSelectedDraftDetails(selectedDraftIds),
        loadDrafts(),
        loadCoverages(),
      ]);
      setSelectedAssignmentIds((prev) =>
        prev.filter((id) => !idsToDelete.includes(id)),
      );
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to delete selected assignments."
          : "Failed to delete selected assignments.";

      setErrorMsg(message);
    } finally {
      setActionLoading("");
    }
  };

  const handleCreateDraftFromCoverage = async (coverage: CoverageItem) => {
    const coverageId = getCoverageId(coverage);
    if (!coverageId) {
      setErrorMsg(
        "Unable to create draft for this coverage. Missing coverage id.",
      );
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");
    const loadingKey = `create-draft:${coverageId}`;
    setCoverageActionLoadingId(loadingKey);

    try {
      await api.post("/schedules/auto-generate", { coverageIds: [coverageId] });
      setSuccessMsg(
        "Draft created for this coverage. Review assignments and publish when ready.",
      );
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
              ?.data?.message || "Failed to create draft from this coverage."
          : "Failed to create draft from this coverage.";

      setErrorMsg(message);
    } finally {
      setCoverageActionLoadingId("");
    }
  };

  const handleFillAssignmentWithAI = async ({
    draftId,
    assignmentId,
  }: {
    draftId: string;
    assignmentId: string;
  }) => {
    const safeDraftId = String(draftId || "");
    const safeAssignmentId = String(assignmentId || "");
    if (!safeDraftId || !safeAssignmentId) {
      setErrorMsg(
        "Unable to fill this slot with AI. Missing draft or assignment id.",
      );
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");
    const loadingKey = `fill-ai:${safeDraftId}:${safeAssignmentId}`;
    setAssignmentActionLoadingId(loadingKey);

    try {
      const res = await api.post(
        `/schedules/draft-schedules/${safeDraftId}/assignments/${safeAssignmentId}/fill-ai`,
      );

      setSuccessMsg(
        String(res?.data?.message || "Draft assignment filled with AI."),
      );
      await Promise.all([
        activeDraftId ? loadDraftDetail(activeDraftId) : Promise.resolve(),
        loadSelectedDraftDetails(selectedDraftIds),
        loadDrafts(),
      ]);
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message ||
            "Unable to fill this assignment with AI right now."
          : "Unable to fill this assignment with AI right now.";

      setErrorMsg(message);
    } finally {
      setAssignmentActionLoadingId("");
    }
  };

  const selectedStaffOptions = useMemo(
    () => [
      { value: "", label: "Unassigned (leave unfilled)" },
      ...staffList
        .filter((member) => Boolean(member._id))
        .map((member) => ({
          value: String(member._id),
          label: member.name || member._id || "Unknown staff",
        })),
    ],
    [staffList],
  );

  const toastMessage = errorMsg || successMsg;
  const toastIsError = Boolean(errorMsg);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Schedule Workspace</Text>
            <Text style={styles.subtitle}>
              Review generated schedules, adjust assignments, and publish
              approved shifts.
            </Text>
            <Text style={styles.caption}>
              Partially filled drafts usually mean there are not enough
              available, qualified staff for some shifts after applying role,
              certification, unit, shift, and overtime rules.
            </Text>
          </View>

          {onClose ? (
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Feather name="x" size={20} color="#6b7280" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricChip}>
            <Text style={styles.metricText}>
              {liveSchedules.length} live schedules
            </Text>
          </View>
          <View style={styles.metricChipWarning}>
            <Text style={styles.metricTextWarning}>
              {openCoverageItems.length} open coverages
            </Text>
          </View>
          <View style={styles.metricChipSuccess}>
            <Text style={styles.metricTextSuccess}>
              {publishableAssignments.length} publishable assignments
            </Text>
          </View>
        </View>

        <View style={styles.workspaceBoard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Draft Workspace ({publishableAssignments.length} publishable)
            </Text>
            <View style={styles.workspaceHeaderRight}>
              <Text style={styles.helperText}>
                {selectedPublishableCount}/{publishableAssignments.length}{" "}
                selected
              </Text>
              <Pressable
                style={styles.secondaryAction}
                onPress={() => {
                  void Promise.all([loadDrafts(), loadCoverages()]);
                }}
                disabled={loadingDrafts}
              >
                <Text style={styles.secondaryActionText}>
                  {loadingDrafts ? "Refreshing..." : "Refresh"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.workspaceActions}>
            {(selectedPublishableCount > 0 ||
              actionLoading === "delete:selected") && (
              <Pressable
                style={styles.secondaryActionDanger}
                onPress={() => void handleDeleteSelected()}
                disabled={Boolean(actionLoading)}
              >
                <Text style={styles.secondaryActionDangerText}>
                  {actionLoading === "delete:selected"
                    ? "Deleting..."
                    : `Delete selected (${selectedPublishableCount})`}
                </Text>
              </Pressable>
            )}

            {(selectedPublishableCount > 0 ||
              actionLoading === "publish:selected") && (
              <Pressable
                style={styles.secondaryAction}
                onPress={() => void handlePublishSelected()}
                disabled={Boolean(actionLoading)}
              >
                <Text style={styles.secondaryActionText}>
                  {actionLoading === "publish:selected"
                    ? "Publishing..."
                    : `Publish selected AI proposed (${selectedPublishableCount})`}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={styles.primaryActionSmall}
              onPress={() => void handlePublishAll()}
              disabled={
                Boolean(actionLoading) || publishableAssignments.length <= 0
              }
            >
              <Text style={styles.primaryActionText}>
                {actionLoading === "publish:all"
                  ? "Publishing..."
                  : "Publish all AI proposed to live schedule"}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.selectAllBtn}
            onPress={() =>
              handleToggleAllPublishableSelection(!allPublishableSelected)
            }
            disabled={publishableAssignments.length <= 0}
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

          <View style={styles.workspaceTopRow}>
            <View style={styles.viewModeCard}>
              <Text style={styles.viewModeLabel}>Workspace view</Text>
              <View style={styles.toggleWrap}>
                <Pressable
                  style={[
                    styles.toggleBtn,
                    draftViewMode === "calendar"
                      ? styles.toggleBtnActive
                      : null,
                  ]}
                  onPress={() => setDraftViewMode("calendar")}
                >
                  <Feather
                    name="calendar"
                    size={13}
                    color={draftViewMode === "calendar" ? "#1e3a8a" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      draftViewMode === "calendar"
                        ? styles.toggleTextActive
                        : null,
                    ]}
                  >
                    Calendar
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.toggleBtn,
                    draftViewMode === "list" ? styles.toggleBtnActive : null,
                  ]}
                  onPress={() => setDraftViewMode("list")}
                >
                  <Feather
                    name="list"
                    size={13}
                    color={draftViewMode === "list" ? "#1e3a8a" : "#64748b"}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      draftViewMode === "list" ? styles.toggleTextActive : null,
                    ]}
                  >
                    List
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.viewModeHint}>
                {draftViewMode === "calendar"
                  ? "Tap a day to see draft, live, and coverage details."
                  : "Use list mode for bulk edits and publishing."}
              </Text>
            </View>

            <View style={styles.legendWrap}>
              <View style={styles.legendHeaderRow}>
                <Text style={styles.legendLabel}>Legend</Text>
                <Text style={styles.legendHint}>Calendar color guide</Text>
              </View>

              <View style={styles.legendGrid}>
                <LegendPill
                  dotColor="#0f172a"
                  backgroundColor="#e2e8f0"
                  borderColor="#cbd5e1"
                  textColor="#0f172a"
                  label="Live schedule"
                />
                <LegendPill
                  dotColor="#ea580c"
                  backgroundColor="#ffedd5"
                  borderColor="#fdba74"
                  textColor="#9a3412"
                  label="Open coverage (manual)"
                />
                <LegendPill
                  dotColor="#1d4ed8"
                  backgroundColor="#dbeafe"
                  borderColor="#93c5fd"
                  textColor="#1e3a8a"
                  label="AI proposed"
                />
                <LegendPill
                  dotColor="#c2410c"
                  backgroundColor="#ffedd5"
                  borderColor="#fdba74"
                  textColor="#9a3412"
                  label="AI unfilled"
                />
              </View>
            </View>
          </View>

          {draftViewMode === "calendar" ? (
            <>
              {loadingDraftDetail ? (
                <ActivityIndicator size="small" color="#1d4ed8" />
              ) : null}

              <MonthCalendar
                month={calendarMonth}
                selectedDay={selectedDay}
                dayMeta={calendarDayMeta}
                onSelectDay={handleCalendarDaySelect}
                onChangeMonth={setCalendarMonth}
              />

              {loadingSelectedDrafts ? (
                <ActivityIndicator size="small" color="#1d4ed8" />
              ) : null}

              <Text style={styles.caption}>
                Calendar overlays live schedules and draft assignments so
                schedulers can compare current published staffing against draft
                changes in one place.
              </Text>
            </>
          ) : null}

          {draftViewMode === "list" && workspaceAssignments.length === 0 ? (
            <Text style={styles.emptyInline}>
              This workspace has no assignments.
            </Text>
          ) : null}

          {draftViewMode === "list" && workspaceAssignments.length > 0 ? (
            <View style={styles.listWrap}>
              {assignmentsByDay.map((group) => (
                <View key={group.dayLabel} style={styles.dayGroup}>
                  <Text style={styles.dayLabel}>{group.dayLabel}</Text>

                  {group.assignments.map((assignment) => {
                    const assignmentId = getAssignmentId(assignment);
                    const assignmentDraftId = String(
                      assignment.__workspaceDraftId || activeDraftId || "",
                    );
                    const scopedAssignmentId = getScopedAssignmentId(
                      assignmentDraftId,
                      assignmentId,
                    );
                    const chips = getWarningChips(
                      assignment,
                      overtimeThresholdHours,
                    );
                    const isEditable = DRAFT_EDITABLE_STATES.has(
                      String(assignment.state || ""),
                    );
                    const isEditing =
                      editingAssignmentId === assignmentId &&
                      editingAssignmentDraftId === assignmentDraftId;
                    const staffId = String(
                      typeof assignment.staffId === "string"
                        ? assignment.staffId
                        : assignment.staffId?._id || "",
                    );
                    const isUnfilled =
                      String(assignment.state || "") === "unfilled";
                    const staffName =
                      (typeof assignment.staffId === "object" &&
                        assignment.staffId?.name) ||
                      staffById.get(staffId)?.name ||
                      (isUnfilled ? "Unfilled slot" : "Unknown");
                    const selected =
                      selectedAssignmentIds.includes(scopedAssignmentId);
                    const assignmentStateMeta = getDraftStateMeta(
                      assignment.state,
                    );
                    const restoreTargetState = isUnfilled
                      ? "unfilled"
                      : "proposed";
                    const fillAiKey = `fill-ai:${assignmentDraftId}:${assignmentId}`;

                    return (
                      <View
                        key={`${assignmentDraftId}:${assignmentId}`}
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
                                  toggleAssignmentSelection(scopedAssignmentId);
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

                          <Text
                            style={[
                              styles.badgeText,
                              {
                                backgroundColor: assignmentStateMeta.bg,
                                color: assignmentStateMeta.text,
                                borderColor: assignmentStateMeta.border,
                                borderWidth: 1,
                              },
                            ]}
                          >
                            {assignmentStateMeta.label.toUpperCase()}
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
                                  beginEditAssignment(
                                    assignment,
                                    assignmentDraftId,
                                  )
                                }
                              >
                                <Text style={styles.smallActionText}>Edit</Text>
                              </Pressable>
                            ) : null}

                            {String(assignment.state || "") === "unfilled" ? (
                              <Pressable
                                style={styles.primaryActionSmall}
                                onPress={() =>
                                  void handleFillAssignmentWithAI({
                                    draftId: assignmentDraftId,
                                    assignmentId,
                                  })
                                }
                                disabled={
                                  assignmentActionLoadingId === fillAiKey
                                }
                              >
                                <Text style={styles.primaryActionText}>
                                  {assignmentActionLoadingId === fillAiKey
                                    ? "Filling..."
                                    : "Fill with AI"}
                                </Text>
                              </Pressable>
                            ) : null}

                            {assignment.state !== "removed" ? (
                              <Pressable
                                style={styles.smallActionDanger}
                                disabled={Boolean(actionLoading)}
                                onPress={() =>
                                  void handleStateQuickUpdate(
                                    assignment,
                                    "removed",
                                    assignmentDraftId,
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
                                  void handleStateQuickUpdate(
                                    assignment,
                                    restoreTargetState,
                                    assignmentDraftId,
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
                              options={selectedStaffOptions}
                              onChange={(value) =>
                                setEditForm((prev) => {
                                  const nextState =
                                    value && prev.state === "unfilled"
                                      ? "proposed"
                                      : prev.state;

                                  return {
                                    ...prev,
                                    staffId: value,
                                    state: nextState,
                                  };
                                })
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
                                onPress={() => void handleSaveAssignment()}
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
              ))}
            </View>
          ) : null}
        </View>

        <Modal
          visible={dayDetailsOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setDayDetailsOpen(false)}
        >
          <Pressable
            style={styles.dayDetailsBackdrop}
            onPress={() => setDayDetailsOpen(false)}
          >
            <Pressable style={styles.dayDetailsCard} onPress={() => {}}>
              <View style={styles.dayDetailsHeader}>
                <View style={styles.headerTextWrap}>
                  <Text style={styles.dayDetailsTitle}>Day Summary</Text>
                  <Text style={styles.dayDetailsSubtitle}>
                    {selectedDayLabel}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setDayDetailsOpen(false)}
                  style={styles.closeBtnSmall}
                >
                  <Feather name="x" size={18} color="#6b7280" />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.dayDetailsContent}>
                <Text style={styles.summaryText}>
                  {selectedDaySummary
                    ? `Live ${selectedDaySummary.liveCount} · AI proposed ${selectedDaySummary.proposedCount} · Open coverage ${selectedDaySummary.openCoverageCount}`
                    : "No schedule activity for this day."}
                </Text>

                {selectedDayLiveSchedules.length > 0 ? (
                  <View style={styles.summaryStack}>
                    {selectedDayLiveSchedules.map((schedule, index) => {
                      const scheduleId = String(schedule?._id || "");
                      const status = String(
                        schedule?.status || "scheduled",
                      ).toLowerCase();
                      const isCallOut = status === "call_out";
                      const staffName =
                        (typeof schedule?.staffId === "object" &&
                          schedule.staffId?.name) ||
                        staffById.get(
                          String(
                            typeof schedule?.staffId === "string"
                              ? schedule.staffId
                              : schedule?.staffId?._id || "",
                          ),
                        )?.name ||
                        "Assigned staff";

                      return (
                        <View
                          key={`live-${scheduleId || index}`}
                          style={[
                            styles.liveScheduleCard,
                            isCallOut ? styles.liveScheduleCardCallOut : null,
                          ]}
                        >
                          <Text style={styles.liveScheduleTitle}>
                            {staffName} ·{" "}
                            {isCallOut ? "Call-out" : "Live schedule"}
                          </Text>
                          <Text style={styles.liveScheduleMeta}>
                            {getRoleDisplayName(schedule?.role)} ·{" "}
                            {formatTimePart(schedule?.startTime)} -{" "}
                            {formatTimePart(schedule?.endTime)}
                          </Text>
                          {schedule?.unitArea ? (
                            <Text style={styles.liveScheduleMetaMuted}>
                              {getUnitAreaDisplayName(schedule.unitArea)}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {selectedDayOpenCoverage.length > 0 ? (
                  <View style={styles.summaryStack}>
                    {selectedDayOpenCoverage.map((item, index) => {
                      const coverageId = item.coverageId;
                      const openCoverageKey =
                        coverageId ||
                        item.signature ||
                        `${item.coverage.startTime || item.coverage.date || "open"}-${index}`;
                      const isCreatingDraft =
                        coverageActionLoadingId ===
                        `create-draft:${coverageId}`;

                      return (
                        <View
                          key={`open-${openCoverageKey}`}
                          style={styles.coverageCard}
                        >
                          <Text style={styles.coverageTitle}>
                            Open coverage ·{" "}
                            {getRoleDisplayName(item.coverage.role)}
                          </Text>
                          <Text style={styles.coverageMeta}>
                            {formatDateTimeWindow(
                              item.coverage.startTime,
                              item.coverage.endTime,
                            )}
                          </Text>
                          <Text style={styles.coverageMetaMuted}>
                            Need {item.requiredCount} · Open {item.openCount}
                          </Text>
                          <Pressable
                            style={styles.warningAction}
                            onPress={() =>
                              void handleCreateDraftFromCoverage(item.coverage)
                            }
                            disabled={isCreatingDraft}
                          >
                            <Text style={styles.warningActionText}>
                              {isCreatingDraft
                                ? "Creating draft..."
                                : "Create draft"}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {selectedDayAssignments.length > 0 ? (
                  <View style={styles.summaryStack}>
                    {selectedDayAssignments.map((assignment) => {
                      const assignmentId = getAssignmentId(assignment);
                      const draftId = String(
                        assignment.__workspaceDraftId || "",
                      );
                      const stateMeta = getDraftStateMeta(assignment.state);
                      const staffId = String(
                        typeof assignment.staffId === "string"
                          ? assignment.staffId
                          : assignment.staffId?._id || "",
                      );
                      const staffName =
                        (typeof assignment.staffId === "object" &&
                          assignment.staffId?.name) ||
                        staffById.get(staffId)?.name ||
                        (String(assignment.state || "") === "unfilled"
                          ? "Unfilled slot"
                          : "Unknown");
                      const isFilling =
                        assignmentActionLoadingId ===
                        `fill-ai:${draftId}:${assignmentId}`;

                      return (
                        <Pressable
                          key={`${draftId}:${assignmentId}`}
                          style={[
                            styles.assignmentCard,
                            {
                              borderColor: stateMeta.border,
                              backgroundColor: stateMeta.bg,
                            },
                          ]}
                          onPress={() =>
                            beginEditAssignment(assignment, draftId)
                          }
                        >
                          <Text
                            style={[
                              styles.assignmentTitle,
                              { color: stateMeta.text },
                            ]}
                          >
                            {staffName} · {stateMeta.label}
                          </Text>
                          <Text style={styles.assignmentMeta}>
                            {getRoleDisplayName(assignment.role)} ·{" "}
                            {formatTimePart(assignment.startTime)} -{" "}
                            {formatTimePart(assignment.endTime)}
                          </Text>
                          {String(assignment.state || "") === "unfilled" ? (
                            <Pressable
                              style={styles.primaryActionSmall}
                              onPress={() =>
                                void handleFillAssignmentWithAI({
                                  draftId,
                                  assignmentId,
                                })
                              }
                              disabled={isFilling}
                            >
                              <Text style={styles.primaryActionText}>
                                {isFilling ? "Filling..." : "Fill with AI"}
                              </Text>
                            </Pressable>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>

      {toastMessage ? (
        <Pressable
          style={[
            styles.toastBanner,
            toastIsError ? styles.toastBannerError : styles.toastBannerSuccess,
          ]}
          onPress={() => {
            setErrorMsg("");
            setSuccessMsg("");
          }}
        >
          <Feather
            name={toastIsError ? "alert-circle" : "check-circle"}
            size={16}
            color={toastIsError ? "#7f1d1d" : "#14532d"}
          />
          <Text
            style={[
              styles.toastText,
              toastIsError ? styles.toastTextError : styles.toastTextSuccess,
            ]}
          >
            {toastMessage}
          </Text>
          <Feather
            name="x"
            size={14}
            color={toastIsError ? "#7f1d1d" : "#14532d"}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  closeBtnSmall: {
    padding: 4,
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
  caption: {
    color: "#6b7280",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  toastBanner: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  toastBannerError: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
  },
  toastBannerSuccess: {
    backgroundColor: "#dcfce7",
    borderColor: "#86efac",
  },
  toastText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  toastTextError: {
    color: "#7f1d1d",
  },
  toastTextSuccess: {
    color: "#14532d",
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
  metricChipWarning: {
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff7ed",
  },
  metricChipSuccess: {
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f0fdf4",
  },
  metricText: {
    color: "#1e3a8a",
    fontSize: 11,
    fontWeight: "700",
  },
  metricTextWarning: {
    color: "#9a3412",
    fontSize: 11,
    fontWeight: "700",
  },
  metricTextSuccess: {
    color: "#166534",
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
  workspaceBoard: {
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  workspaceHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  helperText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  listWrap: {
    gap: 8,
  },
  badgeText: {
    color: "#374151",
    fontSize: 10,
    fontWeight: "800",
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  workspaceActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  workspaceTopRow: {
    gap: 10,
  },
  legendWrap: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 12,
    backgroundColor: "#f8fbff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  legendHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  legendLabel: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  legendHint: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
  },
  legendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  legendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 30,
    flexBasis: "48%",
    flexGrow: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 1,
  },
  secondaryAction: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
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
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionDangerText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  primaryActionSmall: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  coverageCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 5,
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
  liveScheduleCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#0f172a",
    padding: 10,
    gap: 4,
  },
  liveScheduleCardCallOut: {
    borderColor: "#fecaca",
    backgroundColor: "#991b1b",
  },
  liveScheduleTitle: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  liveScheduleMeta: {
    color: "#cbd5e1",
    fontSize: 11,
  },
  liveScheduleMetaMuted: {
    color: "#94a3b8",
    fontSize: 11,
  },
  warningAction: {
    alignSelf: "flex-start",
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: "#ea580c",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  warningActionText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  selectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectAllText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
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
    marginTop: 1,
  },
  checkboxActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  toggleWrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  viewModeCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 12,
    backgroundColor: "#f8fbff",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  viewModeLabel: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  viewModeHint: {
    color: "#64748b",
    fontSize: 11,
  },
  toggleBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toggleBtnActive: {
    backgroundColor: "#dbeafe",
  },
  toggleText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  toggleTextActive: {
    color: "#1e3a8a",
  },
  summaryPanel: {
    gap: 10,
  },
  calendarPanel: {
    gap: 10,
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 12,
    backgroundColor: "#f8fbff",
    padding: 10,
  },
  dayDetailsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    justifyContent: "center",
    padding: 18,
  },
  dayDetailsCard: {
    maxHeight: "82%",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    padding: 14,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  dayDetailsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  dayDetailsTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  dayDetailsSubtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  dayDetailsContent: {
    gap: 10,
    paddingBottom: 4,
  },
  summaryTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  summaryText: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 18,
  },
  summaryStack: {
    gap: 8,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  needsCoverageCard: {
    borderWidth: 2,
    shadowColor: "#9a3412",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  summaryCardTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  summaryCardText: {
    color: "#1f2937",
    fontSize: 11,
  },
  summaryCardStrong: {
    color: "#0f172a",
    fontSize: 11,
    fontWeight: "700",
  },
  summaryStatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  summaryStatPillNeutral: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  summaryStatPillNeutralText: {
    color: "#334155",
    fontSize: 10,
    fontWeight: "800",
  },
  summaryStatPillInfo: {
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  summaryStatPillInfoText: {
    color: "#1e3a8a",
    fontSize: 10,
    fontWeight: "800",
  },
  summaryStatPillWarn: {
    borderWidth: 1,
    borderColor: "#fdba74",
    backgroundColor: "#fff7ed",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  summaryStatPillWarnText: {
    color: "#9a3412",
    fontSize: 10,
    fontWeight: "800",
  },
  summaryStatPillDanger: {
    borderWidth: 1,
    borderColor: "#f97316",
    backgroundColor: "#ffedd5",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  summaryStatPillDangerText: {
    color: "#9a3412",
    fontSize: 10,
    fontWeight: "800",
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
  fieldLabel: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
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
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectFieldDisabled: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
  },
  selectText: {
    flex: 1,
    color: "#111827",
    fontSize: 12,
  },
  selectTextMuted: {
    color: "#9ca3af",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    maxHeight: "70%",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 10,
    gap: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  modalList: {
    gap: 6,
  },
  modalItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    opacity: 0.5,
  },
  modalItemText: {
    color: "#111827",
    fontSize: 12,
    flex: 1,
  },
  modalItemTextSelected: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  modalItemTextDisabled: {
    color: "#9ca3af",
  },
  emptyInline: {
    color: "#6b7280",
    fontSize: 12,
  },
});
