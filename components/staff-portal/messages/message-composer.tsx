import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import api from "@/config/api";
import { useAuth } from "@/context/auth-context";

type MessageStaff = {
  _id?: string;
  name?: string;
  role?: string;
};

type Props = {
  onSuccess: () => void;
  onClose: () => void;
  initialRecipientId?: string;
  lockRecipient?: boolean;
  initialSubject?: string;
};

type PickerOption = {
  value: string;
  label: string;
  section: "quick" | "role" | "individual";
};

export default function MessageComposer({
  onSuccess,
  onClose,
  initialRecipientId = "",
  lockRecipient = false,
  initialSubject = "",
}: Props) {
  const { user } = useAuth();

  const [form, setForm] = useState({
    recipientSelection: initialRecipientId ? `user:${initialRecipientId}` : "",
    subject: initialSubject,
    body: "",
  });
  const [staffList, setStaffList] = useState<MessageStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);

  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await api.get("/auth/users");
        const users = Array.isArray(res.data)
          ? (res.data as MessageStaff[])
          : [];
        setStaffList(users.filter((member) => member._id !== user?._id));
      } catch (requestError) {
        console.warn("Failed to load staff for messaging", requestError);
        setStaffList([]);
      } finally {
        setLoading(false);
      }
    }

    loadStaff();
  }, [user?._id]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      recipientSelection: initialRecipientId
        ? `user:${initialRecipientId}`
        : "",
      subject: initialSubject,
    }));
  }, [initialRecipientId, initialSubject]);

  const roleOptions = useMemo(() => {
    const uniqueRoles = [
      ...new Set(staffList.map((staff) => staff.role).filter(Boolean)),
    ] as string[];

    return uniqueRoles.sort((a, b) => a.localeCompare(b));
  }, [staffList]);

  const recipientOptions = useMemo(() => {
    const quick: PickerOption[] = [
      {
        value: "all_staff",
        label: "All Staff (except you)",
        section: "quick",
      },
    ];

    const byRole: PickerOption[] = roleOptions.map((role) => ({
      value: `role:${role}`,
      label: `Role: ${role}`,
      section: "role",
    }));

    const individuals: PickerOption[] = staffList.map((staff) => ({
      value: `user:${staff._id}`,
      label: staff.name || "Unknown",
      section: "individual",
    }));

    return [...quick, ...byRole, ...individuals];
  }, [roleOptions, staffList]);

  const selectedRecipientLabel = useMemo(() => {
    if (!form.recipientSelection) {
      return "Select recipients";
    }

    if (form.recipientSelection === "all_staff") {
      return "All Staff (except you)";
    }

    if (form.recipientSelection.startsWith("role:")) {
      return `Role: ${form.recipientSelection.replace("role:", "")}`;
    }

    if (form.recipientSelection.startsWith("user:")) {
      const selectedId = form.recipientSelection.replace("user:", "");
      return (
        staffList.find((staff) => staff._id === selectedId)?.name ||
        "Selected user"
      );
    }

    return "Select recipients";
  }, [form.recipientSelection, staffList]);

  const resolveReceiverIds = () => {
    const selection = form.recipientSelection;

    if (!selection) return [];

    if (selection === "all_staff") {
      return staffList.map((staff) => staff._id).filter(Boolean) as string[];
    }

    if (selection.startsWith("role:")) {
      const role = selection.replace("role:", "");
      return staffList
        .filter((staff) => staff.role === role)
        .map((staff) => staff._id)
        .filter(Boolean) as string[];
    }

    if (selection.startsWith("user:")) {
      const userId = selection.replace("user:", "");
      return userId ? [userId] : [];
    }

    return [];
  };

  const handleSubmit = async () => {
    const receiverIds = resolveReceiverIds();

    if (!receiverIds.length) {
      setError("Please select at least one recipient.");
      return;
    }

    if (!form.subject.trim()) {
      setError("Please enter a subject.");
      return;
    }

    if (!form.body.trim()) {
      setError("Please enter a message.");
      return;
    }

    try {
      setSending(true);
      setError("");

      await api.post("/messages", {
        senderId: user?._id,
        senderModel: "User",
        receiverIds,
        receiverModel: "User",
        subject: form.subject,
        body: form.body,
      });

      onSuccess();
    } catch (requestError) {
      console.warn("Failed to send message", requestError);
      setError("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Send Message</Text>
          <Text style={styles.subtitle}>
            Send an internal message to your team.
          </Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Feather name="x" size={20} color="#6b7280" />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Recipients</Text>
        <Pressable
          style={[
            styles.selectBtn,
            lockRecipient ? styles.selectDisabled : null,
          ]}
          disabled={lockRecipient || loading}
          onPress={() => setRecipientPickerOpen(true)}
        >
          <Text style={styles.selectText}>
            {loading ? "Loading recipients..." : selectedRecipientLabel}
          </Text>
          <Feather name="chevron-down" size={16} color="#6b7280" />
        </Pressable>
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Subject</Text>
        <TextInput
          value={form.subject}
          onChangeText={(value) =>
            setForm((prev) => ({ ...prev, subject: value }))
          }
          style={styles.input}
          placeholder="Message subject"
        />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Message Body</Text>
        <TextInput
          value={form.body}
          onChangeText={(value) =>
            setForm((prev) => ({ ...prev, body: value }))
          }
          style={styles.textArea}
          placeholder="Write your message"
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, styles.cancelBtn]}
          onPress={onClose}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[
            styles.actionBtn,
            styles.submitBtn,
            sending ? styles.submitDisabled : null,
          ]}
          onPress={handleSubmit}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>Send</Text>
          )}
        </Pressable>
      </View>

      <RecipientPickerModal
        open={recipientPickerOpen}
        onClose={() => setRecipientPickerOpen(false)}
        value={form.recipientSelection}
        onSelect={(value) => {
          setForm((prev) => ({ ...prev, recipientSelection: value }));
          setError("");
        }}
        options={recipientOptions}
      />
    </ScrollView>
  );
}

function RecipientPickerModal({
  open,
  onClose,
  value,
  onSelect,
  options,
}: {
  open: boolean;
  onClose: () => void;
  value: string;
  onSelect: (value: string) => void;
  options: PickerOption[];
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Recipients</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={18} color="#6b7280" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalList}>
            {(["quick", "role", "individual"] as const).map((section) => {
              const sectionOptions = options.filter(
                (option) => option.section === section,
              );
              if (sectionOptions.length === 0) {
                return null;
              }

              return (
                <View key={section} style={styles.sectionWrap}>
                  <Text style={styles.sectionTitle}>
                    {section === "quick"
                      ? "Quick Select"
                      : section === "role"
                        ? "By Role"
                        : "Individual Staff"}
                  </Text>
                  {sectionOptions.map((option) => {
                    const selected = option.value === value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.optionBtn,
                          selected ? styles.optionBtnActive : null,
                        ]}
                        onPress={() => {
                          onSelect(option.value);
                          onClose();
                        }}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            selected ? styles.optionTextActive : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                        {selected ? (
                          <Feather name="check" size={16} color="#2563eb" />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
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
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 2,
  },
  error: {
    color: "#b91c1c",
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  fieldWrap: {
    gap: 6,
  },
  label: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  selectBtn: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectDisabled: {
    backgroundColor: "#f9fafb",
    opacity: 0.7,
  },
  selectText: {
    color: "#111827",
    fontSize: 13,
    flexShrink: 1,
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  textArea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  submitBtn: {
    backgroundColor: "#2563eb",
  },
  submitDisabled: {
    opacity: 0.65,
  },
  cancelText: {
    color: "#111827",
    fontWeight: "700",
  },
  submitText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    maxHeight: "75%",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  modalList: {
    gap: 10,
  },
  sectionWrap: {
    gap: 6,
  },
  sectionTitle: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
  },
  optionBtn: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  optionBtnActive: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  optionText: {
    color: "#111827",
    fontSize: 13,
    flexShrink: 1,
  },
  optionTextActive: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
});
