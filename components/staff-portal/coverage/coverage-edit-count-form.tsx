import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import api from "@/config/api";

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

type Coverage = {
  _id?: string;
  role?: string;
  requiredCount?: number;
};

type Props = {
  coverage: Coverage | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function CoverageEditCountForm({
  coverage,
  onClose,
  onSuccess,
}: Props) {
  const [requiredCount, setRequiredCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRequiredCount(Number(coverage?.requiredCount) || 0);
    setError("");
  }, [coverage]);

  const originalCount = useMemo(
    () => Number(coverage?.requiredCount) || 0,
    [coverage],
  );

  const delta = requiredCount - originalCount;

  const setAdjustedCount = (change: number) => {
    setRequiredCount((prev) => Math.max(0, Number(prev) + change));
  };

  const handleSubmit = async () => {
    const nextCount = Number(requiredCount);

    if (!Number.isFinite(nextCount) || nextCount < 0) {
      setError("Required count must be 0 or greater.");
      return;
    }

    if (!coverage?._id) {
      setError("Coverage record not found.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.put(`/coverage/${coverage._id}`, {
        requiredCount: nextCount,
      });
      onSuccess();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Failed to update coverage.";

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Edit Coverage Count</Text>
      <Text style={styles.subtitle}>
        {ROLE_LABELS[coverage?.role || ""] || coverage?.role || "Role"} - adjust
        required staff
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.inputRow}>
        <View style={styles.inputBlock}>
          <Text style={styles.inputLabel}>Current Count</Text>
          <TextInput
            value={`${originalCount}`}
            editable={false}
            style={[styles.input, styles.inputReadOnly]}
          />
        </View>
        <View style={styles.inputBlock}>
          <Text style={styles.inputLabel}>New Count</Text>
          <TextInput
            value={`${requiredCount}`}
            keyboardType="number-pad"
            onChangeText={(value) =>
              setRequiredCount(Math.max(0, Number(value) || 0))
            }
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.adjustRow}>
        <Pressable
          style={styles.adjustBtn}
          disabled={loading || requiredCount <= 0}
          onPress={() => setAdjustedCount(-1)}
        >
          <Feather name="minus" size={16} color="#111827" />
          <Text style={styles.adjustText}>Subtract 1</Text>
        </Pressable>
        <Pressable
          style={styles.adjustBtn}
          disabled={loading}
          onPress={() => setAdjustedCount(1)}
        >
          <Feather name="plus" size={16} color="#111827" />
          <Text style={styles.adjustText}>Add 1</Text>
        </Pressable>
      </View>

      <Text style={styles.deltaText}>
        {delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta}`}
      </Text>

      <View style={styles.actionRow}>
        <Pressable
          onPress={onClose}
          disabled={loading}
          style={[styles.actionBtn, styles.cancelBtn]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.actionBtn, styles.saveBtn]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveText}>Save Count</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10,
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6b7280",
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
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  inputBlock: {
    flex: 1,
    gap: 5,
  },
  inputLabel: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  inputReadOnly: {
    backgroundColor: "#f9fafb",
    color: "#6b7280",
  },
  adjustRow: {
    flexDirection: "row",
    gap: 8,
  },
  adjustBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  adjustText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  deltaText: {
    alignSelf: "flex-end",
    color: "#2563eb",
    fontWeight: "700",
    fontSize: 13,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  saveBtn: {
    backgroundColor: "#2563eb",
  },
  cancelText: {
    color: "#111827",
    fontWeight: "700",
  },
  saveText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
