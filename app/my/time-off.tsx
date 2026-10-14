import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import DateField from "@/components/ios/date-field";
import { Button, Card, Chip, Field, Loading, Notice, type NoticeValue, SectionLabel, kit } from "@/components/ios/kit";
import { StaffHeader, useStaffFormat } from "@/components/staff-link/shared";
import { IOS, apiError, toLabel, todayKey } from "@/constants/ios";
import { useStaffLink } from "@/context/staff-link-context";

const STATUS: Record<string, { label: string; color: string; text?: string }> = {
  pending: { label: "Pending", color: IOS.orange, text: IOS.orangeText },
  approved: { label: "Approved", color: IOS.green, text: IOS.greenText },
  denied: { label: "Denied", color: IOS.red, text: IOS.redText },
  rejected: { label: "Denied", color: IOS.red, text: IOS.redText },
};

type TimeOff = { _id: string; startTime: string; endTime: string; status: string; reason?: string };

export default function MyTimeOff() {
  const { client } = useStaffLink();
  const fmt = useStaffFormat();
  const [items, setItems] = useState<TimeOff[] | null>(null);
  const [form, setForm] = useState({ startDate: todayKey(), endDate: todayKey(), reason: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeValue>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      setItems((await client.get("/time-off")).data || []);
    } catch (err) {
      setItems((prev) => prev || []);
      setNotice({ kind: "error", text: apiError(err, "Couldn't load time off") });
    }
  }, [client]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const send = async () => {
    if (!client) return;
    setBusy(true);
    setNotice(null);
    try {
      await client.post("/time-off", form);
      setNotice({ kind: "success", text: "Time off requested. Your scheduler will review it." });
      setForm({ startDate: todayKey(), endDate: todayKey(), reason: "" });
      await load();
    } catch (err) {
      setNotice({ kind: "error", text: apiError(err, "Couldn't send the request") });
    } finally {
      setBusy(false);
    }
  };

  const range = (t: TimeOff) => {
    const start = fmt.fmtDay(t.startTime);
    const end = fmt.fmtDay(new Date(new Date(t.endTime).getTime() - 1));
    return start === end ? start : `${start} – ${end}`;
  };

  return (
    <View style={kit.screen}>
      <StaffHeader title="Time off" />
      <ScrollView
        contentContainerStyle={kit.content}
        keyboardShouldPersistTaps="handled"
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
        <Card style={{ gap: 12 }}>
          <Text style={kit.title}>Request time off</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <DateField label="From" value={form.startDate} onChange={(startDate) => setForm((f) => ({ ...f, startDate, endDate: f.endDate < startDate ? startDate : f.endDate }))} />
            <DateField label="To" value={form.endDate} onChange={(endDate) => setForm((f) => ({ ...f, endDate }))} />
          </View>
          <Field label="Reason (optional)" value={form.reason} onChangeText={(reason) => setForm((f) => ({ ...f, reason }))} placeholder="Doctor's appointment, trip…" />
          <Button title="Send request" busy={busy} disabled={form.endDate < form.startDate} onPress={send} />
        </Card>

        {items === null ? (
          <Loading />
        ) : items.length > 0 ? (
          <View>
            <SectionLabel>Your requests</SectionLabel>
            <View style={{ gap: 10 }}>
              {items.map((t) => {
                const status = STATUS[t.status] || { label: toLabel(t.status), color: IOS.secondary };
                return (
                  <Card key={t._id} style={{ gap: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <Text style={[kit.title, { flex: 1, fontSize: 16 }]}>{range(t)}</Text>
                      <Chip label={status.label} color={status.color} textColor={status.text} />
                    </View>
                    {t.reason ? <Text style={kit.muted}>{t.reason}</Text> : null}
                  </Card>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
