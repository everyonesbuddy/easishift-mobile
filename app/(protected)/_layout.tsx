import { Redirect, Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import ProtectedBottomNav from "@/components/shared/protected-bottom-nav";
import ProtectedTopBar from "@/components/shared/protected-top-bar";
import { useAuth } from "@/context/auth-context";
import { useNotificationsSync } from "@/hooks/use-notifications-sync";
import { subscribeToNotificationClicks } from "@/services/notifications/notification-service";

export default function ProtectedLayout() {
  const router = useRouter();
  const { user, tenant, can, loading } = useAuth();
  const segments = useSegments();

  // Run notification synchronizer for active user
  useNotificationsSync();

  // Subscribe to notification interactions for deep-linking
  useEffect(() => {
    const unsubscribe = subscribeToNotificationClicks(router);
    return () => {
      unsubscribe();
    };
  }, [router]);

  const seatLimit =
    typeof tenant?.seatLimit === "number"
      ? tenant.seatLimit
      : Number.POSITIVE_INFINITY;
  const hasPaywallExemptStatus =
    !!tenant &&
    ["active", "trialing"].includes(tenant.subscriptionStatus ?? "");
  const showPaywall =
    can("billing.manage") &&
    !!tenant &&
    (!hasPaywallExemptStatus || (Number.isFinite(seatLimit) && seatLimit <= 1));
  const inPaywallFlow = segments.some(
    (segment) => String(segment) === "paywall" || String(segment) === "billing",
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (showPaywall && !inPaywallFlow) {
    return <Redirect href="/paywall" />;
  }

  return (
    <View style={styles.page}>
      <ProtectedTopBar />
      <View style={styles.content}>
        <Slot />
      </View>
      <ProtectedBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
