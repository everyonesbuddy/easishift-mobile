import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
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

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

function formatDateLabel(value: Date | null) {
  if (!value) {
    return "Select date";
  }

  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeLabel(value: Date | null) {
  if (!value) {
    return "Select time";
  }

  return value.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function TimeOffRequestModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [startDateTime, setStartDateTime] = useState<Date | null>(null);
  const [endDateTime, setEndDateTime] = useState<Date | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pickerState, setPickerState] = useState<{
    target: "start" | "end";
    mode: "date" | "time";
    value: Date;
  } | null>(null);

  const reset = () => {
    setStartDateTime(null);
    setEndDateTime(null);
    setReason("");
    setError("");
    setPickerState(null);
  };

  const openPicker = (target: "start" | "end", mode: "date" | "time") => {
    const seed =
      (target === "start" ? startDateTime : endDateTime) || new Date();

    setPickerState({
      target,
      mode,
      value: new Date(seed),
    });
  };

  const applyPicker = () => {
    if (!pickerState) {
      return;
    }

    if (pickerState.target === "start") {
      setStartDateTime(new Date(pickerState.value));
    } else {
      setEndDateTime(new Date(pickerState.value));
    }

    setPickerState(null);
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }

    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setError("");

    const startIso = startDateTime?.toISOString() || "";
    const endIso = endDateTime?.toISOString() || "";

    if (!startIso || !endIso) {
      setError("Start and end date/time are required.");
      return;
    }

    if (new Date(startIso) > new Date(endIso)) {
      setError("End date/time must be after start date/time.");
      return;
    }

    try {
      setSubmitting(true);
      await api.post("/timeoff", {
        startTime: startIso,
        endTime: endIso,
        reason,
      });
      reset();
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
              .response?.data?.message || "Failed to submit request"
          : "Failed to submit request";

      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Request Time Off</Text>
              <Pressable onPress={handleClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#6b7280" />
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Start</Text>
              <View style={styles.dateTimeRow}>
                <Pressable
                  style={styles.selectField}
                  onPress={() => openPicker("start", "date")}
                >
                  <Feather name="calendar" size={14} color="#6b7280" />
                  <Text style={styles.selectFieldText} numberOfLines={1}>
                    {formatDateLabel(startDateTime)}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.selectField}
                  onPress={() => openPicker("start", "time")}
                >
                  <Feather name="clock" size={14} color="#6b7280" />
                  <Text style={styles.selectFieldText} numberOfLines={1}>
                    {formatTimeLabel(startDateTime)}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>End</Text>
              <View style={styles.dateTimeRow}>
                <Pressable
                  style={styles.selectField}
                  onPress={() => openPicker("end", "date")}
                >
                  <Feather name="calendar" size={14} color="#6b7280" />
                  <Text style={styles.selectFieldText} numberOfLines={1}>
                    {formatDateLabel(endDateTime)}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.selectField}
                  onPress={() => openPicker("end", "time")}
                >
                  <Feather name="clock" size={14} color="#6b7280" />
                  <Text style={styles.selectFieldText} numberOfLines={1}>
                    {formatTimeLabel(endDateTime)}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Reason (optional)</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                style={styles.textArea}
                placeholder="Add optional context"
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.actions}>
              <Pressable
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={handleClose}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.actionBtn,
                  styles.submitBtn,
                  submitting ? styles.submitDisabled : null,
                ]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitText}>Request</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>

      <Modal
        visible={pickerState !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerState(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerState(null)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.pickerTitle}>
                {pickerState?.target === "start"
                  ? "Select Start"
                  : "Select End"}{" "}
                {pickerState?.mode === "date" ? "Date" : "Time"}
              </Text>
              <Pressable
                onPress={() => setPickerState(null)}
                style={styles.closeBtn}
              >
                <Feather name="x" size={20} color="#6b7280" />
              </Pressable>
            </View>

            <DateTimePicker
              value={pickerState?.value || new Date()}
              mode={pickerState?.mode || "date"}
              display="spinner"
              onChange={(_, selectedDate) => {
                if (selectedDate) {
                  setPickerState((prev) =>
                    prev
                      ? {
                          ...prev,
                          value: selectedDate,
                        }
                      : prev,
                  );
                }
              }}
            />

            <View style={styles.pickerActions}>
              <Pressable
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => setPickerState(null)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.submitBtn]}
                onPress={applyPicker}
              >
                <Text style={styles.submitText}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
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
    maxHeight: "85%",
  },
  content: {
    padding: 14,
    gap: 12,
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
  dateTimeRow: {
    flexDirection: "row",
    gap: 8,
  },
  selectField: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectFieldText: {
    color: "#111827",
    fontSize: 12,
    flex: 1,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  actions: {
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
    backgroundColor: "#2563eb",
  },
  submitDisabled: {
    opacity: 0.65,
  },
  cancelText: {
    color: "#111827",
    fontWeight: "700",
  },
  submitText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  pickerCard: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 10,
  },
  pickerTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  pickerActions: {
    flexDirection: "row",
    gap: 8,
  },
});
