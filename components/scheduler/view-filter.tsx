import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Sheet, kit } from "@/components/ios/kit";
import { IOS, tint } from "@/constants/ios";

import { type SectionOption, type ViewFilterValue, filterActive, filterAsSection, sectionLabel } from "./week-utils";

/** "Show only" these roles / areas. Saved on the scheduler's account. */
export default function ViewFilter({
  value,
  onChange,
  options,
}: {
  value: ViewFilterValue;
  onChange: (value: ViewFilterValue) => void;
  options: { roles: SectionOption[]; areas: SectionOption[] };
}) {
  const [open, setOpen] = useState(false);
  const active = filterActive(value);
  if (!options.roles.length && !options.areas.length) return null;

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
    <>
      <View style={styles.row}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={active ? `Showing ${sectionLabel(filterAsSection(value), options)}. Change filter` : "Filter by role or area"}
          style={[styles.pill, { backgroundColor: active ? tint(IOS.blue, 0.12) : IOS.fill }]}
        >
          <Feather name="filter" size={14} color={active ? IOS.blue : IOS.ink} />
          <Text style={[styles.pillText, { color: active ? IOS.blue : IOS.ink }]} numberOfLines={1}>
            {active ? `Showing: ${sectionLabel(filterAsSection(value), options)}` : "All roles and areas"}
          </Text>
          <Feather name="chevron-down" size={14} color={active ? IOS.blue : IOS.secondary} />
        </Pressable>
        {active && (
          <Pressable onPress={() => onChange({ roles: [], areas: [] })} hitSlop={8} accessibilityLabel="Clear filter" style={styles.clear}>
            <Text style={{ color: IOS.secondary, fontWeight: "600", fontSize: 13 }}>Clear</Text>
          </Pressable>
        )}
      </View>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Show only"
        subtitle="Pick the roles and areas you schedule. Nothing picked shows everything. Saved for you on the app and the website."
        footer={
          <>
            <Button kind="gray" title="Show everything" style={{ flex: 1 }} disabled={!active} onPress={() => onChange({ roles: [], areas: [] })} />
            <Button title="Done" style={{ flex: 1 }} onPress={() => setOpen(false)} />
          </>
        }
      >
        <View>
          {group("Roles", "roles", options.roles)}
          {group("Unit areas", "areas", options.areas)}
          <Text style={[kit.caption, { marginTop: 10 }]}>With both, only shifts matching both are shown.</Text>
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  pill: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  pillText: { flexShrink: 1, fontSize: 14, fontWeight: "600" },
  clear: { paddingVertical: 6 },
  groupTitle: { fontSize: 12, fontWeight: "700", color: IOS.secondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 14, fontWeight: "600" },
});
