import { ScrollView, StyleSheet, Text, View } from "react-native";

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
  price: number | null;
  seats: number | string;
  supportTier: "standard" | "priority";
  highlight?: boolean;
  isEnterprise?: boolean;
};

const YEARLY_PLANS: Plan[] = [
  {
    key: "starterYearly",
    name: "Starter",
    priceLabel: "$4,000/yr",
    price: 4000,
    seats: 50,
    supportTier: "standard",
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
  },
  {
    key: "enterpriseYearly",
    name: "Enterprise",
    priceLabel: "Custom pricing",
    price: null,
    seats: "150+",
    supportTier: "priority",
    isEnterprise: true,
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

export default function Paywall({ tenant }: Props) {
  const getCapacityLabel = (plan: Plan) =>
    plan.isEnterprise
      ? `${plan.seats} active employees`
      : `Up to ${plan.seats} active employees`;

  const getSupportLabel = (plan: Plan) =>
    plan.supportTier === "priority" ? "Priority support" : "Standard support";

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

        <View style={styles.planColumn}>
          {YEARLY_PLANS.map((plan) => (
            <View
              key={plan.key}
              style={[
                styles.planCard,
                plan.highlight ? styles.planCardHighlight : null,
              ]}
            >
              <View style={styles.planHeaderRow}>
                <View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planPeriodLabel}>
                    Per facility / year
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
                  : `Equivalent to $${Math.round((plan.price ?? 0) / 12)}/mo billed yearly`}
              </Text>
              <Text style={styles.planSeats}>{getCapacityLabel(plan)}</Text>

              <View style={styles.planDivider} />

              {[getSupportLabel(plan), ...SHARED_FEATURE_LIST].map(
                (feature) => (
                  <View
                    key={`${plan.key}-${feature}`}
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

        <View style={styles.implementationWrap}>
          <View style={styles.implementationHeader}>
            <Text style={styles.implementationBadge}>Recommended</Text>
            <Text style={styles.implementationTitle}>
              Guided Implementation
            </Text>
            <Text style={styles.implementationSub}>
              A hands-on launch package for teams that want a smoother rollout
              with direct support from day one.
            </Text>

            <View style={styles.startingAtWrap}>
              <Text style={styles.startingAtLabel}>STARTING AT</Text>
              <Text style={styles.startingAtPrice}>$2,500</Text>
              <Text style={styles.startingAtSub}>per location</Text>
            </View>
          </View>

          <View style={styles.implementationBody}>
            <Text style={styles.includesLabel}>INCLUDES</Text>
            {[
              "Employee import",
              "Schedule configuration",
              "Manager training",
              "Go-live support",
            ].map((item) => (
              <View key={item} style={styles.includesItem}>
                <Text style={styles.featureBullet}>•</Text>
                <Text style={styles.includesText}>{item}</Text>
              </View>
            ))}

            <View style={styles.implementationAside}>
              <Text style={styles.implementationAsideText}>
                Self-serve setup is always available at no additional cost. Many
                teams choose to get started on their own and add implementation
                later if needed.
              </Text>
            </View>
          </View>
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
  implementationWrap: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  implementationHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.06)",
    backgroundColor: "#f8fbff",
    gap: 8,
  },
  implementationBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: "800",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  implementationTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  implementationSub: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 19,
  },
  startingAtWrap: {
    marginTop: 2,
  },
  startingAtLabel: {
    color: "#6b7280",
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "700",
  },
  startingAtPrice: {
    color: "#111827",
    fontSize: 29,
    fontWeight: "900",
    marginTop: 2,
  },
  startingAtSub: {
    color: "#6b7280",
    fontSize: 12,
  },
  implementationBody: {
    padding: 14,
    gap: 9,
  },
  includesLabel: {
    color: "#6b7280",
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "700",
  },
  includesItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: "rgba(15,23,42,0.03)",
  },
  includesText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  implementationAside: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fbfdff",
    gap: 9,
  },
  implementationAsideText: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 18,
  },
  footerNote: {
    marginTop: 10,
    color: "#6b7280",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});
