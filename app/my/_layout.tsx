import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs, useRouter } from "expo-router";
import { ActivityIndicator, type ColorValue, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, kit } from "@/components/ios/kit";
import PinScreen from "@/components/staff-link/pin-screen";
import { IOS } from "@/constants/ios";
import { useStaffLink } from "@/context/staff-link-context";

/**
 * Staff side of the app: the same personal link as on the web, kept on
 * this phone. No account or password; an optional PIN per device.
 */
export default function MyScheduleLayout() {
  const { ready, token, me, loadError, submitPin, forget, reload } = useStaffLink();
  const router = useRouter();

  if (!ready) return <Centered />;
  if (!token) return <Redirect href="/staff-start" />;

  if (loadError) {
    return (
      <SafeAreaView style={[kit.screen, styles.center]}>
        <Feather name="link-2" size={30} color={IOS.secondary} />
        <Text style={[kit.title, { textAlign: "center", marginTop: 12 }]}>{loadError}</Text>
        <View style={{ gap: 10, marginTop: 20, alignSelf: "stretch" }}>
          <Button title="Try again" onPress={() => void reload()} />
          <Button
            kind="gray"
            title="Use a different link"
            onPress={async () => {
              await forget();
              router.replace("/staff-start");
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!me) return <Centered />;

  if (me.locked) {
    return (
      <PinScreen
        key={me.pin?.set ? "enter" : "choose"}
        firstName={me.staff?.firstName}
        facilityName={me.facility?.name}
        pinSet={Boolean(me.pin?.set)}
        onSubmit={submitPin}
        onUseAnotherLink={async () => {
          await forget();
          router.replace("/staff-start");
        }}
      />
    );
  }

  const f = me.features || {};

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: IOS.blue,
        tabBarInactiveTintColor: IOS.secondary,
        tabBarStyle: {
          backgroundColor: "rgba(249,249,249,0.96)",
          borderTopColor: IOS.hairline,
          ...(Platform.OS === "web" ? { height: 62, paddingBottom: 8 } : null),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        sceneStyle: { backgroundColor: IOS.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Shifts", tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} /> }} />
      <Tabs.Screen name="open" options={{ title: "Open", tabBarIcon: ({ color }) => <TabIcon name="plus-circle" color={color} />, href: f.pickup ? undefined : null }} />
      <Tabs.Screen name="swaps" options={{ title: "Swaps", tabBarIcon: ({ color }) => <TabIcon name="repeat" color={color} />, href: f.swaps ? undefined : null }} />
      <Tabs.Screen name="time-off" options={{ title: "Time off", tabBarIcon: ({ color }) => <TabIcon name="sun" color={color} /> }} />
      <Tabs.Screen name="clock" options={{ title: "Clock in", tabBarIcon: ({ color }) => <TabIcon name="clock" color={color} />, href: f.clockIn ? undefined : null }} />
      <Tabs.Screen name="messages" options={{ title: "Messages", href: null }} />
    </Tabs>
  );
}

function TabIcon({ name, color }: { name: keyof typeof Feather.glyphMap; color: ColorValue }) {
  return <Feather name={name} size={22} color={color as string} />;
}

function Centered() {
  return (
    <View style={[kit.screen, styles.center]}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
});
