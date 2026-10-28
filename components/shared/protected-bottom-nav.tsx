import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChangePasswordModal from "@/components/auth/change-password-modal";
import { ResidentsSheetLoader, useCanEnterResidents } from "@/components/scheduler/residents-today";
import { Button, Card, Row, Sheet, kit } from "@/components/ios/kit";
import { IOS, tint } from "@/constants/ios";
import { useAuth } from "@/context/auth-context";

type NavItem = { id: string; label: string; icon: keyof typeof Feather.glyphMap; to?: string };

const WEB = "https://wisershifts.com";

/**
 * Scheduler tabs: the on-the-go essentials. Setup (Weekly Needs, Facility
 * Preferences, billing, adding staff) stays on the web.
 */
export default function ProtectedBottomNav() {
  const { can, hasFeature, plan, usage, tenant, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [residentsOpen, setResidentsOpen] = useState(false);
  const canResidents = useCanEnterResidents();

  const items: NavItem[] = [
    { id: "schedule", label: "Schedule", icon: "calendar", to: "/schedule" },
    ...(hasFeature("swaps") ? [{ id: "swaps", label: "Swaps", icon: "repeat", to: "/swap-requests" } as NavItem] : []),
    ...(can("timeoff.review") ? [{ id: "timeoff", label: "Time off", icon: "sun", to: "/timeoff-decisions" } as NavItem] : []),
    ...(hasFeature("messaging") ? [{ id: "messages", label: "Messages", icon: "message-square", to: "/messages" } as NavItem] : []),
    { id: "more", label: "More", icon: "menu" },
  ];

  const go = (to: string) => router.push(to as Parameters<typeof router.push>[0]);
  const openWeb = (path: string) => Linking.openURL(`${WEB}${path}`);

  const limit = (n?: number | null) => (n === null || n === undefined ? "unlimited" : String(n));

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) + 4 }]}>
        {items.map((item) => {
          const active = item.to ? pathname === item.to || pathname.startsWith(`${item.to}/`) : moreOpen;
          const color = active ? IOS.blue : IOS.secondary;
          return (
            <Pressable
              key={item.id}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => (item.to ? go(item.to) : setMoreOpen(true))}
            >
              <Feather name={item.icon} size={22} color={color} />
              <Text style={[styles.label, { color }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={tenant?.name || "WiserShifts"} subtitle={user?.email ? String(user.email) : undefined}>
        <View style={{ gap: 14 }}>
          {plan && (
            <Card style={{ gap: 4, backgroundColor: usage?.overLimit ? tint(IOS.orange, 0.08) : IOS.surface }}>
              <Text style={kit.caption}>PLAN</Text>
              <Text style={kit.title}>{plan.label || "Free"}</Text>
              <Text style={kit.muted}>
                {usage?.staff ?? 0} of {limit(plan.limits?.staff)} active staff · {usage?.schedulers ?? 0} of {limit(plan.limits?.schedulers)} schedulers
              </Text>
              {usage?.overLimit && (
                <Text style={[kit.muted, { color: IOS.orangeText }]}>
                  Over the plan: adding people and publishing new weeks are paused. Manage it on wisershifts.com.
                </Text>
              )}
            </Card>
          )}
          <Card padded={false}>
            {can("staff.view") && (
              <Row
                first
                title="Staff"
                subtitle="Send or share someone's link"
                left={<Feather name="users" size={18} color={IOS.blue} />}
                right={<Feather name="chevron-right" size={18} color={IOS.tertiary} />}
                onPress={() => {
                  setMoreOpen(false);
                  go("/staffs");
                }}
              />
            )}
            {canResidents && (
              <Row
                first={!can("staff.view")}
                title="Residents today"
                subtitle="For hours per resident day on the Labor page"
                left={<Feather name="clipboard" size={18} color={IOS.blue} />}
                right={<Feather name="chevron-right" size={18} color={IOS.tertiary} />}
                onPress={() => {
                  setMoreOpen(false);
                  setResidentsOpen(true);
                }}
              />
            )}
            <Row
              first={!can("staff.view") && !canResidents}
              title="Weekly Needs, preferences, billing"
              subtitle="Set up on wisershifts.com"
              left={<Feather name="external-link" size={18} color={IOS.blue} />}
              onPress={() => openWeb("/schedule")}
            />
            <Row
              title="Change password"
              left={<Feather name="lock" size={18} color={IOS.blue} />}
              onPress={() => {
                setMoreOpen(false);
                setPasswordOpen(true);
              }}
            />
          </Card>
          <Button
            kind="gray"
            color={IOS.redText}
            title="Sign out"
            icon="log-out"
            onPress={async () => {
              setMoreOpen(false);
              await logout();
              router.replace("/");
            }}
          />
        </View>
      </Sheet>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <ResidentsSheetLoader open={residentsOpen} onClose={() => setResidentsOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS.separator,
    backgroundColor: "rgba(249,249,249,0.97)",
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  label: { fontSize: 11, fontWeight: "600" },
});
