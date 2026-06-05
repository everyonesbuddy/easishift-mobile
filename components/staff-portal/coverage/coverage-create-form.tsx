import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
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
import {
  getRoleDisplayName,
  getRoleOptionsForIndustry,
  getRoleOptionsFromFacilityPreferences,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";

const weekdayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

const horizonOptions = [1, 2, 3, 7, 14, 28, 42, 56] as const;

const requirementTemplates = [
  {
    id: "morning",
    label: "Morning 07-15",
    startTime: "07:00",
    endTime: "15:00",
  },
  {
    id: "business",
    label: "Business 09-17",
    startTime: "09:00",
    endTime: "17:00",
  },
  {
    id: "evening",
    label: "Evening 15-23",
    startTime: "15:00",
    endTime: "23:00",
  },
  { id: "night", label: "Night 23-07", startTime: "23:00", endTime: "07:00" },
] as const;

type ShiftSlot = {
  tag?: unknown;
  label?: unknown;
  startLocalTime?: unknown;
  endLocalTime?: unknown;
};

type ShiftTypeDefinition = {
  key?: unknown;
  label?: unknown;
  timeSlots?: ShiftSlot[];
};

type FacilityPreferences = {
  roleFamilies?: unknown[];
  unitAreas?: unknown[];
  certificationTags?: unknown[];
  shiftTypeDefinitions?: ShiftTypeDefinition[];
};

type Requirement = {
  role: string;
  requiredCount: number;
  startTime: string;
  endTime: string;
  unitArea: string;
  shiftType: string;
  shiftTag: string;
  requiredCertificationTags: string[];
};

type Props = {
  tenantId?: string;
  onSuccess?: () => void;
  onClose?: () => void;
};

const defaultRequirement: Requirement = {
  role: "",
  requiredCount: 1,
  startTime: "09:00",
  endTime: "17:00",
  unitArea: "",
  shiftType: "",
  shiftTag: "",
  requiredCertificationTags: [],
};

function normalizeToken(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function dedupeStrings(values: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
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

function toDayKey(input: Date) {
  const y = input.getFullYear();
  const m = `${input.getMonth() + 1}`.padStart(2, "0");
  const d = `${input.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toUTCISOString(dateStr: string, timeStr: string) {
  const [year, month, day] = String(dateStr || "")
    .split("-")
    .map((part) => Number(part));
  const [hour, minute] = String(timeStr || "")
    .split(":")
    .map((part) => Number(part));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return new Date(`${dateStr}T${timeStr}:00`).toISOString();
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function isOvernightTimeRange(startTime: string, endTime: string) {
  if (!startTime || !endTime) {
    return false;
  }

  return endTime <= startTime;
}

function formatShiftPreview(
  dateValue: string,
  startTime: string,
  endTime: string,
) {
  if (!dateValue || !startTime || !endTime) {
    return `${startTime || "--:--"} - ${endTime || "--:--"}`;
  }

  const start = new Date(`${dateValue}T${startTime}:00`);
  const end = new Date(`${dateValue}T${endTime}:00`);

  if (isOvernightTimeRange(startTime, endTime)) {
    end.setDate(end.getDate() + 1);
  }

  return `${start.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })} - ${end.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })} ${end.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function buildDatesFromPattern(
  startDateStr: string,
  horizonDays: number,
  mode: string,
  weekdays: number[],
) {
  const start = new Date(`${startDateStr}T00:00:00`);
  const totalDays = Number(horizonDays);
  const selectedWeekdays = new Set(weekdays);

  if (!Number.isFinite(totalDays) || totalDays <= 0) {
    return [] as string[];
  }

  if (Number.isNaN(start.getTime())) {
    return [] as string[];
  }

  const dates: string[] = [];

  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);

    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;

    if (mode === "weekdays" && isWeekend) {
      continue;
    }

    if (mode === "weekends" && !isWeekend) {
      continue;
    }

    if (mode === "custom" && !selectedWeekdays.has(day)) {
      continue;
    }

    dates.push(toDayKey(date));
  }

  return dates;
}

function normalizePreferenceStrings(values: unknown) {
  return dedupeStrings(values).map((value) => normalizeToken(value));
}

export default function CoverageCreateForm({
  tenantId,
  onSuccess,
  onClose,
}: Props) {
  const { tenant } = useAuth();

  const [facilityPreferences, setFacilityPreferences] =
    useState<FacilityPreferences | null>(null);

  const today = toDayKey(new Date());

  const [plannerStartDate, setPlannerStartDate] = useState(today);
  const [horizonDays, setHorizonDays] = useState(14);
  const [repeatMode, setRepeatMode] = useState("weekdays");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([
    1, 2, 3, 4, 5,
  ]);
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([
    { ...defaultRequirement },
  ]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"create" | "ai">("create");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadFacilityPreferences() {
      try {
        const res = await api.get("/facility-preferences");
        setFacilityPreferences(res.data || null);
      } catch (requestError) {
        console.warn(
          "Failed to load facility preferences for coverage form",
          requestError,
        );
        setFacilityPreferences(null);
      }
    }

    loadFacilityPreferences();
  }, []);

  const shiftTypeDefinitions = useMemo(() => {
    const defs = Array.isArray(facilityPreferences?.shiftTypeDefinitions)
      ? facilityPreferences.shiftTypeDefinitions
      : [];

    return defs
      .map((def) => ({
        key: normalizeToken(def?.key),
        label: String(def?.label || "").trim(),
        timeSlots: (Array.isArray(def?.timeSlots) ? def.timeSlots : [])
          .map((slot) => ({
            tag: normalizeToken(slot?.tag),
            label: String(slot?.label || "").trim(),
            startLocalTime: String(slot?.startLocalTime || "").trim(),
            endLocalTime: String(slot?.endLocalTime || "").trim(),
          }))
          .filter(
            (slot) => slot.tag && slot.startLocalTime && slot.endLocalTime,
          ),
      }))
      .filter((def) => def.key);
  }, [facilityPreferences?.shiftTypeDefinitions]);

  const slotLookup = useMemo(() => {
    const map = new Map<
      string,
      { startLocalTime: string; endLocalTime: string }
    >();

    shiftTypeDefinitions.forEach((def) => {
      def.timeSlots.forEach((slot) => {
        map.set(`${def.key}:${slot.tag}`, {
          startLocalTime: slot.startLocalTime,
          endLocalTime: slot.endLocalTime,
        });
      });
    });

    return map;
  }, [shiftTypeDefinitions]);

  const shiftDefinitionOptions = useMemo(() => {
    return shiftTypeDefinitions.flatMap((def) =>
      def.timeSlots.map((slot) => ({
        value: `${def.key}:${slot.tag}`,
        shiftType: def.key,
        shiftTag: slot.tag,
        label: `${def.label || toDisplayLabel(def.key)} - ${slot.label || toDisplayLabel(slot.tag)} (${slot.startLocalTime}-${slot.endLocalTime})`,
      })),
    );
  }, [shiftTypeDefinitions]);

  const roleOptions = useMemo(() => {
    const facilityOptions =
      getRoleOptionsFromFacilityPreferences(facilityPreferences);

    if (facilityOptions.length) {
      return facilityOptions;
    }

    return getRoleOptionsForIndustry(
      typeof tenant?.industry === "string" ? tenant.industry : undefined,
    );
  }, [facilityPreferences, tenant]);

  const unitAreas = useMemo(
    () => normalizePreferenceStrings(facilityPreferences?.unitAreas),
    [facilityPreferences?.unitAreas],
  );

  const certificationTags = useMemo(
    () => normalizePreferenceStrings(facilityPreferences?.certificationTags),
    [facilityPreferences?.certificationTags],
  );

  const generatedDates = useMemo(
    () =>
      buildDatesFromPattern(
        plannerStartDate,
        horizonDays,
        repeatMode,
        selectedWeekdays,
      ),
    [plannerStartDate, horizonDays, repeatMode, selectedWeekdays],
  );

  const activeDates = useMemo(
    () => generatedDates.filter((date) => !excludedDates.includes(date)),
    [generatedDates, excludedDates],
  );

  const includedDateSet = useMemo(() => new Set(activeDates), [activeDates]);

  const totalShiftBlocks = activeDates.length * requirements.length;
  const totalRequestedStaff =
    activeDates.length *
    requirements.reduce(
      (sum, req) => sum + (Number(req.requiredCount) || 0),
      0,
    );

  const previewByDate = useMemo(
    () =>
      activeDates.map((dateValue) => ({
        dateValue,
        dateLabel: new Date(`${dateValue}T00:00:00`).toLocaleDateString(
          undefined,
          {
            weekday: "short",
            month: "short",
            day: "numeric",
          },
        ),
        rows: requirements.map((req, reqIndex) => ({
          id: `${dateValue}-${reqIndex}`,
          role: req.role ? getRoleDisplayName(req.role) : "-",
          timeLabel: formatShiftPreview(dateValue, req.startTime, req.endTime),
          count: Number(req.requiredCount) || 0,
          spansOvernight: isOvernightTimeRange(req.startTime, req.endTime),
          unitArea: req.unitArea || "",
          shiftType: req.shiftType || "",
          shiftTag: req.shiftTag || "",
        })),
      })),
    [activeDates, requirements],
  );

  const handleToggleWeekday = (day: number) => {
    setRepeatMode("custom");
    setSelectedWeekdays((prev) => {
      if (prev.includes(day)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== day);
      }

      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const handleRepeatModeChange = (mode: string) => {
    setRepeatMode(mode);

    if (mode === "weekdays") {
      setSelectedWeekdays([1, 2, 3, 4, 5]);
    }

    if (mode === "weekends") {
      setSelectedWeekdays([6, 0]);
    }

    if (mode === "everyday") {
      setSelectedWeekdays([0, 1, 2, 3, 4, 5, 6]);
    }
  };

  const handleRequirementChange = (
    index: number,
    field: keyof Requirement,
    value: string | number | string[],
  ) => {
    setRequirements((prev) =>
      prev.map((req, i) => (i === index ? { ...req, [field]: value } : req)),
    );
  };

  const getShiftSlotsForType = (shiftType: string) => {
    const key = normalizeToken(shiftType);

    if (!key) {
      return [] as { tag: string }[];
    }

    const matched = shiftTypeDefinitions.find((def) => def.key === key);
    return matched?.timeSlots || [];
  };

  const getSelectedSlot = (req: Requirement) => {
    const shiftType = normalizeToken(req.shiftType);
    const shiftTag = normalizeToken(req.shiftTag);

    if (!shiftType || !shiftTag) {
      return null;
    }

    return slotLookup.get(`${shiftType}:${shiftTag}`) || null;
  };

  const getShiftDefinitionValue = (req: Requirement) => {
    const shiftType = normalizeToken(req.shiftType);
    const shiftTag = normalizeToken(req.shiftTag);

    if (!shiftType || !shiftTag) {
      return "";
    }

    return `${shiftType}:${shiftTag}`;
  };

  const handleShiftDefinitionSelect = (
    index: number,
    selectionValue: string,
  ) => {
    const normalizedValue = String(selectionValue || "").trim();

    if (!normalizedValue) {
      handleRequirementChange(index, "shiftType", "");
      handleRequirementChange(index, "shiftTag", "");
      return;
    }

    const selectedOption = shiftDefinitionOptions.find(
      (option) => option.value === normalizedValue,
    );

    if (!selectedOption) {
      return;
    }

    const selectedSlot = slotLookup.get(
      `${selectedOption.shiftType}:${selectedOption.shiftTag}`,
    );

    handleRequirementChange(index, "shiftType", selectedOption.shiftType);
    handleRequirementChange(index, "shiftTag", selectedOption.shiftTag);

    if (selectedSlot?.startLocalTime && selectedSlot?.endLocalTime) {
      handleRequirementChange(index, "startTime", selectedSlot.startLocalTime);
      handleRequirementChange(index, "endTime", selectedSlot.endLocalTime);
    }
  };

  const handleAddRequirement = () => {
    setRequirements((prev) => [...prev, { ...defaultRequirement }]);
  };

  const handleAddTemplateRequirement = (template: {
    startTime: string;
    endTime: string;
  }) => {
    setRequirements((prev) => [
      ...prev,
      {
        ...defaultRequirement,
        startTime: template.startTime,
        endTime: template.endTime,
      },
    ]);
  };

  const handleRemoveRequirement = (index: number) => {
    setRequirements((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index),
    );
  };

  const handleToggleDate = (date: string) => {
    setExcludedDates((prev) =>
      prev.includes(date)
        ? prev.filter((value) => value !== date)
        : [...prev, date],
    );
  };

  const clearExcludedDates = () => {
    setExcludedDates([]);
  };

  const toggleCertificationTag = (index: number, certTag: string) => {
    const req = requirements[index];
    const set = new Set(req.requiredCertificationTags || []);

    if (set.has(certTag)) {
      set.delete(certTag);
    } else {
      set.add(certTag);
    }

    handleRequirementChange(
      index,
      "requiredCertificationTags",
      Array.from(set),
    );
  };

  const handleSubmit = async (autoGenerate = false) => {
    setError("");
    setSuccess("");

    if (!activeDates.length) {
      setError("Please include at least one active date.");
      return;
    }

    for (let index = 0; index < requirements.length; index += 1) {
      const req = requirements[index];
      const slotsForType = getShiftSlotsForType(req.shiftType);
      const selectedSlot = getSelectedSlot(req);
      const requiresSlotTag =
        !!normalizeToken(req.shiftType) && slotsForType.length > 0;

      if (!req.role) {
        setError(`Requirement ${index + 1} must include a role.`);
        return;
      }

      if (requiresSlotTag && !selectedSlot) {
        setError(
          `Requirement ${index + 1} must include a shift slot for selected shift type.`,
        );
        return;
      }

      if (!selectedSlot && (!req.startTime || !req.endTime)) {
        setError(
          `Requirement ${index + 1} must include start time and end time.`,
        );
        return;
      }
    }

    setLoadingMode(autoGenerate ? "ai" : "create");
    setLoading(true);

    try {
      const createdCoverages: { _id?: string }[] = [];

      const createResponses = await Promise.all(
        activeDates.map((date) => {
          const shifts = requirements.map((req) => {
            const selectedSlot = getSelectedSlot(req);
            const startTime = selectedSlot?.startLocalTime || req.startTime;
            const endTime = selectedSlot?.endLocalTime || req.endTime;

            const isOvernight = isOvernightTimeRange(startTime, endTime);
            let endDate = date;

            if (isOvernight) {
              const d = new Date(`${date}T00:00:00`);
              d.setDate(d.getDate() + 1);
              endDate = toDayKey(d);
            }

            return {
              role: req.role,
              requiredCount: Number(req.requiredCount) || 0,
              unitArea: req.unitArea || null,
              shiftType: req.shiftType || null,
              shiftTag: req.shiftTag || null,
              startTime: toUTCISOString(date, startTime),
              endTime: toUTCISOString(endDate, endTime),
              requiredCertificationTags: dedupeStrings(
                req.requiredCertificationTags,
              ),
              note,
            };
          });

          return api.post("/coverage", {
            tenantId,
            dates: [date],
            shifts,
          });
        }),
      );

      createResponses.forEach((response) => {
        const createdForDate = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.created)
            ? response.data.created
            : [];

        createdCoverages.push(...createdForDate);
      });

      if (autoGenerate && createdCoverages.length) {
        await api.post("/schedules/auto-generate", {
          coverageIds: createdCoverages.map((item) => item._id).filter(Boolean),
        });
      }

      const message = autoGenerate
        ? "Coverage created and auto-scheduling completed."
        : "Coverage requirements added successfully.";

      setSuccess(message);
      setRequirements([{ ...defaultRequirement }]);
      setPlannerStartDate(today);
      setHorizonDays(14);
      setRepeatMode("weekdays");
      setSelectedWeekdays([1, 2, 3, 4, 5]);
      setExcludedDates([]);
      setNote("");
      onSuccess?.();
    } catch (requestError) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (requestError as { response?: { data?: { message?: string } } })
              .response?.data?.message || "Failed to add coverage."
          : "Failed to add coverage.";

      setError(message);
    } finally {
      setLoading(false);
      setLoadingMode("create");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Coverage Planner</Text>
          <Text style={styles.subtitle}>
            Set horizon + repeat pattern, then define requirements once.
          </Text>
        </View>
        {onClose ? (
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={22} color="#6b7280" />
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Quick Planner</Text>
        <Text style={styles.sectionHint}>
          Start date + horizon + repeat mode generates dates automatically.
        </Text>

        <View style={styles.inlineInputsRow}>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Start Date</Text>
            <TextInput
              value={plannerStartDate}
              onChangeText={setPlannerStartDate}
              placeholder="YYYY-MM-DD"
              style={styles.input}
            />
          </View>

          <View style={[styles.fieldWrap, styles.horizonWrap]}>
            <Text style={styles.fieldLabel}>Horizon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.rowWrap}>
                {horizonOptions.map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setHorizonDays(value)}
                    style={[
                      styles.token,
                      horizonDays === value ? styles.tokenActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tokenText,
                        horizonDays === value ? styles.tokenTextActive : null,
                      ]}
                    >
                      {value}d
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Repeat Mode</Text>
        <View style={styles.rowWrap}>
          {[
            { key: "everyday", label: "Every Day" },
            { key: "weekdays", label: "Weekdays" },
            { key: "weekends", label: "Weekends" },
            { key: "custom", label: "Custom" },
          ].map((mode) => (
            <Pressable
              key={mode.key}
              onPress={() => handleRepeatModeChange(mode.key)}
              style={[
                styles.token,
                repeatMode === mode.key ? styles.tokenActive : null,
              ]}
            >
              <Text
                style={[
                  styles.tokenText,
                  repeatMode === mode.key ? styles.tokenTextActive : null,
                ]}
              >
                {mode.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.rowWrap}>
          {weekdayOptions.map((day) => {
            const active = selectedWeekdays.includes(day.value);
            return (
              <Pressable
                key={day.value}
                onPress={() => handleToggleWeekday(day.value)}
                style={[styles.token, active ? styles.tokenActive : null]}
              >
                <Text
                  style={[
                    styles.tokenText,
                    active ? styles.tokenTextActive : null,
                  ]}
                >
                  {day.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionHint}>
          Generated {generatedDates.length} dates, using {activeDates.length}{" "}
          active dates.
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.requirementHeaderRow}>
          <Text style={styles.sectionTitle}>Generated Dates</Text>
          <Pressable
            onPress={clearExcludedDates}
            disabled={!excludedDates.length}
            style={styles.linkBtn}
          >
            <Text style={styles.linkBtnText}>Re-include all</Text>
          </Pressable>
        </View>

        <View style={styles.rowWrap}>
          {generatedDates.map((date) => {
            const included = includedDateSet.has(date);
            return (
              <Pressable
                key={date}
                onPress={() => handleToggleDate(date)}
                style={[styles.token, included ? styles.tokenActive : null]}
              >
                <Text
                  style={[
                    styles.tokenText,
                    included ? styles.tokenTextActive : styles.tokenTextMuted,
                  ]}
                >
                  {new Date(`${date}T00:00:00`).toLocaleDateString()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.requirementHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Coverage Requirements</Text>
          <Text style={styles.sectionHint}>
            {requirements.length}{" "}
            {requirements.length === 1 ? "entry" : "entries"}
          </Text>
        </View>

        <Pressable style={styles.smallBtn} onPress={handleAddRequirement}>
          <Feather name="plus" size={14} color="#111827" />
          <Text style={styles.smallBtnText}>Add Requirement</Text>
        </Pressable>
      </View>

      <View style={styles.rowWrap}>
        {requirementTemplates.map((template) => (
          <Pressable
            key={template.id}
            style={styles.token}
            onPress={() => handleAddTemplateRequirement(template)}
          >
            <Text style={styles.tokenText}>{template.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.stack}>
        {requirements.map((req, index) => {
          const selectedSlot = getSelectedSlot(req);
          const roleValue = req.role;
          const unitAreaValue = req.unitArea;
          const shiftDefValue = getShiftDefinitionValue(req);

          return (
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

              <Text style={styles.fieldLabel}>Role</Text>
              <View style={styles.rowWrap}>
                {roleOptions.map((item) => {
                  const active = roleValue === item.value;
                  return (
                    <Pressable
                      key={`${index}-${item.value}`}
                      style={[styles.token, active ? styles.tokenActive : null]}
                      onPress={() =>
                        handleRequirementChange(index, "role", item.value)
                      }
                    >
                      <Text
                        style={[
                          styles.tokenText,
                          active ? styles.tokenTextActive : null,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.inlineInputsRow}>
                <View style={[styles.fieldWrap, styles.countWrap]}>
                  <Text style={styles.fieldLabel}>Count</Text>
                  <TextInput
                    value={String(req.requiredCount)}
                    onChangeText={(value) =>
                      handleRequirementChange(
                        index,
                        "requiredCount",
                        Math.max(0, Number(value) || 0),
                      )
                    }
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>Start</Text>
                  <TextInput
                    value={selectedSlot?.startLocalTime || req.startTime}
                    onChangeText={(value) =>
                      handleRequirementChange(index, "startTime", value)
                    }
                    editable={!selectedSlot}
                    style={[
                      styles.input,
                      selectedSlot ? styles.inputDisabled : null,
                    ]}
                  />
                </View>
                <View style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>End</Text>
                  <TextInput
                    value={selectedSlot?.endLocalTime || req.endTime}
                    onChangeText={(value) =>
                      handleRequirementChange(index, "endTime", value)
                    }
                    editable={!selectedSlot}
                    style={[
                      styles.input,
                      selectedSlot ? styles.inputDisabled : null,
                    ]}
                  />
                </View>
              </View>

              {isOvernightTimeRange(req.startTime, req.endTime) ? (
                <Text style={styles.infoBanner}>
                  Overnight shift: this requirement will end on the next day.
                </Text>
              ) : null}

              <Text style={styles.fieldLabel}>Unit Area (Optional)</Text>
              <View style={styles.rowWrap}>
                <Pressable
                  style={[
                    styles.token,
                    !unitAreaValue ? styles.tokenActive : null,
                  ]}
                  onPress={() => handleRequirementChange(index, "unitArea", "")}
                >
                  <Text
                    style={[
                      styles.tokenText,
                      !unitAreaValue ? styles.tokenTextActive : null,
                    ]}
                  >
                    Any Area
                  </Text>
                </Pressable>

                {unitAreas.map((area) => {
                  const active = unitAreaValue === area;
                  return (
                    <Pressable
                      key={`${index}-area-${area}`}
                      style={[styles.token, active ? styles.tokenActive : null]}
                      onPress={() =>
                        handleRequirementChange(index, "unitArea", area)
                      }
                    >
                      <Text
                        style={[
                          styles.tokenText,
                          active ? styles.tokenTextActive : null,
                        ]}
                      >
                        {toDisplayLabel(area)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Shift Definition (Optional)</Text>
              <View style={styles.rowWrap}>
                <Pressable
                  style={[
                    styles.token,
                    !shiftDefValue ? styles.tokenActive : null,
                  ]}
                  onPress={() => handleShiftDefinitionSelect(index, "")}
                >
                  <Text
                    style={[
                      styles.tokenText,
                      !shiftDefValue ? styles.tokenTextActive : null,
                    ]}
                  >
                    Manual Time Entry
                  </Text>
                </Pressable>

                {shiftDefinitionOptions.map((option) => {
                  const active = shiftDefValue === option.value;
                  return (
                    <Pressable
                      key={`${index}-shiftdef-${option.value}`}
                      style={[styles.token, active ? styles.tokenActive : null]}
                      onPress={() =>
                        handleShiftDefinitionSelect(index, option.value)
                      }
                    >
                      <Text
                        style={[
                          styles.tokenText,
                          active ? styles.tokenTextActive : null,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>
                Required Certifications (Optional)
              </Text>
              <View style={styles.rowWrap}>
                {certificationTags.length === 0 ? (
                  <Text style={styles.sectionHint}>
                    No certification tags configured yet.
                  </Text>
                ) : (
                  certificationTags.map((cert) => {
                    const active = req.requiredCertificationTags.includes(cert);
                    return (
                      <Pressable
                        key={`${index}-cert-${cert}`}
                        style={[
                          styles.token,
                          active ? styles.tokenActive : null,
                        ]}
                        onPress={() => toggleCertificationTag(index, cert)}
                      >
                        <Text
                          style={[
                            styles.tokenText,
                            active ? styles.tokenTextActive : null,
                          ]}
                        >
                          {toDisplayLabel(cert)}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Plan Summary</Text>
        <Text style={styles.sectionHint}>
          {totalShiftBlocks} coverage entries, {totalRequestedStaff} staff
          positions, {activeDates.length} active dates.
        </Text>

        {previewByDate.length === 0 ? (
          <Text style={styles.sectionHint}>
            Add active dates and at least one requirement to see preview.
          </Text>
        ) : (
          <View style={styles.previewWrap}>
            {previewByDate.map((group) => (
              <View key={group.dateValue} style={styles.previewDayCard}>
                <Text style={styles.previewDayLabel}>{group.dateLabel}</Text>

                {group.rows.map((row) => (
                  <View key={row.id} style={styles.previewRow}>
                    <Text style={styles.previewRole}>{row.role}</Text>
                    <Text style={styles.previewMeta}>
                      {row.timeLabel}
                      {row.unitArea ? ` | ${toDisplayLabel(row.unitArea)}` : ""}
                      {row.shiftType
                        ? ` | ${toDisplayLabel(row.shiftType)}`
                        : ""}
                      {row.shiftTag ? ` | ${toDisplayLabel(row.shiftTag)}` : ""}
                      {row.spansOvernight ? " | Overnight" : ""}
                    </Text>
                    <Text style={styles.previewCount}>x{row.count}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Notes (Optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          style={[styles.input, styles.notesInput]}
          placeholder="Add coverage notes..."
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
  inlineInputsRow: {
    flexDirection: "row",
    gap: 8,
  },
  fieldWrap: {
    flex: 1,
    gap: 5,
  },
  countWrap: {
    maxWidth: 90,
  },
  horizonWrap: {
    flex: 1.3,
  },
  fieldLabel: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
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
  inputDisabled: {
    backgroundColor: "#eef2f7",
    color: "#64748b",
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  token: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tokenActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  tokenText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  tokenTextActive: {
    color: "#1d4ed8",
  },
  tokenTextMuted: {
    textDecorationLine: "line-through",
  },
  requirementHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  linkBtn: {
    paddingVertical: 4,
  },
  linkBtnText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
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
    flexDirection: "row",
    gap: 6,
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
  infoBanner: {
    color: "#1e40af",
    backgroundColor: "#dbeafe",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: "600",
  },
  previewWrap: {
    gap: 8,
    maxHeight: 300,
  },
  previewDayCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 8,
    gap: 6,
  },
  previewDayLabel: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  previewRow: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 6,
    gap: 2,
  },
  previewRole: {
    color: "#1f2937",
    fontSize: 12,
    fontWeight: "700",
  },
  previewMeta: {
    color: "#64748b",
    fontSize: 11,
  },
  previewCount: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
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
