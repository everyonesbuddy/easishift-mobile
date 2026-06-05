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

const DEFAULTS = {
  employees: 50,
  hourlyWage: 22,
  weeklyHours: 40,
  turnoverRate: 65,
  vacancyDays: 30,
};

const RECRUITMENT_COST_PER_HIRE = 2000;
const MANAGER_HOURLY_RATE = 25;
const SCHEDULING_HOURS_PER_WEEK = 10;
const WEEKS_PER_YEAR = 52;
const PRODUCTIVITY_FACTOR = 0.5;
const WISERSHIFTS_SAVINGS_RATE = 0.28;
const BEEHIIV_MAGIC_LINK_TEMPLATE =
  "https://magic.beehiiv.com/v1/861bd1b1-f350-4ecc-a6fc-ab3e0eca93f6?email=<email>";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
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

export default function TurnoverRoiCalculatorScreen() {
  const [employees, setEmployees] = useState(DEFAULTS.employees);
  const [hourlyWage, setHourlyWage] = useState(DEFAULTS.hourlyWage);
  const [weeklyHours, setWeeklyHours] = useState(DEFAULTS.weeklyHours);
  const [turnoverRate, setTurnoverRate] = useState(DEFAULTS.turnoverRate);
  const [vacancyDays, setVacancyDays] = useState(DEFAULTS.vacancyDays);
  const [email, setEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const metrics = useMemo(() => {
    const annualTurnoverEvents = employees * (turnoverRate / 100);
    const vacancyWeeks = vacancyDays / 7;

    const recruitmentPerEvent = RECRUITMENT_COST_PER_HIRE;
    const onboardingPerEvent = hourlyWage * weeklyHours * 4;
    const overtimePerEvent = hourlyWage * 1.5 * weeklyHours * vacancyWeeks;
    const productivityPerEvent =
      hourlyWage * weeklyHours * 8 * PRODUCTIVITY_FACTOR;

    const costPerTurnoverEvent =
      recruitmentPerEvent +
      onboardingPerEvent +
      overtimePerEvent +
      productivityPerEvent;

    const recruitmentAnnual = recruitmentPerEvent * annualTurnoverEvents;
    const onboardingAnnual = onboardingPerEvent * annualTurnoverEvents;
    const overtimeAnnual = overtimePerEvent * annualTurnoverEvents;
    const productivityAnnual = productivityPerEvent * annualTurnoverEvents;

    const annualTurnoverCost =
      recruitmentAnnual +
      onboardingAnnual +
      overtimeAnnual +
      productivityAnnual;

    const schedulingAdminCost =
      MANAGER_HOURLY_RATE * SCHEDULING_HOURS_PER_WEEK * WEEKS_PER_YEAR;

    const totalCost = annualTurnoverCost + schedulingAdminCost;
    const projectedSavings = totalCost * WISERSHIFTS_SAVINGS_RATE;

    return {
      annualTurnoverEvents,
      costPerTurnoverEvent,
      annualTurnoverCost,
      schedulingAdminCost,
      totalCost,
      projectedSavings,
      drivers: [
        {
          label: `Recruitment (${Math.round(annualTurnoverEvents)} hires @ ${formatMoney(
            RECRUITMENT_COST_PER_HIRE,
          )})`,
          value: recruitmentAnnual,
        },
        { label: "Onboarding and training", value: onboardingAnnual },
        { label: "Overtime or agency fill", value: overtimeAnnual },
        { label: "Productivity loss", value: productivityAnnual },
        { label: "Scheduling admin time", value: schedulingAdminCost },
      ],
    };
  }, [employees, hourlyWage, weeklyHours, turnoverRate, vacancyDays]);

  const handleSendSummary = async () => {
    const trimmedEmail = email.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!isValidEmail) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    const payload = {
      recipientEmail: trimmedEmail,
      source: "wisershifts.com/turnover-roi-calculator",
      calculatorType: "LTC turnover ROI calculator",
      inputs: {
        employees,
        hourlyWage,
        weeklyHours,
        turnoverRate,
        vacancyDays,
      },
      outputs: {
        annualTurnoverEvents: metrics.annualTurnoverEvents,
        costPerTurnoverEvent: metrics.costPerTurnoverEvent,
        annualTurnoverCost: metrics.annualTurnoverCost,
        schedulingAdminCost: metrics.schedulingAdminCost,
        totalCost: metrics.totalCost,
        projectedSavings: metrics.projectedSavings,
        savingsRate: WISERSHIFTS_SAVINGS_RATE,
      },
      costDrivers: metrics.drivers.map((driver) => ({
        label: driver.label,
        value: driver.value,
      })),
      meta: {
        sentAt: new Date().toISOString(),
      },
    };

    try {
      setSendingEmail(true);
      await Linking.openURL(buildBeehiivMagicLink(trimmedEmail));
      await api.post("/marketing/turnover-roi/email-summary", payload);
      Alert.alert("Summary sent", "Check your inbox for the ROI summary.");
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
          <Text style={styles.title}>LTC Turnover To ROI Calculator</Text>
          <Text style={styles.subtitle}>
            Estimate your annual turnover burden and see what WiserShifts can
            save.
          </Text>
        </View>

        <View style={styles.panelCard}>
          <Text style={styles.cardTitle}>Facility Inputs</Text>
          <View style={styles.stack}>
            <InputWithSlider
              label="Number of employees"
              value={employees}
              onChange={setEmployees}
              min={10}
              max={500}
            />
            <InputWithSlider
              label="Average hourly wage"
              value={hourlyWage}
              onChange={setHourlyWage}
              min={12}
              max={60}
              step={0.5}
              adornment="$"
            />
            <InputWithSlider
              label="Average hours per week"
              value={weeklyHours}
              onChange={setWeeklyHours}
              min={20}
              max={50}
            />
            <InputWithSlider
              label="Annual turnover rate"
              value={turnoverRate}
              onChange={setTurnoverRate}
              min={10}
              max={100}
              helper="Default: 65%"
            />
            <InputWithSlider
              label="Average time to fill vacancy"
              value={vacancyDays}
              onChange={setVacancyDays}
              min={7}
              max={90}
              helper="Default: 30 days"
            />
          </View>
        </View>

        <View style={styles.impactCard}>
          <Text style={styles.cardTitle}>Live Annual Impact</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Cost per turnover event</Text>
            <Text style={styles.metricPrimary}>
              {formatMoney(metrics.costPerTurnoverEvent)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Annual turnover cost</Text>
            <Text style={styles.metricPrimary}>
              {formatMoney(metrics.annualTurnoverCost)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Scheduling admin cost</Text>
            <Text style={styles.metricSecondary}>
              {formatMoney(metrics.schedulingAdminCost)}
            </Text>
          </View>

          <Divider />

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Total annual cost</Text>
            <Text style={styles.metricPrimaryLarge}>
              {formatMoney(metrics.totalCost)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>
              Projected savings with WiserShifts (28%)
            </Text>
            <Text style={styles.metricSavings}>
              {formatMoney(metrics.projectedSavings)}/yr
            </Text>
          </View>

          <Divider />

          <View style={styles.stackCompact}>
            {metrics.drivers.map((driver) => (
              <View key={driver.label} style={styles.driverRow}>
                <Text style={styles.driverLabel}>{driver.label}</Text>
                <Text style={styles.driverValue}>
                  {formatMoney(driver.value)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.stack}>
            <TextInput
              placeholder="you@facility.com"
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
                Linking.openURL("https://calendly.com/easishift-info/30min")
              }
              variant="filled"
              icon="phone-call"
              label="See how WiserShifts reduces this - book a 30 min call"
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
  stack: {
    gap: 10,
  },
  stackCompact: {
    gap: 6,
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
  metricPrimary: {
    color: "#0f172a",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.4,
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
  driverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  driverLabel: {
    color: "#334155",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  driverValue: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 13,
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
