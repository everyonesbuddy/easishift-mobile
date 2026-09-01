import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
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

import GuideHelpButton from "@/components/shared/guide-help-button";
import GuideTourOverlay from "@/components/shared/guide-tour-overlay";
import api from "@/config/api";
import {
  getRoleDisplayName,
  getRoleOptionsForIndustry,
  getRoleOptionsFromFacilityPreferences,
  getUnitAreaDisplayName,
} from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";
import { useGuideTour } from "@/context/guide-tour-context";

const COVERAGE_FORM_TOUR_STEPS = [
  {
    target: "coverage-form-date-pattern",
    title: "Choose your date pattern",
    body: "Set a start date, planning horizon, and repeat pattern. Every active date receives the requirements below.",
  },
  {
    target: "coverage-form-requirements",
    title: "Define staffing requirements",
    body: "Add the role, count, time slot, unit area, and certifications needed for each coverage template.",
  },
  {
    target: "coverage-form-submit",
    title: "Save or generate a draft",
    body: "Save requirements when you will schedule manually, or generate a draft schedule from available qualified staff.",
  },
];

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
  facilityTimezone?: string;
  facilityTimezoneConfirmed?: boolean;
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

const REPEAT_MODE_FROM_API: Record<string, string> = {
  daily: "everyday",
  weekdays: "weekdays",
  weekends: "weekends",
  custom: "custom",
};

const COVERAGE_COPY_PATTERN =
  /(?:copy|repeat|reuse|duplicate)\s+(?:coverage|staffing|shifts?)\s+from\s+/i;

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
  const [year, month, day] = String(dateKey || "")
    .split("-")
    .map(Number);
  const [hour, minute] = String(timeValue || "")
    .split(":")
    .map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return new Date(`${dateKey}T${timeValue}:00`).toISOString();
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function isOvernight(startTime: string, endTime: string) {
  return !!startTime && !!endTime && endTime <= startTime;
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

  if (isOvernight(startTime, endTime)) {
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

function formatNlUnresolvedItem(item: unknown) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return "Unknown issue";

  const value = item as { path?: unknown; message?: unknown };
  const path = String(value.path || "").trim();
  const message = String(value.message || "").trim();
  return path && message
    ? `${path}: ${message}`
    : message || path || "Unknown issue";
}

export default function CoverageCreateForm({
  tenantId,
  onSuccess,
  onClose,
}: Props) {
  const { tenant, can } = useAuth();
  const router = useRouter();
  const { startTourIfUnseen } = useGuideTour();
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
  const [submitMode, setSubmitMode] = useState<"save-only" | "generate">(
    "generate",
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [nlMessage, setNlMessage] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState("");
  const [nlUnresolved, setNlUnresolved] = useState<string[]>([]);
  const [horizonPickerOpen, setHorizonPickerOpen] = useState(false);
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [startDatePickerValue, setStartDatePickerValue] = useState(new Date());
  const [pickerState, setPickerState] = useState<{
    requirementIndex: number;
    field: "role" | "unitArea" | "shiftDefinition";
  } | null>(null);

  const canTrustFacilityTimezone = Boolean(
    facilityPreferences?.facilityTimezoneConfirmed,
  );

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

  useEffect(() => {
    void startTourIfUnseen("coverage-create-form", COVERAGE_FORM_TOUR_STEPS);
  }, [startTourIfUnseen]);

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
  const canUseNlParser = can("coverage.manage");

  const unitAreas = useMemo(
    () => normalizeStringArray(facilityPreferences?.unitAreas),
    [facilityPreferences?.unitAreas],
  );
  const certificationTags = useMemo(
    () => normalizeStringArray(facilityPreferences?.certificationTags),
    [facilityPreferences?.certificationTags],
  );
  const nlSuggestions = useMemo(() => {
    const sampleRole = roleOptions[0]?.label || "staff";
    const sampleUnit = unitAreas[0]
      ? ` for ${getUnitAreaDisplayName(unitAreas[0])}`
      : "";
    const slots = shiftTypeDefinitions.flatMap((definition) =>
      definition.timeSlots.map((slot) => ({
        ...slot,
        shiftType: definition.key,
      })),
    );
    const firstSlot = slots[0];

    return [
      firstSlot
        ? `Need 1 ${sampleRole}${sampleUnit}, ${to12HourTime(firstSlot.startLocalTime)} to ${to12HourTime(firstSlot.endLocalTime)}, weekdays for the next 2 weeks`
        : null,
      `Need 1 ${sampleRole}`,
      "Copy coverage from last week to this week",
    ].filter((suggestion): suggestion is string => Boolean(suggestion));
  }, [roleOptions, shiftTypeDefinitions, unitAreas]);

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
      rows: requirements.map((req, index) => {
        const selectedSlot = getSelectedSlot(req);
        const startTime = selectedSlot?.startLocalTime || req.startTime;
        const endTime = selectedSlot?.endLocalTime || req.endTime;

        return {
          id: `${dateValue}-${index}`,
          role: req.role ? getRoleDisplayName(req.role) : "-",
          timeLabel: formatShiftPreview(dateValue, startTime, endTime),
          unitArea: req.unitArea || "",
          shiftType: req.shiftType || "",
          shiftTag: req.shiftTag || "",
          count: Number(req.requiredCount) || 0,
          overnight: isOvernight(startTime, endTime),
        };
      }),
    }));
  }, [activeDates, requirements, slotLookup]);

  const getShiftSlotsForType = (shiftType: string) => {
    const key = normalizeToken(shiftType);
    if (!key) {
      return [] as {
        tag: string;
        label: string;
        startLocalTime: string;
        endLocalTime: string;
      }[];
    }

    const matched = shiftTypeDefinitions.find(
      (definition) => definition.key === key,
    );
    return matched?.timeSlots || [];
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

  const applyNlDraft = (draft: unknown) => {
    const data = (draft || {}) as {
      datePattern?: {
        startDate?: string;
        horizonDays?: number;
        repeatMode?: string;
        customWeekdays?: number[];
      };
      shifts?: Partial<Requirement>[];
      unresolved?: unknown[];
    };
    const datePattern = data.datePattern || {};
    const mappedMode =
      REPEAT_MODE_FROM_API[datePattern.repeatMode || ""] || "weekdays";

    if (datePattern.startDate) setPlannerStartDate(datePattern.startDate);
    if (
      Number.isFinite(Number(datePattern.horizonDays)) &&
      Number(datePattern.horizonDays) > 0
    ) {
      setHorizonDays(Number(datePattern.horizonDays));
    }
    setRepeatMode(mappedMode);
    setSelectedWeekdays(
      mappedMode === "custom" && Array.isArray(datePattern.customWeekdays)
        ? datePattern.customWeekdays
        : mappedMode === "weekends"
          ? [0, 6]
          : mappedMode === "everyday"
            ? [0, 1, 2, 3, 4, 5, 6]
            : [1, 2, 3, 4, 5],
    );

    if (Array.isArray(data.shifts) && data.shifts.length) {
      setRequirements(
        data.shifts.map((shift) => ({
          role: normalizeToken(shift.role),
          requiredCount: Number(shift.requiredCount) || 1,
          startTime: String(shift.startTime || defaultRequirement.startTime),
          endTime: String(shift.endTime || defaultRequirement.endTime),
          unitArea: normalizeToken(shift.unitArea),
          shiftType: normalizeToken(shift.shiftType),
          shiftTag: normalizeToken(shift.shiftTag),
          requiredCertificationTags: normalizeStringArray(
            shift.requiredCertificationTags,
          ),
        })),
      );
    }

    setNlUnresolved(
      Array.isArray(data.unresolved)
        ? data.unresolved.map(formatNlUnresolvedItem).filter(Boolean)
        : [],
    );
  };

  const handleNlParse = async () => {
    const message = nlMessage.trim();
    if (!message) {
      setNlError("Describe the coverage you need first.");
      return;
    }

    setNlLoading(true);
    setNlError("");
    setNlUnresolved([]);
    try {
      const basePayload = {
        formType: "coverage",
        message,
        currentFormState: {
          plannerStartDate,
          horizonDays,
          repeatMode,
          selectedWeekdays,
          requirements,
        },
      };
      const coverageHistory = COVERAGE_COPY_PATTERN.test(message)
        ? await api
            .get("/coverage")
            .then((response) =>
              Array.isArray(response.data) ? response.data : [],
            )
            .catch(() => [])
        : [];
      const response = await api.post(
        "/nl/parse",
        coverageHistory.length
          ? { ...basePayload, coverageHistory }
          : basePayload,
      );

      if (!response.data?.draft) {
        throw new Error("No draft returned.");
      }
      applyNlDraft(response.data.draft);
      setSuccess(
        "Form filled from your description. Review before submitting.",
      );
    } catch (requestError: unknown) {
      const data =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError
          ? (
              requestError as {
                response?: {
                  data?: {
                    message?: string;
                    gaps?: unknown[];
                    errors?: unknown[];
                  };
                };
              }
            ).response?.data
          : undefined;
      setNlError(data?.message || "Couldn't understand that. Try rephrasing.");
      setNlUnresolved(
        [...(data?.gaps || []), ...(data?.errors || [])]
          .map(formatNlUnresolvedItem)
          .filter(Boolean),
      );
    } finally {
      setNlLoading(false);
    }
  };

  const handleSubmit = async (modeOverride?: "save-only" | "generate") => {
    setError("");
    setSuccess("");

    const mode = modeOverride || submitMode;
    const shouldGenerateDraft = mode !== "save-only";

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

    setLoading(true);
    setLoadingMode(shouldGenerateDraft ? "ai" : "create");

    try {
      const createdCoverages: Array<{ _id?: string }> = [];
      const allRequirementsUseSlots = requirements.every((requirement) =>
        Boolean(getSelectedSlot(requirement)),
      );
      const createResponses =
        canTrustFacilityTimezone && allRequirementsUseSlots
          ? [
              await api.post("/coverage", {
                tenantId,
                dates: activeDates,
                shifts: requirements.map((requirement) => ({
                  role: requirement.role,
                  requiredCount: Number(requirement.requiredCount) || 0,
                  unitArea: requirement.unitArea || null,
                  shiftType: requirement.shiftType || null,
                  shiftTag: requirement.shiftTag || null,
                  requiredCertificationTags: dedupeStrings(
                    requirement.requiredCertificationTags,
                  ),
                  note,
                })),
              }),
            ]
          : await Promise.all(
              activeDates.map((dateValue) => {
                const shifts = requirements.map((req) => {
                  const selectedSlot = getSelectedSlot(req);
                  const startTime =
                    selectedSlot?.startLocalTime || req.startTime;
                  const endTime = selectedSlot?.endLocalTime || req.endTime;
                  const overnight = isOvernight(startTime, endTime);
                  let endDate = dateValue;

                  if (overnight) {
                    const nextDay = new Date(`${dateValue}T00:00:00`);
                    nextDay.setDate(nextDay.getDate() + 1);
                    endDate = toDayKey(nextDay);
                  }

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

      createResponses.forEach((response) => {
        const createdForDate = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.created)
            ? response.data.created
            : [];

        createdCoverages.push(...createdForDate);
      });

      let draftWasGenerated = false;

      if (shouldGenerateDraft && createdCoverages.length) {
        try {
          await api.post("/schedules/auto-generate", {
            coverageIds: createdCoverages
              .map((item) => item._id)
              .filter(Boolean),
          });
          draftWasGenerated = true;
        } catch {
          draftWasGenerated = false;
        }
      }

      setSuccess(
        shouldGenerateDraft
          ? draftWasGenerated
            ? "Coverage created and AI draft is ready. Review, adjust, and publish from Draft Schedule Board."
            : "Coverage created successfully."
          : "Coverage requirements saved successfully.",
      );
      setRequirements([{ ...defaultRequirement }]);
      setPlannerStartDate(toDayKey(new Date()));
      setHorizonDays(14);
      setRepeatMode("weekdays");
      setSelectedWeekdays([1, 2, 3, 4, 5]);
      setExcludedDates([]);
      setNote("");
      onSuccess?.();

      if (draftWasGenerated) {
        router.push(
          "/schedule?draftReview=1" as Parameters<typeof router.push>[0],
        );
      } else if (!shouldGenerateDraft) {
        router.push("/schedule" as Parameters<typeof router.push>[0]);
      }
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

    return shiftDefinitionOptions.map((option) => ({
      value: option.value,
      label: option.label,
    }));
  }, [pickerState, roleOptions, shiftDefinitionOptions, unitAreas]);

  const shiftDefinitionHelperText =
    shiftDefinitionOptions.length === 0
      ? "No time slots are configured yet. Add one in Facility Preferences."
      : "Type to search this select. Only an existing slot can be chosen; if it is not listed, add it in Facility Preferences.";

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
      <GuideHelpButton
        tourId="coverage-create-form"
        tourSteps={COVERAGE_FORM_TOUR_STEPS}
      />
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Coverage Planner</Text>
          <Text style={styles.subtitle}>
            Define your date pattern and requirements. When you create coverage,
            AI automatically builds the best draft it can from available,
            qualified staff.
          </Text>
          <Text style={styles.subtleNote}>
            If a draft is partially filled, there may not be enough available
            staff who meet role, certification, shift, unit, or policy
            constraints.
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

      {canUseNlParser ? (
        <View style={styles.aiCard}>
          <AccordionHeader
            icon="zap"
            title="Describe with AI"
            subtitle="Describe the coverage you need and review the prefilled plan."
            open={aiOpen}
            onToggle={() => setAiOpen((value) => !value)}
          />
          {aiOpen ? (
            <View style={styles.accordionBody}>
              <TextInput
                value={nlMessage}
                onChangeText={(value) => {
                  setNlMessage(value);
                  setNlError("");
                }}
                placeholder="e.g. 3 RNs every weekday night next month"
                placeholderTextColor="#9ca3af"
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.nlInput]}
              />
              <View style={styles.rowWrap}>
                {nlSuggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => setNlMessage(suggestion)}
                    style={styles.nlSuggestion}
                  >
                    <Text style={styles.nlSuggestionText}>{suggestion}</Text>
                  </Pressable>
                ))}
              </View>
              {nlError ? (
                <Text style={styles.fieldError}>{nlError}</Text>
              ) : null}
              {nlUnresolved.length ? (
                <View style={styles.nlWarning}>
                  <Text style={styles.nlWarningTitle}>
                    Double-check these details:
                  </Text>
                  {nlUnresolved.map((item) => (
                    <Text key={item} style={styles.nlWarningText}>
                      • {item}
                    </Text>
                  ))}
                </View>
              ) : null}
              <Pressable
                style={[
                  styles.aiActionBtn,
                  nlLoading ? styles.disabledButton : null,
                ]}
                onPress={() => void handleNlParse()}
                disabled={nlLoading || !nlMessage.trim()}
              >
                {nlLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Feather name="zap" size={15} color="#ffffff" />
                )}
                <Text style={styles.aiActionBtnText}>
                  {nlLoading ? "Filling form..." : "Fill Form with AI"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

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
            subtitle={`${activeDates.length} active${excludedDates.length ? ` · ${excludedDates.length} excluded` : ""}`}
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
                      style={[
                        styles.selectField,
                        shiftDefinitionOptions.length === 0
                          ? styles.selectFieldDisabled
                          : null,
                      ]}
                      onPress={() =>
                        shiftDefinitionOptions.length > 0
                          ? setPickerState({
                              requirementIndex: index,
                              field: "shiftDefinition",
                            })
                          : null
                      }
                      disabled={shiftDefinitionOptions.length === 0}
                    >
                      <Text
                        style={[
                          styles.selectFieldText,
                          !shiftDefinitionValue
                            ? styles.selectFieldTextMuted
                            : null,
                          shiftDefinitionOptions.length === 0
                            ? styles.selectFieldTextDisabled
                            : null,
                        ]}
                        numberOfLines={1}
                      >
                        {shiftDefinitionValue
                          ? shiftDefinitionOptions.find(
                              (option) => option.value === shiftDefinitionValue,
                            )?.label || "Select time slot"
                          : "Select time slot"}
                      </Text>
                      <Feather name="chevron-down" size={16} color="#6b7280" />
                    </Pressable>
                    <Text style={styles.fieldHelperText}>
                      {shiftDefinitionHelperText}
                    </Text>
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

      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Notes (Optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Any additional notes about these coverage requirements..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={[styles.input, styles.notesInput]}
        />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtn, styles.secondaryBtn]}
          onPress={() => {
            setSubmitMode("save-only");
            void handleSubmit("save-only");
          }}
          disabled={loading}
        >
          {loading && loadingMode === "create" ? (
            <ActivityIndicator size="small" color="#1e3a8a" />
          ) : (
            <Text style={styles.secondaryBtnText}>Save Requirement Only</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.primaryBtn]}
          onPress={() => {
            setSubmitMode("generate");
            void handleSubmit("generate");
          }}
          disabled={loading}
        >
          {loading && loadingMode === "ai" ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              Save Requirements and Generate Draft Schedule
            </Text>
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
        searchable={pickerState?.field === "shiftDefinition"}
        searchPlaceholder="Search time slots"
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
      <GuideTourOverlay />
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
  searchable = false,
  searchPlaceholder = "Search...",
}: {
  open: boolean;
  title: string;
  value: string;
  options: { value: string; label: string }[];
  onClose: () => void;
  onSelect: (value: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeToken(query);
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      normalizeToken(option.label).includes(normalizedQuery),
    );
  }, [options, query]);

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

          {searchable ? (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
            />
          ) : null}

          <ScrollView contentContainerStyle={styles.pickerList}>
            {filteredOptions.map((option) => {
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
            {filteredOptions.length === 0 ? (
              <Text style={styles.emptyInline}>No matching options.</Text>
            ) : null}
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
  subtleNote: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
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
  aiCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fcd34d",
    backgroundColor: "#fffbeb",
    overflow: "hidden",
  },
  nlInput: {
    minHeight: 76,
    paddingTop: 9,
  },
  nlSuggestion: {
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  nlSuggestionText: {
    color: "#92400e",
    fontSize: 11,
    fontWeight: "600",
  },
  fieldError: {
    color: "#b91c1c",
    fontSize: 12,
  },
  nlWarning: {
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 8,
    backgroundColor: "#fff7ed",
    padding: 9,
    gap: 3,
  },
  nlWarningTitle: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: "800",
  },
  nlWarningText: {
    color: "#78350f",
    fontSize: 11,
    lineHeight: 16,
  },
  aiActionBtn: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: "#d97706",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  aiActionBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.6,
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
  notesInput: {
    minHeight: 74,
    paddingTop: 8,
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
  selectFieldTextMuted: {
    color: "#6b7280",
  },
  selectFieldTextDisabled: {
    color: "#9ca3af",
  },
  fieldHelperText: {
    color: "#6b7280",
    fontSize: 10,
    lineHeight: 14,
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
    paddingHorizontal: 12,
  },
  primaryBtn: { backgroundColor: "#2563eb" },
  secondaryBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  darkBtn: { backgroundColor: "#111827" },
  primaryBtnText: { color: "#ffffff", fontWeight: "700" },
  secondaryBtnText: { color: "#1e3a8a", fontWeight: "700" },
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
  searchInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    color: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
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
  emptyInline: {
    color: "#6b7280",
    fontSize: 12,
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
