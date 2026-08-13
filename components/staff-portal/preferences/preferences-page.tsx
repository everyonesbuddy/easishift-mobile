import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

import ConfirmDialog from "@/components/shared/confirm-dialog";
import api from "@/config/api";
import { useAuth } from "@/context/auth-context";

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
  const router = useRouter();
  const { logout, user } = useAuth();
  const [prefs, setPrefs] = useState<PreferencesData>({ ...defaultPrefs });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    preferredDays: false,
    notifications: false,
    dangerZone: false,
  });

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

  const handleDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      setDeleteDialogOpen(false);
      setError("");
      setSuccess("");

      const userId = String(user?._id || user?.id || "").trim();
      if (!userId) {
        setError("Unable to delete account because user details are missing.");
        return;
      }

      await api.delete(`/auth/${userId}`);
      await logout();
      router.replace("/login");
    } catch (requestError) {
      console.warn("Failed to delete account", requestError);
      setError("Failed to delete account");
    } finally {
      setDeletingAccount(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
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
          expanded={expandedSections.preferredDays}
          onToggle={() => toggleSection("preferredDays")}
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
                    numberOfLines={1}
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
          title="Notification Preferences"
          description="Choose how you receive important updates"
          expanded={expandedSections.notifications}
          onToggle={() => toggleSection("notifications")}
        >
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

        <SectionCard
          title="Danger Zone"
          description="Permanently remove your personal account from this facility."
          expanded={expandedSections.dangerZone}
          onToggle={() => toggleSection("dangerZone")}
          danger
        >
          <View style={styles.deleteCard}>
            <Text style={styles.deleteText}>
              Deleting your account removes your personal access, preferences,
              messages, schedules, and time-off records associated with this
              facility.
            </Text>
            <Pressable
              style={[
                styles.deleteButton,
                deletingAccount ? styles.saveBtnDisabled : null,
              ]}
              onPress={() => setDeleteDialogOpen(true)}
              disabled={deletingAccount}
            >
              <Feather name="trash-2" size={16} color="#ffffff" />
              <Text style={styles.deleteButtonText}>
                {deletingAccount ? "Deleting..." : "Delete My Account"}
              </Text>
            </Pressable>
          </View>
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

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Your Account?"
        message="This permanently deletes your account and your personal data for this facility. This action cannot be undone."
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteAccount}
      />
    </SafeAreaView>
  );
}

function SectionCard({
  title,
  description,
  expanded,
  onToggle,
  danger,
  children,
}: {
  title: string;
  description?: string;
  expanded: boolean;
  onToggle: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[styles.sectionCard, danger ? styles.sectionCardDanger : null]}
    >
      <Pressable style={styles.sectionHeader} onPress={onToggle}>
        <View style={styles.sectionHeaderTextWrap}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {description ? (
            <Text style={styles.sectionDescription}>{description}</Text>
          ) : null}
        </View>
        <Feather
          name="chevron-down"
          size={18}
          color="#6b7280"
          style={[
            styles.sectionChevron,
            expanded ? styles.sectionChevronExpanded : null,
          ]}
        />
      </Pressable>
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
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
    overflow: "hidden",
  },
  sectionCardDanger: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  sectionHeader: {
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f9fafb",
  },
  sectionHeaderTextWrap: {
    flex: 1,
    gap: 2,
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
  sectionChevron: {
    transform: [{ rotate: "0deg" }],
  },
  sectionChevronExpanded: {
    transform: [{ rotate: "180deg" }],
  },
  sectionBody: {
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 10,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayPill: {
    minWidth: 40,
    flexBasis: "13.5%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 8,
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
    fontSize: 11,
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
  deleteCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    padding: 12,
    gap: 12,
  },
  deleteText: {
    color: "#7f1d1d",
    fontSize: 12,
    lineHeight: 18,
  },
  deleteButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  deleteButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
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
