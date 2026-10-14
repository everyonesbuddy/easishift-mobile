import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Card, Field, Notice, type NoticeValue, kit } from "@/components/ios/kit";
import api from "@/config/api";
import { IOS, apiError, apiStatus } from "@/constants/ios";
import { useStaffLink } from "@/context/staff-link-context";
import { parseLinkToken } from "@/services/staff-link/storage";

/**
 * Staff without their link on this phone: we text/email it to them (they
 * tap it and the app opens), or they paste it.
 */
export default function StaffStart() {
  const router = useRouter();
  const { openLink } = useStaffLink();
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const [paste, setPaste] = useState("");
  const [notice, setNotice] = useState<NoticeValue>(null);

  const requestLink = async () => {
    setSending(true);
    setNotice(null);
    try {
      const res = await api.post("/staff-link/request", { contact: contact.trim() });
      setSent(res.data?.message || "If that phone or email is on a schedule, we've sent the link to it.");
    } catch (err) {
      setNotice({
        kind: "error",
        text: apiStatus(err) === 429 ? "Too many tries. Wait a few minutes, then try again." : apiError(err, "Couldn't send it. Try again."),
      });
    } finally {
      setSending(false);
    }
  };

  const openPasted = async (text: string) => {
    const token = parseLinkToken(text);
    if (!token) {
      setNotice({ kind: "error", text: "That doesn't look like a WiserShifts link. It looks like wisershifts.com/s/…" });
      return;
    }
    await openLink(token);
    router.replace("/my");
  };

  const pasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    setPaste(text);
    if (parseLinkToken(text)) await openPasted(text);
  };

  return (
    <SafeAreaView style={kit.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={kit.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={{ flexDirection: "row", alignItems: "center" }}>
            <Feather name="chevron-left" size={20} color={IOS.blue} />
            <Text style={{ color: IOS.blue, fontSize: 16 }}>Back</Text>
          </Pressable>
          <View>
            <Text style={kit.largeTitle}>Open your schedule</Text>
            <Text style={[kit.muted, { marginTop: 6, fontSize: 15 }]}>
              Your scheduler sends you a personal link. Tap it on this phone and the app opens your schedule. No password.
            </Text>
          </View>

          <Notice notice={notice} onClose={() => setNotice(null)} />

          <Card style={{ gap: 12 }}>
            <Text style={kit.title}>Send me my link</Text>
            {sent ? (
              <>
                <Notice notice={{ kind: "success", text: sent }} />
                <Text style={kit.muted}>Open the text or email on this phone and tap the link.</Text>
                <Button kind="plain" title="Use a different phone or email" onPress={() => setSent("")} />
              </>
            ) : (
              <>
                <Field
                  label="Phone or email on your schedule"
                  value={contact}
                  onChangeText={setContact}
                  placeholder="(555) 123-4567 or you@email.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  onSubmitEditing={() => contact.trim() && void requestLink()}
                />
                <Button title="Send my link" busy={sending} disabled={!contact.trim()} onPress={requestLink} />
              </>
            )}
          </Card>

          <Card style={{ gap: 12 }}>
            <Text style={kit.title}>Already have the link?</Text>
            <Field
              label="Paste it here"
              value={paste}
              onChangeText={setPaste}
              placeholder="https://wisershifts.com/s/…"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button kind="gray" icon="clipboard" title="Paste" style={{ flex: 1 }} onPress={pasteFromClipboard} />
              <Button title="Open" style={{ flex: 1 }} disabled={!paste.trim()} onPress={() => openPasted(paste)} />
            </View>
          </Card>

          <Text style={[kit.caption, { textAlign: "center" }]}>
            Not getting it? Ask your scheduler to check your phone number or email, or to send your link again.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
