import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import { Button, Card, Empty, Loading, Notice, type NoticeValue, kit } from "@/components/ios/kit";
import { type LinkShift, StaffHeader, useStaffFormat } from "@/components/staff-link/shared";
import { apiError, toLabel } from "@/constants/ios";
import { useStaffLink } from "@/context/staff-link-context";

export default function OpenShifts() {
  const { client } = useStaffLink();
  const fmt = useStaffFormat();
  const [items, setItems] = useState<LinkShift[] | null>(null);
  const [notice, setNotice] = useState<NoticeValue>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      setItems((await client.get("/open-shifts")).data || []);
    } catch (err) {
      setItems((prev) => prev || []);
      setNotice({ kind: "error", text: apiError(err, "Couldn't load open shifts") });
    }
  }, [client]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pickUp = async (c: LinkShift) => {
    if (!client) return;
    setBusyId(c._id);
    setNotice(null);
    try {
      await client.post("/open-shifts/pick-up", { coverageId: c._id });
      setNotice({ kind: "success", text: "It's yours. The shift is on your schedule." });
      await load();
    } catch (err) {
      setNotice({ kind: "error", text: apiError(err, "Couldn't pick it up") });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={kit.screen}>
      <StaffHeader title="Open shifts" />
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
        {items === null ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty title="No open shifts you can take right now" body="We'll text you when one opens up that fits you." />
        ) : (
          items.map((c) => (
            <Card key={c._id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={kit.title}>{fmt.shiftLine(c)}</Text>
                <Text style={kit.muted}>
                  {toLabel(c.role)}
                  {c.unitArea ? ` · ${toLabel(c.unitArea)}` : ""}
                  {(c.remaining || 0) > 1 ? ` · ${c.remaining} spots` : ""}
                </Text>
              </View>
              <Button small title="Pick up" busy={busyId === c._id} disabled={Boolean(busyId)} onPress={() => pickUp(c)} />
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
