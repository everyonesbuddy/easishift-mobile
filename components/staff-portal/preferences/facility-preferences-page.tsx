import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { useAuth } from "@/context/auth-context";
import {
  getDeviceTimeZone,
  getLocalTimeZoneAbbreviation,
} from "../../../config/timezone";

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

type TimeTrackingPrefs = {
  enabled?: boolean;
  mode?: "open" | "qr";
  requireScheduleMatch?: boolean;
  clockInGraceMinutes?: number;
  clockOutGraceMinutes?: number;
  roundingMinutes?: 0 | 5 | 6 | 10 | 15;
  autoCloseOpenBreakOnClockOut?: boolean;
};

type FacilityPreferences = {
  schedulingPattern?: string;
  facilityTimezone?: string;
  facilityTimezoneConfirmed?: boolean;
  roleFamilies?: string[];
  unitAreas?: string[];
  shiftTypes?: string[];
  certificationTags?: string[];
  shiftTypeDefinitions?: ShiftTypeDefinition[];
  weeklyOvertimeThresholdHours?: number;
  fairnessLookbackDays?: number;
  notifyStaffOnCoveragePost?: boolean;
  shiftReminderLeadHours?: number;
  timeTracking?: TimeTrackingPrefs;
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

const TIME_TRACKING_DEFAULTS: Required<TimeTrackingPrefs> = {
  enabled: false,
  mode: "open",
  requireScheduleMatch: true,
  clockInGraceMinutes: 15,
  clockOutGraceMinutes: 30,
  roundingMinutes: 0,
  autoCloseOpenBreakOnClockOut: true,
};

const DEFAULT_PREFS: FacilityPreferences = {
  schedulingPattern: "balance",
  facilityTimezone: "UTC",
  facilityTimezoneConfirmed: false,
  roleFamilies: [],
  unitAreas: [],
  shiftTypes: [],
  certificationTags: [],
  shiftTypeDefinitions: [],
  weeklyOvertimeThresholdHours: 40,
  fairnessLookbackDays: 28,
  notifyStaffOnCoveragePost: false,
  shiftReminderLeadHours: 24,
  timeTracking: TIME_TRACKING_DEFAULTS,
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

function normalizeTimeTrackingPrefs(
  input: unknown,
): Required<TimeTrackingPrefs> {
  const safe = input && typeof input === "object" ? input : {};
  const normalizedMode = ["open", "qr"].includes(
    String((safe as TimeTrackingPrefs).mode || ""),
  )
    ? (String((safe as TimeTrackingPrefs).mode || "open") as "open" | "qr")
    : String((safe as TimeTrackingPrefs).mode || "") === "geofence"
      ? "qr"
      : String((safe as TimeTrackingPrefs).mode || "") === "manual"
        ? "open"
        : TIME_TRACKING_DEFAULTS.mode;

  const roundedValue = Number((safe as TimeTrackingPrefs).roundingMinutes);
  const normalizedRounding = [0, 5, 6, 10, 15].includes(roundedValue)
    ? (roundedValue as 0 | 5 | 6 | 10 | 15)
    : TIME_TRACKING_DEFAULTS.roundingMinutes;

  return {
    enabled: Boolean((safe as TimeTrackingPrefs).enabled),
    mode: normalizedMode,
    requireScheduleMatch:
      typeof (safe as TimeTrackingPrefs).requireScheduleMatch === "boolean"
        ? Boolean((safe as TimeTrackingPrefs).requireScheduleMatch)
        : TIME_TRACKING_DEFAULTS.requireScheduleMatch,
    clockInGraceMinutes: Math.max(
      0,
      Number.isFinite(Number((safe as TimeTrackingPrefs).clockInGraceMinutes))
        ? Number((safe as TimeTrackingPrefs).clockInGraceMinutes)
        : TIME_TRACKING_DEFAULTS.clockInGraceMinutes,
    ),
    clockOutGraceMinutes: Math.max(
      0,
      Number.isFinite(Number((safe as TimeTrackingPrefs).clockOutGraceMinutes))
        ? Number((safe as TimeTrackingPrefs).clockOutGraceMinutes)
        : TIME_TRACKING_DEFAULTS.clockOutGraceMinutes,
    ),
    roundingMinutes: normalizedRounding,
    autoCloseOpenBreakOnClockOut:
      typeof (safe as TimeTrackingPrefs).autoCloseOpenBreakOnClockOut ===
      "boolean"
        ? Boolean((safe as TimeTrackingPrefs).autoCloseOpenBreakOnClockOut)
        : TIME_TRACKING_DEFAULTS.autoCloseOpenBreakOnClockOut,
  };
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

  next.timeTracking = normalizeTimeTrackingPrefs(safePrefs.timeTracking);
  next.facilityTimezone =
    String(safePrefs.facilityTimezone || "UTC").trim() || "UTC";
  next.facilityTimezoneConfirmed = Boolean(safePrefs.facilityTimezoneConfirmed);

  return next;
}

export default function FacilityPreferencesPage() {
  const router = useRouter();
  const { tenant, logout, can } = useAuth();
  const canManageFacilityPreferences = can("facility_preferences.manage");
  const canViewOnlyFacilityPreferences =
    can("facility_preferences.view") && !canManageFacilityPreferences;
  const canDeleteTenant = can("tenant.delete");
  const [prefs, setPrefs] = useState<FacilityPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [patternPickerOpen, setPatternPickerOpen] = useState(false);
  const deviceTimezone = getDeviceTimeZone();
  const deviceTimezoneAbbreviation = getLocalTimeZoneAbbreviation();

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

  const handleTimeTrackingChange = <
    K extends keyof Required<TimeTrackingPrefs>,
  >(
    field: K,
    value: Required<TimeTrackingPrefs>[K],
  ) => {
    setPrefs((prev) => {
      const source = prev || safePrefs;
      const current = normalizeTimeTrackingPrefs(source.timeTracking);

      return {
        ...source,
        timeTracking: {
          ...current,
          [field]: value,
        },
      };
    });
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
      const payload = {
        ...normalizeTaxonomyPrefs(safePrefs),
        facilityTimezoneConfirmed: Boolean(safePrefs.facilityTimezone),
      };
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

  const handleDeleteAccount = async () => {
    const tenantId = String(tenant?._id || "").trim();

    if (!tenantId) {
      setDeleteDialogOpen(false);
      setError("Unable to delete account because tenant details are missing.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await api.delete(`/tenants/${tenantId}`);
      setDeleteDialogOpen(false);
      await logout();
      router.replace("/login");
    } catch (requestError) {
      console.warn("Failed to delete tenant account", requestError);
      setError("Failed to delete account. Please try again.");
    } finally {
      setSaving(false);
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
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Facility Preferences</Text>
            <Text style={styles.subtitle}>
              Configure facility-level scheduling policy and rules
            </Text>
          </View>
          <View style={styles.headerActions}>
            {canManageFacilityPreferences ? (
              <Pressable
                style={styles.resetBtn}
                onPress={() => setResetDialogOpen(true)}
              >
                <Feather name="rotate-ccw" size={14} color="#b91c1c" />
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
        {canViewOnlyFacilityPreferences ? (
          <View style={styles.viewOnlyNotice}>
            <Feather name="eye" size={16} color="#1d4ed8" />
            <Text style={styles.viewOnlyNoticeText}>
              You have view-only access to Facility Preferences. Contact an
              administrator to make changes.
            </Text>
          </View>
        ) : null}

        <Section title="Scheduling Pattern">
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Scheduling Pattern</Text>
            <Pressable
              style={styles.selectField}
              onPress={() => setPatternPickerOpen(true)}
              disabled={!canManageFacilityPreferences}
            >
              <Text style={styles.selectFieldText} numberOfLines={1}>
                {SCHEDULING_PATTERNS.find(
                  (pattern) => pattern.value === safePrefs.schedulingPattern,
                )?.label || "Select pattern"}
              </Text>
              <Feather name="chevron-down" size={16} color="#6b7280" />
            </Pressable>
          </View>
        </Section>

        <Section title="Facility Timezone">
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Timezone</Text>
            <TextInput
              value={safePrefs.facilityTimezone || "UTC"}
              onChangeText={(value) =>
                handleChange("facilityTimezone", value || "UTC")
              }
              editable={canManageFacilityPreferences}
              autoCapitalize="none"
              placeholder="e.g. America/New_York"
              style={styles.input}
            />
            <Text style={styles.hintText}>
              Use an IANA timezone, such as America/New_York or Europe/London.
            </Text>
            {canManageFacilityPreferences ? (
              <Pressable
                style={styles.useDeviceTimezoneBtn}
                onPress={() => handleChange("facilityTimezone", deviceTimezone)}
              >
                <Feather name="map-pin" size={14} color="#1d4ed8" />
                <Text style={styles.useDeviceTimezoneText}>
                  Use device timezone ({deviceTimezone}
                  {deviceTimezoneAbbreviation
                    ? `, ${deviceTimezoneAbbreviation}`
                    : ""}
                  )
                </Text>
              </Pressable>
            ) : null}
            <View
              style={[
                styles.timezoneStatus,
                safePrefs.facilityTimezoneConfirmed
                  ? styles.timezoneStatusConfirmed
                  : styles.timezoneStatusPending,
              ]}
            >
              <Feather
                name={
                  safePrefs.facilityTimezoneConfirmed
                    ? "check-circle"
                    : "alert-circle"
                }
                size={15}
                color={
                  safePrefs.facilityTimezoneConfirmed ? "#166534" : "#92400e"
                }
              />
              <Text style={styles.timezoneStatusText}>
                {safePrefs.facilityTimezoneConfirmed
                  ? `Confirmed: shift-slot times use ${safePrefs.facilityTimezone}.`
                  : "Not confirmed. Save this timezone to use it for facility shift-slot times."}
              </Text>
            </View>
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
            editable={canManageFacilityPreferences}
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
            editable={canManageFacilityPreferences}
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
            editable={canManageFacilityPreferences}
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
                              disabled={!canManageFacilityPreferences}
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
                        editable={canManageFacilityPreferences}
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
                        editable={canManageFacilityPreferences}
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
                        editable={canManageFacilityPreferences}
                      />
                      <Pressable
                        style={styles.smallBtn}
                        onPress={() => handleAddShiftSlot(shiftTypeKey)}
                        disabled={!canManageFacilityPreferences}
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
            editable={canManageFacilityPreferences}
            placeholder="e.g. med-pass, bilingual"
          />
        </Section>

        <Section title="Workload Signals">
          <Field
            label="Weekly Overtime Threshold (hours)"
            value={String(safePrefs.weeklyOvertimeThresholdHours ?? 40)}
            disabled={!canManageFacilityPreferences}
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
            disabled={!canManageFacilityPreferences}
            onChangeText={(value) =>
              handleChange("fairnessLookbackDays", parseInt(value, 10) || 7)
            }
          />
        </Section>

        <Section title="Time Tracking">
          <SwitchRow
            title="Enable Time Tracking"
            description="When disabled, clock-in/out requests are rejected."
            value={Boolean(safePrefs.timeTracking?.enabled)}
            disabled={!canManageFacilityPreferences}
            onValueChange={(value) =>
              handleTimeTrackingChange("enabled", value)
            }
          />

          {!safePrefs.timeTracking?.enabled ? (
            <Text style={styles.hintText}>
              Time tracking is off. Turn it on to configure attendance behavior.
            </Text>
          ) : null}

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Tracking Mode</Text>
            <View style={styles.segmentRow}>
              {(["open", "qr"] as const).map((mode) => {
                const selected =
                  (safePrefs.timeTracking?.mode || "open") === mode;
                return (
                  <Pressable
                    key={mode}
                    style={[
                      styles.segmentBtn,
                      selected ? styles.segmentBtnActive : null,
                    ]}
                    onPress={() => handleTimeTrackingChange("mode", mode)}
                    disabled={!canManageFacilityPreferences}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        selected ? styles.segmentBtnTextActive : null,
                      ]}
                    >
                      {mode === "open" ? "Open" : "QR"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Rounding</Text>
            <View style={styles.segmentRow}>
              {([0, 5, 6, 10, 15] as const).map((minutes) => {
                const selected =
                  Number(safePrefs.timeTracking?.roundingMinutes ?? 0) ===
                  minutes;

                return (
                  <Pressable
                    key={String(minutes)}
                    style={[
                      styles.segmentBtn,
                      selected ? styles.segmentBtnActive : null,
                    ]}
                    onPress={() =>
                      handleTimeTrackingChange("roundingMinutes", minutes)
                    }
                    disabled={!canManageFacilityPreferences}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        selected ? styles.segmentBtnTextActive : null,
                      ]}
                    >
                      {minutes === 0 ? "No rounding" : `${minutes} min`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field
            label="Clock In Grace (minutes)"
            value={String(safePrefs.timeTracking?.clockInGraceMinutes ?? 15)}
            disabled={!canManageFacilityPreferences}
            onChangeText={(value) =>
              handleTimeTrackingChange(
                "clockInGraceMinutes",
                Math.max(0, parseInt(value, 10) || 0),
              )
            }
          />

          <Field
            label="Clock Out Grace (minutes)"
            value={String(safePrefs.timeTracking?.clockOutGraceMinutes ?? 30)}
            disabled={!canManageFacilityPreferences}
            onChangeText={(value) =>
              handleTimeTrackingChange(
                "clockOutGraceMinutes",
                Math.max(0, parseInt(value, 10) || 0),
              )
            }
          />

          {(safePrefs.timeTracking?.mode || "open") === "qr" ? (
            <Text style={styles.hintText}>
              QR mode is active. Staff must scan a valid facility QR token to
              clock in and clock out.
            </Text>
          ) : null}

          <SwitchRow
            title="Require Schedule Match"
            description="Staff can clock in/out only when a matching shift exists within grace windows."
            value={Boolean(safePrefs.timeTracking?.requireScheduleMatch)}
            disabled={!canManageFacilityPreferences}
            onValueChange={(value) =>
              handleTimeTrackingChange("requireScheduleMatch", value)
            }
          />

          <SwitchRow
            title="Auto Close Open Break on Clock Out"
            description="If a break is still open at clock-out, close it automatically."
            value={Boolean(
              safePrefs.timeTracking?.autoCloseOpenBreakOnClockOut,
            )}
            disabled={!canManageFacilityPreferences}
            onValueChange={(value) =>
              handleTimeTrackingChange("autoCloseOpenBreakOnClockOut", value)
            }
          />
        </Section>

        <Section title="Notifications">
          <SwitchRow
            title="Notify Staff on Coverage Post"
            value={Boolean(safePrefs.notifyStaffOnCoveragePost)}
            disabled={!canManageFacilityPreferences}
            onValueChange={(value) =>
              handleChange("notifyStaffOnCoveragePost", value)
            }
          />
          <Field
            label="Shift Reminder Lead Time (hours)"
            value={String(safePrefs.shiftReminderLeadHours ?? 24)}
            disabled={!canManageFacilityPreferences}
            onChangeText={(value) =>
              handleChange("shiftReminderLeadHours", parseInt(value, 10) || 1)
            }
          />
          <Text style={styles.hintText}>
            Shift reminders use the facility timezone after it is confirmed.
          </Text>
        </Section>

        {canDeleteTenant ? (
          <Section title="Account Deletion">
            <View style={styles.dangerCard}>
              <Text style={styles.dangerText}>
                Permanently delete this facility account and all related tenant
                data, including staff, schedules, coverage, messages, and
                preferences.
              </Text>
              <Pressable
                style={styles.deleteAccountBtn}
                onPress={() => setDeleteDialogOpen(true)}
                disabled={saving}
              >
                <Feather name="trash-2" size={15} color="#ffffff" />
                <Text style={styles.deleteAccountBtnText}>
                  {saving ? "Deleting..." : "Delete Facility Account"}
                </Text>
              </Pressable>
            </View>
          </Section>
        ) : null}

        {canManageFacilityPreferences ? (
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
        ) : null}
      </ScrollView>

      <ConfirmDialog
        open={canManageFacilityPreferences && resetDialogOpen}
        title="Reset to Defaults?"
        message="This will remove all custom facility preferences and restore defaults."
        onCancel={() => setResetDialogOpen(false)}
        onConfirm={handleReset}
      />

      <ConfirmDialog
        open={canDeleteTenant && deleteDialogOpen}
        title="Delete Facility Account?"
        message="This permanently deletes the facility account and all related data. This action cannot be undone."
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteAccount}
      />

      <Modal
        visible={patternPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPatternPickerOpen(false)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => setPatternPickerOpen(false)}
        >
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Scheduling Pattern</Text>
              <Pressable
                onPress={() => setPatternPickerOpen(false)}
                style={styles.closeBtn}
              >
                <Feather name="x" size={18} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.pickerList}>
              {SCHEDULING_PATTERNS.map((pattern) => {
                const selected = safePrefs.schedulingPattern === pattern.value;
                return (
                  <Pressable
                    key={pattern.value}
                    style={[
                      styles.pickerItem,
                      selected ? styles.pickerItemActive : null,
                    ]}
                    onPress={() => {
                      handleChange("schedulingPattern", pattern.value);
                      setPatternPickerOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selected ? styles.pickerItemTextActive : null,
                      ]}
                    >
                      {pattern.label}
                    </Text>
                    {selected ? (
                      <Feather name="check" size={16} color="#2563eb" />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.section}>
      <Pressable
        style={styles.sectionHeader}
        onPress={() => setExpanded((value) => !value)}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="#64748b"
        />
      </Pressable>
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  disabled = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        keyboardType="number-pad"
      />
    </View>
  );
}

function SwitchRow({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
}: {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchTextWrap}>
        <Text style={styles.switchTitle}>{title}</Text>
        {description ? (
          <Text style={styles.switchDescription}>{description}</Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
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
  editable = true,
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
  editable?: boolean;
}) {
  return (
    <View style={styles.subSection}>
      <Text style={styles.subTitle}>{title}</Text>

      <View style={styles.arrayList}>
        {values.map((value, idx) => (
          <View key={`${fieldKey}-${value}-${idx}`} style={styles.arrayItem}>
            <Text style={styles.arrayText}>{toDisplayLabel(value)}</Text>
            <Pressable
              onPress={() => onRemove(fieldKey, idx)}
              disabled={!editable}
            >
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
          editable={editable}
        />
        <Pressable
          style={[styles.smallBtn, !editable ? styles.disabledControl : null]}
          onPress={() => onAdd(fieldKey)}
          disabled={!editable}
        >
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
    alignItems: "flex-start",
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  resetBtn: {
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fff1f2",
    borderRadius: 8,
    minHeight: 34,
    paddingHorizontal: 9,
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
  guideBtn: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    minHeight: 34,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  guideBtnText: {
    color: "#1d4ed8",
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
  viewOnlyNotice: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  viewOnlyNoticeText: {
    flex: 1,
    color: "#1e40af",
    fontSize: 12,
    lineHeight: 17,
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
  sectionHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
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
  selectField: {
    minHeight: 36,
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
  selectFieldText: {
    flex: 1,
    color: "#111827",
    fontSize: 12,
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
  disabledControl: {
    opacity: 0.5,
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
  segmentRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  segmentBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  segmentBtnActive: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  segmentBtnText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  segmentBtnTextActive: {
    color: "#1d4ed8",
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
  switchTextWrap: {
    flex: 1,
    paddingRight: 10,
    gap: 2,
  },
  switchTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  switchDescription: {
    color: "#6b7280",
    fontSize: 11,
    lineHeight: 15,
  },
  hintText: {
    color: "#6b7280",
    fontSize: 12,
  },
  useDeviceTimezoneBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
  },
  useDeviceTimezoneText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "700",
  },
  timezoneStatus: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  timezoneStatusConfirmed: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  timezoneStatusPending: {
    borderColor: "#fcd34d",
    backgroundColor: "#fffbeb",
  },
  timezoneStatusText: {
    flex: 1,
    color: "#334155",
    fontSize: 12,
    lineHeight: 17,
  },
  dangerCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    padding: 12,
    gap: 12,
  },
  dangerText: {
    color: "#7f1d1d",
    fontSize: 12,
    lineHeight: 18,
  },
  deleteAccountBtn: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  deleteAccountBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
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
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  pickerCard: {
    maxHeight: "70%",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 10,
    gap: 8,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
    minWidth: 0,
  },
  closeBtn: { padding: 8, marginRight: 2 },
  pickerList: {
    gap: 6,
  },
  pickerItem: {
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
  pickerItemActive: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  pickerItemText: {
    color: "#111827",
    fontSize: 12,
    flex: 1,
  },
  pickerItemTextActive: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
});
