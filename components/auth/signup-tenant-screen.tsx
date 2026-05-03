import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import api from "@/config/api";

const PHONE_COUNTRY_CODES = [
  { code: "+1", label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+353", label: "Ireland (+353)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+64", label: "New Zealand (+64)" },
  { code: "+27", label: "South Africa (+27)" },
  { code: "+91", label: "India (+91)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
];

function validateEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

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

  return "Failed to create tenant. Try again.";
}

function CountryCodeField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (!value) {
      return "Select";
    }

    return (
      PHONE_COUNTRY_CODES.find((item) => item.code === value)?.label ?? "Select"
    );
  }, [value]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.codeSelector,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.codeLabel}>{label}</Text>
        <Text style={styles.codeValue}>{selectedLabel}</Text>
      </Pressable>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.selectorBackdrop}>
          <View style={styles.selectorCard}>
            <Text style={styles.selectorTitle}>Choose Country Code</Text>

            <ScrollView style={styles.selectorList}>
              <Pressable
                onPress={() => {
                  onChange("");
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.selectorItem,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.selectorItemText}>Select</Text>
              </Pressable>

              {PHONE_COUNTRY_CODES.map((item) => (
                <Pressable
                  key={item.code}
                  onPress={() => {
                    onChange(item.code);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.selectorItem,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.selectorItemText}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              onPress={() => setOpen(false)}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function SignupTenantScreen() {
  const router = useRouter();

  const [hospitalName, setHospitalName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [tenantPhoneCountryCode, setTenantPhoneCountryCode] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [userPhoneCountryCode, setUserPhoneCountryCode] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setEmailError("");

    if (!validateEmail(adminEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/signup/tenant", {
        name: hospitalName,
        email: adminEmail,
        password: adminPassword,
        tenantPhoneCountryCode,
        tenantPhone,
        userPhoneCountryCode,
        userPhone,
        address,
        adminName,
      });

      router.replace("/login");
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
          <Text style={styles.title}>Sign Up Hospital</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            placeholder="Hospital Name"
            value={hospitalName}
            onChangeText={setHospitalName}
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={styles.codeFieldWrap}>
              <CountryCodeField
                label="Country Code"
                value={tenantPhoneCountryCode}
                onChange={setTenantPhoneCountryCode}
              />
            </View>
            <View style={styles.fieldFlex}>
              <TextInput
                placeholder="Facility Phone"
                value={tenantPhone}
                onChangeText={setTenantPhone}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>
          </View>

          <TextInput
            placeholder="Hospital Address"
            value={address}
            onChangeText={setAddress}
            style={styles.input}
          />

          <Text style={styles.sectionLabel}>Admin Info</Text>

          <TextInput
            placeholder="Admin Name"
            value={adminName}
            onChangeText={setAdminName}
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={styles.codeFieldWrap}>
              <CountryCodeField
                label="Country Code"
                value={userPhoneCountryCode}
                onChange={setUserPhoneCountryCode}
              />
            </View>
            <View style={styles.fieldFlex}>
              <TextInput
                placeholder="Admin Phone"
                value={userPhone}
                onChangeText={setUserPhone}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>
          </View>

          <TextInput
            placeholder="Admin Email"
            value={adminEmail}
            onChangeText={(value) => {
              setAdminEmail(value);
              setEmailError("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          {emailError ? (
            <Text style={styles.inlineError}>{emailError}</Text>
          ) : null}

          <TextInput
            placeholder="Password"
            value={adminPassword}
            onChangeText={setAdminPassword}
            secureTextEntry
            style={styles.input}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.pressed : null,
              loading ? styles.disabled : null,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Hospital</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    backgroundColor: "rgba(0, 0, 0, 0.03)",
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
  sectionLabel: {
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    marginTop: 3,
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
  row: {
    flexDirection: "row",
    gap: 8,
  },
  codeFieldWrap: {
    width: 165,
  },
  fieldFlex: {
    flex: 1,
  },
  codeSelector: {
    borderWidth: 1,
    borderColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    minHeight: 44,
    justifyContent: "center",
  },
  codeLabel: {
    fontSize: 11,
    color: "#475569",
    marginBottom: 2,
  },
  codeValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600",
  },
  selectorBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  selectorCard: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    padding: 14,
    gap: 10,
    maxHeight: "70%",
  },
  selectorTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 19,
  },
  selectorList: {
    maxHeight: 320,
  },
  selectorItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15, 23, 42, 0.08)",
  },
  selectorItemText: {
    color: "#0f172a",
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: "#42a5f5",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  secondaryButtonText: {
    color: "#0f172a",
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
  inlineError: {
    color: "#b91c1c",
    marginTop: -6,
    marginBottom: -2,
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.58,
  },
});
