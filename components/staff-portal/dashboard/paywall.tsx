import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  type BillingInterval,
  getCapacityLabel,
  getSupportLabel,
  SHARED_FEATURE_LIST,
  useBillingPlans,
} from "@/components/staff-portal/billing/billing-plans";

type TenantLike = {
  _id?: string;
};

type Props = {
  tenant?: TenantLike | null;
};

export default function Paywall({ tenant }: Props) {
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("year");
  const plans = useBillingPlans(billingInterval);

  if (!tenant) {
    return null;
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.wrap}>
        <Text style={styles.title}>Activate your facility</Text>
        <Text style={styles.webOnlyNote}>
          Mobile billing is view-only. A facility admin can manage subscription
          details in the WiserShifts web portal.
        </Text>

        <View style={styles.intervalControl}>
          {(["year", "month"] as BillingInterval[]).map((interval) => (
            <Pressable
              key={interval}
              onPress={() => setBillingInterval(interval)}
              style={[
                styles.intervalButton,
                billingInterval === interval
                  ? styles.intervalButtonActive
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.intervalButtonText,
                  billingInterval === interval
                    ? styles.intervalButtonTextActive
                    : null,
                ]}
              >
                {interval === "year" ? "Yearly" : "Monthly"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.planColumn}>
          {plans.map((plan) => (
            <View
              key={plan.planKey}
              style={[
                styles.planCard,
                plan.highlight ? styles.planCardHighlight : null,
              ]}
            >
              <View style={styles.planHeaderRow}>
                <View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planPeriodLabel}>
                    {plan.isEnterprise
                      ? "Custom package"
                      : `Per facility / ${billingInterval === "year" ? "year" : "month"}`}
                  </Text>
                </View>
                {plan.highlight ? (
                  <Text style={styles.popularPill}>Most popular</Text>
                ) : null}
              </View>

              <Text style={styles.planPrice}>{plan.priceLabel}</Text>
              <Text style={styles.planSub}>
                {plan.isEnterprise
                  ? "Talk to sales for a custom package"
                  : plan.cadenceNote}
              </Text>
              <Text style={styles.planSeats}>{getCapacityLabel(plan)}</Text>

              <View style={styles.planDivider} />

              {[getSupportLabel(plan), ...SHARED_FEATURE_LIST].map(
                (feature) => (
                  <View
                    key={`${plan.planKey}-${feature}`}
                    style={styles.featureRow}
                  >
                    <Text style={styles.featureBullet}>•</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ),
              )}

              {!plan.isEnterprise ? (
                <Text style={styles.trialNote}>
                  Free trial availability is managed in the web portal.
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <Text style={styles.footerNote}>
          One price per facility. Each facility is billed independently.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  wrap: {
    marginTop: 12,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 14,
    gap: 10,
  },
  title: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 13,
    textAlign: "center",
  },
  webOnlyNote: {
    color: "#1e40af",
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
  badgeText: {
    color: "#1d4ed8",
    fontWeight: "600",
    fontSize: 12,
    textAlign: "center",
  },
  intervalControl: {
    alignSelf: "center",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    padding: 3,
    backgroundColor: "#eff6ff",
  },
  intervalButton: {
    minWidth: 88,
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: "center",
  },
  intervalButtonActive: {
    backgroundColor: "#2563eb",
  },
  intervalButtonText: {
    color: "#1e40af",
    fontSize: 12,
    fontWeight: "800",
  },
  intervalButtonTextActive: {
    color: "#ffffff",
  },
  planColumn: {
    gap: 10,
  },
  planCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.1)",
    padding: 12,
    backgroundColor: "#ffffff",
    gap: 7,
  },
  planHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  planPeriodLabel: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 2,
  },
  popularPill: {
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: "800",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  planCardHighlight: {
    borderColor: "#2563eb",
    borderWidth: 2,
  },
  planName: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  planPrice: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
  },
  planSub: {
    color: "#6b7280",
    fontSize: 12,
  },
  planSeats: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  planDivider: {
    marginTop: 4,
    marginBottom: 2,
    height: 1,
    backgroundColor: "rgba(15,23,42,0.09)",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  featureBullet: {
    color: "#1d4ed8",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  featureText: {
    color: "#111827",
    fontSize: 12,
  },
  trialNote: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 4,
  },
  footerNote: {
    marginTop: 10,
    color: "#6b7280",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});
