import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const CALCULATORS = [
  {
    title: "Turnover ROI Calculator",
    description:
      "Estimate annual turnover burden and projected Easishift savings based on headcount, wage, turnover, and vacancy timeline.",
    cta: "Open Turnover ROI",
    to: "/turnover-roi-calculator",
    icon: "trending-up",
    tag: "Retention & ROI",
  },
  {
    title: "Cost Leak Calculator (Estimator)",
    description:
      "Estimate annual labor cost leakage across overtime, temporary labor premium, scheduling effort, and coverage inefficiency.",
    cta: "Open Cost Leak Estimator",
    to: "/cost-leak-calculator",
    icon: "dollar-sign",
    tag: "Labor Cost",
  },
] as const;

export default function CalculatorsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerWrap}>
          <Text style={styles.title}>Workforce Calculators</Text>
          <Text style={styles.subtitle}>
            Explore practical estimators to quantify labor impact and potential
            savings with Easishift.
          </Text>
        </View>

        <View style={styles.grid}>
          {CALCULATORS.map((calculator) => (
            <View key={calculator.title} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <View style={styles.iconWrap}>
                    <Feather
                      name={
                        calculator.icon as React.ComponentProps<
                          typeof Feather
                        >["name"]
                      }
                      size={18}
                      color="#1565c0"
                    />
                  </View>
                  <Text style={styles.cardTitle}>{calculator.title}</Text>
                </View>
                <View style={styles.tagChip}>
                  <Text style={styles.tagText}>{calculator.tag}</Text>
                </View>
              </View>

              <Text style={styles.cardDescription}>
                {calculator.description}
              </Text>

              <Pressable
                onPress={() => router.push(calculator.to)}
                style={({ pressed }) => [
                  styles.button,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <Text style={styles.buttonText}>{calculator.cta}</Text>
                <Feather name="arrow-right" size={16} color="#ffffff" />
              </Pressable>
            </View>
          ))}
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
  grid: {
    gap: 10,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.1)",
    padding: 14,
    backgroundColor: "#ffffff",
    gap: 10,
  },
  cardHeader: {
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(25,118,210,0.1)",
  },
  cardTitle: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 18,
    flex: 1,
  },
  tagChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  cardDescription: {
    color: "#475569",
    lineHeight: 21,
  },
  button: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: "#1565c0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.88,
  },
});
