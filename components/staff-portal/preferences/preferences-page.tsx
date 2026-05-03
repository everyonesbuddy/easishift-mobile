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

import api from "@/config/api";

type PreferencesData = {
  preferredDaysOfWeek?: number[];
  unavailableDaysOfWeek?: number[];
  preferredShiftStart?: string;
  preferredShiftEnd?: string;
  minHoursPerWeek?: number;
  maxHoursPerWeek?: number;
  dislikesNights?: boolean;
  prefersBlockScheduling?: boolean;
  scheduleEmailNotificationsEnabled?: boolean;
  scheduleSmsNotificationsEnabled?: boolean;
  timeOffEmailNotificationsEnabled?: boolean;
  timeOffSmsNotificationsEnabled?: boolean;
  notes?: string;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const defaultPrefs: PreferencesData = {
  preferredDaysOfWeek: [],
  unavailableDaysOfWeek: [],
  preferredShiftStart: "08:00",
  preferredShiftEnd: "17:00",
  minHoursPerWeek: 0,
  maxHoursPerWeek: 0,
  dislikesNights: false,
  prefersBlockScheduling: false,
  scheduleEmailNotificationsEnabled: true,
  scheduleSmsNotificationsEnabled: true,
  timeOffEmailNotificationsEnabled: true,
  timeOffSmsNotificationsEnabled: true,
  notes: "",
};

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);
}

function sanitizePrefs(value: unknown): PreferencesData {
  if (typeof value !== "object" || value === null) {
    return { ...defaultPrefs };
  }

  const source = value as PreferencesData;

  return {
    preferredDaysOfWeek: toNumberArray(source.preferredDaysOfWeek),
    unavailableDaysOfWeek: toNumberArray(source.unavailableDaysOfWeek),
    preferredShiftStart:
      typeof source.preferredShiftStart === "string"
        ? source.preferredShiftStart
        : defaultPrefs.preferredShiftStart,
    preferredShiftEnd:
      typeof source.preferredShiftEnd === "string"
        ? source.preferredShiftEnd
        : defaultPrefs.preferredShiftEnd,
    minHoursPerWeek:
      typeof source.minHoursPerWeek === "number" ? source.minHoursPerWeek : 0,
    maxHoursPerWeek:
      typeof source.maxHoursPerWeek === "number" ? source.maxHoursPerWeek : 0,
    dislikesNights:
      typeof source.dislikesNights === "boolean"
        ? source.dislikesNights
        : false,
    prefersBlockScheduling:
      typeof source.prefersBlockScheduling === "boolean"
        ? source.prefersBlockScheduling
        : false,
    scheduleEmailNotificationsEnabled:
      typeof source.scheduleEmailNotificationsEnabled === "boolean"
        ? source.scheduleEmailNotificationsEnabled
        : true,
    scheduleSmsNotificationsEnabled:
      typeof source.scheduleSmsNotificationsEnabled === "boolean"
        ? source.scheduleSmsNotificationsEnabled
        : true,
    timeOffEmailNotificationsEnabled:
      typeof source.timeOffEmailNotificationsEnabled === "boolean"
        ? source.timeOffEmailNotificationsEnabled
        : true,
    timeOffSmsNotificationsEnabled:
      typeof source.timeOffSmsNotificationsEnabled === "boolean"
        ? source.timeOffSmsNotificationsEnabled
        : true,
    notes: typeof source.notes === "string" ? source.notes : "",
  };
}

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<PreferencesData>({ ...defaultPrefs });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function fetchPrefs() {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/preferences/me");
        setPrefs(sanitizePrefs(res.data));
      } catch (requestError) {
        console.warn("Failed to load preferences", requestError);
        setError("Failed to load preferences");
      } finally {
        setLoading(false);
      }
    }

    fetchPrefs();
  }, []);

  const preferredSet = useMemo(
    () => new Set<number>(prefs.preferredDaysOfWeek || []),
    [prefs.preferredDaysOfWeek],
  );

  const unavailableSet = useMemo(
    () => new Set<number>(prefs.unavailableDaysOfWeek || []),
    [prefs.unavailableDaysOfWeek],
  );

  const handleChange = <K extends keyof PreferencesData>(
    field: K,
    value: PreferencesData[K],
  ) => {
    setPrefs((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (
    field: "preferredDaysOfWeek" | "unavailableDaysOfWeek",
    value: number,
  ) => {
    const arr = Array.isArray(prefs[field]) ? [...(prefs[field] || [])] : [];
    const idx = arr.indexOf(value);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(value);
      arr.sort((a, b) => a - b);
    }
    handleChange(field, arr);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await api.post("/preferences/me", prefs);
      setSuccess("Preferences saved.");
    } catch (requestError) {
      console.warn("Failed to save preferences", requestError);
      setError("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerWrap}>
          <Text style={styles.title}>My Preferences</Text>
          <Text style={styles.subtitle}>
            Set your availability and work style preferences
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Feather name="info" size={18} color="#1d4ed8" />
            <View style={styles.infoBody}>
              <Text style={styles.infoText}>
                These preferences help administrators and AI systems create
                schedules that work better for you.
              </Text>
              <Text style={styles.infoText}>
                They are soft constraints and cannot guarantee specific
                assignments, but they are considered when schedules are built.
              </Text>
            </View>
          </View>
        </View>

        <SectionCard
          title="Preferred Days"
          description="Select the days you prefer to work"
        >
          <View style={styles.daysGrid}>
            {DAYS.map((day, i) => {
              const isPreferred = preferredSet.has(i);
              const isUnavailable = unavailableSet.has(i);

              return (
                <Pressable
                  key={day}
                  style={[
                    styles.dayPill,
                    isPreferred ? styles.dayPillPreferred : null,
                    isUnavailable ? styles.dayPillDisabled : null,
                  ]}
                  onPress={() => {
                    if (!isUnavailable) {
                      toggleArrayItem("preferredDaysOfWeek", i);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.dayPillText,
                      isPreferred ? styles.dayPillTextPreferred : null,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        <SectionCard
          title="Unavailable Days"
          description="Select days when you cannot work"
        >
          <View style={styles.daysGrid}>
            {DAYS.map((day, i) => {
              const isPreferred = preferredSet.has(i);
              const isUnavailable = unavailableSet.has(i);

              return (
                <Pressable
                  key={day}
                  style={[
                    styles.dayPill,
                    isUnavailable ? styles.dayPillUnavailable : null,
                    isPreferred ? styles.dayPillDisabled : null,
                  ]}
                  onPress={() => {
                    if (!isPreferred) {
                      toggleArrayItem("unavailableDaysOfWeek", i);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.dayPillText,
                      isUnavailable ? styles.dayPillTextUnavailable : null,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        <SectionCard title="Preferred Shift Times">
          <View style={styles.twoColGrid}>
            <Field label="Preferred Start Time">
              <TextInput
                value={prefs.preferredShiftStart || "08:00"}
                onChangeText={(value) =>
                  handleChange("preferredShiftStart", value)
                }
                style={styles.input}
                placeholder="08:00"
              />
            </Field>
            <Field label="Preferred End Time">
              <TextInput
                value={prefs.preferredShiftEnd || "17:00"}
                onChangeText={(value) =>
                  handleChange("preferredShiftEnd", value)
                }
                style={styles.input}
                placeholder="17:00"
              />
            </Field>
          </View>
        </SectionCard>

        <SectionCard title="Weekly Hours">
          <View style={styles.twoColGrid}>
            <Field label="Minimum Hours per Week">
              <TextInput
                value={String(prefs.minHoursPerWeek || 0)}
                onChangeText={(value) =>
                  handleChange("minHoursPerWeek", parseInt(value, 10) || 0)
                }
                style={styles.input}
                keyboardType="numeric"
              />
            </Field>
            <Field label="Maximum Hours per Week">
              <TextInput
                value={String(prefs.maxHoursPerWeek || 0)}
                onChangeText={(value) =>
                  handleChange("maxHoursPerWeek", parseInt(value, 10) || 0)
                }
                style={styles.input}
                keyboardType="numeric"
              />
            </Field>
          </View>
        </SectionCard>

        <SectionCard title="Work Style Preferences">
          <SwitchRow
            title="Night Shift Preference"
            description="I prefer working night shifts"
            value={Boolean(prefs.dislikesNights)}
            onValueChange={(value) => handleChange("dislikesNights", value)}
          />

          <SwitchRow
            title="Block Scheduling"
            description="I prefer working consecutive days in a row"
            value={Boolean(prefs.prefersBlockScheduling)}
            onValueChange={(value) =>
              handleChange("prefersBlockScheduling", value)
            }
          />
        </SectionCard>

        <SectionCard title="Notification Preferences">
          <SwitchRow
            title="Schedule Email Notifications"
            description="Receive email alerts for schedule updates"
            value={prefs.scheduleEmailNotificationsEnabled ?? true}
            onValueChange={(value) =>
              handleChange("scheduleEmailNotificationsEnabled", value)
            }
          />

          <SwitchRow
            title="Schedule SMS Notifications"
            description="Receive text alerts for schedule updates"
            value={prefs.scheduleSmsNotificationsEnabled ?? true}
            onValueChange={(value) =>
              handleChange("scheduleSmsNotificationsEnabled", value)
            }
          />

          <SwitchRow
            title="Time-Off Email Notifications"
            description="Receive email alerts for time-off decisions"
            value={prefs.timeOffEmailNotificationsEnabled ?? true}
            onValueChange={(value) =>
              handleChange("timeOffEmailNotificationsEnabled", value)
            }
          />

          <SwitchRow
            title="Time-Off SMS Notifications"
            description="Receive text alerts for time-off decisions"
            value={prefs.timeOffSmsNotificationsEnabled ?? true}
            onValueChange={(value) =>
              handleChange("timeOffSmsNotificationsEnabled", value)
            }
          />
        </SectionCard>

        <SectionCard title="Additional Notes">
          <TextInput
            value={prefs.notes || ""}
            onChangeText={(value) => handleChange("notes", value)}
            style={styles.notesInput}
            multiline
            textAlignVertical="top"
            placeholder="Add any additional scheduling preferences or constraints..."
          />
        </SectionCard>

        <Pressable
          style={[styles.saveBtn, saving ? styles.saveBtnDisabled : null]}
          onPress={handleSave}
          disabled={saving}
        >
          <Feather name="save" size={16} color="#ffffff" />
          <Text style={styles.saveBtnText}>
            {saving ? "Saving..." : "Save Preferences"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? (
        <Text style={styles.sectionDescription}>{description}</Text>
      ) : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function SwitchRow({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchBody}>
        <Text style={styles.switchTitle}>{title}</Text>
        <Text style={styles.switchDescription}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
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
    paddingBottom: 20,
    gap: 12,
  },
  headerWrap: {
    gap: 2,
  },
  title: {
    color: "#111827",
    fontSize: 22,
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
    fontSize: 13,
  },
  success: {
    color: "#065f46",
    backgroundColor: "#d1fae5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  infoCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    padding: 12,
  },
  infoRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  infoBody: {
    flex: 1,
    gap: 6,
  },
  infoText: {
    color: "#1e40af",
    fontSize: 12,
    lineHeight: 18,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionDescription: {
    color: "#6b7280",
    fontSize: 12,
  },
  sectionBody: {
    gap: 10,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayPill: {
    minWidth: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPillPreferred: {
    backgroundColor: "#ecfdf5",
    borderColor: "#16a34a",
    borderWidth: 2,
  },
  dayPillUnavailable: {
    backgroundColor: "#fff1f2",
    borderColor: "#dc2626",
    borderWidth: 2,
  },
  dayPillDisabled: {
    opacity: 0.55,
  },
  dayPillText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  dayPillTextPreferred: {
    color: "#166534",
  },
  dayPillTextUnavailable: {
    color: "#b91c1c",
  },
  twoColGrid: {
    gap: 10,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    color: "#111827",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  switchBody: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  switchDescription: {
    color: "#6b7280",
    fontSize: 12,
  },
  notesInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#111827",
  },
  saveBtn: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
