import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";

type HomeScreenStyles = {
  safeArea: ViewStyle;
  content: ViewStyle;
  backdrop: ViewStyle;
  bubbleBase: ViewStyle;
  bubbleOne: ViewStyle;
  bubbleTwo: ViewStyle;
  bubbleThree: ViewStyle;
  bubbleFour: ViewStyle;
  bubbleFive: ViewStyle;
  brand: ViewStyle;
  logoRow: ViewStyle;
  logo: ImageStyle;
  title: TextStyle;
  subtitle: TextStyle;
  featureWrap: ViewStyle;
  featureCard: ViewStyle;
  featureIconWrap: ViewStyle;
  featureTitle: TextStyle;
  featureText: TextStyle;
  featureDots: ViewStyle;
  featureDot: ViewStyle;
  featureDotActive: ViewStyle;
  actionStack: ViewStyle;
  buttonBase: ViewStyle;
  buttonFilled: ViewStyle;
  buttonOutline: ViewStyle;
  buttonFilledText: TextStyle;
  buttonOutlineText: TextStyle;
  buttonIcon: TextStyle;
  buttonPressed: ViewStyle;
  buttonFullWidth: ViewStyle;
};

type FeatureSlide = {
  key: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  text: string;
};

const FEATURE_SLIDES: FeatureSlide[] = [
  {
    key: "speed",
    icon: "zap",
    title: "Faster scheduling",
    text: "Build your scheduling in minutes, not hours.",
  },
  {
    key: "communication",
    icon: "send",
    title: "Better communication",
    text: "Share updates instantly with the whole team.",
  },
  {
    key: "coverage",
    icon: "shield",
    title: "Clear shift coverage",
    text: "Catch gaps early and keep handoffs smooth.",
  },
];

function ActionButton({
  label,
  variant,
  onPress,
  icon,
  fullWidth,
}: {
  label: string;
  variant: "filled" | "outline";
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
  fullWidth?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        variant === "filled" ? styles.buttonFilled : styles.buttonOutline,
        fullWidth ? styles.buttonFullWidth : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      {icon ? (
        <Feather
          name={icon}
          size={16}
          color={variant === "filled" ? "#ffffff" : "#42a5f5"}
          style={styles.buttonIcon}
        />
      ) : null}
      <Text
        style={
          variant === "filled"
            ? styles.buttonFilledText
            : styles.buttonOutlineText
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Bubble({
  size,
  style,
  duration,
  delay,
}: {
  size: number;
  style: ViewStyle;
  duration: number;
  delay: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [delay, duration, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -14],
  });

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bubbleBase,
        { width: size, height: size, borderRadius: size / 2 },
        style,
        { transform: [{ translateY }, { scale }] },
      ]}
    />
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [activeFeature, setActiveFeature] = useState(0);

  const featureOpacity = useRef(new Animated.Value(1)).current;
  const featureTranslate = useRef(new Animated.Value(0)).current;
  const iconMotion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconMotion, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(iconMotion, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [iconMotion]);

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.parallel([
        Animated.timing(featureOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(featureTranslate, {
          toValue: -8,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setActiveFeature((prev) => (prev + 1) % FEATURE_SLIDES.length);
        featureTranslate.setValue(8);

        Animated.parallel([
          Animated.timing(featureOpacity, {
            toValue: 1,
            duration: 220,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(featureTranslate, {
            toValue: 0,
            duration: 220,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 2000);

    return () => clearInterval(timer);
  }, [featureOpacity, featureTranslate]);

  const activeSlide = FEATURE_SLIDES[activeFeature];

  const iconScale = iconMotion.interpolate({
    inputRange: [0, 1],
    outputRange: activeFeature === 0 ? [1, 1.14] : [1, 1.06],
  });
  const iconRotate = iconMotion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange:
      activeFeature === 1
        ? ["0deg", "10deg", "0deg"]
        : ["0deg", "0deg", "0deg"],
  });
  const iconLift = iconMotion.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: activeFeature === 2 ? [0, -7, 0] : [0, -2, 0],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.backdrop} />
        <Bubble size={84} duration={4200} delay={0} style={styles.bubbleOne} />
        <Bubble
          size={56}
          duration={5200}
          delay={600}
          style={styles.bubbleTwo}
        />
        <Bubble
          size={34}
          duration={3800}
          delay={1100}
          style={styles.bubbleThree}
        />
        <Bubble
          size={48}
          duration={4600}
          delay={350}
          style={styles.bubbleFour}
        />
        <Bubble
          size={24}
          duration={3400}
          delay={900}
          style={styles.bubbleFive}
        />

        <View style={styles.brand}>
          <View style={styles.logoRow}>
            <Image
              source={require("@/assets/logos/wiserShifts-icon-light.svg")}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.title}>WiserShifts</Text>
          </View>
          <Text style={styles.subtitle}>
            Login or create an account to open the staff portal.
          </Text>

          <View style={styles.featureWrap}>
            <Animated.View
              style={[
                styles.featureCard,
                {
                  opacity: featureOpacity,
                  transform: [{ translateY: featureTranslate }],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.featureIconWrap,
                  {
                    transform: [
                      { translateY: iconLift },
                      { scale: iconScale },
                      { rotate: iconRotate },
                    ],
                  },
                ]}
              >
                <Feather name={activeSlide.icon} size={18} color="#1d4ed8" />
              </Animated.View>
              <Text style={styles.featureTitle}>{activeSlide.title}</Text>
              <Text style={styles.featureText}>{activeSlide.text}</Text>
            </Animated.View>

            <View style={styles.featureDots}>
              {FEATURE_SLIDES.map((slide, index) => (
                <View
                  key={slide.key}
                  style={[
                    styles.featureDot,
                    index === activeFeature ? styles.featureDotActive : null,
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.actionStack}>
          <ActionButton
            label="Login"
            variant="filled"
            icon="log-in"
            onPress={() => router.push("/login")}
            fullWidth
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create<HomeScreenStyles>({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    justifyContent: "flex-end",
    backgroundColor: "#ffffff",
    position: "relative",
    overflow: "hidden",
  },
  backdrop: {
    position: "absolute",
    top: -60,
    right: -70,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(59, 130, 246, 0.07)",
  },
  bubbleBase: {
    position: "absolute",
    backgroundColor: "rgba(66, 165, 245, 0.14)",
  },
  bubbleOne: {
    top: 90,
    left: 10,
  },
  bubbleTwo: {
    top: 170,
    right: 18,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
  },
  bubbleThree: {
    bottom: 110,
    left: 40,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
  },
  bubbleFour: {
    top: 260,
    left: 24,
    backgroundColor: "rgba(66, 165, 245, 0.1)",
  },
  bubbleFive: {
    bottom: 220,
    right: 34,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
  },
  brand: {
    gap: 10,
    alignItems: "center",
    flex: 0,
    justifyContent: "center",
    marginBottom: 80,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 34,
    height: 34,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1,
    color: "#0f172a",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: "#475569",
    textAlign: "center",
    maxWidth: 320,
  },
  featureWrap: {
    width: "100%",
    alignItems: "center",
    marginTop: 8,
    gap: 10,
  },
  featureCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(66, 165, 245, 0.22)",
    backgroundColor: "rgba(239, 246, 255, 0.72)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 4,
    minHeight: 112,
    justifyContent: "center",
  },
  featureIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(29, 78, 216, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  featureText: {
    fontSize: 14,
    lineHeight: 19,
    color: "#475569",
    textAlign: "center",
    maxWidth: 280,
  },
  featureDots: {
    flexDirection: "row",
    gap: 7,
  },
  featureDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(148, 163, 184, 0.5)",
  },
  featureDotActive: {
    width: 18,
    backgroundColor: "#42a5f5",
  },
  actionStack: {
    gap: 12,
    marginTop: 0,
    justifyContent: "center",
  },
  buttonBase: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonFilled: {
    backgroundColor: "#42a5f5",
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: "rgba(66, 165, 245, 0.25)",
    backgroundColor: "#ffffff",
  },
  buttonFilledText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  buttonOutlineText: {
    color: "#42a5f5",
    fontWeight: "800",
    fontSize: 14,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonFullWidth: {
    width: "100%",
  },
});
