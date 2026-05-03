import type { Href } from "expo-router";
import { Link } from "expo-router";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

type ScreenLink = {
  href: Href;
  label: string;
};

type ScreenPlaceholderProps = {
  title: string;
  description: string;
  routePath: string;
  area: "Public" | "Protected";
  note?: string;
  links?: ScreenLink[];
};

export function ScreenPlaceholder({
  title,
  description,
  routePath,
  area,
  note,
  links,
}: ScreenPlaceholderProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={styles.card}>
          <View style={styles.badges}>
            <View style={styles.badge}>
              <ThemedText type="defaultSemiBold">{area}</ThemedText>
            </View>
            <View style={styles.badge}>
              <ThemedText>{routePath}</ThemedText>
            </View>
          </View>

          <ThemedText type="title" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText style={styles.description}>{description}</ThemedText>

          {note ? <ThemedText style={styles.note}>{note}</ThemedText> : null}

          {links?.length ? (
            <View style={styles.linksSection}>
              <ThemedText type="subtitle">Related routes</ThemedText>
              {links.map((link, index) => (
                <Link
                  key={`${link.label}-${index}`}
                  href={link.href}
                  style={styles.link}
                >
                  <ThemedText type="link">{link.label}</ThemedText>
                </Link>
              ))}
            </View>
          ) : null}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 30,
  },
  card: {
    borderRadius: 24,
    gap: 16,
    padding: 24,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  badge: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  title: {
    lineHeight: 36,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  note: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.75,
  },
  linksSection: {
    gap: 10,
    paddingTop: 8,
  },
  link: {
    paddingVertical: 4,
  },
});
