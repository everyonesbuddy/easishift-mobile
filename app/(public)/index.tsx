import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { kit } from "@/components/ios/kit";
import { IOS, tint } from "@/constants/ios";
import { useAuth } from "@/context/auth-context";
import { useStaffLink } from "@/context/staff-link-context";

/**
 * First screen. Staff open their schedule (no account); schedulers sign in.
 * Anyone already set up on this phone goes straight in.
 */
export default function Welcome() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { ready, token } = useStaffLink();

  if (loading || !ready) {
    return (
      <View style={[kit.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (user) return <Redirect href="/schedule" />;
  if (token) return <Redirect href="/my" />;

  return (
    <SafeAreaView style={kit.screen}>
      <View style={styles.top}>
        <Image source={require("@/assets/images/icon-192.png")} style={styles.logo} contentFit="contain" />
        <Text style={[kit.largeTitle, { textAlign: "center", marginTop: 18 }]}>WiserShifts</Text>
        <Text style={[kit.muted, { textAlign: "center", fontSize: 16, marginTop: 6, maxWidth: 300 }]}>
          Your schedule, swaps and time off in one place.
        </Text>
      </View>

      <View style={styles.choices}>
        <Choice
          icon="calendar"
          color={IOS.blue}
          title="I'm on the schedule"
          body="See your shifts, swap, pick up shifts and request time off. No password."
          onPress={() => router.push("/staff-start")}
        />
        <Choice
          icon="grid"
          color={IOS.purple}
          title="I make the schedule"
          body="Sign in to fill shifts, handle call-outs and approve requests."
          onPress={() => router.push("/login")}
        />
        <Pressable onPress={() => Linking.openURL("https://wisershifts.com/signup")} style={{ alignSelf: "center", padding: 12 }}>
          <Text style={{ color: IOS.secondary, fontSize: 14 }}>
            New facility? <Text style={{ color: IOS.blue, fontWeight: "600" }}>Start on wisershifts.com</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Choice({
  icon,
  color,
  title,
  body,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  color: string;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.choice, pressed && { opacity: 0.75 }]} accessibilityRole="button">
      <View style={[styles.choiceIcon, { backgroundColor: tint(color, 0.12) }]}>
        <Feather name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={kit.title}>{title}</Text>
        <Text style={[kit.muted, { marginTop: 2 }]}>{body}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={IOS.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  logo: { width: 76, height: 76, borderRadius: 18 },
  choices: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: IOS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS.hairline,
  },
  choiceIcon: { width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
