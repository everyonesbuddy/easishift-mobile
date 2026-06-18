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
  getUnitAreaDisplayName,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";

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
  { label: "Morning 07-15", startTime: "07:00", endTime: "15:00" },
  { label: "Business 09-17", startTime: "09:00", endTime: "17:00" },
  { label: "Evening 15-23", startTime: "15:00", endTime: "23:00" },
  { label: "Night 23-07", startTime: "23:00", endTime: "07:00" },
] as const;

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

function normalizeStringArray(values: unknown) {
  return dedupeStrings(values).map((value) => normalizeToken(value));
}

function toDisplayLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
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

function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toUTCISOString(dateKey: string, timeValue: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function isOvernight(startTime: string, endTime: string) {
  return !!startTime && !!endTime && endTime <= startTime;
}

function buildDates(
  startDate: string,
  horizonDays: number,
  repeatMode: string,
  weekdays: number[],
) {
  const start = new Date(`${startDate}T00:00:00`);
  if (
    Number.isNaN(start.getTime()) ||
    !Number.isFinite(horizonDays) ||
    horizonDays <= 0
  ) {
    return [] as string[];
  }

  const weekdaySet = new Set(weekdays);
  const dates: string[] = [];

  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);

    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;

    if (repeatMode === "weekdays" && isWeekend) continue;
    if (repeatMode === "weekends" && !isWeekend) continue;
    if (repeatMode === "custom" && !weekdaySet.has(day)) continue;

    dates.push(toDayKey(date));
  }

  return dates;
}

export default function CoverageCreateForm({
  tenantId,
  onSuccess,
  onClose,
}: Props) {
  const { tenant } = useAuth();
  const [facilityPreferences, setFacilityPreferences] =
    useState<FacilityPreferences | null>(null);
  const [plannerStartDate, setPlannerStartDate] = useState(
    toDayKey(new Date()),
  );
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
    let isMounted = true;

    async function loadPreferences() {
      try {
        const response = await api.get("/facility-preferences");
        if (isMounted) {
          setFacilityPreferences(response.data || null);
        }
      } catch (loadError) {
        console.warn("Failed to load facility preferences", loadError);
        if (isMounted) {
          setFacilityPreferences(null);
        }
      }
    }

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const shiftTypeDefinitions = useMemo(() => {
    const defs = Array.isArray(facilityPreferences?.shiftTypeDefinitions)
      ? facilityPreferences?.shiftTypeDefinitions
      : [];

    return defs
      .map((definition) => ({
        key: normalizeToken(definition?.key),
        label: String(definition?.label || "").trim(),
        timeSlots: (Array.isArray(definition?.timeSlots)
          ? definition.timeSlots
          : []
        )
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
      .filter((definition) => definition.key);
  }, [facilityPreferences?.shiftTypeDefinitions]);

  const slotLookup = useMemo(() => {
    const map = new Map<
      string,
      { startLocalTime: string; endLocalTime: string }
    >();

    shiftTypeDefinitions.forEach((definition) => {
      definition.timeSlots.forEach((slot) => {
        map.set(`${definition.key}:${slot.tag}`, {
          startLocalTime: slot.startLocalTime,
          endLocalTime: slot.endLocalTime,
        });
      });
    });

    return map;
  }, [shiftTypeDefinitions]);

  const shiftDefinitionOptions = useMemo(() => {
    return shiftTypeDefinitions.flatMap((definition) =>
      definition.timeSlots.map((slot) => ({
        value: `${definition.key}:${slot.tag}`,
        shiftType: definition.key,
        shiftTag: slot.tag,
        label: `${definition.label || toDisplayLabel(definition.key)} - ${slot.label || toDisplayLabel(slot.tag)} (${to12HourTime(slot.startLocalTime)} - ${to12HourTime(slot.endLocalTime)})`,
      })),
    );
  }, [shiftTypeDefinitions]);

  const roleOptions = useMemo(() => {
    const facilityRoleOptions =
      getRoleOptionsFromFacilityPreferences(facilityPreferences);
    return facilityRoleOptions.length > 0
      ? facilityRoleOptions
      : getRoleOptionsForIndustry(tenant?.industry);
  }, [facilityPreferences, tenant?.industry]);

  const unitAreas = useMemo(
    () => normalizeStringArray(facilityPreferences?.unitAreas),
    [facilityPreferences?.unitAreas],
  );
  const certificationTags = useMemo(
    () => normalizeStringArray(facilityPreferences?.certificationTags),
    [facilityPreferences?.certificationTags],
  );

  const generatedDates = useMemo(
    () =>
      buildDates(plannerStartDate, horizonDays, repeatMode, selectedWeekdays),
    [plannerStartDate, horizonDays, repeatMode, selectedWeekdays],
  );

  const activeDates = useMemo(
    () => generatedDates.filter((date) => !excludedDates.includes(date)),
    [generatedDates, excludedDates],
  );

  const includedDateSet = useMemo(() => new Set(activeDates), [activeDates]);

  const previewByDate = useMemo(() => {
    return activeDates.map((dateValue) => ({
      dateValue,
      dateLabel: new Date(`${dateValue}T00:00:00`).toLocaleDateString(
        undefined,
        {
          weekday: "short",
          month: "short",
          day: "numeric",
        },
      ),
      rows: requirements.map((req, index) => ({
        id: `${dateValue}-${index}`,
        role: req.role ? getRoleDisplayName(req.role) : "-",
        timeLabel: `${to12HourTime(req.startTime)} - ${to12HourTime(req.endTime)}`,
        unitArea: req.unitArea,
        shiftType: req.shiftType,
        shiftTag: req.shiftTag,
        count: Number(req.requiredCount) || 0,
        overnight: isOvernight(req.startTime, req.endTime),
      })),
    }));
  }, [activeDates, requirements]);

  const handleRepeatModeChange = (mode: string) => {
    setRepeatMode(mode);

    if (mode === "weekdays") setSelectedWeekdays([1, 2, 3, 4, 5]);
    if (mode === "weekends") setSelectedWeekdays([0, 6]);
    if (mode === "everyday") setSelectedWeekdays([0, 1, 2, 3, 4, 5, 6]);
  };

  const handleToggleWeekday = (day: number) => {
    setRepeatMode("custom");
    setSelectedWeekdays((prev) => {
      if (prev.includes(day)) {
        return prev.length === 1 ? prev : prev.filter((value) => value !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const handleRequirementChange = (
    index: number,
    field: keyof Requirement,
    value: string | number | string[],
  ) => {
    setRequirements((prev) =>
      prev.map((req, reqIndex) =>
        reqIndex === index ? { ...req, [field]: value } : req,
      ),
    );
  };

  const getSelectedSlot = (req: Requirement) => {
    const shiftType = normalizeToken(req.shiftType);
    const shiftTag = normalizeToken(req.shiftTag);
    if (!shiftType || !shiftTag) return null;
    return slotLookup.get(`${shiftType}:${shiftTag}`) || null;
  };

  const getShiftDefinitionValue = (req: Requirement) => {
    const shiftType = normalizeToken(req.shiftType);
    const shiftTag = normalizeToken(req.shiftTag);
    return shiftType && shiftTag ? `${shiftType}:${shiftTag}` : "";
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
    if (!selectedOption) return;

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
      prev.length === 1
        ? prev
        : prev.filter((_, reqIndex) => reqIndex !== index),
    );
  };

  const toggleCertificationTag = (index: number, certTag: string) => {
    const current = requirements[index];
    const next = new Set(current.requiredCertificationTags || []);

    if (next.has(certTag)) {
      next.delete(certTag);
    } else {
      next.add(certTag);
    }

    handleRequirementChange(
      index,
      "requiredCertificationTags",
      Array.from(next),
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

  const handleSubmit = async (autoGenerate = false) => {
    setError("");
    setSuccess("");

    if (!activeDates.length) {
      setError("Please include at least one active date.");
      return;
    }

    for (let index = 0; index < requirements.length; index += 1) {
      const req = requirements[index];
      if (!req.role) {
        setError(`Requirement ${index + 1} must include a role.`);
        return;
      }
      if (!req.shiftType && (!req.startTime || !req.endTime)) {
        setError(`Requirement ${index + 1} must include a time range.`);
        return;
      }
    }

    setLoading(true);
    setLoadingMode(autoGenerate ? "ai" : "create");

    try {
      const createResponses = await Promise.all(
        activeDates.map((dateValue) => {
          const shifts = requirements.map((req) => {
            const selectedSlot = getSelectedSlot(req);
            const startTime = selectedSlot?.startLocalTime || req.startTime;
            const endTime = selectedSlot?.endLocalTime || req.endTime;
            const overnight = isOvernight(startTime, endTime);
            const endDate = overnight
              ? toDayKey(new Date(`${dateValue}T00:00:00`))
              : dateValue;

            return {
              role: req.role,
              requiredCount: Number(req.requiredCount) || 0,
              unitArea: req.unitArea || null,
              shiftType: req.shiftType || null,
              shiftTag: req.shiftTag || null,
              startTime: toUTCISOString(dateValue, startTime),
              endTime: toUTCISOString(endDate, endTime),
              requiredCertificationTags: dedupeStrings(
                req.requiredCertificationTags,
              ),
              note,
            };
          });

          return api.post("/coverage", {
            tenantId,
            dates: [dateValue],
            shifts,
          });
        }),
      );

      if (autoGenerate) {
        const coverageIds = createResponses
          .flatMap((response) =>
            Array.isArray(response.data)
              ? response.data
              : response.data?.created || [],
          )
          .map((item) => item?._id)
          .filter(Boolean);

        if (coverageIds.length) {
          await api.post("/schedules/auto-generate", { coverageIds });
        }
      }

      setSuccess(
        autoGenerate
          ? "Coverage created and AI schedule generation started."
          : "Coverage requirements added successfully.",
      );
      setRequirements([{ ...defaultRequirement }]);
      setPlannerStartDate(toDayKey(new Date()));
      setHorizonDays(14);
      setRepeatMode("weekdays");
      setSelectedWeekdays([1, 2, 3, 4, 5]);
      setExcludedDates([]);
      setNote("");
      onSuccess?.();
    } catch (requestError: unknown) {
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
            Set the horizon, repeat pattern, and coverage requirements in one
            pass.
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
          Generate dates from a start date, horizon, and repeat mode.
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
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          Choose a Shift Definition when possible. Manual times stay available
          for exceptions.
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
            key={template.label}
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
          const shiftDefinitionValue = getShiftDefinitionValue(req);

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
                  const active = req.role === item.value;
                  return (
                    <Pressable
                      key={`${index}-${item.value}`}
                      onPress={() =>
                        handleRequirementChange(index, "role", item.value)
                      }
                      style={[styles.token, active ? styles.tokenActive : null]}
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

              {isOvernight(req.startTime, req.endTime) ? (
                <Text style={styles.sectionHint}>
                  Overnight shift: this requirement ends the next day.
                </Text>
              ) : null}

              <Text style={styles.fieldLabel}>Unit Area</Text>
              <View style={styles.rowWrap}>
                <Pressable
                  onPress={() => handleRequirementChange(index, "unitArea", "")}
                  style={[
                    styles.token,
                    !req.unitArea ? styles.tokenActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.tokenText,
                      !req.unitArea ? styles.tokenTextActive : null,
                    ]}
                  >
                    Any Area
                  </Text>
                </Pressable>
                {unitAreas.map((area) => {
                  const active = req.unitArea === area;
                  return (
                    <Pressable
                      key={`${index}-${area}`}
                      onPress={() =>
                        handleRequirementChange(index, "unitArea", area)
                      }
                      style={[styles.token, active ? styles.tokenActive : null]}
                    >
                      <Text
                        style={[
                          styles.tokenText,
                          active ? styles.tokenTextActive : null,
                        ]}
                      >
                        {getUnitAreaDisplayName(area)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Shift Definition</Text>
              <View style={styles.rowWrap}>
                <Pressable
                  onPress={() => handleShiftDefinitionSelect(index, "")}
                  style={[
                    styles.token,
                    !shiftDefinitionValue ? styles.tokenActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.tokenText,
                      !shiftDefinitionValue ? styles.tokenTextActive : null,
                    ]}
                  >
                    Manual Time Entry
                  </Text>
                </Pressable>
                {shiftDefinitionOptions.map((option) => {
                  const active = shiftDefinitionValue === option.value;
                  return (
                    <Pressable
                      key={`${index}-${option.value}`}
                      onPress={() =>
                        handleShiftDefinitionSelect(index, option.value)
                      }
                      style={[styles.token, active ? styles.tokenActive : null]}
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

              <Text style={styles.fieldLabel}>Required Certifications</Text>
              <View style={styles.rowWrap}>
                {certificationTags.length ? (
                  certificationTags.map((cert) => {
                    const active = req.requiredCertificationTags.includes(cert);
                    return (
                      <Pressable
                        key={`${index}-${cert}`}
                        onPress={() => toggleCertificationTag(index, cert)}
                        style={[
                          styles.token,
                          active ? styles.tokenActive : null,
                        ]}
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
                ) : (
                  <Text style={styles.sectionHint}>
                    No certification tags configured yet.
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Plan Summary</Text>
        <Text style={styles.sectionHint}>
          {activeDates.length} active dates • {requirements.length} requirement
          blocks.
        </Text>

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
                    {row.shiftType ? ` | ${toDisplayLabel(row.shiftType)}` : ""}
                    {row.shiftTag ? ` | ${toDisplayLabel(row.shiftTag)}` : ""}
                    {row.overnight ? " | Overnight" : ""}
                  </Text>
                  <Text style={styles.previewCount}>x{row.count}</Text>
                </View>
              ))}
            </View>
          ))}
          {!previewByDate.length ? (
            <Text style={styles.sectionHint}>
              Add active dates and at least one requirement to preview the plan.
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Notes</Text>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, paddingBottom: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  closeBtn: { padding: 8, marginRight: 2 },
  title: { color: "#111827", fontSize: 20, fontWeight: "800" },
  subtitle: { color: "#6b7280", fontSize: 13, marginTop: 2 },
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
  sectionTitle: { color: "#111827", fontSize: 15, fontWeight: "700" },
  sectionHint: { color: "#6b7280", fontSize: 12 },
  infoBanner: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#dbeafe",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  infoBannerText: {
    color: "#1e40af",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  inlineInputsRow: { flexDirection: "row", gap: 8 },
  fieldWrap: { flex: 1, gap: 5 },
  countWrap: { maxWidth: 90 },
  horizonWrap: { flex: 1.3 },
  fieldLabel: { color: "#374151", fontSize: 12, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#111827",
  },
  inputDisabled: { backgroundColor: "#eef2f7", color: "#64748b" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  token: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tokenActive: { borderColor: "#1d4ed8", backgroundColor: "#dbeafe" },
  tokenText: { color: "#374151", fontSize: 12, fontWeight: "600" },
  tokenTextActive: { color: "#1d4ed8" },
  tokenTextMuted: { textDecorationLine: "line-through" },
  requirementHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  linkBtn: { paddingVertical: 4 },
  linkBtnText: { color: "#2563eb", fontSize: 12, fontWeight: "700" },
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
  smallBtnText: { color: "#111827", fontSize: 13, fontWeight: "700" },
  stack: { gap: 10 },
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
  requirementTitle: { color: "#111827", fontSize: 14, fontWeight: "700" },
  previewWrap: { gap: 8 },
  previewDayCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 8,
    gap: 6,
  },
  previewDayLabel: { color: "#111827", fontSize: 12, fontWeight: "700" },
  previewRow: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 6,
    gap: 2,
  },
  previewRole: { color: "#1f2937", fontSize: 12, fontWeight: "700" },
  previewMeta: { color: "#64748b", fontSize: 11 },
  previewCount: { color: "#0f172a", fontSize: 12, fontWeight: "700" },
  notesInput: { minHeight: 68, textAlignVertical: "top" },
  actionRow: { gap: 8 },
  actionBtn: {
    borderRadius: 8,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: { backgroundColor: "#2563eb" },
  darkBtn: { backgroundColor: "#111827" },
  primaryBtnText: { color: "#ffffff", fontWeight: "700" },
  darkBtnText: { color: "#ffffff", fontWeight: "700" },
});
