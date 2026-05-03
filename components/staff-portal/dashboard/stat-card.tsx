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
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      style={({ pressed }: { pressed?: boolean }) => [
        styles.card,
        onPress && pressed ? styles.cardPressed : null,
      ]}
      {...(onPress ? { onPress } : {})}
    >
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}

      {layout === "center" ? (
        <View style={styles.centerLayout}>
          <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
            <Feather name={icon} size={20} color="#1f2937" />
          </View>
          <Text style={styles.valueText}>{value}</Text>
          <Text style={styles.subtitleText}>{subtitle || title}</Text>
        </View>
      ) : (
        <View style={styles.sideLayout}>
          <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
            <Feather name={icon} size={20} color="#1f2937" />
          </View>
          <View>
            <Text style={styles.sideValueText}>{value}</Text>
            <Text style={styles.subtitleText}>{subtitle || title}</Text>
          </View>
        </View>
      )}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    minHeight: 122,
    justifyContent: "center",
  },
  cardPressed: {
    opacity: 0.9,
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#f59e0b",
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#111827",
    fontSize: 11,
    fontWeight: "700",
  },
  centerLayout: {
    alignItems: "center",
    gap: 8,
  },
  sideLayout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  },
  sideValueText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 22,
  },
  subtitleText: {
    color: "#6b7280",
    fontSize: 13,
  },
});
