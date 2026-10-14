import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { IOS, keyToDate } from "@/constants/ios";

const toKey = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** A date as "YYYY-MM-DD". Native date picker on phones, a text box on web. */
export default function DateField({ label, value, onChange }: { label: string; value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);

  if (Platform.OS === "web") {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <TextInput value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" style={styles.box} accessibilityLabel={label} />
      </View>
    );
  }

  const date = keyToDate(value);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === "ios" ? (
        <View style={[styles.box, { justifyContent: "center", alignItems: "flex-start" }]}>
          <DateTimePicker value={date} mode="date" display="compact" onChange={(_, d) => d && onChange(toKey(d))} />
        </View>
      ) : (
        <>
          <Pressable style={[styles.box, { justifyContent: "center" }]} onPress={() => setOpen(true)} accessibilityLabel={label}>
            <Text style={{ fontSize: 16, color: IOS.ink }}>
              {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </Text>
          </Pressable>
          {open && (
            <DateTimePicker
              value={date}
              mode="date"
              onChange={(_, d) => {
                setOpen(false);
                if (d) onChange(toKey(d));
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: IOS.secondary },
  box: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS.separator,
    backgroundColor: IOS.surface,
    paddingHorizontal: 12,
    fontSize: 16,
    color: IOS.ink,
  },
});
