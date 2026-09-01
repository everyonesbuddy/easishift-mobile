import { useEffect, useState } from "react";

import api from "@/config/api";

export type BillingInterval = "month" | "year";

export type BillingPlan = {
  planKey: string;
  name: string;
  priceLabel: string;
  cadenceNote: string;
  seats: number | string;
  supportTier: "standard" | "priority";
  highlight: boolean;
  isEnterprise?: boolean;
};

type RawBillingPlan = {
  planKey: string;
  name: string;
  priceCents: number;
  interval: BillingInterval;
  seats: number;
};

const SHARED_FEATURE_LIST = [
  "Automated scheduling",
  "Shift swaps",
  "Time-off management",
  "Internal messaging",
  "Coverage planning",
  "Staff directory",
];

const PLAN_METADATA: Record<
  string,
  Pick<BillingPlan, "highlight" | "supportTier">
> = {
  starter: { highlight: false, supportTier: "standard" },
  growth: { highlight: true, supportTier: "standard" },
  premium: { highlight: false, supportTier: "priority" },
};

const FALLBACK_YEARLY_PLANS: BillingPlan[] = [
  {
    planKey: "starterYearly",
    name: "Starter",
    priceLabel: "$4,000/yr",
    cadenceNote: "Equivalent to $333/mo billed annually",
    seats: 50,
    supportTier: "standard",
    highlight: false,
  },
  {
    planKey: "growthYearly",
    name: "Growth",
    priceLabel: "$7,000/yr",
    cadenceNote: "Equivalent to $583/mo billed annually",
    seats: 100,
    supportTier: "standard",
    highlight: true,
  },
  {
    planKey: "premiumYearly",
    name: "Premium",
    priceLabel: "$9,000/yr",
    cadenceNote: "Equivalent to $750/mo billed annually",
    seats: 150,
    supportTier: "priority",
    highlight: false,
  },
];

const ENTERPRISE_PLAN: BillingPlan = {
  planKey: "enterprise",
  name: "Enterprise",
  priceLabel: "Custom pricing",
  cadenceNote: "Custom annual package",
  seats: "150+",
  supportTier: "priority",
  highlight: false,
  isEnterprise: true,
};

function getPlanFamily(planKey: string) {
  return planKey.replace(/(Monthly|Yearly)$/i, "").toLowerCase();
}

function formatPriceLabel(priceCents: number, interval: BillingInterval) {
  const amount = Math.round(priceCents / 100);
  return `$${amount.toLocaleString()}/${interval === "month" ? "mo" : "yr"}`;
}

function decoratePlan(plan: RawBillingPlan): BillingPlan {
  const metadata = PLAN_METADATA[getPlanFamily(plan.planKey)] ?? {
    highlight: false,
    supportTier: "standard" as const,
  };
  const amount = Math.round(plan.priceCents / 100);

  return {
    ...plan,
    ...metadata,
    priceLabel: formatPriceLabel(plan.priceCents, plan.interval),
    cadenceNote:
      plan.interval === "month"
        ? "Billed monthly"
        : `Equivalent to $${Math.round(amount / 12)}/mo billed annually`,
  };
}

export function getCapacityLabel(plan: BillingPlan) {
  return plan.isEnterprise
    ? `${plan.seats} active employees`
    : `Up to ${plan.seats} active employees`;
}

export function getSupportLabel(plan: BillingPlan) {
  return plan.supportTier === "priority"
    ? "Priority support"
    : "Standard support";
}

export { SHARED_FEATURE_LIST };

export function useBillingPlans(interval: BillingInterval) {
  const [plans, setPlans] = useState<BillingPlan[]>(
    interval === "year" ? FALLBACK_YEARLY_PLANS : [],
  );

  useEffect(() => {
    let active = true;
    setPlans(interval === "year" ? FALLBACK_YEARLY_PLANS : []);

    api
      .get<{ plans?: RawBillingPlan[] }>("/stripe/plans")
      .then((response) => {
        if (!active || !Array.isArray(response.data.plans)) return;

        const intervalPlans = response.data.plans
          .filter((plan) => plan.interval === interval)
          .map(decoratePlan);
        setPlans(intervalPlans);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [interval]);

  return [...plans, ENTERPRISE_PLAN];
}
