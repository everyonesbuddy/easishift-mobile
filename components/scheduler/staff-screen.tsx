import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Linking, Platform, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar, Button, Card, Empty, Loading, Notice, type NoticeValue, Sheet, kit } from "@/components/ios/kit";
import api from "@/config/api";
import { getRoleDisplayName } from "@/constants/industry-roles";
import { IOS, apiError, roleColor } from "@/constants/ios";
import { useAuth } from "@/context/auth-context";

import { notSentReason } from "./week-utils";

type Staff = {
  _id: string;
  name: string;
  roles?: string[];
  email?: string | null;
  phoneE164?: string | null;
  hasPhone?: boolean;
  hasEmail?: boolean;
  smsStatus?: string;
  linkPinSet?: boolean;
};

/**
 * The team, for sharing links on the go. Adding and editing people stays
 * on the web.
 */
export default function StaffScreen() {
  const { can, facilityPreferences } = useAuth();
  const canManage = can("staff.manage");
  const roleFamilies = (facilityPreferences as { roleFamilies?: unknown[] } | null)?.roleFamilies;
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Staff | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeValue>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/staff");
      setStaff(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setStaff((prev) => prev || []);
      setNotice({ kind: "error", text: apiError(err, "Couldn't load staff") });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (staff || []).filter((s) => !q || s.name.toLowerCase().includes(q) || (s.roles || []).some((r) => r.includes(q)));
  }, [staff, query]);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      setNotice({ kind: "error", text: apiError(err, "Something went wrong") });
    } finally {
      setBusy(null);
    }
  };

  const sendLink = (s: Staff) =>
    act("send", async () => {
      const res = await api.post(`/staff/${s._id}/send-link`);
      setOpen(null);
      if (res.data?.delivered) {
        setNotice({ kind: "success", text: `Link sent to ${s.name} by ${res.data.channel === "sms" ? "text" : "email"}.` });
      } else {
        setNotice({ kind: "warning", text: `Couldn't reach ${s.name}: ${notSentReason(res.data?.reason)}. Share the link yourself instead.` });
      }
    });

  const shareLink = (s: Staff) =>
    act("share", async () => {
      const res = await api.get(`/staff/${s._id}/link`);
      const url = res.data?.url as string;
      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(url);
        setNotice({ kind: "success", text: `${s.name}'s link copied.` });
      } else {
        await Share.share({ message: `Your WiserShifts schedule: ${url}` });
      }
    });

  const resetPin = (s: Staff) =>
    act("pin", async () => {
      await api.post(`/staff/${s._id}/reset-pin`);
      setOpen(null);
      setNotice({ kind: "success", text: `${s.name} will choose a new PIN next time they open their link.` });
      void load();
    });

  return (
    <View style={kit.screen}>
      <ScrollView
        contentContainerStyle={[kit.content, { paddingTop: 12 }]}
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
        <Text style={kit.largeTitle}>Staff</Text>
        <View style={styles.search}>
          <Feather name="search" size={16} color={IOS.secondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={IOS.secondary}
            style={{ flex: 1, fontSize: 16, color: IOS.ink, paddingVertical: 8 }}
            autoCorrect={false}
          />
        </View>
        <Notice notice={notice} onClose={() => setNotice(null)} />
        {staff === null ? (
          <Loading />
        ) : shown.length === 0 ? (
          <Empty title={query ? "Nobody matches" : "No staff yet"} body={query ? undefined : "Add your team on wisershifts.com."} />
        ) : (
          <Card padded={false}>
            {shown.map((s, i) => {
              const role = (s.roles || [])[0];
              return (
                <View key={s._id} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <Avatar name={s.name} color={roleColor(role, roleFamilies)} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[kit.body, { fontWeight: "600" }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={kit.caption} numberOfLines={1}>
                      {(s.roles || []).map(getRoleDisplayName).join(", ") || "No role"}
                      {!s.hasPhone && !s.hasEmail ? " · no phone or email" : s.smsStatus === "opted_out" ? " · texts off" : ""}
                    </Text>
                  </View>
                  {canManage && <Button small kind="tinted" title="Link" icon="link" onPress={() => setOpen(s)} />}
                </View>
              );
            })}
          </Card>
        )}
        <Text style={[kit.caption, { textAlign: "center" }]}>Add or edit people on wisershifts.com.</Text>
      </ScrollView>

      <Sheet open={Boolean(open)} onClose={() => setOpen(null)} title={open?.name || ""} subtitle="Their personal link opens their schedule. No password.">
        {open && (
          <View style={{ gap: 10 }}>
            <Button
              title="Send their link"
              icon="send"
              busy={busy === "send"}
              disabled={!open.hasPhone && !open.hasEmail}
              onPress={() => sendLink(open)}
            />
            {!open.hasPhone && !open.hasEmail && <Text style={kit.caption}>Add a phone or email for them on the web to send it.</Text>}
            <Button kind="gray" title={Platform.OS === "web" ? "Copy link" : "Share link…"} icon="share" busy={busy === "share"} onPress={() => shareLink(open)} />
            {open.phoneE164 ? (
              <Button kind="gray" title="Call" icon="phone" onPress={() => Linking.openURL(`tel:${open.phoneE164}`)} />
            ) : null}
            {open.linkPinSet && <Button kind="plain" color={IOS.redText} title="Reset their PIN" busy={busy === "pin"} onPress={() => resetPin(open)} />}
          </View>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: IOS.fill, borderRadius: 12, paddingHorizontal: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: IOS.hairline },
});
