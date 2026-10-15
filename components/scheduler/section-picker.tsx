import { Pressable, StyleSheet, Text, View } from "react-native";

import { Segmented, kit } from "@/components/ios/kit";
import { IOS } from "@/constants/ios";

import type { SectionOption, SectionValue } from "./week-utils";

/** "Everything" or "A section" (roles and/or areas), for Publish and Auto-fill. */
export default function SectionPicker({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: SectionValue;
  onChange: (value: SectionValue) => void;
  options: { roles: SectionOption[]; areas: SectionOption[] };
  allLabel: string;
}) {
  const toggle = (field: "roles" | "areas", key: string) => {
    const list = value[field];
    onChange({ ...value, [field]: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] });
  };

  const group = (title: string, field: "roles" | "areas", list: SectionOption[]) =>
    list.length > 0 && (
      <View style={{ marginTop: 12 }}>
        <Text style={styles.groupTitle}>{title}</Text>
        <View style={styles.chips}>
          {list.map((o) => {
            const on = value[field].includes(o.key);
            return (
              <Pressable
                key={o.key}
                onPress={() => toggle(field, o.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.chip, { backgroundColor: on ? IOS.blue : IOS.fill }]}
              >
                <Text style={[styles.chipText, { color: on ? "#fff" : IOS.ink }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );

  return (
    <View>
      <Segmented
        value={value.mode}
        onChange={(mode) => onChange({ ...value, mode })}
        options={[
          { value: "all", label: allLabel },
          { value: "section", label: "A section" },
        ]}
      />
      {value.mode === "section" && (
        <>
          {group("Roles", "roles", options.roles)}
          {group("Unit areas", "areas", options.areas)}
          <Text style={[kit.caption, { marginTop: 8 }]}>Pick roles, areas or both. With both, only shifts matching both.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: { fontSize: 12, fontWeight: "700", color: IOS.secondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 14, fontWeight: "600" },
});

