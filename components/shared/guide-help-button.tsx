import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";

import { type GuideTourStep, useGuideTour } from "@/context/guide-tour-context";

type Props = {
  tourId: string;
  tourSteps: GuideTourStep[];
};

export default function GuideHelpButton({ tourId, tourSteps }: Props) {
  const { startTour } = useGuideTour();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Take tour"
      onPress={() => startTour(tourId, tourSteps)}
      style={styles.button}
    >
      <Feather name="compass" size={15} color="#334155" />
      <Text style={styles.label}>Take tour</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-end",
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  label: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
});
