import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: keyof typeof Feather.glyphMap;
  layout?: "center" | "side";
  bgColor?: string;
  badge?: number | string | null;
  onPress?: () => void;
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  layout = "center",
  bgColor = "#e3f2fd",
  badge,
  onPress,
}: Props) {
  const hasBadge = badge !== null && badge !== undefined && badge !== "";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        onPress && pressed ? styles.cardPressed : null,
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        {hasBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>

      {layout === "center" ? (
        <View style={styles.centerLayout}>
          <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
            <Feather name={icon} size={20} color="#1f2937" />
          </View>
          <Text style={styles.valueText}>{value}</Text>
          <Text style={[styles.subtitleText, styles.centerSubtitleText]}>
            {subtitle || title}
          </Text>
        </View>
      ) : (
        <View style={styles.sideLayout}>
          <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
            <Feather name={icon} size={20} color="#1f2937" />
          </View>
          <View style={styles.sideContent}>
            <Text style={styles.sideValueText}>{value}</Text>
            <Text style={styles.subtitleText}>{subtitle || title}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    minHeight: 132,
    justifyContent: "flex-start",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.96,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: "#f59e0b",
    borderRadius: 999,
    minWidth: 24,
    minHeight: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  badgeText: {
    color: "#111827",
    fontSize: 11,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    lineHeight: 14,
    flex: 1,
  },
  centerLayout: {
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  sideLayout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  sideContent: {
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 27,
    lineHeight: 32,
  },
  sideValueText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 22,
    lineHeight: 28,
  },
  subtitleText: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 18,
  },
  centerSubtitleText: {
    textAlign: "center",
  },
});
