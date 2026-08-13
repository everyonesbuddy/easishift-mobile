import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/context/auth-context";

type Plan = {
  key: string;
  name: string;
  priceLabel: string;
  price: number | null;
  seats: number | string;
  supportTier: "standard" | "priority";
  isEnterprise?: boolean;
  highlight: boolean;
};

const YEARLY_PLANS: Plan[] = [
  {
    key: "starterYearly",
    name: "Starter",
    priceLabel: "$4,000/yr",
    price: 4000,
    seats: 50,
    supportTier: "standard",
    highlight: false,
  },
  {
    key: "growthYearly",
    name: "Growth",
    priceLabel: "$7,000/yr",
    price: 7000,
    seats: 100,
    supportTier: "standard",
    highlight: true,
  },
  {
    key: "premiumYearly",
    name: "Premium",
    priceLabel: "$9,000/yr",
    price: 9000,
    seats: 150,
    supportTier: "priority",
    highlight: false,
  },
  {
    key: "enterpriseYearly",
    name: "Enterprise",
    priceLabel: "Custom pricing",
    price: null,
    seats: "150+",
    supportTier: "priority",
    isEnterprise: true,
    highlight: false,
  },
];

const SHARED_FEATURE_LIST = [
  "Automated scheduling",
  "Shift swaps",
  "Time-off management",
  "Internal messaging",
  "Coverage planning",
  "Staff directory",
];

const WEBSITE_BILLING_URL = "https://www.wisershifts.com";

export default function ManageSubscriptionPage() {
  const { tenant } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const getCapacityLabel = (plan: Plan) =>
    plan.isEnterprise
      ? `${plan.seats} active employees`
      : `Up to ${plan.seats} active employees`;

  const getSupportLabel = (plan: Plan) =>
    plan.supportTier === "priority" ? "Priority support" : "Standard support";

  const getPlanDisplayName = (planKey?: string | null) => {
    const displayMap: Record<string, string> = {
      starterYearly: "Starter Annual",
      growthYearly: "Growth Annual",
      premiumYearly: "Premium Annual",
      enterpriseYearly: "Enterprise Annual",
    };

    if (!planKey) return "No plan";
    return displayMap[planKey] || planKey;
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

  const billingEmailLabel =
    typeof tenant.billingEmail === "string" &&
    tenant.billingEmail.trim().length > 0
      ? tenant.billingEmail
      : "Not set";
  const tenantRecord = tenant as any;
  const currentPlanKey = String(tenantRecord?.planKey ?? "");

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Manage Subscription</Text>
          <Text style={styles.subtitle}>
            Review your current plan and plan reference details. Mobile billing
            is view-only.
          </Text>
        </View>

        <View style={styles.webOnlyNotice}>
          <Text style={styles.webOnlyNoticeText}>
            Subscription setup, upgrades, and cancellations are managed in the
            web portal. This mobile page is view-only.
          </Text>
        </View>

        <View style={styles.currentCard}>
          <View style={styles.currentCardTop}>
            <View>
              <Text style={styles.currentTitle}>Current subscription</Text>
              <Text style={styles.currentSubtext}>
                Mobile view only. Use the web portal to make changes.
              </Text>
            </View>
            <View
              style={[
                styles.statusChip,
                (tenant.subscriptionStatus || "inactive") === "active"
                  ? styles.statusChipActive
                  : styles.statusChipNeutral,
              ]}
            >
              <Text style={styles.statusChipText}>
                {tenant.subscriptionStatus || "Inactive"}
              </Text>
            </View>
          </View>

          <View style={styles.currentSummaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Plan</Text>
              <Text style={styles.summaryValue}>
                {currentPlanKey
                  ? getPlanDisplayName(currentPlanKey)
                  : "No plan"}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Seats</Text>
              <Text style={styles.summaryValue}>{tenant.seatLimit ?? "1"}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Billing</Text>
              <Text style={styles.summaryValue}>{billingEmailLabel}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Plan reference</Text>

        <View style={styles.planGrid}>
          {YEARLY_PLANS.map((plan) => (
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
                  <View style={styles.planBadgeRow}>
                    {currentPlanKey === plan.key ? (
                      <Text style={styles.currentPlanPill}>Current plan</Text>
                    ) : null}
                    {plan.highlight ? (
                      <Text style={styles.popularPill}>Most popular</Text>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.planCycle}>Per facility / year</Text>
                <Text style={styles.planPrice}>{plan.priceLabel}</Text>
                <Text style={styles.planPriceHint}>
                  {plan.isEnterprise
                    ? "Custom plan details are available through WiserShifts support."
                    : `Equivalent to $${Math.round((plan.price ?? 0) / 12)}/mo billed yearly`}
                </Text>
                <Text style={styles.planSeats}>{getCapacityLabel(plan)}</Text>

                <View style={styles.featureList}>
                  {[getSupportLabel(plan), ...SHARED_FEATURE_LIST].map(
                    (feature) => (
                      <View key={feature} style={styles.featureItem}>
                        <Feather
                          name="check-circle"
                          size={14}
                          color="#2563eb"
                        />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ),
                  )}
                </View>
              </View>

              <Text style={styles.referenceText}>
                {plan.isEnterprise
                  ? "Enterprise pricing is available through direct WiserShifts support."
                  : "Displayed for plan comparison and internal subscription reference."}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.footerText}>
          One price per facility. Each facility is billed independently.
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
  webOnlyNotice: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  webOnlyNoticeText: {
    color: "#1e3a8a",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "600",
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
    gap: 10,
  },
  currentCardTop: {
    gap: 8,
  },
  currentTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  currentSubtext: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  statusChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipActive: {
    backgroundColor: "#dcfce7",
  },
  statusChipNeutral: {
    backgroundColor: "#e5e7eb",
  },
  statusChipText: {
    color: "#111827",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  currentSummaryGrid: {
    gap: 8,
  },
  summaryCard: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  summaryLabel: {
    color: "#6b7280",
    fontSize: 11,
  },
  summaryValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3,
  },
  portalButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  portalButtonText: {
    color: "#ffffff",
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
  planBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 6,
    flexShrink: 1,
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
  currentPlanPill: {
    color: "#166534",
    backgroundColor: "#dcfce7",
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
  referenceText: {
    color: "#6b7280",
    fontSize: 11,
  },
  footerText: {
    color: "#6b7280",
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: 2,
  },
} as any);
