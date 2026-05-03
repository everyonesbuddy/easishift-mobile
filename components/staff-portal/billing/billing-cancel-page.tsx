import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function BillingCancelPage() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Payment cancelled</Text>
        <Text style={styles.body}>
          Your payment was not completed. You can try again or return to
          billing.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push("/billing")}
        >
          <Text style={styles.buttonText}>Back to billing</Text>
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
