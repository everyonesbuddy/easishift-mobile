import { Feather } from "@expo/vector-icons";
import type { AxiosInstance } from "axios";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button, Card, kit } from "@/components/ios/kit";
import { IOS, apiError } from "@/constants/ios";

// The exact words they agree to (the server keeps the same wording with their yes).
const CONSENT_WORDING =
  "Text me my schedule: shift reminders, schedule changes, open shifts I can pick up and replies to my requests. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";

/**
 * "Text me my schedule": their own yes to texts. The box starts unticked and
 * nothing is sent until they tick it and press Text me; then one confirmation
 * text. Shown only when their workplace texts, they have a number on file,
 * and they haven't said yes yet.
 */
export default function TextConsentCard({
  client,
  smsStatus,
  phoneLast4,
  onDone,
}: {
  client: AxiosInstance;
  smsStatus?: string;
  phoneLast4?: string | null;
  onDone: (confirmationSent: boolean) => void;
}) {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const off = smsStatus === "opted_out";

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await client.post("/text-consent", { agree: true });
      onDone(Boolean(res.data?.confirmationSent));
    } catch (err) {
      setError(apiError(err, "Couldn't turn on texts. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: 10 }}>
      <View>
        <Text style={[kit.body, { fontWeight: "700" }]}>{off ? "Texts are off" : "Get your schedule by text"}</Text>
        <Text style={kit.caption}>
          {off ? "You turned texts off. Tick the box to turn them back on." : "We only text you if you say yes here."}
          {phoneLast4 ? ` Texts go to the number ending ${phoneLast4}.` : ""}
        </Text>
      </View>
      <Pressable
        onPress={() => setAgree((v) => !v)}
        style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agree }}
        accessibilityLabel={CONSENT_WORDING}
      >
        <Feather name={agree ? "check-square" : "square"} size={22} color={agree ? IOS.blue : IOS.secondary} style={{ marginTop: 1 }} />
        <Text style={[kit.caption, { flex: 1, fontSize: 13.5, color: IOS.ink }]}>{CONSENT_WORDING}</Text>
      </Pressable>
      {error ? <Text style={[kit.caption, { color: IOS.redText }]}>{error}</Text> : null}
      <Button title="Text me" disabled={!agree} busy={busy} onPress={submit} />
      <Text style={kit.caption}>Or text JOIN to (855) 449-8584. Terms: wisershifts.com/terms · Privacy: wisershifts.com/privacy</Text>
    </Card>
  );
}
