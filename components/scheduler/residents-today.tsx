import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, Card, Notice, type NoticeValue, Sheet, kit } from "@/components/ios/kit";
import api from "@/config/api";
import { IOS, addDaysToKey, apiError, tint, todayKey } from "@/constants/ios";
import { useAuth } from "@/context/auth-context";

type Census = { date: string; residents: number };
type LaborSettings = { typicalCensus: number | null; census: Census[] };

/** Can this person enter residents (paid plan + owner/admin/scheduler)? */
export function useCanEnterResidents() {
  const { can, hasFeature } = useAuth();
  return hasFeature("labor") && can("labor.census");
}

function useLaborSettings(enabled: boolean) {
  const [settings, setSettings] = useState<LaborSettings | null>(null);
  const load = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return api
      .get("/labor/settings")
      .then((res) => setSettings({ typicalCensus: res.data?.typicalCensus ?? null, census: res.data?.census || [] }))
      .catch(() => setSettings(null));
  }, [enabled]);
  useEffect(() => {
    load();
  }, [load]);
  return { settings, setSettings, reload: load };
}

/**
 * Residents today, for hours per resident day on the Labor page. Mounted
 * only while open, so it starts fresh each time. Big number
 * with − / +, plus one-tap "same as yesterday" / "usual". Saves one day.
 */
export function ResidentsSheet({
  open,
  onClose,
  settings,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  settings: LaborSettings | null;
  onSaved: (s: LaborSettings) => void;
}) {
  const today = todayKey();
  const byDate = new Map((settings?.census || []).map((c) => [c.date, c.residents]));
  const yesterday = byDate.get(addDaysToKey(today, -1));
  const usual = settings?.typicalCensus ?? null;
  const start = byDate.get(today) ?? yesterday ?? usual ?? null;
  const [value, setValue] = useState(start === null ? "" : String(start));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeValue>(null);

  const n = value.trim() === "" ? null : Number(value);
  const valid = n !== null && Number.isInteger(n) && n >= 0 && n <= 5000;
  const step = (d: number) => setValue(String(Math.max(0, (Number(value) || 0) + d)));

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.put("/labor/census", { entries: [{ date: today, residents: n }] });
      onSaved({ typicalCensus: res.data?.typicalCensus ?? usual, census: res.data?.census || [] });
      onClose();
    } catch (err) {
      setNotice({ kind: "error", text: apiError(err, "Couldn't save") });
    } finally {
      setBusy(false);
    }
  };

  const quick = [
    ...(yesterday !== undefined ? [{ label: `Same as yesterday (${yesterday})`, v: yesterday }] : []),
    ...(usual !== null && usual !== yesterday ? [{ label: `Usual (${usual})`, v: usual }] : []),
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Residents today"
      subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      footer={<Button title="Save" onPress={save} busy={busy} disabled={!valid} />}
    >
      <View style={{ gap: 14 }}>
        <Text style={kit.muted}>How many residents are in the building today? This keeps hours per resident day on the Labor page accurate.</Text>
        <View style={styles.stepper}>
          <Pressable style={styles.stepBtn} onPress={() => step(-1)} accessibilityLabel="One fewer">
            <Feather name="minus" size={22} color={IOS.ink} />
          </Pressable>
          <TextInput
            value={value}
            onChangeText={(t) => setValue(t.replace(/[^0-9]/g, "").slice(0, 4))}
            keyboardType="number-pad"
            style={styles.number}
            accessibilityLabel="Residents"
            placeholder="0"
            placeholderTextColor={IOS.tertiary}
            selectTextOnFocus
          />
          <Pressable style={styles.stepBtn} onPress={() => step(1)} accessibilityLabel="One more">
            <Feather name="plus" size={22} color={IOS.ink} />
          </Pressable>
        </View>
        {quick.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {quick.map((q) => (
              <Pressable key={q.label} onPress={() => setValue(String(q.v))} style={styles.quick}>
                <Text style={styles.quickText}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Notice notice={notice} onClose={() => setNotice(null)} />
      </View>
    </Sheet>
  );
}

/**
 * On the Schedule screen: a small prompt until today's residents are in.
 * Disappears once entered (change it from More → Residents today).
 */
export function ResidentsTodayPrompt() {
  const enabled = useCanEnterResidents();
  const { settings, setSettings } = useLaborSettings(enabled);
  const [open, setOpen] = useState(false);
  if (!enabled || !settings) return null;
  const today = todayKey();
  if (settings.census.some((c) => c.date === today)) return null;
  return (
    <>
      <Card style={styles.prompt}>
        <View style={styles.icon}>
          <Feather name="users" size={16} color={IOS.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[kit.body, { fontWeight: "600" }]}>Residents today?</Text>
          <Text style={kit.caption}>For hours per resident day</Text>
        </View>
        <Button small title="Enter" onPress={() => setOpen(true)} />
      </Card>
      {open && <ResidentsSheet open onClose={() => setOpen(false)} settings={settings} onSaved={setSettings} />}
    </>
  );
}

/** Opens the sheet from elsewhere (the More menu). Loads when opened. */
export function ResidentsSheetLoader({ open, onClose }: { open: boolean; onClose: () => void }) {
  const enabled = useCanEnterResidents();
  // Loads each time it opens (enabled flips with `open`).
  const { settings, setSettings } = useLaborSettings(enabled && open);
  if (!open || !settings) return null;
  return <ResidentsSheet open onClose={onClose} settings={settings} onSaved={setSettings} />;
}

const styles = StyleSheet.create({
  prompt: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: tint(IOS.blue, 0.12), alignItems: "center", justifyContent: "center" },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18 },
  stepBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: IOS.fill, alignItems: "center", justifyContent: "center" },
  number: { minWidth: 110, textAlign: "center", fontSize: 44, fontWeight: "700", color: IOS.ink, paddingVertical: 4, fontVariant: ["tabular-nums"] },
  quick: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: tint(IOS.blue, 0.1) },
  quickText: { color: IOS.blue, fontWeight: "600", fontSize: 14 },
});
