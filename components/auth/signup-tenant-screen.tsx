import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
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

const TERMS_VERSION = "1.0";
const TERMS_URL = "https://www.wisershifts.com/terms-and-conditions";
const PRIVACY_URL = "https://www.wisershifts.com/privacy-policy";
const EULA_URL = "https://www.wisershifts.com/eula";

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

const INDUSTRIES = [
  "Healthcare",
  "Senior Living",
  "Retail",
  "Hospitality",
  "Manufacturing",
  "Education",
  "Transportation",
  "Finance",
  "Police",
  "Warehouse and Logistics",
  "Security Service",
  "Other",
] as const;

function validateEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function getErrorMessage(error: unknown) {
  const fallbackMessage = "Failed to create tenant. Try again.";
  const maybeMessage =
    typeof error === "object" && error !== null && "response" in error
      ? (error as { response?: { data?: { message?: unknown } } }).response
          ?.data?.message
      : undefined;

  return typeof maybeMessage === "string" ? maybeMessage : fallbackMessage;
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

function IndustryField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.codeSelector,
          error ? styles.inputErrorBorder : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.codeLabel}>Industry</Text>
        <Text style={styles.codeValue}>{value || "Select Industry"}</Text>
      </Pressable>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.selectorBackdrop}>
          <View style={styles.selectorCard}>
            <Text style={styles.selectorTitle}>Choose Industry</Text>

            <ScrollView style={styles.selectorList}>
              {INDUSTRIES.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.selectorItem,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.selectorItemText}>{item}</Text>
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
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState("");
  const [hospitalNameError, setHospitalNameError] = useState("");
  const [adminNameError, setAdminNameError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [industryError, setIndustryError] = useState("");
  const [tenantPhoneError, setTenantPhoneError] = useState("");
  const [adminPhoneError, setAdminPhoneError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState("");
  const [loading, setLoading] = useState(false);

  const openLegalLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      setError("Unable to open legal link.");
    });
  };

  const isFormValid = useMemo(() => {
    const hasRequiredText =
      Boolean(hospitalName.trim()) &&
      Boolean(address.trim()) &&
      Boolean(adminName.trim()) &&
      Boolean(adminPassword.trim()) &&
      Boolean(adminEmail.trim()) &&
      Boolean(industry);

    const isPasswordValid = adminPassword.length >= 8;
    const isEmailValid = validateEmail(adminEmail);

    const hasTenantPhoneCountryCode = Boolean(tenantPhoneCountryCode.trim());
    const hasTenantPhone = Boolean(tenantPhone.trim());
    const isTenantPhoneValid = hasTenantPhoneCountryCode === hasTenantPhone;

    const hasAdminPhoneCountryCode = Boolean(userPhoneCountryCode.trim());
    const hasAdminPhone = Boolean(userPhone.trim());
    const isAdminPhoneValid = hasAdminPhoneCountryCode === hasAdminPhone;

    return (
      hasRequiredText &&
      isPasswordValid &&
      isEmailValid &&
      isTenantPhoneValid &&
      isAdminPhoneValid &&
      termsAccepted
    );
  }, [
    address,
    adminEmail,
    adminName,
    adminPassword,
    hospitalName,
    industry,
    tenantPhone,
    tenantPhoneCountryCode,
    termsAccepted,
    userPhone,
    userPhoneCountryCode,
  ]);

  const handleSubmit = async () => {
    setError("");
    setHospitalNameError("");
    setAdminNameError("");
    setAddressError("");
    setPasswordError("");
    setEmailError("");
    setIndustryError("");
    setTenantPhoneError("");
    setAdminPhoneError("");
    setTermsError("");

    if (!hospitalName.trim()) {
      setHospitalNameError("Facility name is required");
      return;
    }

    if (!address.trim()) {
      setAddressError("Facility address is required");
      return;
    }

    if (!adminName.trim()) {
      setAdminNameError("Admin name is required");
      return;
    }

    if (!adminPassword.trim()) {
      setPasswordError("Password is required");
      return;
    }

    if (adminPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    const hasTenantPhoneCountryCode = Boolean(tenantPhoneCountryCode.trim());
    const hasTenantPhone = Boolean(tenantPhone.trim());
    if (hasTenantPhoneCountryCode !== hasTenantPhone) {
      setTenantPhoneError(
        "Facility phone and country code must be provided together",
      );
      return;
    }

    const hasAdminPhoneCountryCode = Boolean(userPhoneCountryCode.trim());
    const hasAdminPhone = Boolean(userPhone.trim());
    if (hasAdminPhoneCountryCode !== hasAdminPhone) {
      setAdminPhoneError(
        "Admin phone and country code must be provided together",
      );
      return;
    }

    if (!validateEmail(adminEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (!industry) {
      setIndustryError("Please select an industry");
      return;
    }

    if (!termsAccepted) {
      setTermsError("You must accept the Terms and Conditions to continue");
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
        industry,
        adminName,
        termsAccepted: true,
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: new Date().toISOString(),
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
          <Text style={styles.title}>Sign Up Facility</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            placeholder="Facility Name"
            value={hospitalName}
            onChangeText={(value) => {
              setHospitalName(value);
              setHospitalNameError("");
            }}
            style={[
              styles.input,
              hospitalNameError ? styles.inputErrorBorder : null,
            ]}
          />
          {hospitalNameError ? (
            <Text style={styles.inlineError}>{hospitalNameError}</Text>
          ) : null}

          <View style={styles.row}>
            <View style={styles.codeFieldWrap}>
              <CountryCodeField
                label="Country Code"
                value={tenantPhoneCountryCode}
                onChange={(value) => {
                  setTenantPhoneCountryCode(value);
                  setTenantPhoneError("");
                }}
              />
            </View>
            <View style={styles.fieldFlex}>
              <TextInput
                placeholder="Facility Phone"
                value={tenantPhone}
                onChangeText={(value) => {
                  setTenantPhone(value);
                  setTenantPhoneError("");
                }}
                keyboardType="phone-pad"
                style={[
                  styles.input,
                  tenantPhoneError ? styles.inputErrorBorder : null,
                ]}
              />
            </View>
          </View>
          {tenantPhoneError ? (
            <Text style={styles.inlineError}>{tenantPhoneError}</Text>
          ) : null}

          <TextInput
            placeholder="Facility Address"
            value={address}
            onChangeText={(value) => {
              setAddress(value);
              setAddressError("");
            }}
            style={[
              styles.input,
              addressError ? styles.inputErrorBorder : null,
            ]}
          />
          {addressError ? (
            <Text style={styles.inlineError}>{addressError}</Text>
          ) : null}

          <IndustryField
            value={industry}
            onChange={(value) => {
              setIndustry(value);
              setIndustryError("");
            }}
            error={industryError}
          />
          {industryError ? (
            <Text style={styles.inlineError}>{industryError}</Text>
          ) : null}

          <Text style={styles.sectionLabel}>Admin Info</Text>

          <TextInput
            placeholder="Admin Name"
            value={adminName}
            onChangeText={(value) => {
              setAdminName(value);
              setAdminNameError("");
            }}
            style={[
              styles.input,
              adminNameError ? styles.inputErrorBorder : null,
            ]}
          />
          {adminNameError ? (
            <Text style={styles.inlineError}>{adminNameError}</Text>
          ) : null}

          <View style={styles.row}>
            <View style={styles.codeFieldWrap}>
              <CountryCodeField
                label="Country Code"
                value={userPhoneCountryCode}
                onChange={(value) => {
                  setUserPhoneCountryCode(value);
                  setAdminPhoneError("");
                }}
              />
            </View>
            <View style={styles.fieldFlex}>
              <TextInput
                placeholder="Admin Phone"
                value={userPhone}
                onChangeText={(value) => {
                  setUserPhone(value);
                  setAdminPhoneError("");
                }}
                keyboardType="phone-pad"
                style={[
                  styles.input,
                  adminPhoneError ? styles.inputErrorBorder : null,
                ]}
              />
            </View>
          </View>
          {adminPhoneError ? (
            <Text style={styles.inlineError}>{adminPhoneError}</Text>
          ) : null}

          <TextInput
            placeholder="Admin Email"
            value={adminEmail}
            onChangeText={(value) => {
              setAdminEmail(value);
              setEmailError("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, emailError ? styles.inputErrorBorder : null]}
          />
          {emailError ? (
            <Text style={styles.inlineError}>{emailError}</Text>
          ) : null}

          <TextInput
            placeholder="Password"
            value={adminPassword}
            onChangeText={(value) => {
              setAdminPassword(value);
              setPasswordError("");
            }}
            secureTextEntry
            style={[
              styles.input,
              passwordError ? styles.inputErrorBorder : null,
            ]}
          />
          {passwordError ? (
            <Text style={styles.inlineError}>{passwordError}</Text>
          ) : null}

          <View style={styles.termsWrap}>
            <Pressable
              onPress={() => {
                setTermsAccepted((prev) => !prev);
                setTermsError("");
              }}
              style={({ pressed }) => [
                styles.checkbox,
                termsAccepted ? styles.checkboxChecked : null,
                pressed ? styles.pressed : null,
              ]}
            >
              {termsAccepted ? (
                <Text style={styles.checkboxTick}>✓</Text>
              ) : null}
            </Pressable>

            <Text style={styles.termsText}>
              I agree to the{" "}
              <Text
                style={styles.termsLink}
                onPress={() => openLegalLink(TERMS_URL)}
              >
                Terms and Conditions
              </Text>
              {", "}
              <Text
                style={styles.termsLink}
                onPress={() => openLegalLink(PRIVACY_URL)}
              >
                Privacy Policy
              </Text>
              {" and "}
              <Text
                style={styles.termsLink}
                onPress={() => openLegalLink(EULA_URL)}
              >
                EULA
              </Text>
            </Text>
          </View>

          {termsError ? (
            <Text style={styles.inlineError}>{termsError}</Text>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={loading || !isFormValid}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.pressed : null,
              loading || !isFormValid ? styles.disabled : null,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Facility</Text>
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
  inputErrorBorder: {
    borderColor: "#dc2626",
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
  termsWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#0f172a",
    borderRadius: 4,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  checkboxTick: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 14,
  },
  termsText: {
    flex: 1,
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 18,
  },
  termsLink: {
    color: "#1d4ed8",
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.58,
  },
});
