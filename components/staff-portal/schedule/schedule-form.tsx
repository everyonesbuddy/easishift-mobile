import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
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

import GuideHelpButton from "@/components/shared/guide-help-button";
import GuideTourOverlay from "@/components/shared/guide-tour-overlay";
import api from "@/config/api";
import {
  getFacilityRolesFromUser,
  getRoleDisplayName,
  getShiftTagDisplayName,
  getShiftTypeDisplayName,
  getUnitAreaDisplayName,
  getUserRoles,
  isRoleCompatible,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";
import { useGuideTour } from "@/context/guide-tour-context";

import { CoverageItem, ScheduleItem, StaffUser } from "./schedule-types";

type Props = {
  onSuccess: () => void;
  onClose: () => void;
  schedule: ScheduleItem | null;
  staffList: StaffUser[];
  initialStaffId?: string;
  initialCoverage?: CoverageItem | null;
  disableStaffSelect?: boolean;
  mode?: "manual" | "pickup";
};

type FormData = {
  staffId: string;
  coverageId: string;
  role: string;
  unitArea: string;
  shiftType: string;
  shiftTag: string;
  certificationTags: string[];
  startTime: string;
  endTime: string;
  notes: string;
  status:
    | "scheduled"
    | "in_progress"
    | "completed"
    | "left_early"
    | "no_show"
    | "call_out";
  timezone: string;
};

type CoverageOption = CoverageItem & {
  spotsRemaining: number;
};

const SCHEDULE_STATUS_OPTIONS: FormData["status"][] = [
  "scheduled",
  "in_progress",
  "completed",
  "left_early",
  "no_show",
  "call_out",
];

function getScheduleFormTourSteps(isEditing: boolean, isPickup: boolean) {
  const steps = [];

  if (!isPickup) {
    steps.push({
      target: "schedule-form-staff",
      title: "Choose a staff member",
      body: "Only staff compatible with the selected coverage role and restrictions are available.",
    });
  }

  if (!isEditing) {
    steps.push({
      target: "schedule-form-shift",
      title: isPickup ? "Pick an open shift" : "Select a shift",
      body: "Choose an open coverage requirement to populate its time, role, area, and qualification requirements.",
    });
  }

  steps.push({
    target: "schedule-form-submit",
    title: isPickup ? "Claim the shift" : "Save the schedule",
    body: "The backend checks scheduling conflicts and availability before it saves the change.",
  });

  return steps;
}

function toLocalInputValue(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const tzOffset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - tzOffset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toUTC(dateString: string) {
  if (!dateString) return "";
  return new Date(dateString).toISOString();
}

function normalizeStringArray(values: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function normalizeTag(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getCoverageId(coverage: CoverageItem) {
  const rawCoverage = coverage as CoverageItem & {
    coverageId?: { _id?: string } | string | null;
  };

  return String(
    rawCoverage?.coverageId && typeof rawCoverage.coverageId === "object"
      ? rawCoverage.coverageId._id || ""
      : rawCoverage?.coverageId || coverage?._id || "",
  );
}

function buildCoverageSignature(coverage: Partial<CoverageItem>) {
  const startRaw = coverage?.startTime;
  const endRaw = coverage?.endTime;
  const startMs = new Date(startRaw || "").getTime();
  const endMs = new Date(endRaw || "").getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "";
  }

  return [
    String(startMs),
    String(endMs),
    normalizeTag(coverage?.role),
    normalizeTag(coverage?.unitArea),
    normalizeTag(coverage?.shiftType),
    normalizeTag(coverage?.shiftTag),
  ].join("|");
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

function formatCertificationTags(value: unknown) {
  const tags = normalizeStringArray(value);
  return tags.length ? tags.join(", ") : "-";
}

function formatShiftLabel(coverage: CoverageItem) {
  const start = new Date(coverage.startTime || "");
  const end = new Date(coverage.endTime || "");

  const dateLabel = Number.isNaN(start.getTime())
    ? "Unknown date"
    : start.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

  const startLabel = Number.isNaN(start.getTime())
    ? "--:--"
    : start.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });

  const endLabel = Number.isNaN(end.getTime())
    ? "--:--"
    : end.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });

  return `${dateLabel} - ${startLabel} - ${endLabel}`;
}

function SelectModal({
  open,
  title,
  options,
  onSelect,
  onClose,
  value,
}: {
  open: boolean;
  title: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onSelect: (value: string) => void;
  onClose: () => void;
  value: string;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.selectCard} onPress={() => {}}>
          <View style={styles.selectHeader}>
            <Text style={styles.selectTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.optionsList}>
            {options.map((option) => {
              const selected = option.value === value;

              return (
                <Pressable
                  key={option.value}
                  disabled={option.disabled}
                  style={[
                    styles.optionBtn,
                    selected ? styles.optionBtnActive : null,
                    option.disabled ? styles.optionBtnDisabled : null,
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selected ? styles.optionTextActive : null,
                      option.disabled ? styles.optionTextDisabled : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Feather name="check" size={16} color="#1d4ed8" />
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

export default function ScheduleForm({
  onSuccess,
  onClose,
  schedule,
  staffList,
  initialStaffId = "",
  initialCoverage = null,
  disableStaffSelect = false,
  mode = "manual",
}: Props) {
  const isEditing = Boolean(schedule);
  const { user, can, facilityPreferences } = useAuth();
  const isPickup = mode === "pickup";
  const canManageSchedules = can("schedule.manage");
  const { startTourIfUnseen } = useGuideTour();
  const tourId = isPickup
    ? "schedule-form-pickup"
    : isEditing
      ? "schedule-form-edit"
      : "schedule-form-create";
  const tourSteps = useMemo(
    () => getScheduleFormTourSteps(isEditing, isPickup),
    [isEditing, isPickup],
  );
  const canPickUpShift =
    can("schedule.pick_up") &&
    getFacilityRolesFromUser(user, facilityPreferences).length > 0;

  const [formData, setFormData] = useState<FormData>({
    staffId: "",
    coverageId: "",
    role: "",
    unitArea: "",
    shiftType: "",
    shiftTag: "",
    certificationTags: [],
    startTime: "",
    endTime: "",
    notes: "",
    status: "scheduled",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const [coverageOptions, setCoverageOptions] = useState<CoverageOption[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [includeDraftCoverages, setIncludeDraftCoverages] = useState(false);
  const [draftCoverageIds, setDraftCoverageIds] = useState<string[]>([]);
  const [draftCoverageSignatures, setDraftCoverageSignatures] = useState<
    string[]
  >([]);
  const [hasLoadedDraftCoverageRefs, setHasLoadedDraftCoverageRefs] =
    useState(false);
  const [draftCoverageFetchFailed, setDraftCoverageFetchFailed] =
    useState(false);
  const [staffSelectOpen, setStaffSelectOpen] = useState(false);
  const [shiftSelectOpen, setShiftSelectOpen] = useState(false);

  useEffect(() => {
    void startTourIfUnseen(tourId, tourSteps);
  }, [startTourIfUnseen, tourId, tourSteps]);

  const activeCoverageContext = !isEditing
    ? initialCoverage ||
      coverageOptions.find(
        (coverage) => coverage._id === formData.coverageId,
      ) ||
      null
    : null;

  const compatibleStaffOptions = useMemo(() => {
    return staffList.filter((member) => {
      if (!activeCoverageContext) {
        return true;
      }

      const compatibleFacilityRole = getFacilityRolesFromUser(
        member,
        facilityPreferences,
      ).some((role) => isRoleCompatible(role, activeCoverageContext?.role));
      const compatibleSystemRole = getUserRoles(member).some((role) =>
        isRoleCompatible(role, activeCoverageContext?.role),
      );
      if (!compatibleFacilityRole && !compatibleSystemRole) {
        return false;
      }

      return doesCoverageMatchStaffTags(member, activeCoverageContext);
    });
  }, [activeCoverageContext, facilityPreferences, staffList]);

  useEffect(() => {
    if (!schedule) {
      return;
    }

    const staffId =
      typeof schedule.staffId === "string"
        ? schedule.staffId
        : schedule.staffId?._id || "";

    setFormData({
      staffId,
      coverageId: "",
      role: schedule.role || "",
      unitArea: schedule.unitArea || "",
      shiftType: schedule.shiftType || "",
      shiftTag: schedule.shiftTag || "",
      certificationTags: normalizeStringArray(schedule.certificationTags),
      startTime: toLocalInputValue(schedule.startTime),
      endTime: toLocalInputValue(schedule.endTime),
      notes: schedule.notes || "",
      status: schedule.status || "scheduled",
      timezone:
        schedule.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }, [schedule]);

  useEffect(() => {
    if (schedule || !initialStaffId) {
      return;
    }

    const selected = staffList.find((staff) => staff._id === initialStaffId);

    setFormData((prev) => ({
      ...prev,
      staffId: initialStaffId,
      role: getUserRoles(selected)[0] || prev.role,
    }));
  }, [initialStaffId, schedule, staffList]);

  useEffect(() => {
    if (isEditing || !initialCoverage) {
      return;
    }

    const coverageId = getCoverageId(initialCoverage);

    setFormData((prev) => ({
      ...prev,
      coverageId,
      role: initialCoverage.role || prev.role,
      unitArea: initialCoverage.unitArea || "",
      shiftType: initialCoverage.shiftType || "",
      shiftTag: initialCoverage.shiftTag || "",
      certificationTags: Array.isArray(
        initialCoverage.requiredCertificationTags,
      )
        ? normalizeStringArray(initialCoverage.requiredCertificationTags)
        : prev.certificationTags,
      startTime: toLocalInputValue(initialCoverage.startTime),
      endTime: toLocalInputValue(initialCoverage.endTime),
    }));
  }, [initialCoverage, isEditing]);

  useEffect(() => {
    if (isEditing || isPickup) {
      setHasLoadedDraftCoverageRefs(true);
      setDraftCoverageFetchFailed(false);
      return;
    }

    let isMounted = true;

    async function loadDraftCoverageReferences() {
      setHasLoadedDraftCoverageRefs(false);
      setDraftCoverageFetchFailed(false);

      try {
        const res = await api.get("/schedules/draft-schedules", {
          params: { status: "all", limit: 50 },
        });

        const drafts = Array.isArray(res.data) ? res.data : [];
        const activeDrafts = drafts.filter((draft) =>
          ["draft", "partially_published"].includes(
            String(draft?.status || "").toLowerCase(),
          ),
        );

        const idSet = new Set<string>();
        const signatureSet = new Set<string>();

        activeDrafts.forEach((draft) => {
          const draftCoverages = [
            ...(Array.isArray(draft?.coverageSnapshot)
              ? draft.coverageSnapshot
              : []),
            ...(Array.isArray(draft?.coverages) ? draft.coverages : []),
            ...(Array.isArray(draft?.sourceCoverages)
              ? draft.sourceCoverages
              : []),
            ...(Array.isArray(draft?.inputCoverages)
              ? draft.inputCoverages
              : []),
            ...(Array.isArray(draft?.requestedCoverages)
              ? draft.requestedCoverages
              : []),
          ];

          draftCoverages.forEach((coverage: CoverageItem) => {
            const coverageId = getCoverageId(coverage);
            if (coverageId) {
              idSet.add(coverageId);
            }

            const signature = buildCoverageSignature(coverage);
            if (signature) {
              signatureSet.add(signature);
            }
          });

          [
            ...(Array.isArray(draft?.coverageIds) ? draft.coverageIds : []),
            ...(Array.isArray(draft?.sourceCoverageIds)
              ? draft.sourceCoverageIds
              : []),
            ...(Array.isArray(draft?.inputCoverageIds)
              ? draft.inputCoverageIds
              : []),
          ].forEach((coverageId: unknown) => {
            const normalized = String(coverageId || "");
            if (normalized) {
              idSet.add(normalized);
            }
          });

          (Array.isArray(draft?.assignments) ? draft.assignments : []).forEach(
            (assignment: { coverageId?: { _id?: string } | string }) => {
              const assignmentCoverageId = String(
                typeof assignment?.coverageId === "object"
                  ? assignment.coverageId?._id || ""
                  : assignment?.coverageId || "",
              );
              if (assignmentCoverageId) {
                idSet.add(assignmentCoverageId);
              }
            },
          );
        });

        if (!isMounted) {
          return;
        }

        setDraftCoverageIds(Array.from(idSet));
        setDraftCoverageSignatures(Array.from(signatureSet));
      } catch (error) {
        console.warn("Failed to load draft coverage references", error);
        if (!isMounted) {
          return;
        }

        setDraftCoverageIds([]);
        setDraftCoverageSignatures([]);
        setDraftCoverageFetchFailed(true);
      } finally {
        if (isMounted) {
          setHasLoadedDraftCoverageRefs(true);
        }
      }
    }

    void loadDraftCoverageReferences();

    return () => {
      isMounted = false;
    };
  }, [isEditing, isPickup]);

  const loadCoverage = useCallback(async () => {
    if (!formData.staffId || isEditing) {
      return;
    }

    if (isPickup) {
      if (!canPickUpShift) {
        setMessage("You are not eligible to pick up shifts.");
        setSubmitting(false);
        return;
      }

      try {
        const res = await api.get("/schedules/open-for-me");
        setCoverageOptions(
          (Array.isArray(res.data) ? res.data : [])
            .map((item) => ({
              ...item,
              spotsRemaining: Number(item.remaining) || 0,
            }))
            .filter((item) => item.spotsRemaining > 0),
        );
      } catch (error) {
        console.warn("Failed to load open shifts", error);
        setCoverageOptions([]);
      }
      return;
    }

    const excludeDraftCoverages = !canManageSchedules || !includeDraftCoverages;
    if (excludeDraftCoverages && !hasLoadedDraftCoverageRefs) {
      setCoverageOptions([]);
      return;
    }

    if (excludeDraftCoverages && draftCoverageFetchFailed) {
      setCoverageOptions([]);
      return;
    }

    const selectedStaff = staffList.find(
      (staff) => staff._id === formData.staffId,
    );
    if (!selectedStaff || getUserRoles(selectedStaff).length === 0) {
      setCoverageOptions([]);
      return;
    }

    try {
      const [coverageRes, schedulesRes] = await Promise.all([
        api.get("/coverage"),
        api.get("/schedules"),
      ]);

      const now = new Date();

      const schedules = Array.isArray(schedulesRes.data)
        ? (schedulesRes.data as ScheduleItem[])
        : [];
      const raw = Array.isArray(coverageRes.data)
        ? (coverageRes.data as CoverageItem[])
        : [];

      const draftCoverageIdSet = new Set(draftCoverageIds);
      const draftCoverageSignatureSet = new Set(draftCoverageSignatures);

      const getScheduledCount = (coverage: CoverageItem) => {
        const assignedCount = Number(coverage?.assignedCount);
        if (Number.isFinite(assignedCount)) {
          return assignedCount;
        }

        const startMs = new Date(coverage?.startTime || "").getTime();
        const endMs = new Date(coverage?.endTime || "").getTime();

        return schedules.filter((scheduleItem) => {
          if (!scheduleItem || scheduleItem.status === "call_out") {
            return false;
          }

          const scheduleStartMs = new Date(
            scheduleItem.startTime || "",
          ).getTime();
          const scheduleEndMs = new Date(scheduleItem.endTime || "").getTime();

          return (
            scheduleStartMs === startMs &&
            scheduleEndMs === endMs &&
            isRoleCompatible(scheduleItem.role, coverage.role)
          );
        }).length;
      };

      const valid = raw
        .filter((item) => {
          const start = new Date(item.startTime || "");

          if (excludeDraftCoverages) {
            const coverageId = getCoverageId(item);
            const coverageSignature = buildCoverageSignature(item);
            const isDraftLinked =
              (coverageId && draftCoverageIdSet.has(coverageId)) ||
              (coverageSignature &&
                draftCoverageSignatureSet.has(coverageSignature));

            if (isDraftLinked) {
              return false;
            }
          }

          return (
            !Number.isNaN(start.getTime()) &&
            start > now &&
            (getUserRoles(selectedStaff).some((role) =>
              isRoleCompatible(role, item.role),
            ) ||
              getFacilityRolesFromUser(selectedStaff, facilityPreferences).some(
                (role) => isRoleCompatible(role, item.role),
              )) &&
            doesCoverageMatchStaffTags(selectedStaff, item)
          );
        })
        .map((item) => {
          const requiredCount = Number(item.requiredCount) || 0;
          const directRemaining = Number(item.remaining);
          const scheduledCount = getScheduledCount(item);
          const computedRemaining = Math.max(0, requiredCount - scheduledCount);

          const spotsRemaining = Number.isFinite(directRemaining)
            ? Math.max(0, directRemaining)
            : computedRemaining;

          return {
            ...item,
            spotsRemaining,
          };
        })
        .filter((item) => item.spotsRemaining > 0);

      setCoverageOptions(valid);
    } catch (error) {
      console.warn("Failed to load coverage for schedule form", error);
      setCoverageOptions([]);
    }
  }, [
    draftCoverageFetchFailed,
    draftCoverageIds,
    draftCoverageSignatures,
    formData.staffId,
    hasLoadedDraftCoverageRefs,
    includeDraftCoverages,
    canManageSchedules,
    canPickUpShift,
    facilityPreferences,
    isEditing,
    isPickup,
    staffList,
  ]);

  useEffect(() => {
    loadCoverage();
  }, [loadCoverage]);

  const selectedStaffLabel = useMemo(() => {
    if (!formData.staffId) {
      return "Select staff";
    }

    const selected = staffList.find((staff) => staff._id === formData.staffId);
    if (!selected) {
      return "Select staff";
    }

    return `${selected.name || "Unknown"} (${
      getUserRoles(selected).map(getRoleDisplayName).join(", ") || "Unknown"
    })`;
  }, [formData.staffId, staffList]);

  const selectedShiftLabel = useMemo(() => {
    if (!formData.coverageId) {
      return coverageOptions.length ? "Select shift" : "No shifts available";
    }

    const selected = coverageOptions.find(
      (item) => item._id === formData.coverageId,
    );
    if (!selected) {
      return "Select shift";
    }

    return `${getRoleDisplayName(selected.role)} | ${formatShiftLabel(selected)}${selected.unitArea ? ` | ${getUnitAreaDisplayName(selected.unitArea)}` : ""}${selected.shiftType ? ` | ${getShiftTypeDisplayName(selected.shiftType)}` : ""}${selected.shiftTag ? ` | ${getShiftTagDisplayName(selected.shiftTag)}` : ""}`;
  }, [coverageOptions, formData.coverageId]);

  const statusButtons: FormData["status"][] = canManageSchedules
    ? SCHEDULE_STATUS_OPTIONS
    : ["scheduled", "call_out"];

  const submit = async () => {
    setMessage("");
    setSubmitting(true);

    if (isPickup) {
      if (!formData.coverageId) {
        setMessage("Select an available shift first.");
        setSubmitting(false);
        return;
      }

      try {
        await api.post("/schedules/pick-up", {
          coverageId: formData.coverageId,
        });
        onSuccess();
      } catch (error: unknown) {
        const msg =
          typeof error === "object" && error !== null && "response" in error
            ? String(
                (
                  error as {
                    response?: { data?: { message?: string } };
                  }
                ).response?.data?.message ||
                  "This shift is no longer available for pickup.",
              )
            : "This shift is no longer available for pickup.";
        setMessage(msg);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!isEditing && activeCoverageContext) {
      const selectedStaff = staffList.find(
        (staff) => staff._id === formData.staffId,
      );
      const isCompatible =
        Boolean(selectedStaff) &&
        getFacilityRolesFromUser(selectedStaff, facilityPreferences).some(
          (role) => isRoleCompatible(role, activeCoverageContext?.role),
        ) &&
        doesCoverageMatchStaffTags(
          selectedStaff as StaffUser,
          activeCoverageContext,
        );

      if (!isCompatible) {
        setMessage(
          "Selected staff is not compatible with this coverage requirements.",
        );
        setSubmitting(false);
        return;
      }
    }

    const payload: Record<string, unknown> = {
      staffId: formData.staffId,
      role: formData.role,
      unitArea: formData.unitArea || null,
      shiftType: formData.shiftType || null,
      shiftTag: formData.shiftTag || null,
      certificationTags: normalizeStringArray(formData.certificationTags),
      startTime: toUTC(formData.startTime),
      endTime: toUTC(formData.endTime),
      notes: formData.notes,
      status: formData.status,
      timezone: formData.timezone,
    };

    if (!canManageSchedules && isEditing) {
      Object.keys(payload).forEach((key) => {
        if (key !== "status") {
          delete payload[key];
        }
      });
    }

    if (!isEditing && !payload.staffId) {
      setMessage("Please select a staff member.");
      setSubmitting(false);
      return;
    }

    if (
      !isEditing &&
      (!payload.startTime || !payload.endTime || !payload.role)
    ) {
      setMessage("Please select a shift before creating a schedule.");
      setSubmitting(false);
      return;
    }

    try {
      if (isEditing && schedule?._id) {
        await api.put(`/schedules/${schedule._id}`, payload);
      } else {
        await api.post("/schedules", payload);
      }

      onSuccess();
    } catch (error: unknown) {
      const msg =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Error saving schedule"
          : "Error saving schedule";

      setMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.card}>
      <GuideHelpButton tourId={tourId} tourSteps={tourSteps} />
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>
            {isEditing
              ? "Edit Schedule"
              : isPickup
                ? "Pick Up an Open Shift"
                : "Create New Schedule"}
          </Text>
          <Text style={styles.subtitle}>
            Assign shifts and update schedule status.
          </Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Feather name="x" size={20} color="#6b7280" />
        </Pressable>
      </View>

      {message ? <Text style={styles.error}>{message}</Text> : null}

      {!isPickup ? (
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Staff</Text>
          <Pressable
            style={styles.selectBtn}
            disabled={isEditing || disableStaffSelect}
            onPress={() => setStaffSelectOpen(true)}
          >
            <Text style={styles.selectText}>{selectedStaffLabel}</Text>
            <Feather name="chevron-down" size={16} color="#6b7280" />
          </Pressable>
        </View>
      ) : null}

      {!isEditing && initialCoverage ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Scheduling open coverage: {getRoleDisplayName(initialCoverage.role)}
            {initialCoverage.unitArea
              ? ` | ${getUnitAreaDisplayName(initialCoverage.unitArea)}`
              : ""}
            {initialCoverage.startTime && initialCoverage.endTime
              ? ` | ${formatShiftLabel(initialCoverage)}`
              : ""}
            {Array.isArray(initialCoverage.requiredCertificationTags) &&
            initialCoverage.requiredCertificationTags.length > 0
              ? ` | Cert: ${initialCoverage.requiredCertificationTags.join(", ")}`
              : ""}
          </Text>
        </View>
      ) : null}

      {!isEditing && !initialCoverage ? (
        <>
          {canManageSchedules ? (
            <View style={styles.switchRow}>
              <Text style={styles.label}>Include draft-flow coverages</Text>
              <Switch
                value={includeDraftCoverages}
                onValueChange={setIncludeDraftCoverages}
              />
            </View>
          ) : null}

          {!includeDraftCoverages && draftCoverageFetchFailed ? (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Unable to verify draft coverages right now. To prevent
                conflicts, draft-linked shifts are hidden.
              </Text>
            </View>
          ) : null}

          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Select Shift</Text>
            <Pressable
              style={styles.selectBtn}
              onPress={() => setShiftSelectOpen(true)}
              disabled={!coverageOptions.length}
            >
              <Text style={styles.selectText}>{selectedShiftLabel}</Text>
              <Feather name="chevron-down" size={16} color="#6b7280" />
            </Pressable>
          </View>
        </>
      ) : null}

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Start</Text>
        <TextInput
          editable={false}
          style={styles.inputDisabled}
          value={formData.startTime}
        />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>End</Text>
        <TextInput
          editable={false}
          style={styles.inputDisabled}
          value={formData.endTime}
        />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Role</Text>
        <TextInput
          editable={false}
          style={styles.inputDisabled}
          value={getRoleDisplayName(formData.role)}
        />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Unit Area</Text>
        <TextInput
          editable={false}
          style={styles.inputDisabled}
          value={formData.unitArea || "-"}
        />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Shift Type</Text>
        <TextInput
          editable={false}
          style={styles.inputDisabled}
          value={formData.shiftType || "-"}
        />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Shift Slot</Text>
        <TextInput
          editable={false}
          style={styles.inputDisabled}
          value={formData.shiftTag || "-"}
        />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Certification Tags</Text>
        <TextInput
          editable={false}
          style={styles.inputDisabled}
          value={formatCertificationTags(formData.certificationTags)}
        />
      </View>

      {canManageSchedules && !isPickup ? (
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            multiline
            numberOfLines={3}
            style={styles.inputArea}
            value={formData.notes}
            onChangeText={(value) =>
              setFormData((prev) => ({ ...prev, notes: value }))
            }
          />
        </View>
      ) : null}

      {isEditing ? (
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusRow}>
            {statusButtons.map((status) => {
              const active = formData.status === status;
              return (
                <Pressable
                  key={status}
                  style={[
                    styles.statusChip,
                    active ? styles.statusChipActive : null,
                  ]}
                  onPress={() => setFormData((prev) => ({ ...prev, status }))}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      active ? styles.statusChipTextActive : null,
                    ]}
                  >
                    {status.replace("_", " ").toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionBtn, styles.cancelBtn]}
          onPress={onClose}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.submitBtn]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>
              {isEditing
                ? "Update Schedule"
                : isPickup
                  ? "Pick Up Shift"
                  : "Create Schedule"}
            </Text>
          )}
        </Pressable>
      </View>

      <SelectModal
        open={staffSelectOpen}
        onClose={() => setStaffSelectOpen(false)}
        title="Select Staff"
        value={formData.staffId}
        onSelect={(value) => {
          const selected = staffList.find((staff) => staff._id === value);
          setFormData((prev) => ({
            ...prev,
            staffId: value,
            ...(initialCoverage && !isEditing
              ? { role: getUserRoles(selected)[0] || prev.role }
              : {
                  coverageId: "",
                  startTime: "",
                  endTime: "",
                  role: getUserRoles(selected)[0] || "",
                  unitArea: "",
                  shiftType: "",
                  shiftTag: "",
                  certificationTags: [],
                }),
          }));
        }}
        options={compatibleStaffOptions.map((staff) => ({
          value: staff._id || "",
          label: `${staff.name || "Unknown"} (${
            getUserRoles(staff).map(getRoleDisplayName).join(", ") || "Unknown"
          })`,
        }))}
      />

      <SelectModal
        open={shiftSelectOpen}
        onClose={() => setShiftSelectOpen(false)}
        title="Select Shift"
        value={formData.coverageId}
        onSelect={(value) => {
          const coverage = coverageOptions.find((item) => item._id === value);
          if (!coverage?._id) {
            return;
          }

          setFormData((prev) => ({
            ...prev,
            coverageId: coverage._id || "",
            role: coverage.role || "",
            unitArea: coverage.unitArea || "",
            shiftType: coverage.shiftType || "",
            shiftTag: coverage.shiftTag || "",
            certificationTags: normalizeStringArray(
              coverage.requiredCertificationTags,
            ),
            startTime: toLocalInputValue(coverage.startTime),
            endTime: toLocalInputValue(coverage.endTime),
          }));
        }}
        options={coverageOptions.map((coverage) => ({
          value: coverage._id || "",
          label: `${getRoleDisplayName(coverage.role)} | ${formatShiftLabel(coverage)}${coverage.unitArea ? ` | ${getUnitAreaDisplayName(coverage.unitArea)}` : ""}${coverage.shiftType ? ` | ${getShiftTypeDisplayName(coverage.shiftType)}` : ""}${coverage.shiftTag ? ` | ${getShiftTagDisplayName(coverage.shiftTag)}` : ""} (${coverage.spotsRemaining} spots left${coverage.spotsRemaining <= 0 ? " | Full" : ""})`,
          disabled: coverage.spotsRemaining <= 0,
        }))}
      />
      <GuideTourOverlay />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  fieldWrap: {
    gap: 6,
  },
  infoBox: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  infoText: {
    color: "#1e3a8a",
    fontSize: 12,
    lineHeight: 18,
  },
  warningBox: {
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  warningText: {
    color: "#92400e",
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectBtn: {
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
  selectText: {
    color: "#111827",
    fontSize: 13,
    flexShrink: 1,
  },
  inputDisabled: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#6b7280",
    backgroundColor: "#f9fafb",
  },
  inputArea: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#111827",
    minHeight: 88,
    textAlignVertical: "top",
    backgroundColor: "#ffffff",
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusChipActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  statusChipText: {
    color: "#374151",
    fontSize: 11,
    fontWeight: "700",
  },
  statusChipTextActive: {
    color: "#1d4ed8",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  submitBtn: {
    backgroundColor: "#1d4ed8",
  },
  cancelText: {
    color: "#111827",
    fontWeight: "700",
  },
  submitText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  selectCard: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    maxHeight: "70%",
    padding: 12,
    gap: 8,
  },
  selectHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  optionsList: {
    gap: 6,
  },
  optionBtn: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  optionBtnActive: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  optionBtnDisabled: {
    opacity: 0.55,
  },
  optionText: {
    color: "#111827",
    fontSize: 13,
    flexShrink: 1,
  },
  optionTextActive: {
    color: "#1e3a8a",
    fontWeight: "700",
  },
  optionTextDisabled: {
    color: "#6b7280",
  },
});
