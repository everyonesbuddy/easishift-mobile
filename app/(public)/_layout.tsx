import { Slot } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function PublicLayout() {
  return (
    <View style={styles.page}>
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
