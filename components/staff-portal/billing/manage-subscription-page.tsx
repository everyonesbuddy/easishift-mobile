import { Feather } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import api from "@/config/api";
import { useAuth } from "@/context/auth-context";

type Plan = {
  key: string;
  name: string;
  priceLabel: string;
  price: number;
  seats: number;
  highlight: boolean;
};

const YEARLY_PLANS: Plan[] = [
  {
    key: "starterYearly",
    name: "Starter",
    priceLabel: "$4,000/yr",
    price: 4000,
    seats: 50,
    highlight: false,
  },
  {
    key: "growthYearly",
    name: "Growth",
    priceLabel: "$7,000/yr",
    price: 7000,
    seats: 100,
    highlight: true,
  },
  {
    key: "premiumYearly",
    name: "Premium",
    priceLabel: "$9,000/yr",
    price: 9000,
    seats: 150,
    highlight: false,
  },
];

const MONTHLY_PLANS: Plan[] = [
  {
    key: "starterMonthly",
    name: "Starter",
    priceLabel: "$400/mo",
    price: 400,
    seats: 50,
    highlight: false,
  },
  {
    key: "growthMonthly",
    name: "Growth",
    priceLabel: "$700/mo",
    price: 700,
    seats: 100,
    highlight: true,
  },
  {
    key: "premiumMonthly",
    name: "Premium",
    priceLabel: "$900/mo",
    price: 900,
    seats: 150,
    highlight: false,
  },
];

const FEATURE_LIST = [
  "Priority support",
  "Advanced reporting",
  "Automated scheduling tools",
];

function getYearlySavingsPercent() {
  const sampleMonthly = MONTHLY_PLANS[0]?.price;
  const sampleYearly = YEARLY_PLANS[0]?.price;

  if (!sampleMonthly || !sampleYearly) {
    return null;
  }

  const monthlyTotal = sampleMonthly * 12;
  const savingsPercent = Math.round(
    ((monthlyTotal - sampleYearly) / monthlyTotal) * 100,
  );

  return Number.isFinite(savingsPercent) ? savingsPercent : null;
}

export default function ManageSubscriptionPage() {
  const { tenant, refreshTenant } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<"yearly" | "monthly">(
    "yearly",
  );

  const plans = useMemo(
    () => (billingPeriod === "yearly" ? YEARLY_PLANS : MONTHLY_PLANS),
    [billingPeriod],
  );

  const yearlySavingsPercent = useMemo(() => getYearlySavingsPercent(), []);

  const handleChoosePlan = async (planKey: string) => {
    if (!tenant?._id || typeof tenant._id !== "string") {
      setError("Tenant details are missing.");
      return;
    }

    setError(null);
    setSuccess("");
    setLoadingPlan(planKey);

    try {
      const res = await api.post("/stripe/create-checkout-session", {
        tenantId: tenant._id,
        planKey,
      });

      const url =
        typeof res?.data?.url === "string" && res.data.url.length > 0
          ? res.data.url
          : "";

      if (!url) {
        setError("Missing checkout URL from server");
        return;
      }

      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        setError("Unable to open checkout URL on this device.");
        return;
      }

      await Linking.openURL(url);
    } catch (requestError: unknown) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (requestError as { response?: { data?: { message?: string } } })
              .response?.data?.message || "Request failed"
          : "Request failed";

      setError(message);
    } finally {
      setLoadingPlan(null);
    }
  };

  const requestCancelSubscription = (atPeriodEnd: boolean) => {
    Alert.alert(
      "Cancel subscription",
      atPeriodEnd
        ? "Cancel at period end? Users will keep access until the billing period ends."
        : "Cancel immediately? This will stop access now.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => {
            void handleCancelSubscription({ atPeriodEnd });
          },
        },
      ],
    );
  };

  const handleCancelSubscription = async (opts: { atPeriodEnd: boolean }) => {
    if (!tenant?._id || typeof tenant._id !== "string") {
      setError("Tenant details are missing.");
      return;
    }

    setError(null);
    setSuccess("");

    try {
      setLoadingPlan("cancel");
      await api.post("/stripe/cancel-subscription", {
        tenantId: tenant._id,
        atPeriodEnd: Boolean(opts.atPeriodEnd),
      });
      await refreshTenant();
      setSuccess(
        "Subscription cancellation requested. Changes may take a moment to appear.",
      );
    } catch (requestError: unknown) {
      const message =
        typeof requestError === "object" &&
        requestError !== null &&
        "response" in requestError &&
        typeof (requestError as { response?: { data?: { message?: string } } })
          .response?.data?.message === "string"
          ? (requestError as { response?: { data?: { message?: string } } })
              .response?.data?.message || "Failed to cancel subscription"
          : "Failed to cancel subscription";

      setError(message);
    } finally {
      setLoadingPlan(null);
    }
  };

  if (!tenant) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingText}>Loading tenant...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const planLabel =
    typeof tenant.planKey === "string" && tenant.planKey.trim().length > 0
      ? tenant.planKey
      : "None";

  const billingEmailLabel =
    typeof tenant.billingEmail === "string" &&
    tenant.billingEmail.trim().length > 0
      ? tenant.billingEmail
      : "Not set";

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Manage Subscription</Text>
          <Text style={styles.subtitle}>
            View your current plan, billing details, and upgrade options.
          </Text>
        </View>

        <View style={styles.periodTabs}>
          <Pressable
            style={[
              styles.periodTab,
              billingPeriod === "yearly" ? styles.periodTabActive : null,
            ]}
            onPress={() => setBillingPeriod("yearly")}
          >
            <Text
              style={[
                styles.periodTabText,
                billingPeriod === "yearly" ? styles.periodTabTextActive : null,
              ]}
            >
              Yearly
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.periodTab,
              billingPeriod === "monthly" ? styles.periodTabActive : null,
            ]}
            onPress={() => setBillingPeriod("monthly")}
          >
            <Text
              style={[
                styles.periodTabText,
                billingPeriod === "monthly" ? styles.periodTabTextActive : null,
              ]}
            >
              Monthly
            </Text>
          </Pressable>
        </View>

        <View style={styles.tipPill}>
          <Text style={styles.tipText}>
            {billingPeriod === "yearly" && yearlySavingsPercent
              ? `Yearly saves ${yearlySavingsPercent}% compared to monthly`
              : "Monthly offers flexibility with no long-term commitment"}
          </Text>
        </View>

        <View style={styles.currentCard}>
          <Text style={styles.currentTitle}>Current subscription</Text>
          <Text style={styles.currentLine}>
            Status:{" "}
            <Text style={styles.bold}>
              {tenant.subscriptionStatus || "inactive"}
            </Text>
          </Text>
          <Text style={styles.currentLine}>
            Plan: <Text style={styles.bold}>{planLabel}</Text> • Seats:{" "}
            <Text style={styles.bold}>{tenant.seatLimit ?? "1"}</Text>
          </Text>
          <Text style={styles.currentLine}>
            Billing: <Text style={styles.bold}>{billingEmailLabel}</Text>
          </Text>

          <View style={styles.currentActions}>
            <Pressable
              style={styles.cancelBtn}
              disabled={loadingPlan === "cancel"}
              onPress={() => requestCancelSubscription(true)}
            >
              <Text style={styles.cancelBtnText}>
                {loadingPlan === "cancel"
                  ? "Processing..."
                  : "Cancel at period end"}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.cancelBtn, styles.cancelNowBtn]}
              disabled={loadingPlan === "cancel"}
              onPress={() => requestCancelSubscription(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel now</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Upgrade options</Text>

        <View style={styles.planGrid}>
          {plans.map((plan) => (
            <View
              key={plan.key}
              style={[
                styles.planCard,
                plan.highlight ? styles.planCardHighlight : null,
              ]}
            >
              <View style={styles.planTop}>
                <View style={styles.planTitleRow}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.highlight ? (
                    <Text style={styles.popularPill}>Most popular</Text>
                  ) : null}
                </View>

                <Text style={styles.planCycle}>
                  Per facility / {billingPeriod === "yearly" ? "year" : "month"}
                </Text>

                <Text style={styles.planPrice}>{plan.priceLabel}</Text>
                <Text style={styles.planPriceHint}>
                  {billingPeriod === "yearly"
                    ? `Equivalent to $${Math.round(plan.price / 12)}/mo billed yearly`
                    : "Billed monthly, cancel anytime"}
                </Text>

                <Text style={styles.planSeats}>{plan.seats} seats</Text>

                <View style={styles.featureList}>
                  {FEATURE_LIST.map((feature) => (
                    <View key={feature} style={styles.featureItem}>
                      <Feather name="check-circle" size={14} color="#2563eb" />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {tenant.planKey === plan.key ? (
                <View style={styles.currentPlanBtn}>
                  <Text style={styles.currentPlanBtnText}>Current plan</Text>
                </View>
              ) : (
                <Pressable
                  style={[
                    styles.planActionBtn,
                    plan.highlight ? styles.planActionBtnHighlight : null,
                    loadingPlan === plan.key ? styles.planActionDisabled : null,
                  ]}
                  onPress={() => handleChoosePlan(plan.key)}
                  disabled={loadingPlan === plan.key}
                >
                  {loadingPlan === plan.key ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Feather
                        name="arrow-up-right"
                        size={14}
                        color="#ffffff"
                      />
                      <Text style={styles.planActionText}>Get started</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <Text style={styles.footerText}>
          One price per facility. Each facility is billed independently.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: "#6b7280",
    fontSize: 13,
  },
  content: {
    padding: 16,
    paddingTop: 28,
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    gap: 3,
    alignItems: "center",
  },
  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    textAlign: "center",
  },
  periodTabs: {
    alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.06)",
    borderRadius: 999,
    padding: 4,
    flexDirection: "row",
    gap: 4,
  },
  periodTab: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  periodTabActive: {
    backgroundColor: "#ffffff",
  },
  periodTabText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "800",
  },
  periodTabTextActive: {
    color: "#111827",
  },
  tipPill: {
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#dbeafe",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tipText: {
    color: "#1e40af",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  currentCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 6,
  },
  currentTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  currentLine: {
    color: "#4b5563",
    fontSize: 13,
  },
  bold: {
    color: "#111827",
    fontWeight: "800",
  },
  currentActions: {
    marginTop: 8,
    gap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cancelBtn: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelNowBtn: {
    backgroundColor: "#1d4ed8",
  },
  cancelBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  planGrid: {
    gap: 12,
  },
  planCard: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 12,
  },
  planCardHighlight: {
    borderColor: "#2563eb",
    borderWidth: 2,
  },
  planTop: {
    gap: 8,
  },
  planTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  planName: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  popularPill: {
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "800",
  },
  planCycle: {
    color: "#6b7280",
    fontSize: 12,
  },
  planPrice: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
  },
  planPriceHint: {
    color: "#6b7280",
    fontSize: 12,
  },
  planSeats: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  featureList: {
    gap: 6,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    color: "#111827",
    fontSize: 13,
  },
  currentPlanBtn: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#9ca3af",
    alignItems: "center",
    justifyContent: "center",
  },
  currentPlanBtnText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  planActionBtn: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  planActionBtnHighlight: {
    backgroundColor: "#2563eb",
  },
  planActionDisabled: {
    opacity: 0.8,
  },
  planActionText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
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
  success: {
    color: "#065f46",
    backgroundColor: "#d1fae5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  footerText: {
    color: "#6b7280",
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
  },
});
