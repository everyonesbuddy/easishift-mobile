import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import ForgotPasswordModal from "@/components/auth/forgot-password-modal";
import api from "@/config/api";
import { useAuth } from "@/context/auth-context";

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response
      ?.data?.message === "string"
  ) {
    return (error as { response?: { data?: { message?: string } } }).response
      ?.data?.message;
  }

  return "Invalid credentials, please try again.";
}

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login/staff", {
        email: email.trim(),
        password,
      });

      await login(res.data);
      router.replace("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Login</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={loading || !email.trim() || !password.trim()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.pressed : null,
              loading || !email.trim() || !password.trim()
                ? styles.disabled
                : null,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Login</Text>
            )}
          </Pressable>

          <Text style={styles.helperText}>
            Don&apos;t have an account? Contact your hospital admin.
          </Text>

          <Pressable
            onPress={() => setForgotPasswordOpen(true)}
            style={({ pressed }) => [
              styles.linkButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.linkText}>Forgot password?</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ForgotPasswordModal
        open={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    padding: 18,
    gap: 12,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: "#42a5f5",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  helperText: {
    textAlign: "center",
    color: "#0f172a",
    marginTop: 4,
  },
  linkButton: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  linkText: {
    color: "#42a5f5",
    fontWeight: "700",
  },
  errorBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  errorText: {
    color: "#7f1d1d",
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.58,
  },
});
