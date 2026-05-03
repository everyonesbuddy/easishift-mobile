import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/context/auth-context";

export default function BillingSuccessPage() {
  const { refreshTenant } = useAuth();
  const router = useRouter();

  useEffect(() => {
    void refreshTenant();
  }, [refreshTenant]);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Payment successful</Text>
        <Text style={styles.body}>
          Thank you. Your subscription should activate shortly. We will update
          your account automatically.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push("/dashboard")}
        >
          <Text style={styles.buttonText}>Go to dashboard</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 16,
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 12,
  },
  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
  },
  body: {
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 21,
  },
  button: {
    marginTop: 6,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
});
