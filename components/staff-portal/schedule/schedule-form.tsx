import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import api from "@/config/api";
import {
  getRoleDisplayName,
  isRoleCompatible,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";

import { CoverageItem, ScheduleItem, StaffUser } from "./schedule-types";

type Props = {
  onSuccess: () => void;
  onClose: () => void;
  schedule: ScheduleItem | null;
  staffList: StaffUser[];
  initialStaffId?: string;
  disableStaffSelect?: boolean;
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
  status: "scheduled" | "completed" | "call_out";
  timezone: string;
};

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

  return `${dateLabel} - ${startLabel} to ${endLabel}`;
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
  disableStaffSelect = false,
}: Props) {
  const isEditing = Boolean(schedule);
  const { isAdmin } = useAuth();

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

  const [coverageOptions, setCoverageOptions] = useState<CoverageItem[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [staffSelectOpen, setStaffSelectOpen] = useState(false);
  const [shiftSelectOpen, setShiftSelectOpen] = useState(false);

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
      role: selected?.role || prev.role,
    }));
  }, [initialStaffId, schedule, staffList]);

  const loadCoverage = useCallback(async () => {
    if (!formData.staffId || isEditing) {
      return;
    }

    const selectedStaff = staffList.find(
      (staff) => staff._id === formData.staffId,
    );
    if (!selectedStaff?.role) {
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

          return (
            !Number.isNaN(start.getTime()) &&
            start > now &&
            isRoleCompatible(selectedStaff.role, item.role)
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
            remaining: spotsRemaining,
          };
        })
        .filter((item) => Number(item.remaining) > 0);

      setCoverageOptions(valid);
    } catch (error) {
      console.warn("Failed to load coverage for schedule form", error);
      setCoverageOptions([]);
    }
  }, [formData.staffId, isEditing, staffList]);

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

    return `${selected.name || "Unknown"} (${getRoleDisplayName(selected.role)})`;
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

    return `${getRoleDisplayName(selected.role)} | ${formatShiftLabel(selected)}${selected.unitArea ? ` | ${selected.unitArea}` : ""}${selected.shiftType ? ` | ${selected.shiftType}` : ""}${selected.shiftTag ? ` | ${selected.shiftTag}` : ""}`;
  }, [coverageOptions, formData.coverageId]);

  const statusButtons: FormData["status"][] = isAdmin
    ? ["scheduled", "completed", "call_out"]
    : ["scheduled", "call_out"];

  const submit = async () => {
    setMessage("");
    setSubmitting(true);

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

    if (!isAdmin && isEditing) {
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
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>
            {isEditing ? "Edit Schedule" : "Create New Schedule"}
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

      {!isEditing ? (
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

      {isAdmin ? (
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
              {isEditing ? "Update Schedule" : "Create Schedule"}
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
            coverageId: "",
            startTime: "",
            endTime: "",
            role: selected?.role || "",
            unitArea: "",
            shiftType: "",
            shiftTag: "",
            certificationTags: [],
          }));
        }}
        options={staffList.map((staff) => ({
          value: staff._id || "",
          label: `${staff.name || "Unknown"} (${getRoleDisplayName(staff.role)})`,
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
          label: `${getRoleDisplayName(coverage.role)} | ${formatShiftLabel(coverage)}${coverage.unitArea ? ` | ${coverage.unitArea}` : ""}${coverage.shiftType ? ` | ${coverage.shiftType}` : ""}${coverage.shiftTag ? ` | ${coverage.shiftTag}` : ""} (${coverage.remaining ?? 0} spots left)`,
          disabled: (coverage.remaining ?? 0) === 0,
        }))}
      />
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
  label: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
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
