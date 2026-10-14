import { Redirect, Slot, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import ProtectedBottomNav from "@/components/shared/protected-bottom-nav";
import ProtectedTopBar from "@/components/shared/protected-top-bar";
import { IOS } from "@/constants/ios";
import { useAuth } from "@/context/auth-context";
import { useNotificationsSync } from "@/hooks/use-notifications-sync";
import { subscribeToNotificationClicks } from "@/services/notifications/notification-service";

/**
 * Signed-in schedulers. Free facilities use the app like any other: plan
 * limits pause publishing / adding people (the backend says so), they
 * don't lock the app. Plans are managed on the web.
 */
export default function ProtectedLayout() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useNotificationsSync();

  useEffect(() => {
    const unsubscribe = subscribeToNotificationClicks(router);
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/" />;

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
  page: { flex: 1, backgroundColor: IOS.canvas },
  content: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: IOS.canvas },
});
