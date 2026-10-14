import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { Card, Empty, Loading, Notice, type NoticeValue, kit } from "@/components/ios/kit";
import { StaffHeader, useStaffFormat } from "@/components/staff-link/shared";
import { IOS, apiError } from "@/constants/ios";
import { useStaffLink } from "@/context/staff-link-context";

type Message = { _id: string; subject?: string; body?: string; createdAt?: string };

export default function MyMessages() {
  const { client } = useStaffLink();
  const fmt = useStaffFormat();
  const router = useRouter();
  const [items, setItems] = useState<Message[] | null>(null);
  const [notice, setNotice] = useState<NoticeValue>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      setItems((await client.get("/messages")).data || []);
    } catch (err) {
      setItems((prev) => prev || []);
      setNotice({ kind: "error", text: apiError(err, "Couldn't load messages") });
    }
  }, [client]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={kit.screen}>
      <StaffHeader title="Messages" />
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
        <Pressable onPress={() => router.navigate("/my")} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Feather name="chevron-left" size={18} color={IOS.blue} />
          <Text style={{ color: IOS.blue, fontSize: 16 }}>Shifts</Text>
        </Pressable>
        <Notice notice={notice} onClose={() => setNotice(null)} />
        {items === null ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty title="No messages" body="Messages from your scheduler show up here." />
        ) : (
          items.map((m) => (
            <Card key={m._id} style={{ gap: 4 }}>
              {m.subject ? <Text style={kit.title}>{m.subject}</Text> : null}
              <Text style={kit.body}>{m.body}</Text>
              <Text style={kit.caption}>{m.createdAt ? `${fmt.fmtDay(m.createdAt)} ${fmt.fmtTime(m.createdAt)}` : ""}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
