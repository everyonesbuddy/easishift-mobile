import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PublicNavItem = {
  id: string;
  label: string;
  to: string;
};

const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { id: "login", label: "Login", to: "/login" },
  { id: "roi", label: "ROI", to: "/turnover-roi-calculator" },
];

function isRouteActive(pathname: string, to: string) {
  if (to === "/") {
    return pathname === "/";
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function PublicTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [logoFailed, setLogoFailed] = useState(false);

  const navigateTo = (to: string) => {
    router.push(to as Parameters<typeof router.push>[0]);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigateTo("/")}
          style={({ pressed }) => [
            styles.brandLeft,
            pressed ? styles.pressed : null,
          ]}
        >
          {logoFailed ? (
            <Text style={styles.brandFallback}>WISERSHIFTS</Text>
          ) : (
            <Image
              source={require("@/assets/logos/wiserShifts-logo-light.svg")}
              style={styles.logo}
              contentFit="contain"
              onError={() => setLogoFailed(true)}
            />
          )}
        </Pressable>

        <View style={styles.navLinks}>
          {PUBLIC_NAV_ITEMS.map((item) => {
            const active = isRouteActive(pathname, item.to);

            return (
              <Pressable
                key={item.id}
                onPress={() => navigateTo(item.to)}
                style={({ pressed }) => [pressed ? styles.pressed : null]}
              >
                <Text
                  style={[styles.navLink, active ? styles.navLinkActive : null]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingLeft: 0,
    paddingRight: 16,
    paddingBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandLeft: {
    paddingVertical: 2,
  },
  logo: {
    width: 180,
    height: 34,
  },
  brandFallback: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  navLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    justifyContent: "flex-end",
    flexShrink: 0,
  },
  navLink: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
  },
  navLinkActive: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.84,
  },
});
