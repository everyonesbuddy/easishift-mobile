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
  View,
} from "react-native";

import api from "@/config/api";

type PreferencesData = {
  preferredDaysOfWeek?: number[];
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const defaultPrefs: PreferencesData = {
  preferredDaysOfWeek: [],
  emailNotificationsEnabled: true,
  smsNotificationsEnabled: true,
};

function sanitizePrefs(value: unknown): PreferencesData {
  if (typeof value !== "object" || value === null) {
    return { ...defaultPrefs };
  }

  const source = value as PreferencesData;

  return {
    preferredDaysOfWeek: Array.isArray(source.preferredDaysOfWeek)
      ? source.preferredDaysOfWeek
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6)
      : [],
    emailNotificationsEnabled:
      typeof source.emailNotificationsEnabled === "boolean"
        ? source.emailNotificationsEnabled
        : true,
    smsNotificationsEnabled:
      typeof source.smsNotificationsEnabled === "boolean"
        ? source.smsNotificationsEnabled
        : true,
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

  const handleChange = <K extends keyof PreferencesData>(
    field: K,
    value: PreferencesData[K],
  ) => {
    setPrefs((prev) => ({ ...prev, [field]: value }));
  };

  const togglePreferredDay = (dayIndex: number) => {
    const arr = Array.isArray(prefs.preferredDaysOfWeek)
      ? [...prefs.preferredDaysOfWeek]
      : [];
    const idx = arr.indexOf(dayIndex);

    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(dayIndex);
      arr.sort((a, b) => a - b);
    }

    handleChange("preferredDaysOfWeek", arr);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload: PreferencesData = {
        preferredDaysOfWeek: Array.isArray(prefs.preferredDaysOfWeek)
          ? prefs.preferredDaysOfWeek
          : [],
        emailNotificationsEnabled: prefs.emailNotificationsEnabled ?? true,
        smsNotificationsEnabled: prefs.smsNotificationsEnabled ?? true,
      };

      await api.post("/preferences/me", payload);
      setSuccess("Preferences saved");
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
          <ActivityIndicator size="large" color="#2563eb" />
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
                These settings control notifications and preferred work days.
              </Text>
              <Text style={styles.infoText}>
                Facility rules are configured by admins in Facility Preferences.
              </Text>
            </View>
          </View>
        </View>

        <SectionCard
          title="Preferred Days"
          description="Select the days you prefer to work"
        >
          <View style={styles.daysGrid}>
            {DAYS.map((day, index) => {
              const isPreferred = preferredSet.has(index);

              return (
                <Pressable
                  key={day}
                  style={[
                    styles.dayPill,
                    isPreferred ? styles.dayPillPreferred : null,
                  ]}
                  onPress={() => togglePreferredDay(index)}
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

        <SectionCard title="Notification Preferences">
          <SwitchRow
            title="Email Notifications"
            description="Receive email alerts for important updates"
            value={prefs.emailNotificationsEnabled ?? true}
            onValueChange={(value) =>
              handleChange("emailNotificationsEnabled", value)
            }
          />

          <SwitchRow
            title="SMS Notifications"
            description="Receive text alerts for important updates"
            value={prefs.smsNotificationsEnabled ?? true}
            onValueChange={(value) =>
              handleChange("smsNotificationsEnabled", value)
            }
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
    flexBasis: "13.5%",
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
  dayPillText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  dayPillTextPreferred: {
    color: "#166534",
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
