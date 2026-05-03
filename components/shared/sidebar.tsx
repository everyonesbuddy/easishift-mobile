import ChangePasswordModal from "@/components/auth/change-password-modal";
import { useAuth } from "@/context/auth-context";
import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const SIDEBAR_WIDTH = 260;

type MenuItem = {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  to: string;
};

const adminMenuItems: MenuItem[] = [
  { id: "overview", icon: "grid", label: "Overview", to: "/dashboard" },
  {
    id: "coverage",
    icon: "clipboard",
    label: "Coverage Planning....",
    to: "/coverage-planning",
  },
  {
    id: "schedule",
    icon: "calendar",
    label: "Schedule Builder",
    to: "/schedule",
  },
  { id: "staff", icon: "users", label: "Staff Management", to: "/staffs" },
  {
    id: "subscription",
    icon: "settings",
    label: "Manage Subscription",
    to: "/billing",
  },
  {
    id: "timeoff",
    icon: "clock",
    label: "Time Off Requests",
    to: "/timeoff-decisions",
  },
  {
    id: "messages",
    icon: "message-square",
    label: "Messages",
    to: "/messages",
  },
];

const staffMenuItems: MenuItem[] = [
  { id: "overview", icon: "grid", label: "Overview", to: "/dashboard" },
  { id: "schedule", icon: "calendar", label: "My Schedule", to: "/schedule" },
  {
    id: "preferences",
    icon: "settings",
    label: "Preferences",
    to: "/preferences",
  },
  { id: "timeoff", icon: "clock", label: "Time Off", to: "/timeoff-requests" },
  {
    id: "swap-requests",
    icon: "repeat",
    label: "Shift Swaps",
    to: "/swap-requests",
  },
  {
    id: "messages",
    icon: "message-square",
    label: "Messages",
    to: "/messages",
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function Sidebar({ visible, onClose }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const role = user?.role || "staff";
  const menuItems = role === "admin" ? adminMenuItems : staffMenuItems;

  const handleNavigate = (to: string) => {
    onClose();
    router.push(to as Parameters<typeof router.push>[0]);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Drawer panel */}
        <View style={styles.drawer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logoText}>Easishift</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={22} color="#d1d5db" />
            </TouchableOpacity>
          </View>

          {/* Navigation */}
          <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
            {menuItems.map((item) => {
              const isActive = pathname === item.to;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => handleNavigate(item.to)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={item.icon}
                    size={20}
                    color={isActive ? "#ffffff" : "#d1d5db"}
                  />
                  <Text
                    style={[styles.navLabel, isActive && styles.navLabelActive]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* User Footer */}
          <View style={styles.footer}>
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <Feather name="user" size={20} color="#ffffff" />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {typeof user?.name === "string" && user.name
                    ? user.name
                    : "Staff User"}
                </Text>
                <Text style={styles.userEmail} numberOfLines={1}>
                  {typeof user?.email === "string" ? user.email : ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setUserMenuVisible((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="more-vertical" size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {userMenuVisible && (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setUserMenuVisible(false);
                  setChangePasswordOpen(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.menuOptionText}>Change Password</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: "#111827",
    borderRightWidth: 1,
    borderRightColor: "#1f2937",
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  logoText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  nav: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: "#2563eb",
  },
  navLabel: {
    color: "#d1d5db",
    fontSize: 15,
  },
  navLabelActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    padding: 12,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  userEmail: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 1,
  },
  menuOption: {
    backgroundColor: "#1f2937",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  menuOptionText: {
    color: "#ffffff",
    fontSize: 14,
  },
});
