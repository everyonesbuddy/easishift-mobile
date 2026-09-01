import { Feather } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useGuideTour } from "@/context/guide-tour-context";

export default function GuideTourOverlay() {
  const { activeTour, endTour, nextStep, prevStep, stepIndex } = useGuideTour();
  const step = activeTour?.steps[stepIndex];

  if (!activeTour || !step) {
    return null;
  }

  const isLastStep = stepIndex === activeTour.steps.length - 1;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={endTour}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.stepCount}>
              Step {stepIndex + 1} of {activeTour.steps.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close guide"
              hitSlop={8}
              onPress={endTour}
            >
              <Feather name="x" size={20} color="#64748b" />
            </Pressable>
          </View>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>
          <View style={styles.actions}>
            <Pressable onPress={endTour} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>Skip tour</Text>
            </Pressable>
            <View style={styles.primaryActions}>
              {stepIndex > 0 ? (
                <Pressable onPress={prevStep} style={styles.backButton}>
                  <Text style={styles.backButtonLabel}>Back</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={nextStep} style={styles.nextButton}>
                <Text style={styles.nextButtonLabel}>
                  {isLastStep ? "Done" : "Next"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15,23,42,0.65)",
  },
  card: {
    borderRadius: 8,
    backgroundColor: "#ffffff",
    padding: 20,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepCount: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
  },
  body: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  primaryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  textButton: {
    minHeight: 38,
    justifyContent: "center",
  },
  textButtonLabel: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  backButton: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 7,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  backButtonLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  nextButton: {
    minHeight: 38,
    borderRadius: 7,
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  nextButtonLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
});
