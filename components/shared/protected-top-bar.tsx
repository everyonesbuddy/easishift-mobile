import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IOS } from "@/constants/ios";
import { useAuth } from "@/context/auth-context";

/** Facility name above the scheduler screens. */
export default function ProtectedTopBar() {
  const { tenant } = useAuth();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: Math.max(insets.top, 8) + 4 }]}>
      <Text style={styles.name} numberOfLines={1}>
        {tenant?.name || "WiserShifts"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 16, paddingBottom: 6, backgroundColor: IOS.canvas },
  name: { fontSize: 15, fontWeight: "600", color: IOS.secondary },
});
