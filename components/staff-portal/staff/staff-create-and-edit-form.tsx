import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import api from "@/config/api";
import { useAuth } from "@/context/auth-context";

import {
  CREATE_ROLES,
  getRoleDisplayName,
  PHONE_COUNTRY_CODES,
  StaffMember,
} from "./staff-shared";

type Props = {
  staff: StaffMember | null;
  onSuccess: () => void;
  onClose: () => void;
  staffList?: StaffMember[];
};

type FormState = {
  name: string;
  email: string;
  phoneCountryCode: string;
  phone: string;
  role: string;
};

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function StaffCreateAndEditForm({
  staff,
  onSuccess,
  onClose,
  staffList = [],
}: Props) {
  const { user, role: loggedInRole, tenant } = useAuth();
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phoneCountryCode: "",
    phone: "",
    role: "doctor",
  });
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [codePickerOpen, setCodePickerOpen] = useState(false);

  const isEditingSelf = Boolean(staff && staff._id === user?._id);
  const disableRoleChange = isEditingSelf && loggedInRole === "admin";

  useEffect(() => {
    if (!staff) {
      return;
    }

    setForm({
      name: staff.name || "",
      email: staff.email || "",
      phoneCountryCode:
        staff.userPhoneCountryCode || staff.phoneCountryCode || "",
      phone: staff.userPhone || staff.phone || "",
      role: staff.role || "doctor",
    });
  }, [staff]);

  const handleSubmit = async () => {
    setEmailError("");
    setPhoneError("");
    setError("");

    const normalizedPhone = form.phone.trim();
    const normalizedPhoneCountryCode = form.phoneCountryCode.trim();

    if (!validateEmail(form.email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (
      (normalizedPhone && !normalizedPhoneCountryCode) ||
      (!normalizedPhone && normalizedPhoneCountryCode)
    ) {
      setPhoneError("Please provide both country code and phone number");
      return;
    }

    setLoading(true);

    try {
      if (staff?._id) {
        const payload: Record<string, string> = {
          name: form.name,
          email: form.email,
          role: disableRoleChange ? staff.role || form.role : form.role,
        };

        if (normalizedPhone && normalizedPhoneCountryCode) {
          payload.userPhoneCountryCode = normalizedPhoneCountryCode;
          payload.userPhone = normalizedPhone;
          payload.phoneCountryCode = normalizedPhoneCountryCode;
          payload.phone = normalizedPhone;
        }

        await api.put(`/auth/${staff._id}`, payload);
      } else {
        const seatLimit = Number(tenant?.seatLimit);
        const hasSeatLimit = Number.isFinite(seatLimit) && seatLimit > 0;
        const existingStaffCount = Array.isArray(staffList)
          ? staffList.length
          : 0;

        if (hasSeatLimit && existingStaffCount >= seatLimit) {
          setError(
            `Staff seat limit reached (${existingStaffCount}/${seatLimit}). Upgrade your plan to add more staff.`,
          );
          setLoading(false);
          return;
        }

        await api.post("/auth/signup/staff", {
          name: form.name,
          email: form.email,
          role: form.role,
          ...(normalizedPhone && normalizedPhoneCountryCode
            ? {
                userPhoneCountryCode: normalizedPhoneCountryCode,
                userPhone: normalizedPhone,
                phoneCountryCode: normalizedPhoneCountryCode,
                phone: normalizedPhone,
              }
            : {}),
        });
      }

      onSuccess();
    } catch (requestError: unknown) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (requestError as { response?: { data?: { message?: string } } })
              .response?.data?.message || "Failed to save staff"
          : "Failed to save staff";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>
            {staff ? "Edit Staff Member" : "Add Staff Member"}
          </Text>
          <Text style={styles.subtitle}>
            Create and manage healthcare team member accounts.
          </Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Feather name="x" size={20} color="#6b7280" />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={form.name}
          onChangeText={(value) =>
            setForm((prev) => ({ ...prev, name: value }))
          }
          style={styles.input}
          placeholder="Full name"
        />
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={form.email}
          onChangeText={(value) => {
            setForm((prev) => ({ ...prev, email: value }));
            setEmailError("");
          }}
          style={styles.input}
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {emailError ? (
          <Text style={styles.fieldError}>{emailError}</Text>
        ) : null}
      </View>

      <View style={styles.row}>
        <View style={[styles.fieldWrap, styles.rowField]}>
          <Text style={styles.label}>Country Code</Text>
          <Pressable
            style={styles.selectBtn}
            onPress={() => setCodePickerOpen(true)}
          >
            <Text style={styles.selectText}>
              {form.phoneCountryCode || "Select code"}
            </Text>
            <Feather name="chevron-down" size={16} color="#6b7280" />
          </Pressable>
        </View>

        <View style={[styles.fieldWrap, styles.rowField]}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            value={form.phone}
            onChangeText={(value) => {
              setForm((prev) => ({ ...prev, phone: value }));
              setPhoneError("");
            }}
            style={styles.input}
            placeholder="Phone number"
            keyboardType="phone-pad"
          />
        </View>
      </View>
      {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Role</Text>
        <Pressable
          style={[
            styles.selectBtn,
            disableRoleChange ? styles.selectDisabled : null,
          ]}
          onPress={() => {
            if (!disableRoleChange) {
              setRolePickerOpen(true);
            }
          }}
        >
          <Text style={styles.selectText}>{getRoleDisplayName(form.role)}</Text>
          <Feather name="chevron-down" size={16} color="#6b7280" />
        </Pressable>
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
            loading ? styles.submitDisabled : null,
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitText}>
            {loading ? "Saving..." : staff ? "Save Changes" : "Create Staff"}
          </Text>
        </Pressable>
      </View>

      <PickerModal
        open={rolePickerOpen}
        title="Select Role"
        value={form.role}
        onClose={() => setRolePickerOpen(false)}
        onSelect={(value) => setForm((prev) => ({ ...prev, role: value }))}
        options={CREATE_ROLES.map((role) => ({
          value: role,
          label: getRoleDisplayName(role),
        }))}
      />

      <PickerModal
        open={codePickerOpen}
        title="Select Country Code"
        value={form.phoneCountryCode}
        onClose={() => setCodePickerOpen(false)}
        onSelect={(value) => {
          setForm((prev) => ({ ...prev, phoneCountryCode: value }));
          setPhoneError("");
        }}
        options={PHONE_COUNTRY_CODES.map((item) => ({
          value: item.code,
          label: item.label,
        }))}
      />
    </ScrollView>
  );
}

function PickerModal({
  open,
  title,
  value,
  onClose,
  onSelect,
  options,
}: {
  open: boolean;
  title: string;
  value: string;
  onClose: () => void;
  onSelect: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  if (!open) {
    return null;
  }

  return (
    <View style={styles.pickerOverlay}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose} />
      <View style={styles.pickerCard}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={18} color="#6b7280" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.pickerList}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.pickerItem,
                  selected ? styles.pickerItemActive : null,
                ]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    selected ? styles.pickerItemTextActive : null,
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
        </ScrollView>
      </View>
    </View>
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
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rowField: {
    flex: 1,
  },
  label: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
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
  selectBtn: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
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
  },
  fieldError: {
    color: "#b91c1c",
    fontSize: 12,
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
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    padding: 20,
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  pickerCard: {
    maxHeight: "70%",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 8,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  pickerList: {
    gap: 6,
  },
  pickerItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerItemActive: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
  },
  pickerItemText: {
    color: "#111827",
    fontSize: 13,
  },
  pickerItemTextActive: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
});
