import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import api from "@/config/api";

type ChangePasswordModalProps = {
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
    return (
      (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message || "Failed to change password"
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to change password";
}

export default function ChangePasswordModal({
  open,
  onClose,
}: ChangePasswordModalProps) {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleClose = () => {
    if (loading) {
      return;
    }

    setFormData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    setError("");

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError("New password must be different from current password");
      return;
    }

    setLoading(true);

    try {
      await api.patch("/auth/change-password", {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      Alert.alert("Success", "Password changed successfully.");
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const isDisabled =
    loading ||
    !formData.currentPassword.trim() ||
    !formData.newPassword.trim() ||
    !formData.confirmPassword.trim();

  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Change password</Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#6b7280" />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            placeholder="Current Password"
            value={formData.currentPassword}
            onChangeText={(value) => handleChange("currentPassword", value)}
            secureTextEntry
            editable={!loading}
            style={styles.input}
          />

          <TextInput
            placeholder="New Password"
            value={formData.newPassword}
            onChangeText={(value) => handleChange("newPassword", value)}
            secureTextEntry
            editable={!loading}
            style={styles.input}
          />

          <TextInput
            placeholder="Confirm New Password"
            value={formData.confirmPassword}
            onChangeText={(value) => handleChange("confirmPassword", value)}
            secureTextEntry
            editable={!loading}
            style={styles.input}
          />

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
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              disabled={isDisabled}
              style={({ pressed }) => [
                styles.button,
                styles.primaryButton,
                pressed ? styles.pressed : null,
                isDisabled ? styles.disabled : null,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Change Password</Text>
              )}
            </Pressable>
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
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  closeBtn: {
    padding: 8,
    marginRight: 2,
  },
  title: {
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
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
    marginTop: 6,
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
  errorBox: {
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fee2e2",
  },
  errorText: {
    color: "#7f1d1d",
    lineHeight: 19,
  },
});
