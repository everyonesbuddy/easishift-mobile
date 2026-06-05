import { useAuth } from "@/context/auth-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  onMobileOpen?: () => void;
};

export default function Navbar({ onMobileOpen }: Props) {
  const { user, role, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace("/(public)/login" as Parameters<typeof router.replace>[0]);
  };

  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "";

  return (
    <View style={styles.appBar}>
      {/* Left side */}
      <View style={styles.left}>
        {!user ? (
          <TouchableOpacity
            onPress={() =>
              router.push("/" as Parameters<typeof router.push>[0])
            }
            activeOpacity={0.8}
          >
            <Text style={styles.logoText}>WiserShifts</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Mobile: hamburger */}
            <TouchableOpacity
              onPress={onMobileOpen}
              style={styles.burgerBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="menu" size={24} color="#374151" />
            </TouchableOpacity>

            {/* Desktop-ish (tablet+): show title */}
            <View style={styles.titleBlock}>
              <Text style={styles.dashboardTitle}>{roleLabel} Dashboard</Text>
              <Text style={styles.dashboardSub}>
                Manage your healthcare workforce efficiently
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Right side */}
      <View style={styles.right}>
        {!user ? (
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() =>
              router.push(
                "/(public)/login" as Parameters<typeof router.push>[0],
              )
            }
            activeOpacity={0.8}
          >
            <Text style={styles.loginBtnText}>Login</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Feather name="log-out" size={16} color="#6b7280" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const STATUS_BAR_HEIGHT =
  Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;

const styles = StyleSheet.create({
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: STATUS_BAR_HEIGHT + 12,
    paddingBottom: 12,
    height: 64 + STATUS_BAR_HEIGHT,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    zIndex: 30,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.5,
  },
  burgerBtn: {
    marginRight: 8,
  },
  titleBlock: {
    flexShrink: 1,
  },
  dashboardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  dashboardSub: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 1,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loginBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  loginBtnText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "500",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  logoutText: {
    color: "#6b7280",
    fontSize: 14,
  },
});
