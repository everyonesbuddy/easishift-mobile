import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
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
  getFacilityRolesFromUser,
  getUserRoles,
  isRoleCompatible,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";

import {
  formatWindow,
  getRoleDisplayName,
  ScheduleItem,
  StaffUser,
} from "./schedule-types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schedule?: ScheduleItem | null;
  enableSchedulePicker?: boolean;
  staffList?: StaffUser[];
};

function PickerCard({
  title,
  value,
  placeholder,
  options,
  onChoose,
  disabled,
}: {
  title: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChoose: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{title}</Text>
      <Pressable
        style={[styles.selectBtn, disabled ? styles.selectBtnDisabled : null]}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.selectText}>{value || placeholder}</Text>
        <Feather name="chevron-down" size={16} color="#6b7280" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Feather name="x" size={18} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalList}>
              {options.length === 0 ? (
                <Text style={styles.emptyText}>No options available.</Text>
              ) : (
                options.map((option) => (
                  <Pressable
                    key={option.value}
                    style={styles.modalItem}
                    onPress={() => {
                      onChoose(option.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{option.label}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function ShiftSwapRequestModal({
  open,
  onClose,
  onSuccess,
  schedule = null,
  enableSchedulePicker = false,
  staffList = [],
}: Props) {
  const { user, can, facilityPreferences } = useAuth();
  const canUseShiftSwap = can("shift_swap.use");

  const [mySchedules, setMySchedules] = useState<ScheduleItem[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(
    schedule?._id || "",
  );
  const [receiverStaffId, setReceiverStaffId] = useState("");
  const [note, setNote] = useState("");
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedScheduleId(schedule?._id || "");
    setReceiverStaffId("");
    setNote("");
    setError("");
  }, [open, schedule]);

  useEffect(() => {
    if (!open || !enableSchedulePicker || schedule || !user?._id) {
      return;
    }

    const loadMySchedules = async () => {
      try {
        setLoadingSchedules(true);
        const res = await api.get(`/schedules?staffId=${user._id}`);
        const now = new Date();
        const schedules = Array.isArray(res.data)
          ? (res.data as ScheduleItem[])
          : [];
        const upcoming = schedules.filter((item) => {
          const start = new Date(item.startTime || "");
          return (
            item.status === "scheduled" &&
            !Number.isNaN(start.getTime()) &&
            start > now
          );
        });
        setMySchedules(upcoming);
      } catch (requestError) {
        console.warn("Failed to load schedules for swap", requestError);
        setMySchedules([]);
      } finally {
        setLoadingSchedules(false);
      }
    };

    loadMySchedules();
  }, [open, enableSchedulePicker, schedule, user]);

  const activeSchedule = useMemo(() => {
    if (schedule) {
      return schedule;
    }

    return mySchedules.find((item) => item._id === selectedScheduleId) || null;
  }, [schedule, mySchedules, selectedScheduleId]);

  const receiverOptions = useMemo(() => {
    if (!activeSchedule) {
      return [];
    }

    const assignedStaffId =
      typeof activeSchedule.staffId === "string"
        ? activeSchedule.staffId
        : activeSchedule.staffId?._id;

    return staffList.filter((staff) => {
      if (!staff?._id) {
        return false;
      }

      if (String(staff._id) === String(assignedStaffId)) {
        return false;
      }

      return (
        getUserRoles(staff).some((role) =>
          isRoleCompatible(role, activeSchedule.role),
        ) ||
        getFacilityRolesFromUser(staff, facilityPreferences).some((role) =>
          isRoleCompatible(role, activeSchedule.role),
        )
      );
    });
  }, [activeSchedule, facilityPreferences, staffList]);

  const submitSwapRequest = async () => {
    if (!canUseShiftSwap) {
      setError("You do not have permission to request a shift swap.");
      return;
    }

    if (!activeSchedule?._id) {
      setError("Please select a shift to swap.");
      return;
    }

    if (!receiverStaffId) {
      setError("Please choose a recipient.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await api.post(`/schedules/${activeSchedule._id}/swap-requests`, {
        receiverStaffId,
        note,
      });

      onSuccess();
      onClose();
    } catch (requestError: unknown) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (requestError as { response?: { data?: { message?: string } } })
              .response?.data?.message || "Failed to send swap request"
          : "Failed to send swap request";

      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const schedulePickerValue = activeSchedule
    ? `${getRoleDisplayName(activeSchedule.role)} | ${formatWindow(
        activeSchedule.startTime,
        activeSchedule.endTime,
      )}`
    : "";

  const receiverPickerValue =
    receiverOptions.find((staff) => staff._id === receiverStaffId)?.name || "";

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={submitting ? undefined : onClose}
    >
      <Pressable
        style={styles.modalBackdrop}
        onPress={submitting ? undefined : onClose}
      >
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Request Shift Swap</Text>
            <Pressable
              onPress={onClose}
              disabled={submitting}
              style={styles.closeBtn}
            >
              <Feather name="x" size={20} color="#6b7280" />
            </Pressable>
          </View>

          {enableSchedulePicker && !schedule ? (
            loadingSchedules ? (
              <ActivityIndicator size="small" color="#1d4ed8" />
            ) : (
              <PickerCard
                title="Shift"
                value={schedulePickerValue}
                placeholder="Select shift"
                onChoose={(value) => {
                  setSelectedScheduleId(value);
                  setReceiverStaffId("");
                }}
                options={mySchedules.map((item) => ({
                  value: item._id || "",
                  label: `${getRoleDisplayName(item.role)} | ${formatWindow(
                    item.startTime,
                    item.endTime,
                  )}`,
                }))}
              />
            )
          ) : null}

          {activeSchedule ? (
            <View style={styles.selectedShiftCard}>
              <Text style={styles.selectedLabel}>Selected Shift</Text>
              <Text style={styles.selectedText}>
                {getRoleDisplayName(activeSchedule.role)} |{" "}
                {formatWindow(activeSchedule.startTime, activeSchedule.endTime)}
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>Select a shift to continue.</Text>
          )}

          <PickerCard
            title="Send To"
            value={receiverPickerValue}
            placeholder="Choose recipient"
            onChoose={setReceiverStaffId}
            disabled={!activeSchedule}
            options={receiverOptions.map((staff) => ({
              value: staff._id || "",
              label: `${staff.name || "Unknown"} (${
                getUserRoles(staff).map(getRoleDisplayName).join(", ") ||
                "Unknown"
              })`,
            }))}
          />

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput
              multiline
              numberOfLines={3}
              value={note}
              onChangeText={setNote}
              style={styles.noteInput}
              editable={!submitting && Boolean(activeSchedule)}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.submitBtn]}
              onPress={submitSwapRequest}
              disabled={submitting || !activeSchedule}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitText}>Send Request</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 10,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  selectedShiftCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    padding: 10,
    gap: 4,
  },
  selectedLabel: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  selectedText: {
    color: "#111827",
    fontSize: 13,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
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
  },
  selectBtnDisabled: {
    backgroundColor: "#f3f4f6",
  },
  selectText: {
    color: "#111827",
    fontSize: 13,
    flexShrink: 1,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#111827",
    backgroundColor: "#ffffff",
    minHeight: 86,
    textAlignVertical: "top",
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
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    minHeight: 42,
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
  modalCard: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    maxHeight: "70%",
    padding: 12,
    gap: 8,
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
  modalList: {
    gap: 6,
  },
  modalItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#f9fafb",
  },
  modalItemText: {
    color: "#111827",
    fontSize: 13,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
  },
});
