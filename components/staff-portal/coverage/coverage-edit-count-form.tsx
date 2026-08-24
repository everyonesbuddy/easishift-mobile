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
  getCertificationTagDisplayName,
  getRoleDisplayName,
  getRoleOptionsFromFacilityPreferences,
  getUnitAreaDisplayName,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";

type Coverage = {
  _id?: string;
  role?: string;
  unitArea?: string;
  requiredCount?: number;
  remaining?: number;
  spotsRemaining?: number;
  startTime?: string;
  endTime?: string;
  shiftType?: string;
  shiftTag?: string;
  requiredCertificationTags?: string[];
};

type Props = {
  coverage: Coverage | null;
  onClose: () => void;
  onSuccess: () => void;
};

type Option = { value: string; label: string };

function normalizeToken(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
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

function getCoverageId(value: unknown) {
  if (!value || typeof value !== "object") return String(value || "");
  const item = value as {
    coverageId?: { _id?: string } | string;
    _id?: string;
  };
  return String(
    typeof item.coverageId === "object"
      ? item.coverageId?._id || ""
      : item.coverageId || item._id || "",
  );
}

function buildCoverageSignature(value: Record<string, unknown>) {
  const start = new Date(
    String(value.startTime || value.windowStart || ""),
  ).getTime();
  const end = new Date(
    String(value.endTime || value.windowEnd || ""),
  ).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "";

  return [
    start,
    end,
    normalizeToken(value.role),
    normalizeToken(value.unitArea),
    normalizeToken(value.shiftType),
    normalizeToken(value.shiftTag),
  ].join("|");
}

function referencesCoverage(
  value: unknown,
  coverageId: string,
  signature: string,
) {
  if (getCoverageId(value) === coverageId) return true;
  if (!signature || !value || typeof value !== "object") return false;
  return buildCoverageSignature(value as Record<string, unknown>) === signature;
}

function draftReferencesCoverage(
  draft: Record<string, unknown>,
  coverageId: string,
  signature: string,
) {
  const status = normalizeToken(draft.status);
  if (status && !["draft", "partially_published"].includes(status)) {
    return false;
  }

  const collections = [
    draft.coverageSnapshot,
    draft.coverages,
    draft.sourceCoverages,
    draft.inputCoverages,
    draft.requestedCoverages,
    draft.assignments,
  ];

  if (
    collections.some(
      (items) =>
        Array.isArray(items) &&
        items.some((item) => referencesCoverage(item, coverageId, signature)),
    )
  ) {
    return true;
  }

  return [
    ...(Array.isArray(draft.coverageIds) ? draft.coverageIds : []),
    ...(Array.isArray(draft.sourceCoverageIds) ? draft.sourceCoverageIds : []),
    ...(Array.isArray(draft.inputCoverageIds) ? draft.inputCoverageIds : []),
  ].some((id) => String(id || "") === coverageId);
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
  options: Option[];
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
        <Pressable style={styles.pickerCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose}>
              <Feather name="x" size={18} color="#64748b" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.pickerList}>
            {options.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.pickerItem,
                  option.value === value ? styles.pickerItemActive : null,
                ]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <Text style={styles.pickerItemText}>{option.label}</Text>
                {option.value === value ? (
                  <Feather name="check" size={16} color="#2563eb" />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MultiSelectModal({
  open,
  title,
  values,
  options,
  onChange,
  onClose,
}: {
  open: boolean;
  title: string;
  values: string[];
  options: Option[];
  onChange: (values: string[]) => void;
  onClose: () => void;
}) {
  const selectedValues = normalizeStringArray(values);

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose}>
              <Feather name="x" size={18} color="#64748b" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.pickerList}>
            {options.map((option) => {
              const selected = selectedValues.includes(option.value);
              return (
                <Pressable
                  key={option.value}
                  style={[
                    styles.pickerItem,
                    selected ? styles.pickerItemActive : null,
                  ]}
                  onPress={() =>
                    onChange(
                      selected
                        ? selectedValues.filter(
                            (value) => value !== option.value,
                          )
                        : [...selectedValues, option.value],
                    )
                  }
                >
                  <Text style={styles.pickerItemText}>{option.label}</Text>
                  {selected ? (
                    <Feather name="check" size={16} color="#2563eb" />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function CoverageEditCountForm({
  coverage,
  onClose,
  onSuccess,
}: Props) {
  const { can, facilityPreferences } = useAuth();
  const [requiredCount, setRequiredCount] = useState(0);
  const [role, setRole] = useState("");
  const [unitArea, setUnitArea] = useState("");
  const [requiredCertificationTags, setRequiredCertificationTags] = useState<
    string[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [lockChecking, setLockChecking] = useState(false);
  const [metadataLocked, setMetadataLocked] = useState(true);
  const [lockReason, setLockReason] = useState("Checking coverage usage...");
  const [error, setError] = useState("");
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [certPickerOpen, setCertPickerOpen] = useState(false);

  const coverageId = String(coverage?._id || "");
  const originalCount = Number(coverage?.requiredCount) || 0;
  const delta = requiredCount - originalCount;

  useEffect(() => {
    setRequiredCount(originalCount);
    setRole(coverage?.role || "");
    setUnitArea(coverage?.unitArea || "");
    setRequiredCertificationTags(
      normalizeStringArray(coverage?.requiredCertificationTags),
    );
    setError("");
  }, [coverage, originalCount]);

  useEffect(() => {
    let mounted = true;

    async function checkUsage() {
      if (!coverageId) {
        setLockReason("Coverage record not found.");
        return;
      }

      setLockChecking(true);
      setMetadataLocked(true);
      setLockReason("Checking coverage usage...");
      const signature = buildCoverageSignature(
        (coverage || {}) as Record<string, unknown>,
      );

      try {
        const [schedulesResult, draftsResult] = await Promise.allSettled([
          api.get("/schedules"),
          api.get("/schedules/draft-schedules", {
            params: { status: "all", limit: 50 },
          }),
        ]);

        if (!mounted) return;
        if (
          schedulesResult.status === "rejected" ||
          draftsResult.status === "rejected"
        ) {
          setLockReason(
            "Metadata is locked because coverage usage could not be verified.",
          );
          return;
        }

        const schedules = Array.isArray(schedulesResult.value.data)
          ? schedulesResult.value.data
          : [];
        const drafts = Array.isArray(draftsResult.value.data)
          ? draftsResult.value.data
          : [];
        const hasSchedule = schedules.some((item) =>
          referencesCoverage(item, coverageId, signature),
        );
        const hasDraft = drafts.some((item) =>
          draftReferencesCoverage(item, coverageId, signature),
        );
        const remaining = Number(
          coverage?.remaining ?? coverage?.spotsRemaining,
        );
        const hasFilledSlots =
          Number.isFinite(remaining) && remaining < originalCount;

        if (hasSchedule || hasDraft || hasFilledSlots) {
          setMetadataLocked(true);
          setLockReason(
            hasDraft
              ? "Metadata is locked because this coverage is included in a draft schedule. Count can still be changed."
              : "Metadata is locked because this coverage already has schedule activity. Count can still be changed.",
          );
          return;
        }

        setMetadataLocked(false);
        setLockReason(
          "No schedules or drafts are attached, so coverage metadata can be updated.",
        );
      } finally {
        if (mounted) setLockChecking(false);
      }
    }

    void checkUsage();
    return () => {
      mounted = false;
    };
  }, [coverage, coverageId, originalCount]);

  const roleOptions = useMemo(() => {
    const options = getRoleOptionsFromFacilityPreferences(facilityPreferences);
    if (role && !options.some((item) => item.value === role)) {
      return [{ value: role, label: getRoleDisplayName(role) }, ...options];
    }
    return options;
  }, [facilityPreferences, role]);

  const areaOptions = useMemo(
    () =>
      normalizeStringArray([
        unitArea,
        ...(Array.isArray(facilityPreferences?.unitAreas)
          ? facilityPreferences.unitAreas
          : []),
      ]).map((value) => ({ value, label: getUnitAreaDisplayName(value) })),
    [facilityPreferences?.unitAreas, unitArea],
  );

  const certificationOptions = useMemo(
    () =>
      normalizeStringArray([
        ...requiredCertificationTags,
        ...(Array.isArray(facilityPreferences?.certificationTags)
          ? facilityPreferences.certificationTags
          : []),
      ]).map((value) => ({
        value,
        label: getCertificationTagDisplayName(value),
      })),
    [facilityPreferences?.certificationTags, requiredCertificationTags],
  );

  const canManageCoverage = can("coverage.manage");
  const metadataDisabled =
    loading || lockChecking || metadataLocked || !canManageCoverage;

  const handleSubmit = async () => {
    const nextCount = Number(requiredCount);
    if (!can("coverage.manage")) {
      setError("You do not have permission to edit coverage.");
      return;
    }
    if (!Number.isFinite(nextCount) || nextCount < 0) {
      setError("Required count must be 0 or greater.");
      return;
    }
    if (!coverageId) {
      setError("Coverage record not found.");
      return;
    }
    if (!metadataLocked && !role) {
      setError("Role is required.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload: Record<string, unknown> = { requiredCount: nextCount };
      if (!metadataLocked) {
        payload.role = role;
        payload.unitArea = unitArea || null;
        payload.requiredCertificationTags = normalizeStringArray(
          requiredCertificationTags,
        );
      }
      await api.put(`/coverage/${coverageId}`, payload);
      onSuccess();
    } catch (requestError: unknown) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError
          ? String(
              (requestError as { response?: { data?: { message?: string } } })
                .response?.data?.message || "Failed to update coverage.",
            )
          : "Failed to update coverage.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Edit Coverage Requirement</Text>
          <Text style={styles.subtitle}>
            {getRoleDisplayName(coverage?.role)} - update count and metadata
          </Text>
        </View>
        <Pressable onPress={onClose}>
          <Feather name="x" size={20} color="#64748b" />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View
        style={[
          styles.notice,
          metadataLocked ? styles.noticeInfo : styles.noticeSuccess,
        ]}
      >
        <Feather
          name={metadataLocked ? "lock" : "unlock"}
          size={16}
          color={metadataLocked ? "#1d4ed8" : "#166534"}
        />
        <Text style={styles.noticeText}>{lockReason}</Text>
      </View>

      <View style={styles.inputRow}>
        <Field label="Current Count" value={String(originalCount)} readOnly />
        <Field
          label="New Count"
          value={String(requiredCount)}
          disabled={!canManageCoverage}
          onChangeText={(value) =>
            setRequiredCount(Math.max(0, Number(value) || 0))
          }
        />
      </View>

      <View style={styles.adjustRow}>
        <Pressable
          style={styles.adjustBtn}
          disabled={!canManageCoverage || loading || requiredCount <= 0}
          onPress={() => setRequiredCount((value) => Math.max(0, value - 1))}
        >
          <Feather name="minus" size={16} color="#111827" />
          <Text style={styles.adjustText}>Subtract 1</Text>
        </Pressable>
        <Pressable
          style={styles.adjustBtn}
          disabled={!canManageCoverage || loading}
          onPress={() => setRequiredCount((value) => value + 1)}
        >
          <Feather name="plus" size={16} color="#111827" />
          <Text style={styles.adjustText}>Add 1</Text>
        </Pressable>
        <Text style={styles.deltaText}>
          {delta === 0 ? "No count change" : `${delta > 0 ? "+" : ""}${delta}`}
        </Text>
      </View>

      <SelectField
        label="Role"
        value={role ? getRoleDisplayName(role) : "Select role"}
        disabled={metadataDisabled}
        onPress={() => setRolePickerOpen(true)}
      />
      <SelectField
        label="Unit Area"
        value={unitArea ? getUnitAreaDisplayName(unitArea) : "Any Area"}
        disabled={metadataDisabled || areaOptions.length === 0}
        onPress={() => setAreaPickerOpen(true)}
      />
      <SelectField
        label="Required Certification Tags"
        value={
          requiredCertificationTags.length
            ? requiredCertificationTags
                .map(getCertificationTagDisplayName)
                .join(", ")
            : "None"
        }
        disabled={metadataDisabled || certificationOptions.length === 0}
        onPress={() => setCertPickerOpen(true)}
      />

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtn, styles.cancelBtn]}
          onPress={onClose}
          disabled={loading}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.saveBtn]}
          onPress={handleSubmit}
          disabled={!canManageCoverage || loading || lockChecking}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveText}>Save Coverage</Text>
          )}
        </Pressable>
      </View>

      <PickerModal
        open={rolePickerOpen}
        title="Select Role"
        value={role}
        options={roleOptions}
        onSelect={setRole}
        onClose={() => setRolePickerOpen(false)}
      />
      <PickerModal
        open={areaPickerOpen}
        title="Select Unit Area"
        value={unitArea}
        options={[{ value: "", label: "Any Area" }, ...areaOptions]}
        onSelect={setUnitArea}
        onClose={() => setAreaPickerOpen(false)}
      />
      <MultiSelectModal
        open={certPickerOpen}
        title="Select Certifications"
        values={requiredCertificationTags}
        options={certificationOptions}
        onChange={setRequiredCertificationTags}
        onClose={() => setCertPickerOpen(false)}
      />
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  readOnly = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={styles.inputBlock}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        editable={!readOnly && !disabled}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        style={[
          styles.input,
          readOnly || disabled ? styles.inputReadOnly : null,
        ]}
      />
    </View>
  );
}

function SelectField({
  label,
  value,
  disabled,
  onPress,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Pressable
        style={[styles.selectField, disabled ? styles.disabled : null]}
        disabled={disabled}
        onPress={onPress}
      >
        <Text style={styles.selectText} numberOfLines={2}>
          {value}
        </Text>
        <Feather name="chevron-down" size={16} color="#64748b" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTextWrap: { flex: 1 },
  title: { color: "#111827", fontSize: 20, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 13, marginTop: 3 },
  error: {
    color: "#b91c1c",
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 10,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  noticeInfo: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  noticeSuccess: { backgroundColor: "#ecfdf5", borderColor: "#bbf7d0" },
  noticeText: { flex: 1, color: "#334155", fontSize: 12, lineHeight: 18 },
  inputRow: { flexDirection: "row", gap: 8 },
  inputBlock: { flex: 1, gap: 5 },
  inputLabel: { color: "#374151", fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    color: "#111827",
  },
  inputReadOnly: { backgroundColor: "#f9fafb", color: "#64748b" },
  adjustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  adjustBtn: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  adjustText: { color: "#111827", fontSize: 12, fontWeight: "700" },
  deltaText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: "auto",
  },
  fieldWrap: { gap: 5 },
  selectField: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectText: { flex: 1, color: "#111827", fontSize: 13 },
  disabled: { backgroundColor: "#f9fafb", opacity: 0.65 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: { borderWidth: 1, borderColor: "#d1d5db" },
  saveBtn: { backgroundColor: "#2563eb" },
  cancelText: { color: "#111827", fontWeight: "700" },
  saveText: { color: "#ffffff", fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  pickerCard: {
    maxHeight: "78%",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: { color: "#0f172a", fontSize: 17, fontWeight: "800" },
  pickerList: { gap: 8, paddingVertical: 12 },
  pickerItem: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  pickerItemActive: { backgroundColor: "#eff6ff", borderColor: "#93c5fd" },
  pickerItemText: {
    flex: 1,
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  doneButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: { color: "#ffffff", fontWeight: "800" },
});
