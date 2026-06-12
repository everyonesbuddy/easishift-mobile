import ChangePasswordModal from "@/components/auth/change-password-modal";
import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";

type NavItem = {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  to?: string;
  isMore?: boolean;
};

const ADMIN_MAIN_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "home", to: "/dashboard" },
  {
    id: "coverage",
    label: "Coverage",
    icon: "clipboard",
    to: "/coverage-planning",
  },
  { id: "schedule", label: "Schedule", icon: "calendar", to: "/schedule" },
  {
    id: "preferences",
    label: "Preferences",
    icon: "settings",
    to: "/preferences",
  },
  { id: "more", label: "More", icon: "menu", isMore: true },
];

const STAFF_MAIN_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "home", to: "/dashboard" },
  { id: "schedule", label: "Schedule", icon: "calendar", to: "/schedule" },
  {
    id: "preferences",
    label: "Preferences",
    icon: "settings",
    to: "/preferences",
  },
  {
    id: "messages",
    label: "Messages",
    icon: "message-square",
    to: "/messages",
  },
  { id: "more", label: "More", icon: "menu", isMore: true },
];

const ADMIN_MORE_ITEMS: NavItem[] = [
  { id: "staff", label: "Staff Management", icon: "users", to: "/staffs" },
  {
    id: "messages",
    label: "Messages",
    icon: "message-square",
    to: "/messages",
  },
  {
    id: "timeoff-decisions",
    label: "Time Off Decisions",
    icon: "clipboard",
    to: "/timeoff-decisions",
  },
  {
    id: "timeoff-requests",
    label: "My Time Off Requests",
    icon: "clock",
    to: "/timeoff-requests",
  },
  { id: "swaps", label: "Shift Swaps", icon: "repeat", to: "/swap-requests" },
  {
    id: "billing",
    label: "Manage Subscription",
    icon: "credit-card",
    to: "/billing",
  },
  {
    id: "change-password",
    label: "Change Password",
    icon: "lock",
  },
];

const STAFF_MORE_ITEMS: NavItem[] = [
  {
    id: "timeoff-requests",
    label: "My Time Off Requests",
    icon: "clock",
    to: "/timeoff-requests",
  },
  { id: "swaps", label: "Shift Swaps", icon: "repeat", to: "/swap-requests" },
  {
    id: "change-password",
    label: "Change Password",
    icon: "lock",
  },
];

function isActive(pathname: string, to?: string) {
  if (!to) {
    return false;
  }

  if (to === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function ProtectedBottomNav() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const mainItems = useMemo(
    () => (isAdmin ? ADMIN_MAIN_ITEMS : STAFF_MAIN_ITEMS),
    [isAdmin],
  );

  const moreItems = useMemo(
    () => (isAdmin ? ADMIN_MORE_ITEMS : STAFF_MORE_ITEMS),
    [isAdmin],
  );

  const navigateTo = (to?: string) => {
    if (!to) {
      return;
    }

    router.push(to as Parameters<typeof router.push>[0]);
  };

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            paddingBottom: Math.max(insets.bottom, 6) + 6,
          },
        ]}
      >
        {mainItems.map((item) => {
          const active = isActive(pathname, item.to);

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.tabBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (item.isMore) {
                  setMoreOpen(true);
                } else {
                  navigateTo(item.to);
                }
              }}
            >
              <Feather
                name={item.icon}
                size={19}
                color={active ? "#1d4ed8" : "#6b7280"}
              />
              <Text
                style={[styles.tabLabel, active ? styles.tabLabelActive : null]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal
        visible={moreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMoreOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>More Options</Text>
              <TouchableOpacity onPress={() => setMoreOpen(false)}>
                <Feather name="x" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetList}>
              {moreItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.sheetItem}
                  onPress={() => {
                    setMoreOpen(false);
                    if (item.id === "change-password") {
                      setChangePasswordOpen(true);
                      return;
                    }

                    navigateTo(item.to);
                  }}
                >
                  <Feather name={item.icon} size={18} color="#374151" />
                  <Text style={styles.sheetItemLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 10,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: "#1d4ed8",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "60%",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sheetTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  sheetList: {
    gap: 8,
  },
  sheetItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sheetItemLabel: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
});
