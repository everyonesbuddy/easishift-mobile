import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { Button, Card, Chip, Empty, Loading, Notice, type NoticeValue, kit } from "@/components/ios/kit";
import { StaffHeader, useStaffFormat } from "@/components/staff-link/shared";
import { IOS, apiError, toLabel } from "@/constants/ios";
import { useStaffLink } from "@/context/staff-link-context";

const SWAP_STATUS: Record<string, { label: string; color: string; text?: string }> = {
  pending_admin: { label: "Waiting for scheduler", color: IOS.orange, text: IOS.orangeText },
  pending_receiver: { label: "Waiting for coworker", color: IOS.orange, text: IOS.orangeText },
  approved: { label: "Approved", color: IOS.green, text: IOS.greenText },
  accepted: { label: "Swapped", color: IOS.green, text: IOS.greenText },
  denied: { label: "Declined", color: IOS.red, text: IOS.redText },
  rejected: { label: "Declined", color: IOS.red, text: IOS.redText },
  cancelled: { label: "Cancelled", color: IOS.secondary },
};

type Person = { _id?: string; name?: string } | string | null | undefined;
type Swap = {
  _id: string;
  status: string;
  requesterStaffId?: Person;
  receiverStaffId?: Person;
  scheduleId?: { startTime?: string; endTime?: string } | null;
};

const idOf = (p: Person) => (typeof p === "string" ? p : p?._id || "");
const nameOf = (p: Person) => (typeof p === "object" && p ? p.name : undefined);

export default function MySwaps() {
  const { client, me } = useStaffLink();
  const fmt = useStaffFormat();
  const [swaps, setSwaps] = useState<Swap[] | null>(null);
  const [notice, setNotice] = useState<NoticeValue>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      setSwaps((await client.get("/swaps")).data || []);
    } catch (err) {
      setSwaps((prev) => prev || []);
      setNotice({ kind: "error", text: apiError(err, "Couldn't load swaps") });
    }
  }, [client]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const respond = async (swap: Swap, decision: "accept" | "deny") => {
    if (!client) return;
    setBusyId(swap._id);
    try {
      await client.post(`/swaps/${swap._id}/respond`, { decision });
      setNotice({ kind: "success", text: decision === "accept" ? "Swap accepted." : "Swap declined." });
      await load();
    } catch (err) {
      setNotice({ kind: "error", text: apiError(err, "Something went wrong") });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={kit.screen}>
      <StaffHeader title="Swaps" />
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
        {swaps === null ? (
          <Loading />
        ) : swaps.length === 0 ? (
          <Empty title="No swap requests" body="To ask a coworker to take a shift, tap Swap on it under Shifts." />
        ) : (
          swaps.map((sw) => {
            const mine = String(idOf(sw.requesterStaffId)) === String(me?.staff?._id);
            const status = SWAP_STATUS[sw.status] || { label: toLabel(sw.status), color: IOS.secondary };
            const shift = sw.scheduleId;
            return (
              <Card key={sw._id} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Text style={[kit.title, { flex: 1 }]}>
                    {shift?.startTime && shift.endTime ? fmt.shiftLine({ startTime: shift.startTime, endTime: shift.endTime }) : "Shift"}
                  </Text>
                  <Chip label={status.label} color={status.color} textColor={status.text} />
                </View>
                <Text style={kit.muted}>
                  {mine
                    ? `You asked ${nameOf(sw.receiverStaffId) || "a coworker"} to take it`
                    : `${nameOf(sw.requesterStaffId) || "A coworker"} asked you to take it`}
                </Text>
                {!mine && sw.status === "pending_receiver" && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    <Button small title="Accept" busy={busyId === sw._id} disabled={Boolean(busyId)} onPress={() => respond(sw, "accept")} />
                    <Button small kind="gray" title="Decline" disabled={Boolean(busyId)} onPress={() => respond(sw, "deny")} />
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
