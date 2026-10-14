import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { Button, Card, Loading, Notice, type NoticeValue, kit } from "@/components/ios/kit";
import { type LinkShift, StaffHeader, useStaffFormat } from "@/components/staff-link/shared";
import { IOS } from "@/constants/ios";
import { useStaffLink } from "@/context/staff-link-context";
import { clockErrorText, getPunchLocation } from "@/services/staff-link/location";

type Entry = {
  _id: string;
  status: string;
  clockInAt: string;
  clockOutAt?: string;
  breaks?: { startAt: string; endAt?: string }[];
};

export default function ClockIn() {
  const { client } = useStaffLink();
  const fmt = useStaffFormat();
  const [shifts, setShifts] = useState<LinkShift[]>([]);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeValue>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!client) return;
    try {
      const [s, e] = await Promise.all([client.get("/schedule"), client.get("/time-entries")]);
      setShifts(s.data.shifts || []);
      setEntries(e.data || []);
      setNow(Date.now());
    } catch (err) {
      setEntries((prev) => prev || []);
      const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setNotice({ kind: "error", text: data?.message || "Couldn't load your time" });
    }
  }, [client]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const active = (entries || []).find((e) => e.status === "in_progress");
  const openBreak = active?.breaks?.find((b) => !b.endAt);
  const clockable = shifts.find(
    (s) => s.status === "scheduled" && new Date(s.startTime).getTime() - 60 * 60 * 1000 <= now && new Date(s.endTime).getTime() >= now,
  );

  const punch = async (path: string, success: string, withShift = false) => {
    if (!client) return;
    setBusy(true);
    setNotice(null);
    try {
      const location = await getPunchLocation();
      await client.post(path, {
        ...(withShift && clockable ? { scheduleId: clockable._id } : {}),
        ...(location ? { location } : {}),
      });
      setNotice({ kind: "success", text: success });
    } catch (err) {
      const data = (err as { response?: { data?: { errorCode?: string; distanceMeters?: number; message?: string } } })?.response?.data;
      setNotice({ kind: "error", text: clockErrorText(data, "Something went wrong") });
    } finally {
      setBusy(false);
      void load();
    }
  };

  return (
    <View style={kit.screen}>
      <StaffHeader title="Clock in" />
      <ScrollView
        contentContainerStyle={kit.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <Notice notice={notice} onClose={() => setNotice(null)} />
        {entries === null ? (
          <Loading />
        ) : active ? (
          <Card style={{ gap: 14 }}>
            <View>
              <Text style={[kit.caption, { color: IOS.greenText, fontWeight: "700", fontSize: 13 }]}>
                {openBreak ? "ON BREAK" : "CLOCKED IN"}
              </Text>
              <Text style={[kit.largeTitle, { fontSize: 28 }]}>Since {fmt.fmtTime(active.clockInAt)}</Text>
              {openBreak && <Text style={kit.muted}>Break started {fmt.fmtTime(openBreak.startAt)}</Text>}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {openBreak ? (
                <Button kind="tinted" title="End break" style={{ flex: 1 }} disabled={busy} onPress={() => punch("/breaks/end", "Break ended.")} />
              ) : (
                <Button kind="tinted" title="Start break" style={{ flex: 1 }} disabled={busy} onPress={() => punch("/breaks/start", "Break started.")} />
              )}
              <Button kind="destructive" title="Clock out" style={{ flex: 1 }} busy={busy} onPress={() => punch("/clock-out", "Clocked out.")} />
            </View>
          </Card>
        ) : (
          <Card style={{ gap: 14 }}>
            <Text style={kit.title}>{clockable ? `Your shift: ${fmt.shiftLine(clockable)}` : "No shift starting soon."}</Text>
            <Button title="Clock in" icon="log-in" busy={busy} disabled={!clockable} onPress={() => punch("/clock-in", "Clocked in.", true)} />
            <Text style={kit.caption}>
              You can clock in from an hour before your shift. Your location may be checked, so allow location for WiserShifts.
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
