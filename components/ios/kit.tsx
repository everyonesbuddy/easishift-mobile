import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IOS, tint } from "@/constants/ios";

/** Small building blocks with the Apple-like look used across the app. */

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, padded && { padding: 16 }, style]}>{children}</View>;
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
      {right ? <Text style={styles.sectionRight}>{right}</Text> : null}
    </View>
  );
}

type ButtonKind = "filled" | "tinted" | "plain" | "destructive" | "gray";

export function Button({
  title,
  onPress,
  kind = "filled",
  disabled,
  busy,
  small,
  icon,
  style,
  color,
}: {
  title: string;
  onPress?: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  busy?: boolean;
  small?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const accent = color || (kind === "destructive" ? IOS.red : IOS.blue);
  const bg =
    kind === "filled" || kind === "destructive"
      ? accent
      : kind === "tinted"
        ? tint(accent, 0.12)
        : kind === "gray"
          ? IOS.fill
          : "transparent";
  const fg = kind === "filled" || kind === "destructive" ? "#fff" : kind === "gray" ? color || IOS.ink : accent;
  const off = disabled || busy;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(off) }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: off && kind !== "plain" ? IOS.fill : bg, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={kind === "filled" || kind === "destructive" ? IOS.secondary : accent} size="small" />
      ) : (
        <>
          {icon ? <Feather name={icon} size={small ? 14 : 16} color={off ? IOS.tertiary : fg} /> : null}
          <Text numberOfLines={1} style={[styles.buttonText, small && { fontSize: 14 }, { color: off ? IOS.tertiary : fg }]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={styles.segmentText}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type NoticeValue = { kind: "success" | "error" | "info" | "warning"; text: string } | null;

export function Notice({ notice, onClose }: { notice: NoticeValue; onClose?: () => void }) {
  if (!notice) return null;
  const color =
    notice.kind === "success" ? IOS.green : notice.kind === "error" ? IOS.red : notice.kind === "warning" ? IOS.orange : IOS.blue;
  const text =
    notice.kind === "success" ? IOS.greenText : notice.kind === "error" ? IOS.redText : notice.kind === "warning" ? IOS.orangeText : IOS.blueDark;
  return (
    <View style={[styles.notice, { backgroundColor: tint(color, 0.12) }]} accessibilityRole="alert">
      <Text style={[styles.noticeText, { color: text }]}>{notice.text}</Text>
      {onClose ? (
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Dismiss">
          <Feather name="x" size={16} color={text} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: 28 }}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </Card>
  );
}

export function Loading() {
  return (
    <View style={{ paddingVertical: 32, alignItems: "center" }}>
      <ActivityIndicator />
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={IOS.tertiary} {...props} style={[styles.input, props.style]} />
    </View>
  );
}

export function Chip({ label, color = IOS.secondary, textColor, style }: { label: string; color?: string; textColor?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.chip, { backgroundColor: tint(color, 0.14) }, style]}>
      <Text style={[styles.chipText, { color: textColor || color }]}>{label}</Text>
    </View>
  );
}

/** Bottom sheet on a dimmed background. */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={styles.grabber} />
          {title ? (
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{title}</Text>
                {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} accessibilityLabel="Close">
                <Feather name="x" size={16} color={IOS.secondary} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** One row in a grouped list. */
export function Row({
  title,
  subtitle,
  left,
  right,
  onPress,
  first,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  first?: boolean;
}) {
  const content = (
    <View style={[styles.row, !first && styles.rowBorder]}>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? IOS.fill : "transparent" })}>
      {content}
    </Pressable>
  );
}

export function Avatar({ name, color = IOS.secondary, size = 34 }: { name?: string; color?: string; size?: number }) {
  const initials = String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tint(color.startsWith("#") ? color : IOS.secondary, 0.16),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color, fontWeight: "700", fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export const kit = StyleSheet.create({
  screen: { flex: 1, backgroundColor: IOS.canvas },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  largeTitle: { fontSize: 32, fontWeight: "700", color: IOS.ink, letterSpacing: -0.6 },
  kicker: { color: IOS.secondary, fontSize: 15, fontWeight: "500" },
  title: { fontSize: 17, fontWeight: "700", color: IOS.ink },
  body: { fontSize: 15, color: IOS.ink, lineHeight: 21 },
  muted: { fontSize: 14, color: IOS.secondary, lineHeight: 19 },
  caption: { fontSize: 12, color: IOS.secondary },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS.surface,
    borderRadius: IOS.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS.hairline,
    overflow: "hidden",
  },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 4, marginBottom: 6 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: IOS.secondary, textTransform: "uppercase", letterSpacing: 0.6 },
  sectionRight: { fontSize: 13, color: IOS.secondary },
  button: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: IOS.radius.round,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  buttonSmall: { minHeight: 32, paddingHorizontal: 12 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  segmented: { flexDirection: "row", padding: 3, borderRadius: 10, backgroundColor: IOS.fill },
  segment: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8 },
  segmentActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 14, fontWeight: "600", color: IOS.ink },
  notice: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 14 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: "500" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: IOS.ink, textAlign: "center" },
  emptyBody: { fontSize: 14, color: IOS.secondary, marginTop: 4, textAlign: "center" },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: IOS.secondary },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS.separator,
    backgroundColor: IOS.surface,
    paddingHorizontal: 12,
    fontSize: 16,
    color: IOS.ink,
  },
  chip: { borderRadius: IOS.radius.round, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  chipText: { fontSize: 12, fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: IOS.canvas,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    maxHeight: "88%",
  },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: IOS.separator, marginTop: 8, marginBottom: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: IOS.ink, letterSpacing: -0.3 },
  sheetSubtitle: { fontSize: 14, color: IOS.secondary, marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: IOS.fill, alignItems: "center", justifyContent: "center" },
  sheetFooter: { flexDirection: "row", gap: 10, paddingTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11, minHeight: 52 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: IOS.hairline },
  rowTitle: { fontSize: 16, fontWeight: "600", color: IOS.ink },
  rowSubtitle: { fontSize: 13, color: IOS.secondary, marginTop: 1 },
});
