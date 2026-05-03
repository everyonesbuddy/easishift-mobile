import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import api from "@/config/api";

type TenantLike = {
  _id?: string;
};

type Props = {
  tenant?: TenantLike | null;
};

type Plan = {
  key: string;
  name: string;
  priceLabel: string;
  price: number;
  seats: number;
  highlight?: boolean;
};

const YEARLY_PLANS: Plan[] = [
  {
    key: "starterYearly",
    name: "Starter",
    priceLabel: "$4,000/yr",
    price: 4000,
    seats: 50,
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
  },
];

const MONTHLY_PLANS: Plan[] = [
  {
    key: "starterMonthly",
    name: "Starter",
    priceLabel: "$400/mo",
    price: 400,
    seats: 50,
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
  },
];

export default function Paywall({ tenant }: Props) {
  const [billingPeriod, setBillingPeriod] = useState<"yearly" | "monthly">(
    "yearly",
  );
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plans = billingPeriod === "yearly" ? YEARLY_PLANS : MONTHLY_PLANS;

  const yearlySavingsPercent = useMemo(() => {
    const sampleMonthly = MONTHLY_PLANS[0]?.price;
    const sampleYearly = YEARLY_PLANS[0]?.price;
    if (!sampleMonthly || !sampleYearly) {
      return null;
    }

    const monthlyTotal = sampleMonthly * 12;
    return Math.round(((monthlyTotal - sampleYearly) / monthlyTotal) * 100);
  }, []);

  const handleChoosePlan = async (planKey: string) => {
    if (!tenant?._id) {
      setError("Missing tenant id.");
      return;
    }

    setError(null);
    setLoadingPlan(planKey);

    try {
      const res = await api.post("/stripe/create-checkout-session", {
        tenantId: tenant._id,
        planKey,
      });

      const url = res.data?.url;
      if (typeof url === "string" && url.length > 0) {
        await Linking.openURL(url);
      } else {
        setError("Missing checkout URL from server.");
      }
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : err instanceof Error
            ? err.message
            : "Request failed";

      setError(message || "Request failed");
    } finally {
      setLoadingPlan(null);
    }
  };

  if (!tenant) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Activate your clinic</Text>
      <Text style={styles.subtitle}>
        Select a plan to unlock staff seats and activate your subscription.
      </Text>

      <View style={styles.switchRow}>
        <TouchableOpacity
          onPress={() => setBillingPeriod("yearly")}
          style={[
            styles.switchBtn,
            billingPeriod === "yearly" ? styles.switchBtnActive : null,
          ]}
        >
          <Text
            style={[
              styles.switchText,
              billingPeriod === "yearly" ? styles.switchTextActive : null,
            ]}
          >
            Yearly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setBillingPeriod("monthly")}
          style={[
            styles.switchBtn,
            billingPeriod === "monthly" ? styles.switchBtnActive : null,
          ]}
        >
          <Text
            style={[
              styles.switchText,
              billingPeriod === "monthly" ? styles.switchTextActive : null,
            ]}
          >
            Monthly
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.badgeText}>
        {billingPeriod === "yearly" && yearlySavingsPercent
          ? `Yearly saves ${yearlySavingsPercent}% compared to monthly`
          : "Monthly offers flexibility with no long-term commitment"}
      </Text>

      <View style={styles.planColumn}>
        {plans.map((plan) => (
          <View
            key={plan.key}
            style={[
              styles.planCard,
              plan.highlight ? styles.planCardHighlight : null,
            ]}
          >
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>{plan.priceLabel}</Text>
            <Text style={styles.planSub}>
              {billingPeriod === "yearly"
                ? `Equivalent to $${Math.round(plan.price / 12)}/mo billed yearly`
                : "Billed monthly, cancel anytime"}
            </Text>
            <Text style={styles.planSeats}>{plan.seats} seats</Text>

            <TouchableOpacity
              style={[
                styles.ctaBtn,
                plan.highlight ? styles.ctaBtnPrimary : null,
              ]}
              onPress={() => handleChoosePlan(plan.key)}
              disabled={loadingPlan === plan.key}
            >
              {loadingPlan === plan.key ? (
                <ActivityIndicator
                  size="small"
                  color={plan.highlight ? "#ffffff" : "#1d4ed8"}
                />
              ) : (
                <Text
                  style={[
                    styles.ctaText,
                    plan.highlight ? styles.ctaTextPrimary : null,
                  ]}
                >
                  Get started
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  switchRow: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    borderRadius: 999,
    padding: 4,
    alignSelf: "center",
  },
  switchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  switchBtnActive: {
    backgroundColor: "#ffffff",
  },
  switchText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
  },
  switchTextActive: {
    color: "#111827",
  },
  badgeText: {
    color: "#1d4ed8",
    fontWeight: "600",
    fontSize: 12,
    textAlign: "center",
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
  ctaBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  ctaBtnPrimary: {
    backgroundColor: "#2563eb",
  },
  ctaText: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  ctaTextPrimary: {
    color: "#ffffff",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 12,
  },
});
