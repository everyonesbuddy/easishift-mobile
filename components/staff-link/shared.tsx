import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Sheet, kit } from "@/components/ios/kit";
import { IOS } from "@/constants/ios";
import { useStaffLink } from "@/context/staff-link-context";
import { clearShiftReminders } from "@/services/staff-link/reminders";

export type LinkShift = {
  _id: string;
  startTime: string;
  endTime: string;
  status: string;
  role?: string;
  unitArea?: string | null;
  remaining?: number;
};

/** Date/time formatting in the facility's timezone. */
export function useStaffFormat() {
  const { me } = useStaffLink();
  const timeZone = me?.facility?.timezone || undefined;
  const fmtDay = useCallback(
    (iso: string | Date) =>
      new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone }),
    [timeZone],
  );
  const fmtTime = useCallback(
    (iso: string | Date) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone }),
    [timeZone],
  );
  const fmtWeekday = useCallback(
    (iso: string | Date) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", timeZone }),
    [timeZone],
  );
  const fmtDate = useCallback(
    (iso: string | Date) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", timeZone }),
    [timeZone],
  );
  return useMemo(
    () => ({
      timeZone,
      fmtDay,
      fmtTime,
      fmtWeekday,
      fmtDate,
      shiftLine: (s: { startTime: string; endTime: string }) => `${fmtDay(s.startTime)} · ${fmtTime(s.startTime)}–${fmtTime(s.endTime)}`,
    }),
    [timeZone, fmtDay, fmtTime, fmtWeekday, fmtDate],
  );
}

/** Large-title header for the staff screens, with Messages and a menu. */
export function StaffHeader({ title }: { title?: string }) {
  const { me, signOutDevice, forget } = useStaffLink();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const first = String(me?.staff?.name || "").split(" ")[0];

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={{ flex: 1 }}>
        <Text style={kit.kicker} numberOfLines={1}>
          {me?.facility?.name}
        </Text>
        <Text style={kit.largeTitle} numberOfLines={1}>
          {title || `Hi ${first || "there"}`}
        </Text>
      </View>
      <View style={styles.actions}>
        {me?.features?.messages && (
          <Pressable style={styles.iconBtn} onPress={() => router.push("/my/messages")} accessibilityLabel="Messages">
            <Feather name="message-square" size={18} color={IOS.ink} />
          </Pressable>
        )}
        <Pressable style={styles.iconBtn} onPress={() => setMenuOpen(true)} accessibilityLabel="Account">
          <Feather name="user" size={18} color={IOS.ink} />
        </Pressable>
      </View>

      <Sheet open={menuOpen} onClose={() => {
          setMenuOpen(false);
          setConfirmForget(false);
        }}
        title={me?.staff?.name || "Your schedule"} subtitle={me?.facility?.name}>
        <View style={{ gap: 10 }}>
          {confirmForget ? (
            <>
              <Text style={kit.body}>
                You&apos;ll go back to the start screen. To get back in, tap your link again or use Send me my link.
              </Text>
              <Button
                kind="destructive"
                title="Sign out"
                icon="log-out"
                onPress={async () => {
                  setMenuOpen(false);
                  setConfirmForget(false);
                  await clearShiftReminders();
                  await forget();
                  router.replace("/");
                }}
              />
              <Button kind="gray" title="Cancel" onPress={() => setConfirmForget(false)} />
            </>
          ) : (
            <>
              <Text style={kit.muted}>This app keeps your personal schedule link so you don&apos;t have to tap it each time.</Text>
              <Button kind="gray" color={IOS.redText} title="Sign out" icon="log-out" onPress={() => setConfirmForget(true)} />
              {me?.pin?.required && (
                <Button
                  kind="plain"
                  title="Lock with my PIN instead"
                  onPress={async () => {
                    setMenuOpen(false);
                    await clearShiftReminders();
                    await signOutDevice();
                  }}
                />
              )}
            </>
          )}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: IOS.canvas,
  },
  actions: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOS.fill,
    alignItems: "center",
    justifyContent: "center",
  },
});
