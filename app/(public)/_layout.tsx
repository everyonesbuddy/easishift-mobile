import { Slot } from "expo-router";
import { StyleSheet, View } from "react-native";

import PublicTopBar from "@/components/shared/public-top-bar";

export default function PublicLayout() {
  return (
    <View style={styles.page}>
      <PublicTopBar />
      <View style={styles.content}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flex: 1,
  },
});
