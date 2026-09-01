import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import GuideHelpButton from "@/components/shared/guide-help-button";
import ScheduleAndCoverageCharts from "@/components/staff-portal/dashboard/schedule-and-coverage-charts";
import type { StaffMember } from "@/components/staff-portal/staff/staff-shared";
import api from "@/config/api";
import { getFacilityRolesFromUser } from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";
import { useGuideTour } from "@/context/guide-tour-context";

const DASHBOARD_TOUR_STEPS = [
  {
    target: "guide-dashboard-profile-btn",
    title: "Add your profile picture",
    body: "Upload a photo so teammates can recognize you across schedules and roster views.",
  },
  {
    target: "guide-dashboard-charts",
    title: "Your at-a-glance summary",
    body: "These summaries track scheduled hours and coverage as schedules change.",
  },
];

type SummaryMetrics = {
  activeStaffCount?: number;
  fullyStaffedCount?: number;
  understaffedCount?: number;
  pendingTimeOffCount?: number;
  shiftsThisWeekCount?: number;
  hoursThisWeek?: number;
  unreadMessages?: number;
  approvedUpcomingTimeOffCount?: number;
};

type Summary = {
  operational?: SummaryMetrics | null;
  personal?: SummaryMetrics | null;
};

type TenantPayload = {
  tenant?: {
    _id?: string;
    name?: string;
    subscriptionStatus?: string;
    seatLimit?: number;
  };
  _id?: string;
  name?: string;
  subscriptionStatus?: string;
};

function normalizeTenant(input: TenantPayload | null) {
  if (!input) {
    return null;
  }

  return {
    _id: input.tenant?._id || input._id,
    name: input.tenant?.name || input.name || "",
    subscriptionStatus:
      input.tenant?.subscriptionStatus ||
      input.subscriptionStatus ||
      "inactive",
    seatLimit: input.tenant?.seatLimit,
  };
}

export default function StaffDashboardScreen() {
  const { user, roles, can, facilityPreferences, updateCurrentUser } =
    useAuth();
  const canViewOperations = can("schedule.view");
  const canUsePersonalSchedule =
    getFacilityRolesFromUser(user, facilityPreferences).length > 0;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [tenant, setTenant] =
    useState<ReturnType<typeof normalizeTenant>>(null);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const { startTourIfUnseen } = useGuideTour();

  const userId = typeof user?._id === "string" ? user._id : "";
  const tenantId = typeof user?.tenantId === "string" ? user.tenantId : "";

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      if (!userId || !tenantId) {
        throw new Error("Missing user id or tenant id");
      }

      const [operationalResult, personalResult, tenantRes, staffRes] =
        await Promise.allSettled([
          can("staff.view")
            ? api.get(`/summary/admin/${userId}`)
            : Promise.resolve(null),
          canUsePersonalSchedule
            ? api.get(`/summary/staff/${userId}`)
            : Promise.resolve(null),
          api.get(`/tenants/${tenantId}`),
          api.get("/auth/users"),
        ]);

      setSummary({
        ...(operationalResult.status === "fulfilled" && operationalResult.value
          ? { operational: operationalResult.value.data }
          : {}),
        ...(personalResult.status === "fulfilled" && personalResult.value
          ? { personal: personalResult.value.data }
          : {}),
      });
      setTenant(
        tenantRes.status === "fulfilled"
          ? normalizeTenant(tenantRes.value.data || null)
          : null,
      );
      setStaffList(
        staffRes.status === "fulfilled" && Array.isArray(staffRes.value.data)
          ? (staffRes.value.data as StaffMember[])
          : [],
      );
    } catch (error) {
      console.warn("Failed to load dashboard", error);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tenantId, can, canUsePersonalSchedule]);

  useEffect(() => {
    if (!loading) {
      void startTourIfUnseen("staff-dashboard", DASHBOARD_TOUR_STEPS);
    }
  }, [loading, startTourIfUnseen]);

  const firstName = useMemo(() => {
    if (typeof user?.name === "string" && user.name.length > 0) {
      return user.name.split(" ")[0];
    }

    if (typeof user?.firstName === "string" && user.firstName.length > 0) {
      return user.firstName;
    }

    return "there";
  }, [user]);

  const initials = useMemo(() => {
    if (typeof user?.name !== "string" || user.name.length === 0) {
      return "SU";
    }

    return user.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user]);

  const adminCards = [
    {
      title: "Active Staff",
      value: summary?.operational?.activeStaffCount ?? 0,
      subtitle: "Active Staff",
      icon: "users" as const,
      bgColor: "#e3f2fd",
      layout: "center" as const,
    },
    {
      title: "Fully Staffed Today",
      value: summary?.operational?.fullyStaffedCount ?? 0,
      subtitle: "Fully Staffed Today",
      icon: "check-circle" as const,
      bgColor: "#e8f5e9",
      layout: "center" as const,
    },
    {
      title: "Understaffed Today",
      value: summary?.operational?.understaffedCount ?? 0,
      subtitle: "Understaffed Shifts Today",
      icon: "alert-triangle" as const,
      bgColor: "#ffebee",
      layout: "center" as const,
      badge:
        (summary?.operational?.understaffedCount ?? 0) > 0 ? "Alert" : null,
    },
    {
      title: "Pending Requests",
      value: summary?.operational?.pendingTimeOffCount ?? 0,
      subtitle: "Pending Requests",
      icon: "clock" as const,
      bgColor: "#fff8e1",
      layout: "center" as const,
      badge: summary?.operational?.pendingTimeOffCount ?? 0,
    },
  ];

  const staffCards = [
    {
      title: "Upcoming Shifts",
      value: summary?.personal?.shiftsThisWeekCount ?? 0,
      subtitle: "Upcoming Shifts",
      icon: "calendar" as const,
      bgColor: "#e3f2fd",
      layout: "side" as const,
    },
    {
      title: "Hours This Week",
      value: summary?.personal?.hoursThisWeek ?? 0,
      subtitle: "Hours This Week",
      icon: "clock" as const,
      bgColor: "#e8f5e9",
      layout: "side" as const,
    },
    {
      title: "Unread Messages",
      value: summary?.personal?.unreadMessages ?? 0,
      subtitle: "Unread Messages",
      icon: "mail" as const,
      bgColor: "#f3e5f5",
      layout: "side" as const,
    },
    {
      title: "Approved Time Off",
      value: summary?.personal?.approvedUpcomingTimeOffCount ?? 0,
      subtitle: "Approved Time Off",
      icon: "check-circle" as const,
      bgColor: "#fff8e1",
      layout: "side" as const,
    },
  ];

  const handlePickAndUploadProfile = async () => {
    if (!userId) {
      return;
    }

    let ImagePickerModule: {
      requestMediaLibraryPermissionsAsync: () => Promise<{
        granted: boolean;
      }>;
      launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<{
        canceled: boolean;
        assets?: {
          type?: string;
          mimeType?: string | null;
          fileSize?: number;
          base64?: string | null;
        }[];
      }>;
      MediaTypeOptions?: {
        Images?: unknown;
      };
    };

    try {
      ImagePickerModule =
        (await import("expo-image-picker")) as typeof ImagePickerModule;
    } catch {
      Alert.alert(
        "Upload unavailable",
        "Profile image picker is not available in this build yet.",
      );
      return;
    }

    if (
      typeof ImagePickerModule.requestMediaLibraryPermissionsAsync !==
        "function" ||
      typeof ImagePickerModule.launchImageLibraryAsync !== "function"
    ) {
      Alert.alert(
        "Upload unavailable",
        "Image picker is incompatible with the current Expo SDK.",
      );
      return;
    }

    const permission =
      await ImagePickerModule.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Please allow photo library access to upload a profile picture.",
      );
      return;
    }

    const pickerResult = await ImagePickerModule.launchImageLibraryAsync({
      mediaTypes: ImagePickerModule.MediaTypeOptions?.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (pickerResult.canceled || !pickerResult.assets?.length) {
      return;
    }

    const asset = pickerResult.assets[0];
    const maxSizeBytes = 2 * 1024 * 1024;
    const isImageType =
      asset.type === "image" ||
      (typeof asset.mimeType === "string" &&
        asset.mimeType.startsWith("image/"));

    if (!isImageType) {
      Alert.alert("Invalid file", "Please select an image file.");
      return;
    }

    if (typeof asset.fileSize === "number" && asset.fileSize > maxSizeBytes) {
      Alert.alert("Image too large", "Please use an image under 2MB.");
      return;
    }

    if (!asset.base64) {
      Alert.alert("Upload failed", "Unable to read the selected image.");
      return;
    }

    const mimeType = asset.mimeType || "image/jpeg";
    const base64Image = `data:${mimeType};base64,${asset.base64}`;

    try {
      setUploadingProfile(true);
      const response = await api.put(`/auth/${userId}`, {
        profilePicture: base64Image,
      });

      const updatedUser = response?.data?.user;
      if (updatedUser && typeof updatedUser === "object") {
        await updateCurrentUser({
          ...(updatedUser as Record<string, unknown>),
        });
      } else {
        await updateCurrentUser({ profilePicture: base64Image });
      }

      Alert.alert("Success", "Profile picture updated.");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Failed to upload profile picture.";

      Alert.alert(
        "Upload failed",
        message || "Failed to upload profile picture.",
      );
    } finally {
      setUploadingProfile(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorTitle}>Error loading dashboard.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadDashboardData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pageContent}
      >
        <GuideHelpButton
          tourId="staff-dashboard"
          tourSteps={DASHBOARD_TOUR_STEPS}
        />
        <View style={styles.banner}>
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerTitle}>Welcome back, {firstName}!</Text>
            <Text style={styles.bannerSub}>
              {roles.length ? roles.join(" / ") : "Staff"}
              {tenant?.name ? ` • ${tenant.name}` : ""}
            </Text>
            <View style={styles.emailPill}>
              <Text style={styles.emailText}>
                {typeof user?.email === "string" ? user.email : ""}
              </Text>
            </View>
          </View>

          <View style={styles.avatarSection}>
            <View style={styles.avatarWrap}>
              {typeof user?.profilePicture === "string" &&
              user.profilePicture ? (
                <Image
                  source={{ uri: user.profilePicture }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.profileUploadBtn}
              onPress={handlePickAndUploadProfile}
              disabled={uploadingProfile}
              activeOpacity={0.85}
            >
              <Feather name="upload" size={12} color="#ffffff" />
              <Text style={styles.profileUploadBtnText}>
                {uploadingProfile
                  ? "Uploading..."
                  : typeof user?.profilePicture === "string" &&
                      user.profilePicture
                    ? "Change Picture"
                    : "Add Picture"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* <View style={styles.cardsWrap}>
          {(isAdmin ? adminCards : staffCards).map((card) => (
            <View key={card.title} style={styles.cardCell}>
              <StatCard
                title={card.title}
                value={card.value}
                subtitle={card.subtitle}
                icon={card.icon}
                layout={card.layout}
                bgColor={card.bgColor}
                badge={"badge" in card ? card.badge : undefined}
              />
            </View>
          ))}
        </View> */}

        <View>
          <ScheduleAndCoverageCharts
            canViewOperations={canViewOperations}
            canUsePersonalSchedule={canUsePersonalSchedule}
            userId={userId}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scroll: {
    flex: 1,
  },
  pageContent: {
    padding: 16,
    paddingTop: 28,
    paddingBottom: 20,
    gap: 12,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  errorTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2563eb",
  },
  retryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  banner: {
    borderRadius: 14,
    backgroundColor: "#0F4C81",
    padding: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  bannerLeft: {
    flex: 1,
    minWidth: 0,
  },
  bannerTitle: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "800",
  },
  bannerSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
  },
  emailPill: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  emailText: {
    color: "#ffffff",
    fontSize: 12,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarSection: {
    alignItems: "center",
    gap: 8,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 24,
  },
  profileUploadBtn: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  profileUploadBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  cardsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 4,
  },
  cardCell: {
    width: "50%",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
});
