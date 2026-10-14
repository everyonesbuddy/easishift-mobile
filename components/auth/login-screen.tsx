import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ForgotPasswordModal from "@/components/auth/forgot-password-modal";
import { Button, Card, Field, Notice, type NoticeValue, kit } from "@/components/ios/kit";
import api from "@/config/api";
import { IOS, apiError } from "@/constants/ios";
import { useAuth } from "@/context/auth-context";

/**
 * Sign-in for schedulers and owners: email + password, same as the web.
 * Staff don't have passwords; they're pointed to their link.
 */
export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeValue>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.post("/auth/login", { email: email.trim(), password });
      await login(res.data);
      router.replace("/schedule");
    } catch (err) {
      setNotice({ kind: "error", text: apiError(err, "Couldn't sign in. Check your email and password.") });
    } finally {
      setBusy(false);
    }
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
            <Text style={kit.largeTitle}>Sign in</Text>
            <Text style={[kit.muted, { marginTop: 6, fontSize: 15 }]}>For schedulers and owners.</Text>
          </View>

          <Notice notice={notice} onClose={() => setNotice(null)} />

          <Card style={{ gap: 14 }}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              placeholder="you@facility.com"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={() => email && password && void submit()}
            />
            <Button title="Sign in" busy={busy} disabled={!email.trim() || !password} onPress={submit} />
            <Button kind="plain" small title="Forgot password?" onPress={() => setForgotOpen(true)} />
          </Card>

          <Card style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Feather name="calendar" size={20} color={IOS.blue} />
            <View style={{ flex: 1 }}>
              <Text style={[kit.body, { fontWeight: "600" }]}>On the schedule?</Text>
              <Text style={kit.muted}>Staff don&apos;t need a password. Open your schedule with your link.</Text>
            </View>
            <Button small kind="tinted" title="Open" onPress={() => router.replace("/staff-start")} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </SafeAreaView>
  );
}
