import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
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

function parseDayKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  const [loading, setLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"create" | "ai">("create");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [horizonPickerOpen, setHorizonPickerOpen] = useState(false);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [startDatePickerValue, setStartDatePickerValue] = useState(new Date());
  const [pickerState, setPickerState] = useState<{
    requirementIndex: number;
    field: "role" | "unitArea" | "shiftDefinition";
  } | null>(null);

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

  const totalShiftBlocks = activeDates.length * requirements.length;
  const totalRequestedStaff =
    activeDates.length *
    requirements.reduce(
      (sum, requirement) => sum + (Number(requirement.requiredCount) || 0),
      0,
    );

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

  const AccordionHeader = ({
    icon,
    title,
    subtitle,
    open,
    onToggle,
    badge,
  }: {
    icon: keyof typeof Feather.glyphMap;
    title: string;
    subtitle?: string;
    open: boolean;
    onToggle: () => void;
    badge?: string;
  }) => (
    <Pressable style={styles.accordionHeader} onPress={onToggle}>
      <View style={styles.accordionHeaderLeft}>
        <View style={styles.accordionIconWrap}>
          <Feather name={icon} size={15} color="#1d4ed8" />
        </View>
        <View style={styles.accordionTitleWrap}>
          <Text style={styles.accordionTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.accordionSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
        {badge ? (
          <View style={styles.accordionBadge}>
            <Text style={styles.accordionBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Feather
        name={open ? "chevron-up" : "chevron-down"}
        size={18}
        color="#64748b"
      />
    </Pressable>
  );

  const pickerOptions = useMemo(() => {
    if (!pickerState) {
      return [] as { value: string; label: string }[];
    }

    if (pickerState.field === "role") {
      return roleOptions.map((item) => ({
        value: item.value,
        label: item.label,
      }));
    }

    if (pickerState.field === "unitArea") {
      return [
        { value: "", label: "Any Area" },
        ...unitAreas.map((area) => ({
          value: area,
          label: getUnitAreaDisplayName(area),
        })),
      ];
    }

    return [
      { value: "", label: "Manual Time Entry" },
      ...shiftDefinitionOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    ];
  }, [pickerState, roleOptions, shiftDefinitionOptions, unitAreas]);

  const pickerTitle =
    pickerState?.field === "role"
      ? "Select Role"
      : pickerState?.field === "unitArea"
        ? "Select Unit Area"
        : "Select Time Slot";

  const pickerValue = useMemo(() => {
    if (!pickerState) {
      return "";
    }

    const req = requirements[pickerState.requirementIndex];
    if (!req) {
      return "";
    }

    if (pickerState.field === "role") {
      return req.role;
    }

    if (pickerState.field === "unitArea") {
      return req.unitArea || "";
    }

    return getShiftDefinitionValue(req);
  }, [pickerState, requirements]);

  const handlePickerSelect = (value: string) => {
    if (!pickerState) {
      return;
    }

    const { requirementIndex, field } = pickerState;

    if (field === "role") {
      handleRequirementChange(requirementIndex, "role", value);
    } else if (field === "unitArea") {
      handleRequirementChange(requirementIndex, "unitArea", value);
    } else {
      handleShiftDefinitionSelect(requirementIndex, value);
    }
  };

  const openStartDatePicker = () => {
    const parsed = parseDayKey(plannerStartDate);
    setStartDatePickerValue(parsed || new Date());
    setStartDatePickerOpen(true);
  };

  const applyStartDate = () => {
    setPlannerStartDate(toDayKey(startDatePickerValue));
    setStartDatePickerOpen(false);
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

      <View style={[styles.sectionCard, styles.datePatternCard]}>
        <Text style={styles.sectionTitle}>Quick Planner</Text>
        <Text style={styles.sectionHint}>
          Generate dates from a start date, horizon, and repeat mode.
        </Text>

        <View style={styles.inlineInputsRow}>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Start Date</Text>
            <Pressable style={styles.selectField} onPress={openStartDatePicker}>
              <Text style={styles.selectFieldText} numberOfLines={1}>
                {plannerStartDate}
              </Text>
              <Feather name="calendar" size={16} color="#6b7280" />
            </Pressable>
          </View>

          <View style={[styles.fieldWrap, styles.horizonWrap]}>
            <Text style={styles.fieldLabel}>Horizon</Text>
            <Pressable
              style={styles.selectField}
              onPress={() => setHorizonPickerOpen(true)}
            >
              <Text style={styles.selectFieldText} numberOfLines={1}>
                {horizonDays} {horizonDays === 1 ? "day" : "days"}
              </Text>
              <Feather name="chevron-down" size={16} color="#6b7280" />
            </Pressable>
          </View>
        </View>

        <View style={styles.innerPanel}>
          <AccordionHeader
            icon="repeat"
            title="Repeat Mode"
            subtitle={`${repeatMode.charAt(0).toUpperCase() + repeatMode.slice(1)} · ${generatedDates.length} generated`}
            open={repeatOpen}
            onToggle={() => setRepeatOpen((prev) => !prev)}
          />
          {repeatOpen ? (
            <View style={styles.accordionBody}>
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
          ) : null}

          <AccordionHeader
            icon="calendar"
            title="Generated Dates"
            subtitle={`${activeDates.length} active`}
            open={datesOpen}
            onToggle={() => setDatesOpen((prev) => !prev)}
            badge={
              excludedDates.length
                ? `${excludedDates.length} excluded`
                : undefined
            }
          />
          {datesOpen ? (
            <View style={styles.accordionBody}>
              <View style={styles.requirementHeaderRow}>
                <Text style={styles.sectionHint}>
                  Tap a date to exclude/include.
                </Text>
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
                      style={[
                        styles.token,
                        included ? styles.tokenActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tokenText,
                          included
                            ? styles.tokenTextActive
                            : styles.tokenTextMuted,
                        ]}
                      >
                        {new Date(`${date}T00:00:00`).toLocaleDateString()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.sectionCard, styles.requirementSectionCard]}>
        <View style={styles.requirementSectionHeader}>
          <View style={styles.requirementHeaderLeft}>
            <View style={styles.requirementHeaderIconWrap}>
              <Feather name="users" size={14} color="#7c3aed" />
            </View>
            <View>
              <Text style={styles.requirementSectionTitle}>
                Coverage Requirements
              </Text>
              <Text style={styles.requirementSectionSubtitle}>
                {requirements.length} template
                {requirements.length === 1 ? "" : "s"} applied across active
                dates
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.requirementAddBtn}
            onPress={handleAddRequirement}
          >
            <Feather name="plus" size={13} color="#7c3aed" />
            <Text style={styles.requirementAddBtnText}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.stack}>
          {requirements.map((req, index) => {
            const selectedSlot = getSelectedSlot(req);
            const shiftDefinitionValue = getShiftDefinitionValue(req);

            return (
              <View key={`req-${index}`} style={styles.requirementCard}>
                <View style={styles.requirementTopRow}>
                  <View style={styles.requirementTitleLeft}>
                    <View style={styles.requirementIndexBadge}>
                      <Text style={styles.requirementIndexBadgeText}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text style={styles.requirementTitle}>
                      Template {index + 1}
                    </Text>
                    {req.role ? (
                      <View style={styles.requirementRoleChip}>
                        <Text style={styles.requirementRoleChipText}>
                          {getRoleDisplayName(req.role)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => handleRemoveRequirement(index)}
                    disabled={requirements.length === 1}
                  >
                    <Feather name="trash-2" size={16} color="#dc2626" />
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>Role</Text>
                <Pressable
                  style={styles.selectField}
                  onPress={() =>
                    setPickerState({ requirementIndex: index, field: "role" })
                  }
                >
                  <Text style={styles.selectFieldText} numberOfLines={1}>
                    {req.role ? getRoleDisplayName(req.role) : "Select role"}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#6b7280" />
                </Pressable>

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
                  <View style={[styles.fieldWrap, styles.timeSlotWrap]}>
                    <Text style={styles.fieldLabel}>Time Slot</Text>
                    <Pressable
                      style={styles.selectField}
                      onPress={() =>
                        setPickerState({
                          requirementIndex: index,
                          field: "shiftDefinition",
                        })
                      }
                    >
                      <Text style={styles.selectFieldText} numberOfLines={1}>
                        {shiftDefinitionValue
                          ? shiftDefinitionOptions.find(
                              (option) => option.value === shiftDefinitionValue,
                            )?.label || "Manual Time Entry"
                          : "Manual Time Entry"}
                      </Text>
                      <Feather name="chevron-down" size={16} color="#6b7280" />
                    </Pressable>
                  </View>
                </View>

                {isOvernight(req.startTime, req.endTime) ? (
                  <Text style={styles.sectionHint}>
                    Overnight shift: this requirement ends the next day.
                  </Text>
                ) : null}

                <Text style={styles.fieldLabel}>Unit Area</Text>
                <Pressable
                  style={styles.selectField}
                  onPress={() =>
                    setPickerState({
                      requirementIndex: index,
                      field: "unitArea",
                    })
                  }
                >
                  <Text style={styles.selectFieldText} numberOfLines={1}>
                    {req.unitArea
                      ? getUnitAreaDisplayName(req.unitArea)
                      : "Any Area"}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#6b7280" />
                </Pressable>

                <Text style={styles.fieldLabel}>Required Certifications</Text>
                {certificationTags.length ? (
                  <View style={styles.rowWrap}>
                    {certificationTags.map((cert) => {
                      const active =
                        req.requiredCertificationTags.includes(cert);
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
                    })}
                  </View>
                ) : (
                  <View
                    style={[styles.selectField, styles.selectFieldDisabled]}
                  >
                    <Text
                      style={[
                        styles.selectFieldText,
                        styles.selectFieldTextDisabled,
                      ]}
                      numberOfLines={1}
                    >
                      No certifications configured
                    </Text>
                    <Feather name="chevron-down" size={16} color="#9ca3af" />
                  </View>
                )}

                <View style={styles.inlineInputsRow}>
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
              </View>
            );
          })}
        </View>
      </View>

      <View style={[styles.sectionCard, styles.summaryCard]}>
        <AccordionHeader
          icon="file-text"
          title="Plan Summary"
          subtitle={`${totalShiftBlocks} entries · ${totalRequestedStaff} staff positions · ${activeDates.length} dates`}
          open={summaryOpen}
          onToggle={() => setSummaryOpen((prev) => !prev)}
        />

        {summaryOpen ? (
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
                      {row.overnight ? " | Overnight" : ""}
                    </Text>
                    <Text style={styles.previewCount}>x{row.count}</Text>
                  </View>
                ))}
              </View>
            ))}
            {!previewByDate.length ? (
              <Text style={styles.sectionHint}>
                Add active dates and at least one requirement to preview the
                plan.
              </Text>
            ) : null}
          </View>
        ) : null}
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

      <PickerModal
        open={horizonPickerOpen}
        title="Select Horizon"
        value={String(horizonDays)}
        options={horizonOptions.map((value) => ({
          value: String(value),
          label: `${value} ${value === 1 ? "day" : "days"}`,
        }))}
        onClose={() => setHorizonPickerOpen(false)}
        onSelect={(value) => {
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed > 0) {
            setHorizonDays(parsed);
          }
          setHorizonPickerOpen(false);
        }}
      />

      <PickerModal
        open={pickerState !== null}
        title={pickerTitle}
        value={pickerValue}
        options={pickerOptions}
        onClose={() => setPickerState(null)}
        onSelect={(value) => {
          handlePickerSelect(value);
          setPickerState(null);
        }}
      />

      <Modal
        visible={startDatePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStartDatePickerOpen(false)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => setStartDatePickerOpen(false)}
        >
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Start Date</Text>
              <Pressable
                onPress={() => setStartDatePickerOpen(false)}
                style={styles.closeBtn}
              >
                <Feather name="x" size={18} color="#6b7280" />
              </Pressable>
            </View>

            <DateTimePicker
              value={startDatePickerValue}
              mode="date"
              display="spinner"
              onChange={(_, selectedDate) => {
                if (selectedDate) {
                  setStartDatePickerValue(selectedDate);
                }
              }}
            />

            <View style={styles.pickerActionRow}>
              <Pressable
                style={styles.pickerSecondaryBtn}
                onPress={() => setStartDatePickerOpen(false)}
              >
                <Text style={styles.pickerSecondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.pickerPrimaryBtn}
                onPress={applyStartDate}
              >
                <Text style={styles.pickerPrimaryBtnText}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function PickerModal({
  open,
  title,
  value,
  options,
  onClose,
  onSelect,
}: {
  open: boolean;
  title: string;
  value: string;
  options: { value: string; label: string }[];
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerCard} onPress={() => {}}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.pickerList}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={`${title}-${option.value || "empty"}`}
                  style={[
                    styles.pickerItem,
                    selected ? styles.pickerItemActive : null,
                  ]}
                  onPress={() => onSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      selected ? styles.pickerItemTextActive : null,
                    ]}
                  >
                    {option.label}
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
  title: { color: "#111827", fontSize: 18, fontWeight: "800" },
  subtitle: { color: "#6b7280", fontSize: 12, marginTop: 1 },
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
    padding: 8,
    gap: 6,
  },
  datePatternCard: {
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
  },
  summaryCard: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f8fffb",
  },
  requirementSectionCard: {
    borderColor: "#c4b5fd",
    backgroundColor: "#fcfbff",
    padding: 0,
    overflow: "hidden",
  },
  requirementSectionHeader: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#f5f3ff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e3ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  requirementHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  requirementHeaderIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: "#ede9fe",
    alignItems: "center",
    justifyContent: "center",
  },
  requirementSectionTitle: {
    color: "#4c1d95",
    fontSize: 12,
    fontWeight: "800",
  },
  requirementSectionSubtitle: {
    color: "#6b7280",
    fontSize: 10,
    marginTop: 1,
  },
  requirementAddBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c4b5fd",
    backgroundColor: "#ffffff",
    minHeight: 30,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  requirementAddBtnText: {
    color: "#7c3aed",
    fontSize: 11,
    fontWeight: "700",
  },
  innerPanel: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  accordionHeader: {
    minHeight: 46,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
  },
  accordionHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accordionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  accordionTitleWrap: {
    flex: 1,
  },
  accordionTitle: {
    color: "#1e293b",
    fontSize: 12,
    fontWeight: "800",
  },
  accordionSubtitle: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 1,
  },
  accordionBadge: {
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  accordionBadgeText: {
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: "800",
  },
  accordionBody: {
    padding: 8,
    gap: 6,
  },
  sectionTitle: { color: "#111827", fontSize: 13, fontWeight: "700" },
  sectionHint: { color: "#6b7280", fontSize: 11 },
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
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  inlineInputsRow: { flexDirection: "row", gap: 8 },
  fieldWrap: { flex: 1, gap: 4 },
  countWrap: { maxWidth: 90 },
  timeSlotWrap: { flex: 2 },
  horizonWrap: { flex: 1.3 },
  fieldLabel: { color: "#374151", fontSize: 11, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#111827",
    fontSize: 12,
  },
  inputDisabled: { backgroundColor: "#eef2f7", color: "#64748b" },
  selectField: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectFieldDisabled: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
  },
  selectFieldText: {
    flex: 1,
    color: "#111827",
    fontSize: 12,
  },
  selectFieldTextDisabled: {
    color: "#9ca3af",
  },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  token: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tokenActive: { borderColor: "#1d4ed8", backgroundColor: "#dbeafe" },
  tokenText: { color: "#374151", fontSize: 11, fontWeight: "600" },
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
  requirementTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  requirementIndexBadge: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: "#ede9fe",
    alignItems: "center",
    justifyContent: "center",
  },
  requirementIndexBadgeText: {
    color: "#7c3aed",
    fontSize: 10,
    fontWeight: "800",
  },
  requirementTitle: { color: "#4c1d95", fontSize: 12, fontWeight: "700" },
  requirementRoleChip: {
    borderRadius: 999,
    backgroundColor: "#ede9fe",
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  requirementRoleChipText: {
    color: "#7c3aed",
    fontSize: 10,
    fontWeight: "700",
  },
  previewWrap: { gap: 8 },
  previewDayCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 8,
    gap: 6,
  },
  previewDayLabel: { color: "#111827", fontSize: 11, fontWeight: "700" },
  previewRow: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 6,
    gap: 2,
  },
  previewRole: { color: "#1f2937", fontSize: 11, fontWeight: "700" },
  previewMeta: { color: "#64748b", fontSize: 10 },
  previewCount: { color: "#0f172a", fontSize: 11, fontWeight: "700" },
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
  },
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
  pickerActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  pickerPrimaryBtn: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  pickerPrimaryBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  pickerSecondaryBtn: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  pickerSecondaryBtnText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
});
