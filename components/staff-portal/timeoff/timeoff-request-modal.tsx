import { Feather } from "@expo/vector-icons";
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

function parseInputToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
}

export default function TimeOffRequestModal({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStartTime("");
    setEndTime("");
    setReason("");
    setError("");
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

    const startIso = parseInputToIso(startTime);
    const endIso = parseInputToIso(endTime);

    if (!startIso || !endIso) {
      setError("Start and end date/time are required. Use YYYY-MM-DD HH:mm.");
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
              <Text style={styles.label}>Start Date/Time</Text>
              <TextInput
                value={startTime}
                onChangeText={setStartTime}
                style={styles.input}
                placeholder="YYYY-MM-DD HH:mm"
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>End Date/Time</Text>
              <TextInput
                value={endTime}
                onChangeText={setEndTime}
                style={styles.input}
                placeholder="YYYY-MM-DD HH:mm"
              />
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
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    color: "#111827",
    backgroundColor: "#ffffff",
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
});
