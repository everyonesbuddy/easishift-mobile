import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import api from "@/config/api";

const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;
const TEMP_PREMIUM_RATE = 0.35;
const SAVINGS_RATE = 0.24;
const BEEHIIV_MAGIC_LINK_TEMPLATE =
  "https://magic.beehiiv.com/v1/d46e492b-b716-407d-80d5-80ad8b9b4512?email=<email>";

const DEFAULTS = {
  employees: 120,
  hourlyWage: 20,
  overtimeCostPerWeek: 800,
  tempMonthlySpend: 6000,
  schedulingHoursPerWeek: 18,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function alignToStep(value: number, step: number, min: number) {
  if (!step || step <= 0) {
    return value;
  }

  const snapped = Math.round((value - min) / step) * step + min;
  return Number(snapped.toFixed(4));
}

function buildBeehiivMagicLink(email: string) {
  const encodedEmail = encodeURIComponent(email);
  return BEEHIIV_MAGIC_LINK_TEMPLATE.replace("<email>", encodedEmail).replace(
    "{{email}}",
    encodedEmail,
  );
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

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to send summary right now. Please try again.";
}

function InputWithSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  helper,
  adornment,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  helper?: string;
  adornment?: string;
}) {
  const [draftValue, setDraftValue] = useState(String(value));

  const commitDraft = () => {
    if (draftValue.trim() === "") {
      setDraftValue(String(value));
      return;
    }

    const parsed = Number(draftValue);
    if (Number.isNaN(parsed)) {
      setDraftValue(String(value));
      return;
    }

    const normalized = alignToStep(clamp(parsed, min, max), step, min);
    onChange(normalized);
    setDraftValue(String(normalized));
  };

  return (
    <View style={styles.inputCard}>
      <View style={styles.inputHeaderRow}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.inputWrap}>
          {adornment ? (
            <Text style={styles.inputAdornment}>{adornment}</Text>
          ) : null}
          <TextInput
            value={draftValue}
            onChangeText={(next) => {
              if (next === "" || /^\d*\.?\d*$/.test(next)) {
                setDraftValue(next);
              }
            }}
            onBlur={commitDraft}
            onSubmitEditing={commitDraft}
            keyboardType="decimal-pad"
            style={styles.inputField}
            returnKeyType="done"
          />
        </View>
      </View>

      <Slider
        value={value}
        onValueChange={(next) => {
          const nextValue = Number(next);
          onChange(nextValue);
          setDraftValue(String(nextValue));
        }}
        minimumValue={min}
        maximumValue={max}
        step={step}
        minimumTrackTintColor="#1565c0"
        maximumTrackTintColor="#cbd5e1"
        thumbTintColor="#1565c0"
      />

      {helper ? <Text style={styles.helperText}>{helper}</Text> : null}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function ActionButton({
  label,
  onPress,
  variant,
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant: "filled" | "outline";
  icon?: React.ComponentProps<typeof Feather>["name"];
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.buttonBase,
        variant === "filled" ? styles.buttonFilled : styles.buttonOutline,
        pressed ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      {icon ? (
        <Feather
          name={icon}
          size={15}
          color={variant === "filled" ? "#ffffff" : "#0f172a"}
          style={styles.buttonIcon}
        />
      ) : null}
      <Text
        style={
          variant === "filled"
            ? styles.buttonFilledText
            : styles.buttonOutlineText
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function CostLeakCalculatorScreen() {
  const [employees, setEmployees] = useState(DEFAULTS.employees);
  const [hourlyWage, setHourlyWage] = useState(DEFAULTS.hourlyWage);
  const [overtimeCostPerWeek, setOvertimeCostPerWeek] = useState(
    DEFAULTS.overtimeCostPerWeek,
  );
  const [tempMonthlySpend, setTempMonthlySpend] = useState(
    DEFAULTS.tempMonthlySpend,
  );
  const [schedulingHoursPerWeek, setSchedulingHoursPerWeek] = useState(
    DEFAULTS.schedulingHoursPerWeek,
  );
  const [email, setEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const metrics = useMemo(() => {
    const overtimeCostLeak = overtimeCostPerWeek * WEEKS_PER_YEAR;
    const temporaryPremiumLeak =
      tempMonthlySpend * MONTHS_PER_YEAR * TEMP_PREMIUM_RATE;
    const managerHourlyRate = Math.max(hourlyWage * 1.8, 28);
    const schedulingCoordinationLeak =
      schedulingHoursPerWeek * managerHourlyRate * WEEKS_PER_YEAR;

    const totalAnnualLeak =
      overtimeCostLeak + temporaryPremiumLeak + schedulingCoordinationLeak;
    const projectedSavings = totalAnnualLeak * SAVINGS_RATE;

    return {
      overtimeCostLeak,
      temporaryPremiumLeak,
      schedulingCoordinationLeak,
      totalAnnualLeak,
      projectedSavings,
    };
  }, [
    hourlyWage,
    overtimeCostPerWeek,
    schedulingHoursPerWeek,
    tempMonthlySpend,
  ]);

  const handleSendSummary = async () => {
    const trimmedEmail = email.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!isValidEmail) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    const payload = {
      recipientEmail: trimmedEmail,
      source: "wisershifts.com/cost-leak-calculator",
      calculatorType: "Labor cost leak estimator",
      inputs: {
        employees,
        hourlyWage,
        overtimeCostPerWeek,
        tempMonthlySpend,
        schedulingHoursPerWeek,
      },
      outputs: {
        overtimeCostLeak: metrics.overtimeCostLeak,
        temporaryPremiumLeak: metrics.temporaryPremiumLeak,
        schedulingCoordinationLeak: metrics.schedulingCoordinationLeak,
        totalAnnualLeak: metrics.totalAnnualLeak,
        projectedSavings: metrics.projectedSavings,
        savingsRate: SAVINGS_RATE,
      },
      meta: {
        sentAt: new Date().toISOString(),
      },
    };

    try {
      setSendingEmail(true);
      await Linking.openURL(buildBeehiivMagicLink(trimmedEmail));
      await api.post("/marketing/cost-leak/email-summary", payload);
      Alert.alert(
        "Summary sent",
        "Check your inbox for the cost leak summary.",
      );
    } catch (error) {
      Alert.alert("Send failed", getErrorMessage(error));
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerWrap}>
          <Text style={styles.title}>Cost Leak Calculator (Estimator)</Text>
          <Text style={styles.subtitle}>
            Estimate your annual labor cost leak in under 60 seconds. No
            spreadsheets. Just numbers you already know.
          </Text>
        </View>

        <View style={styles.panelCard}>
          <Text style={styles.cardTitle}>Your Numbers</Text>
          <View style={styles.stack}>
            <InputWithSlider
              label="Number of employees"
              value={employees}
              onChange={setEmployees}
              min={10}
              max={1500}
            />
            <InputWithSlider
              label="Average hourly wage"
              value={hourlyWage}
              onChange={setHourlyWage}
              min={10}
              max={80}
              step={0.5}
              adornment="$"
              helper="Approximate is fine - default $20/hr"
            />
            <InputWithSlider
              label="Estimated overtime cost per week"
              value={overtimeCostPerWeek}
              onChange={setOvertimeCostPerWeek}
              min={0}
              max={50000}
              step={50}
              adornment="$"
              helper="If unsure, estimate total weekly overtime payroll cost"
            />
            <InputWithSlider
              label="Monthly spend on temporary / contract workers"
              value={tempMonthlySpend}
              onChange={setTempMonthlySpend}
              min={0}
              max={120000}
              step={500}
              adornment="$"
            />
            <InputWithSlider
              label="Hours per week managers spend scheduling or filling shifts"
              value={schedulingHoursPerWeek}
              onChange={setSchedulingHoursPerWeek}
              min={0}
              max={120}
              helper="Include time spent filling gaps, coordinating, and chasing coverage"
            />
          </View>
        </View>

        <View style={styles.impactCard}>
          <Text style={styles.sectionEyebrow}>
            Total Estimated Annual Labor Cost Leak
          </Text>
          <Text style={styles.metricPrimaryLarge}>
            {formatMoney(metrics.totalAnnualLeak)}
          </Text>
          <Text style={styles.helperText}>
            This estimate is based on typical labor patterns for organizations
            of similar size and structure.
          </Text>

          <Divider />

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Overtime Cost</Text>
            <Text style={styles.metricSecondary}>
              {formatMoney(metrics.overtimeCostLeak)}
            </Text>
            <Text style={styles.driverLabel}>
              Weekly overtime spend x 52 weeks
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Temporary Labor Cost Premium</Text>
            <Text style={styles.metricSecondary}>
              {formatMoney(metrics.temporaryPremiumLeak)}
            </Text>
            <Text style={styles.driverLabel}>
              Monthly temp spend x 12 x 35% agency markup premium
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>
              Scheduling and Admin Time Cost
            </Text>
            <Text style={styles.metricSecondary}>
              {formatMoney(metrics.schedulingCoordinationLeak)}
            </Text>
            <Text style={styles.driverLabel}>
              Scheduling hrs/wk x estimated manager rate x 52 weeks
            </Text>
          </View>

          <Divider />

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>
              Projected savings with Wisershifts (
              {formatPercent(SAVINGS_RATE * 100)})
            </Text>
            <Text style={styles.metricSavings}>
              {formatMoney(metrics.projectedSavings)}/yr
            </Text>
            <Text style={styles.driverLabel}>
              Total annual leak x 24% - based on typical reduction seen with
              improved scheduling visibility
            </Text>
          </View>

          <Divider />

          <View style={styles.stack}>
            <TextInput
              placeholder="you@company.com"
              value={email}
              onChangeText={setEmail}
              style={styles.emailInput}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <ActionButton
              onPress={handleSendSummary}
              disabled={sendingEmail}
              variant="outline"
              icon="mail"
              label={sendingEmail ? "Sending..." : "Email me this summary"}
            />
            <ActionButton
              onPress={() =>
                Linking.openURL("https://calendly.com/wisershifts-info/30min")
              }
              variant="filled"
              icon="phone-call"
              label="See how Wisershifts reduces this - book a 30 min call"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fbff",
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 20,
  },
  headerWrap: {
    gap: 6,
  },
  title: {
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -0.6,
    fontWeight: "900",
    color: "#0f172a",
  },
  subtitle: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
  },
  panelCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.1)",
    padding: 14,
    backgroundColor: "#ffffff",
  },
  impactCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(21, 101, 192, 0.14)",
    padding: 14,
    backgroundColor: "#eff6ff",
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 4,
  },
  sectionEyebrow: {
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 11,
    fontWeight: "700",
  },
  stack: {
    gap: 10,
  },
  inputCard: {
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.12)",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  inputHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  inputLabel: {
    flex: 1,
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
  },
  inputWrap: {
    minWidth: 96,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.15)",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 8,
  },
  inputAdornment: {
    marginRight: 4,
    color: "#334155",
    fontWeight: "700",
  },
  inputField: {
    paddingVertical: 7,
    minWidth: 52,
    textAlign: "right",
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
  },
  helperText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  metricRow: {
    gap: 3,
  },
  metricLabel: {
    color: "#475569",
    fontSize: 13,
  },
  metricPrimaryLarge: {
    color: "#0f172a",
    fontSize: 32,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  metricSecondary: {
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "900",
  },
  metricSavings: {
    color: "#047857",
    fontSize: 28,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(15, 23, 42, 0.12)",
    marginVertical: 4,
  },
  driverLabel: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 18,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.16)",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "600",
    color: "#0f172a",
  },
  buttonBase: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonFilled: {
    backgroundColor: "#1565c0",
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.2)",
    backgroundColor: "#ffffff",
  },
  buttonFilledText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
    textAlign: "center",
  },
  buttonOutlineText: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 14,
    textAlign: "center",
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
