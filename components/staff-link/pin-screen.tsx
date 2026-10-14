import { Feather } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IOS, tint } from "@/constants/ios";

type Props = {
  firstName?: string;
  facilityName?: string;
  pinSet: boolean;
  onSubmit: (mode: "setup" | "verify", pin: string) => Promise<string | null>;
  onUseAnotherLink?: () => void;
};

/**
 * PIN gate for a staff link. First time: choose a 4-digit PIN and type it
 * again. On a new phone: enter it. Same flow as the web link.
 */
export default function PinScreen({ firstName, facilityName, pinSet, onSubmit, onUseAnotherLink }: Props) {
  const [step, setStep] = useState<"choose" | "confirm" | "enter">(pinSet ? "enter" : "choose");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [step, busy]);

  const submit = async (value: string) => {
    if (step === "choose") {
      setFirstPin(value);
      setPin("");
      setStep("confirm");
      return;
    }
    if (step === "confirm" && value !== firstPin) {
      setError("Those didn't match. Choose your PIN again.");
      setPin("");
      setFirstPin("");
      setStep("choose");
      return;
    }
    setBusy(true);
    const message = await onSubmit(step === "enter" ? "verify" : "setup", value);
    setBusy(false);
    if (message) {
      setError(message);
      setPin("");
    }
  };

  const onChange = (text: string) => {
    const value = text.replace(/\D/g, "").slice(0, 4);
    setPin(value);
    if (value) setError("");
    if (value.length === 4 && !busy) void submit(value);
  };

  const title = step === "choose" ? "Choose a 4-digit PIN" : step === "confirm" ? "Type it once more" : "Enter your PIN";
  const help =
    step === "enter"
      ? "You'll only need it once on this phone."
      : "You'll enter it the first time you open your schedule on a new phone or computer.";

  return (
    <SafeAreaView style={styles.page}>
      <Pressable style={styles.inner} onPress={() => inputRef.current?.focus()}>
        <View style={styles.lock}>
          <Feather name="lock" size={26} color={IOS.blue} />
        </View>
        {facilityName ? <Text style={styles.facility}>{facilityName}</Text> : null}
        <Text style={styles.hi}>Hi {firstName || "there"}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.help}>{help}</Text>

        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { borderColor: error ? IOS.red : IOS.ink },
                i < pin.length && { backgroundColor: error ? IOS.red : IOS.ink },
              ]}
            />
          ))}
        </View>
        <TextInput
          ref={inputRef}
          value={pin}
          onChangeText={onChange}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          editable={!busy}
          autoFocus
          accessibilityLabel={title}
          textContentType={step === "enter" ? "password" : "newPassword"}
          style={styles.hiddenInput}
        />

        <View style={styles.status}>
          {busy ? (
            <ActivityIndicator />
          ) : error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </View>

        {step === "enter" && <Text style={styles.forgot}>Forgot it? Ask your scheduler to reset your PIN.</Text>}
        {onUseAnotherLink && (
          <Pressable onPress={onUseAnotherLink} hitSlop={8} style={{ marginTop: 18 }}>
            <Text style={styles.link}>Not you? Use a different link</Text>
          </Pressable>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: IOS.canvas },
  inner: { flex: 1, alignItems: "center", paddingHorizontal: 24, paddingTop: 72 },
  lock: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: tint(IOS.blue, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  facility: { color: IOS.secondary, fontSize: 15 },
  hi: { fontSize: 28, fontWeight: "700", color: IOS.ink, marginTop: 2, letterSpacing: -0.5 },
  title: { fontSize: 17, fontWeight: "600", color: IOS.ink, marginTop: 24 },
  help: { fontSize: 14, color: IOS.secondary, marginTop: 4, textAlign: "center", maxWidth: 300 },
  dots: { flexDirection: "row", gap: 20, marginTop: 32, marginBottom: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  hiddenInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
  status: { minHeight: 48, alignItems: "center", justifyContent: "center", maxWidth: 320 },
  error: { color: IOS.redText, fontSize: 14, textAlign: "center" },
  forgot: { fontSize: 13, color: IOS.secondary, marginTop: 16, textAlign: "center" },
  link: { color: IOS.blue, fontSize: 15, fontWeight: "600" },
});
