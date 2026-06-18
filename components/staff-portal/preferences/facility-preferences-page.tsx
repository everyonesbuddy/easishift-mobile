import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import ConfirmDialog from "@/components/shared/confirm-dialog";
import api from "@/config/api";

type ShiftSlot = {
  tag: string;
  label?: string | null;
  startLocalTime: string;
  endLocalTime: string;
  spansOvernight?: boolean;
};

type ShiftTypeDefinition = {
  key: string;
  label?: string | null;
  timeSlots?: ShiftSlot[];
};

type FacilityPreferences = {
  schedulingPattern?: string;
  roleFamilies?: string[];
  unitAreas?: string[];
  shiftTypes?: string[];
  certificationTags?: string[];
  shiftTypeDefinitions?: ShiftTypeDefinition[];
  weeklyOvertimeThresholdHours?: number;
  fairnessLookbackDays?: number;
  notifyStaffOnCoveragePost?: boolean;
  shiftReminderLeadHours?: number;
};

type SlotInput = {
  tag: string;
  startLocalTime: string;
  endLocalTime: string;
};

const SCHEDULING_PATTERNS = [
  { value: "balance", label: "Balance (fairness-based)" },
  { value: "4_on_4_off", label: "4 On / 4 Off" },
  { value: "2_2_3", label: "2-2-3 (Pitman)" },
  { value: "panama", label: "Panama (28-day cycle)" },
  { value: "fixed_5_2", label: "Fixed 5/2 (Mon-Fri)" },
  { value: "rotating_3", label: "Rotating 3 shifts/week" },
  { value: "custom", label: "Custom (coverage-driven)" },
] as const;

const TAXONOMY_FIELDS = [
  "roleFamilies",
  "unitAreas",
  "shiftTypes",
  "certificationTags",
] as const;

const DEFAULT_PREFS: FacilityPreferences = {
  schedulingPattern: "balance",
  roleFamilies: [],
  unitAreas: [],
  shiftTypes: [],
  certificationTags: [],
  shiftTypeDefinitions: [],
  weeklyOvertimeThresholdHours: 40,
  fairnessLookbackDays: 28,
  notifyStaffOnCoveragePost: false,
  shiftReminderLeadHours: 24,
};

function toSnakeCase(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toDisplayLabel(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function to12HourTime(value: unknown) {
  const raw = String(value || "").trim();
  const match = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);

  if (!match) {
    return raw;
  }

  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = hours >= 12 ? "PM" : "AM";

  hours = hours % 12 || 12;

  return `${hours}:${minutes} ${meridiem}`;
}

function normalizeArrayValues(values: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => toSnakeCase(item))
        .filter(Boolean),
    ),
  );
}

function normalizeTaxonomyPrefs(inputPrefs: FacilityPreferences | null) {
  const safePrefs = inputPrefs || {};
  const next: FacilityPreferences = { ...DEFAULT_PREFS, ...safePrefs };

  for (const field of TAXONOMY_FIELDS) {
    next[field] = normalizeArrayValues(safePrefs[field]);
  }

  next.shiftTypeDefinitions = (
    Array.isArray(safePrefs.shiftTypeDefinitions)
      ? safePrefs.shiftTypeDefinitions
      : []
  )
    .map((definition) => {
      const key = toSnakeCase(definition?.key);
      if (!key) {
        return null;
      }

      const timeSlots = Array.from(
        new Map(
          (Array.isArray(definition?.timeSlots) ? definition.timeSlots : [])
            .map((slot): [string, ShiftSlot] | null => {
              const tag = toSnakeCase(slot?.tag);
              const startLocalTime = String(slot?.startLocalTime || "").trim();
              const endLocalTime = String(slot?.endLocalTime || "").trim();

              if (!tag || !startLocalTime || !endLocalTime) {
                return null;
              }

              return [
                tag,
                {
                  tag,
                  label: String(slot?.label || "").trim() || null,
                  startLocalTime,
                  endLocalTime,
                  spansOvernight: Boolean(
                    endLocalTime &&
                    startLocalTime &&
                    endLocalTime <= startLocalTime,
                  ),
                },
              ];
            })
            .filter((entry): entry is [string, ShiftSlot] => entry !== null),
        ).values(),
      );

      return {
        key,
        label: String(definition?.label || "").trim() || null,
        timeSlots,
      };
    })
    .filter(Boolean) as ShiftTypeDefinition[];

  const definitionKeys = (next.shiftTypeDefinitions || []).map(
    (item) => item.key,
  );
  next.shiftTypes = Array.from(
    new Set([...(next.shiftTypes || []), ...definitionKeys]),
  );

  return next;
}

export default function FacilityPreferencesPage() {
  const [prefs, setPrefs] = useState<FacilityPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const [arrayInputs, setArrayInputs] = useState({
    roleFamilies: "",
    unitAreas: "",
    shiftTypes: "",
    certificationTags: "",
  });
  const [slotInputsByShiftType, setSlotInputsByShiftType] = useState<
    Record<string, SlotInput>
  >({});

  useEffect(() => {
    async function fetchPrefs() {
      try {
        const res = await api.get("/facility-preferences");
        setPrefs(normalizeTaxonomyPrefs(res.data));
      } catch (requestError) {
        console.warn("Failed to load facility preferences", requestError);
        setError("Failed to load facility preferences");
        setPrefs(normalizeTaxonomyPrefs(null));
      } finally {
        setLoading(false);
      }
    }

    fetchPrefs();
  }, []);

  const safePrefs = useMemo(
    () => prefs || normalizeTaxonomyPrefs(null),
    [prefs],
  );

  const handleChange = <K extends keyof FacilityPreferences>(
    field: K,
    value: FacilityPreferences[K],
  ) => {
    setPrefs((prev) => ({ ...(prev || safePrefs), [field]: value }));
  };

  const handleArrayInputChange = (
    field: keyof typeof arrayInputs,
    value: string,
  ) => {
    setArrayInputs((prev) => ({ ...prev, [field]: value }));
  };

  const handleArrayAdd = (field: keyof typeof arrayInputs) => {
    const value = toSnakeCase(arrayInputs[field]);
    if (!value) {
      return;
    }

    setPrefs((prev) => {
      const source = prev || safePrefs;
      const existing = normalizeArrayValues(source[field]);
      if (existing.includes(value)) {
        setError(`${toDisplayLabel(value)} is already in the list`);
        return source;
      }

      setError("");
      return { ...source, [field]: [...existing, value] };
    });

    setArrayInputs((prev) => ({ ...prev, [field]: "" }));
  };

  const handleArrayRemove = (
    field: keyof typeof arrayInputs,
    index: number,
  ) => {
    setPrefs((prev) => {
      const source = prev || safePrefs;
      return {
        ...source,
        [field]: (source[field] || []).filter((_, i) => i !== index),
      };
    });
  };

  const getShiftTypeDefinition = (shiftTypeKey: string) => {
    const key = toSnakeCase(shiftTypeKey);
    return (safePrefs.shiftTypeDefinitions || []).find(
      (item) => item.key === key,
    );
  };

  const getSlotInput = (shiftTypeKey: string) => {
    const key = toSnakeCase(shiftTypeKey);
    return (
      slotInputsByShiftType[key] || {
        tag: "",
        startLocalTime: "",
        endLocalTime: "",
      }
    );
  };

  const handleSlotInputChange = (
    shiftTypeKey: string,
    field: keyof SlotInput,
    value: string,
  ) => {
    const key = toSnakeCase(shiftTypeKey);
    setSlotInputsByShiftType((prev) => ({
      ...prev,
      [key]: {
        ...getSlotInput(key),
        [field]: value,
      },
    }));
  };

  const handleAddShiftSlot = (shiftTypeKey: string) => {
    const key = toSnakeCase(shiftTypeKey);
    const input = getSlotInput(key);
    const tag = toSnakeCase(input.tag);
    const startLocalTime = String(input.startLocalTime || "").trim();
    const endLocalTime = String(input.endLocalTime || "").trim();

    if (!tag || !startLocalTime || !endLocalTime) {
      setError("Provide slot tag, start time, and end time");
      return;
    }

    setPrefs((prev) => {
      const source = prev || safePrefs;
      const existingDefinitions = Array.isArray(source.shiftTypeDefinitions)
        ? source.shiftTypeDefinitions
        : [];

      const defIndex = existingDefinitions.findIndex(
        (item) => item.key === key,
      );
      const nextDefinitions = [...existingDefinitions];

      if (defIndex === -1) {
        nextDefinitions.push({
          key,
          label: null,
          timeSlots: [
            {
              tag,
              label: null,
              startLocalTime,
              endLocalTime,
              spansOvernight: Boolean(
                endLocalTime &&
                startLocalTime &&
                endLocalTime <= startLocalTime,
              ),
            },
          ],
        });
      } else {
        const definition = nextDefinitions[defIndex];
        const currentSlots = Array.isArray(definition.timeSlots)
          ? definition.timeSlots
          : [];

        if (currentSlots.some((slot) => slot.tag === tag)) {
          setError(
            `${toDisplayLabel(tag)} already exists for ${toDisplayLabel(key)}`,
          );
          return source;
        }

        nextDefinitions[defIndex] = {
          ...definition,
          timeSlots: [
            ...currentSlots,
            {
              tag,
              label: null,
              startLocalTime,
              endLocalTime,
              spansOvernight: Boolean(
                endLocalTime &&
                startLocalTime &&
                endLocalTime <= startLocalTime,
              ),
            },
          ],
        };
      }

      setError("");
      return {
        ...source,
        shiftTypeDefinitions: nextDefinitions,
      };
    });

    setSlotInputsByShiftType((prev) => ({
      ...prev,
      [key]: {
        tag: "",
        startLocalTime: "",
        endLocalTime: "",
      },
    }));
  };

  const handleRemoveShiftSlot = (shiftTypeKey: string, slotIndex: number) => {
    const key = toSnakeCase(shiftTypeKey);
    setPrefs((prev) => {
      const source = prev || safePrefs;
      return {
        ...source,
        shiftTypeDefinitions: (source.shiftTypeDefinitions || []).map(
          (definition) => {
            if (definition.key !== key) {
              return definition;
            }

            return {
              ...definition,
              timeSlots: (definition.timeSlots || []).filter(
                (_, idx) => idx !== slotIndex,
              ),
            };
          },
        ),
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = normalizeTaxonomyPrefs(safePrefs);
      const res = await api.post("/facility-preferences", payload);
      setPrefs(normalizeTaxonomyPrefs(res.data));
      setSuccess("Facility preferences saved");
    } catch (requestError) {
      console.warn("Failed to save facility preferences", requestError);
      setError("Failed to save facility preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setError("");

    try {
      const res = await api.delete("/facility-preferences/reset");
      setPrefs(normalizeTaxonomyPrefs(res.data));
      setResetDialogOpen(false);
      setSuccess("Facility preferences reset to defaults");
    } catch (requestError) {
      console.warn("Failed to reset facility preferences", requestError);
      setError("Failed to reset facility preferences");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Facility Preferences</Text>
            <Text style={styles.subtitle}>
              Configure facility-level scheduling policy and rules
            </Text>
          </View>
          <Pressable
            style={styles.resetBtn}
            onPress={() => setResetDialogOpen(true)}
          >
            <Feather name="rotate-ccw" size={14} color="#b91c1c" />
            <Text style={styles.resetBtnText}>Reset</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <Section title="Scheduling Pattern">
          <View style={styles.chipsWrap}>
            {SCHEDULING_PATTERNS.map((pattern) => {
              const active = safePrefs.schedulingPattern === pattern.value;
              return (
                <Pressable
                  key={pattern.value}
                  style={[
                    styles.choiceChip,
                    active ? styles.choiceChipActive : null,
                  ]}
                  onPress={() =>
                    handleChange("schedulingPattern", pattern.value)
                  }
                >
                  <Text
                    style={[
                      styles.choiceChipText,
                      active ? styles.choiceChipTextActive : null,
                    ]}
                  >
                    {pattern.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Facility Taxonomy">
          <ArrayField
            title="Role Families"
            fieldKey="roleFamilies"
            values={safePrefs.roleFamilies || []}
            inputValue={arrayInputs.roleFamilies}
            onInputChange={handleArrayInputChange}
            onAdd={handleArrayAdd}
            onRemove={handleArrayRemove}
            placeholder="e.g. receptionist, nurse, doctor"
          />

          <ArrayField
            title="Unit Areas (Optional)"
            fieldKey="unitAreas"
            values={safePrefs.unitAreas || []}
            inputValue={arrayInputs.unitAreas}
            onInputChange={handleArrayInputChange}
            onAdd={handleArrayAdd}
            onRemove={handleArrayRemove}
            placeholder="e.g. AL, IL, MC"
          />

          <ArrayField
            title="Shift Types"
            fieldKey="shiftTypes"
            values={safePrefs.shiftTypes || []}
            inputValue={arrayInputs.shiftTypes}
            onInputChange={handleArrayInputChange}
            onAdd={handleArrayAdd}
            onRemove={handleArrayRemove}
            placeholder="e.g. day, evening, night"
          />

          <View style={styles.subSection}>
            <Text style={styles.subTitle}>Shift Type Time Slots</Text>
            {(safePrefs.shiftTypes || []).length === 0 ? (
              <Text style={styles.hintText}>
                Add at least one shift type before configuring time slots.
              </Text>
            ) : (
              (safePrefs.shiftTypes || []).map((shiftTypeKey) => {
                const definition = getShiftTypeDefinition(shiftTypeKey);
                const slots = definition?.timeSlots || [];
                const slotInput = getSlotInput(shiftTypeKey);

                return (
                  <View key={shiftTypeKey} style={styles.slotCard}>
                    <Text style={styles.slotTitle}>
                      {toDisplayLabel(shiftTypeKey)}
                    </Text>

                    <View style={styles.slotList}>
                      {slots.length === 0 ? (
                        <Text style={styles.hintText}>
                          No slots configured yet.
                        </Text>
                      ) : (
                        slots.map((slot, idx) => (
                          <View
                            key={`${slot.tag}-${idx}`}
                            style={styles.slotRow}
                          >
                            <Text style={styles.slotRowText}>
                              {toDisplayLabel(slot.tag)} (
                              {to12HourTime(slot.startLocalTime)} -{" "}
                              {to12HourTime(slot.endLocalTime)})
                              {slot.spansOvernight ? " - Overnight" : ""}
                            </Text>
                            <Pressable
                              onPress={() =>
                                handleRemoveShiftSlot(shiftTypeKey, idx)
                              }
                            >
                              <Feather name="x" size={15} color="#b91c1c" />
                            </Pressable>
                          </View>
                        ))
                      )}
                    </View>

                    <View style={styles.slotInputRow}>
                      <TextInput
                        value={slotInput.tag}
                        onChangeText={(value) =>
                          handleSlotInputChange(shiftTypeKey, "tag", value)
                        }
                        placeholder="slot tag"
                        style={[styles.input, styles.slotInput]}
                      />
                      <TextInput
                        value={slotInput.startLocalTime}
                        onChangeText={(value) =>
                          handleSlotInputChange(
                            shiftTypeKey,
                            "startLocalTime",
                            value,
                          )
                        }
                        placeholder="start HH:MM"
                        style={[styles.input, styles.slotInput]}
                      />
                      <TextInput
                        value={slotInput.endLocalTime}
                        onChangeText={(value) =>
                          handleSlotInputChange(
                            shiftTypeKey,
                            "endLocalTime",
                            value,
                          )
                        }
                        placeholder="end HH:MM"
                        style={[styles.input, styles.slotInput]}
                      />
                      <Pressable
                        style={styles.smallBtn}
                        onPress={() => handleAddShiftSlot(shiftTypeKey)}
                      >
                        <Feather name="plus" size={13} color="#ffffff" />
                        <Text style={styles.smallBtnText}>Add</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <ArrayField
            title="Certification Tags (Optional)"
            fieldKey="certificationTags"
            values={safePrefs.certificationTags || []}
            inputValue={arrayInputs.certificationTags}
            onInputChange={handleArrayInputChange}
            onAdd={handleArrayAdd}
            onRemove={handleArrayRemove}
            placeholder="e.g. med-pass, bilingual"
          />
        </Section>

        <Section title="Workload Signals">
          <Field
            label="Weekly Overtime Threshold (hours)"
            value={String(safePrefs.weeklyOvertimeThresholdHours ?? 40)}
            onChangeText={(value) =>
              handleChange(
                "weeklyOvertimeThresholdHours",
                parseInt(value, 10) || 1,
              )
            }
          />
        </Section>

        <Section title="Fairness & Distribution">
          <Field
            label="Fairness Lookback Period (days)"
            value={String(safePrefs.fairnessLookbackDays ?? 28)}
            onChangeText={(value) =>
              handleChange("fairnessLookbackDays", parseInt(value, 10) || 7)
            }
          />
        </Section>

        <Section title="Notifications">
          <SwitchRow
            title="Notify Staff on Coverage Post"
            value={Boolean(safePrefs.notifyStaffOnCoveragePost)}
            onValueChange={(value) =>
              handleChange("notifyStaffOnCoveragePost", value)
            }
          />
          <Field
            label="Shift Reminder Lead Time (hours)"
            value={String(safePrefs.shiftReminderLeadHours ?? 24)}
            onChangeText={(value) =>
              handleChange("shiftReminderLeadHours", parseInt(value, 10) || 1)
            }
          />
          <Text style={styles.hintText}>
            Timezone is fixed to UTC and converted to local time in the app.
          </Text>
        </Section>

        <Pressable
          style={[styles.saveBtn, saving ? styles.saveBtnDisabled : null]}
          disabled={saving}
          onPress={handleSave}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Feather name="save" size={15} color="#ffffff" />
              <Text style={styles.saveBtnText}>Save Preferences</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      <ConfirmDialog
        open={resetDialogOpen}
        title="Reset to Defaults?"
        message="This will remove all custom facility preferences and restore defaults."
        onCancel={() => setResetDialogOpen(false)}
        onConfirm={handleReset}
      />
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
      />
    </View>
  );
}

function SwitchRow({
  title,
  value,
  onValueChange,
}: {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchTitle}>{title}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function ArrayField({
  title,
  fieldKey,
  values,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  placeholder,
}: {
  title: string;
  fieldKey: "roleFamilies" | "unitAreas" | "shiftTypes" | "certificationTags";
  values: string[];
  inputValue: string;
  onInputChange: (
    field: "roleFamilies" | "unitAreas" | "shiftTypes" | "certificationTags",
    value: string,
  ) => void;
  onAdd: (
    field: "roleFamilies" | "unitAreas" | "shiftTypes" | "certificationTags",
  ) => void;
  onRemove: (
    field: "roleFamilies" | "unitAreas" | "shiftTypes" | "certificationTags",
    index: number,
  ) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.subSection}>
      <Text style={styles.subTitle}>{title}</Text>

      <View style={styles.arrayList}>
        {values.map((value, idx) => (
          <View key={`${fieldKey}-${value}-${idx}`} style={styles.arrayItem}>
            <Text style={styles.arrayText}>{toDisplayLabel(value)}</Text>
            <Pressable onPress={() => onRemove(fieldKey, idx)}>
              <Feather name="x" size={15} color="#b91c1c" />
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={inputValue}
          onChangeText={(value) => onInputChange(fieldKey, value)}
          style={[styles.input, styles.inputFlex]}
          placeholder={placeholder}
        />
        <Pressable style={styles.smallBtn} onPress={() => onAdd(fieldKey)}>
          <Feather name="plus" size={13} color="#ffffff" />
          <Text style={styles.smallBtnText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
    paddingTop: 28,
    paddingBottom: 28,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
  },
  resetBtn: {
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fff1f2",
    borderRadius: 8,
    minHeight: 36,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  resetBtnText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
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
  section: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionBody: {
    gap: 10,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  choiceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  choiceChipActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  choiceChipText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  choiceChipTextActive: {
    color: "#1d4ed8",
  },
  subSection: {
    gap: 6,
  },
  subTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  arrayList: {
    gap: 6,
  },
  arrayItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  arrayText: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  inputFlex: {
    flex: 1,
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
  smallBtn: {
    borderRadius: 8,
    backgroundColor: "#2563eb",
    minHeight: 36,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  smallBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  slotCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    padding: 10,
    gap: 8,
  },
  slotTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  slotList: {
    gap: 6,
  },
  slotRow: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  slotRowText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  slotInputRow: {
    gap: 8,
  },
  slotInput: {
    width: "100%",
  },
  fieldWrap: {
    gap: 5,
  },
  fieldLabel: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  switchRow: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    paddingRight: 10,
  },
  hintText: {
    color: "#6b7280",
    fontSize: 12,
  },
  saveBtn: {
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
});
