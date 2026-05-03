import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import api from "@/config/api";

type ForgotPasswordModalProps = {
  open: boolean;
  onClose: () => void;
};

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

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to send reset email";
}

export default function ForgotPasswordModal({
  open,
  onClose,
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    if (loading) {
      return;
    }

    setEmail("");
    setError("");
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSuccess(true);
      setEmail("");

      closeTimerRef.current = setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Reset your password</Text>

          {success ? (
            <View style={[styles.alertBox, styles.alertSuccess]}>
              <Text style={styles.alertText}>
                If this email exists in our system, you&apos;ll receive a
                password reset link shortly. Check your inbox and spam folder.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.helperText}>
                Enter your email address and we&apos;ll send you a link to reset
                your password.
              </Text>

              {error ? (
                <View style={[styles.alertBox, styles.alertError]}>
                  <Text style={styles.alertText}>{error}</Text>
                </View>
              ) : null}

              <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                style={styles.input}
              />
            </>
          )}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleClose}
              disabled={loading}
              style={({ pressed }) => [
                styles.button,
                styles.secondaryButton,
                pressed ? styles.pressed : null,
                loading ? styles.disabled : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {success ? "Close" : "Cancel"}
              </Text>
            </Pressable>

            {!success ? (
              <Pressable
                onPress={handleSubmit}
                disabled={loading || !email.trim()}
                style={({ pressed }) => [
                  styles.button,
                  styles.primaryButton,
                  pressed ? styles.pressed : null,
                  loading || !email.trim() ? styles.disabled : null,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    gap: 12,
  },
  title: {
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "800",
    color: "#0f172a",
  },
  helperText: {
    color: "#475569",
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.2)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  button: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#1565c0",
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.58,
  },
  alertBox: {
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1,
  },
  alertError: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
  },
  alertSuccess: {
    backgroundColor: "#dcfce7",
    borderColor: "#86efac",
  },
  alertText: {
    color: "#0f172a",
    lineHeight: 19,
  },
});
