import { Feather } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";

function getTitle(pathname: string) {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/coverage-planning")) return "Coverage Planning";
  if (pathname.startsWith("/schedule")) return "Schedule";
  if (pathname.startsWith("/staffs")) return "Staff Management";
  if (pathname.startsWith("/messages")) return "Messages";
  if (pathname.startsWith("/billing")) return "Billing";
  if (pathname.startsWith("/timeoff-decisions")) return "Time Off Requests";
  if (pathname.startsWith("/timeoff-requests")) return "Time Off";
  if (pathname.startsWith("/swap-requests")) return "Shift Swaps";
  if (pathname.startsWith("/preferences")) return "Preferences";
  return "Easishift";
}

export default function ProtectedTopBar() {
  const { logout } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const title = getTitle(pathname);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 8),
        },
      ]}
    >
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.85}
      >
        <Feather name="log-out" size={16} color="#6b7280" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 58,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#ffffff",
  },
  logoutText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
  },
});
