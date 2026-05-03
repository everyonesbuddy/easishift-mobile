import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import api from "@/config/api";

const ROLES = [
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
  "staff",
  "other",
] as const;

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

type Requirement = {
  role: string;
  requiredCount: number;
  startTime: string;
  endTime: string;
};

type Props = {
  tenantId?: string;
  onSuccess: () => void;
  onClose: () => void;
};

function toUTC(dateStr: string, timeStr: string) {
  const local = new Date(`${dateStr}T${timeStr}:00`);
  return new Date(local.toISOString()).toISOString();
}

function toDayKey(input: Date) {
  const y = input.getFullYear();
  const m = `${input.getMonth() + 1}`.padStart(2, "0");
  const d = `${input.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function CoverageCreateForm({
  tenantId,
  onSuccess,
  onClose,
}: Props) {
  const today = toDayKey(new Date());

  const [dateInput, setDateInput] = useState(today);
  const [dates, setDates] = useState<string[]>([today]);
  const [requirements, setRequirements] = useState<Requirement[]>([
    {
      role: "",
      requiredCount: 1,
      startTime: "09:00",
      endTime: "17:00",
    },
  ]);
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"create" | "ai">("create");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const addDate = () => {
    const value = dateInput.trim();
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(value);

    if (!valid) {
      setError("Date must be in YYYY-MM-DD format.");
      return;
    }

    setDates((prev) => {
      if (prev.includes(value)) {
        return prev;
      }

      const next = [...prev, value].sort((a, b) => a.localeCompare(b));
      setError("");
      return next;
    });
  };

  const removeDate = (date: string) => {
    setDates((prev) => prev.filter((d) => d !== date));
  };

  const handleRequirementChange = (
    index: number,
    key: keyof Requirement,
    value: string,
  ) => {
    setRequirements((prev) =>
      prev.map((req, i) => {
        if (i !== index) {
          return req;
        }

        if (key === "requiredCount") {
          return {
            ...req,
            requiredCount: Math.max(0, Number(value) || 0),
          };
        }

        return {
          ...req,
          [key]: value,
        };
      }),
    );
  };

  const handleAddRequirement = () => {
    setRequirements((prev) => [
      ...prev,
      {
        role: "",
        requiredCount: 1,
        startTime: "09:00",
        endTime: "17:00",
      },
    ]);
  };

  const handleRemoveRequirement = (index: number) => {
    setRequirements((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );
  };

  const handleSubmit = async (autoGenerate = false) => {
    if (!dates.length || requirements.length === 0) {
      setError("Please add at least one date and one coverage requirement.");
      return;
    }

    const referenceDate = dates[0];

    for (let index = 0; index < requirements.length; index += 1) {
      const req = requirements[index];
      if (!req.role || !req.startTime || !req.endTime) {
        setError(
          `Requirement ${index + 1} must include role, start time, and end time.`,
        );
        return;
      }

      const startUTC = new Date(toUTC(referenceDate, req.startTime));
      const endUTC = new Date(toUTC(referenceDate, req.endTime));

      if (startUTC >= endUTC) {
        setError(
          `Requirement ${index + 1} must have end time after start time.`,
        );
        return;
      }
    }

    setLoadingMode(autoGenerate ? "ai" : "create");
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const allCreated: { _id?: string }[] = [];

      for (const selectedDate of dates) {
        const shifts = requirements.map((req) => ({
          role: req.role,
          requiredCount: Number(req.requiredCount) || 0,
          startTime: toUTC(selectedDate, req.startTime),
          endTime: toUTC(selectedDate, req.endTime),
          note,
        }));

        const createRes = await api.post("/coverage", {
          tenantId,
          dates: [selectedDate],
          shifts,
        });

        const createdForDate = Array.isArray(createRes.data)
          ? createRes.data
          : Array.isArray(createRes.data?.created)
            ? createRes.data.created
            : [];

        allCreated.push(...createdForDate);
      }

      let generatedCount = 0;
      if (autoGenerate) {
        const coverageIds = allCreated.map((item) => item?._id).filter(Boolean);

        if (coverageIds.length > 0) {
          const autoRes = await api.post("/schedules/auto-generate", {
            coverageIds,
          });

          generatedCount = autoRes.data?.generatedCount ?? 0;
        }
      }

      setSuccess(
        autoGenerate
          ? `Coverage created + AI auto-schedule complete (${generatedCount} shifts generated).`
          : "Coverage requirements added successfully!",
      );

      setRequirements([
        {
          role: "",
          requiredCount: 1,
          startTime: "09:00",
          endTime: "17:00",
        },
      ]);
      setDates([today]);
      setDateInput(today);
      setNote("");
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
          : "Failed to add coverage.";

      setError(msg);
    } finally {
      setLoading(false);
      setLoadingMode("create");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Add Coverage Requirements</Text>
          <Text style={styles.subtitle}>
            Define role, count, and shift window for each requirement.
          </Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Feather name="x" size={22} color="#6b7280" />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Coverage Dates</Text>
        <Text style={styles.sectionHint}>Add dates as YYYY-MM-DD</Text>

        <View style={styles.dateInputRow}>
          <TextInput
            value={dateInput}
            onChangeText={setDateInput}
            placeholder="2026-05-01"
            style={styles.input}
          />
          <Pressable style={styles.smallBtn} onPress={addDate}>
            <Text style={styles.smallBtnText}>Add Date</Text>
          </Pressable>
        </View>

        <View style={styles.chipsWrap}>
          {dates.map((d) => (
            <View key={d} style={styles.chip}>
              <Text style={styles.chipText}>{d}</Text>
              <Pressable onPress={() => removeDate(d)}>
                <Feather name="x" size={14} color="#1d4ed8" />
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.requirementHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Coverage Requirements</Text>
          <Text style={styles.sectionHint}>{requirements.length} entries</Text>
        </View>
        <Pressable style={styles.smallBtn} onPress={handleAddRequirement}>
          <Text style={styles.smallBtnText}>Add Requirement</Text>
        </Pressable>
      </View>

      <View style={styles.stack}>
        {requirements.map((req, index) => (
          <View key={`req-${index}`} style={styles.requirementCard}>
            <View style={styles.requirementTopRow}>
              <Text style={styles.requirementTitle}>
                Requirement {index + 1}
              </Text>
              <Pressable
                onPress={() => handleRemoveRequirement(index)}
                disabled={requirements.length === 1}
              >
                <Feather name="trash-2" size={16} color="#dc2626" />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.roleRow}>
                {ROLES.map((role) => {
                  const active = req.role === role;
                  return (
                    <Pressable
                      key={role}
                      style={[
                        styles.roleChip,
                        active ? styles.roleChipActive : null,
                      ]}
                      onPress={() =>
                        handleRequirementChange(index, "role", role)
                      }
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          active ? styles.roleChipTextActive : null,
                        ]}
                      >
                        {ROLE_LABELS[role] || role}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.inlineInputsRow}>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Count</Text>
                <TextInput
                  value={`${req.requiredCount}`}
                  onChangeText={(value) =>
                    handleRequirementChange(index, "requiredCount", value)
                  }
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Start (HH:mm)</Text>
                <TextInput
                  value={req.startTime}
                  onChangeText={(value) =>
                    handleRequirementChange(index, "startTime", value)
                  }
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>End (HH:mm)</Text>
                <TextInput
                  value={req.endTime}
                  onChangeText={(value) =>
                    handleRequirementChange(index, "endTime", value)
                  }
                  style={styles.input}
                />
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          style={[styles.input, styles.notesInput]}
        />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtn, styles.primaryBtn]}
          onPress={() => handleSubmit(false)}
          disabled={loading}
        >
          {loading && loadingMode === "create" ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.primaryBtnText}>Save Requirements</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.darkBtn]}
          onPress={() => handleSubmit(true)}
          disabled={loading}
        >
          {loading && loadingMode === "ai" ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.darkBtnText}>Save + AI Generate Schedule</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    paddingBottom: 8,
  },
  headerRow: {
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
  },
  success: {
    color: "#166534",
    backgroundColor: "#dcfce7",
    borderColor: "#86efac",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sectionCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    padding: 10,
    gap: 8,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  sectionHint: {
    color: "#6b7280",
    fontSize: 12,
  },
  dateInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#111827",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    color: "#1d4ed8",
    fontWeight: "600",
    fontSize: 12,
  },
  requirementHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  smallBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  stack: {
    gap: 10,
  },
  requirementCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    padding: 10,
    gap: 8,
  },
  requirementTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  requirementTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  roleRow: {
    flexDirection: "row",
    gap: 6,
  },
  roleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleChipActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  roleChipText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  roleChipTextActive: {
    color: "#1d4ed8",
  },
  inlineInputsRow: {
    flexDirection: "row",
    gap: 8,
  },
  fieldWrap: {
    flex: 1,
    gap: 5,
  },
  fieldLabel: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  notesInput: {
    minHeight: 68,
    textAlignVertical: "top",
  },
  actionRow: {
    gap: 8,
  },
  actionBtn: {
    borderRadius: 8,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
  },
  darkBtn: {
    backgroundColor: "#111827",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  darkBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
