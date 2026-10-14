import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Card, Chip, Empty, Loading, Notice, type NoticeValue, Sheet, kit } from "@/components/ios/kit";
import api from "@/config/api";
import { getRoleDisplayName } from "@/constants/industry-roles";
import { IOS, addDaysToKey, apiError, apiStatus, keyToDate, plural, roleColor, tint, toLabel, todayKey } from "@/constants/ios";
import { useAuth } from "@/context/auth-context";

import SlotSheet from "./slot-sheet";
import { type CoverageRow, type WeekData, type WeekSchedule, notSentReason, slotLabel, staffName } from "./week-utils";

const SOON_MS = 48 * 60 * 60 * 1000;

const formatWeek = (weekStart: string) => {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${keyToDate(weekStart).toLocaleDateString(undefined, opts)} – ${keyToDate(addDaysToKey(weekStart, 6)).toLocaleDateString(undefined, opts)}`;
};

type PublishResult = {
  error?: string;
  messaged?: number;
  sent?: { sms?: number; email?: number };
  notReached?: { staffId: string; name: string; reason: string }[];
};

/**
 * The week on a phone: one day at a time, each need as a card. Same flow as
 * the web: edits are "Not sent yet" until Publish / Send changes.
 */
export default function WeekScreen() {
  const { can, session, facilityPreferences, hasFeature } = useAuth();
  const canEdit = can("schedule.manage") && !session?.readOnlyReason;
  const roleFamilies = (facilityPreferences as { roleFamilies?: unknown[] } | null)?.roleFamilies;

  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [day, setDay] = useState<string>(todayKey());
  const [data, setData] = useState<WeekData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<NoticeValue>(null);
  const [soon, setSoon] = useState<string | null>(null); // "Send now?" prompt text
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [autoFillOpen, setAutoFillOpen] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const weekRef = useRef<string | null>(null);

  const load = useCallback(async (key: string | null) => {
    if (!key) return;
    try {
      const res = await api.get(`/weeks/${key}`);
      if (weekRef.current === key) setData(res.data);
    } catch (err) {
      setNotice({ kind: "error", text: apiError(err, "Couldn't load the week") });
    }
  }, []);

  const goToWeek = useCallback(
    (key: string) => {
      weekRef.current = key;
      setWeekStart(key);
      setData(null);
      // Today when it's this week; otherwise the same weekday.
      const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(key, i));
      setDay((d) => (days.includes(todayKey()) ? todayKey() : days[(keyToDate(d).getDay() - keyToDate(key).getDay() + 7) % 7]));
      void load(key);
    },
    [load],
  );

  useEffect(() => {
    api
      .get("/weeks/current")
      .then((res) => goToWeek(res.data.weekStart))
      .catch((err) => setNotice({ kind: "error", text: apiError(err, "Couldn't load this week") }));
  }, [goToWeek]);

  useFocusEffect(
    useCallback(() => {
      if (weekRef.current) void load(weekRef.current);
    }, [load]),
  );

  const reload = () => load(weekStart);

  const days = useMemo(() => (weekStart ? Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i)) : []), [weekStart]);

  const { rowsByDay, peopleByCoverage, outsByCoverage, looseByDay } = useMemo(() => {
    const rows = new Map<string, CoverageRow[]>();
    for (const row of data?.coverage || []) {
      if (!rows.has(row.dateKey)) rows.set(row.dateKey, []);
      rows.get(row.dateKey)!.push(row);
    }
    for (const list of rows.values()) {
      list.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime() ||
          String(a.role).localeCompare(String(b.role)) ||
          String(a.unitArea || "").localeCompare(String(b.unitArea || "")),
      );
    }
    const people = new Map<string, WeekSchedule[]>();
    const outs = new Map<string, number>();
    const loose = new Map<string, WeekSchedule[]>();
    for (const s of data?.schedules || []) {
      if (!s.coverageId) {
        const d = new Date(s.startTime);
        const pad = (n: number) => String(n).padStart(2, "0");
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (!loose.has(key)) loose.set(key, []);
        loose.get(key)!.push(s);
        continue;
      }
      const id = String(s.coverageId);
      if (s.status === "call_out") outs.set(id, (outs.get(id) || 0) + 1);
      else {
        if (!people.has(id)) people.set(id, []);
        people.get(id)!.push(s);
      }
    }
    return { rowsByDay: rows, peopleByCoverage: people, outsByCoverage: outs, looseByDay: loose };
  }, [data]);

  const week = data?.week;
  const counts = data?.counts || {};
  const isPublished = week?.status === "published";
  const changes = isPublished ? (counts.pendingPeople ?? counts.unpublishedChanges ?? 0) : counts.unpublishedChanges || 0;
  const canPublish = !isPublished || changes > 0;
  const today = todayKey();
  const fillableOpen = days.reduce(
    (sum, d) => sum + (d >= today ? (rowsByDay.get(d) || []).reduce((n, r) => n + Math.max(0, r.requiredCount - r.assignedCount), 0) : 0),
    0,
  );
  const openRow = (data?.coverage || []).find((r) => r._id === openRowId) || null;

  const publish = async () => {
    if (!weekStart) return;
    setConfirmPublish(false);
    setPublishing(true);
    try {
      const res = await api.post(`/weeks/${weekStart}/publish`);
      setResult(res.data);
      setSoon(null);
      setNotice(null);
      await reload();
    } catch (err) {
      setResult({
        error:
          apiStatus(err) === 402
            ? apiError(err, "You're over your plan. Change your plan or remove people on wisershifts.com, then publish.")
            : apiError(err, "Couldn't publish this week"),
      });
    } finally {
      setPublishing(false);
    }
  };

  const sendNow = async () => {
    if (!weekStart) return;
    setSoon(null);
    try {
      const res = await api.post(`/weeks/${weekStart}/publish`);
      const n = res.data?.messaged || 0;
      setNotice({ kind: "success", text: n ? `Sent to ${plural(n, "person", "people")}.` : "Nobody needed a message." });
      await reload();
    } catch (err) {
      setNotice({ kind: "error", text: apiError(err, "Couldn't send") });
    }
  };

  // After an edit in a published week: changes wait for Send changes, but a
  // shift in the next 48 hours gets a "Send now" offer.
  const onEdited = (message: string, sentAlready: boolean, row: CoverageRow) => {
    const isSoon = new Date(row.startTime).getTime() - Date.now() < SOON_MS;
    if (isPublished && !sentAlready && isSoon) {
      setSoon(`${message}. Not sent yet, and this shift is soon.`);
      setNotice(null);
    } else {
      setNotice({ kind: "success", text: `${message}${isPublished && !sentAlready ? ". Not sent yet" : ""}${sentAlready ? ". Sent" : ""}.` });
    }
  };

  const runAutoFill = async () => {
    if (!weekStart) return;
    setAutoFilling(true);
    try {
      const res = await api.post(`/weeks/${weekStart}/auto-fill`, {});
      const { filled = 0, stillOpen = 0 } = res.data || {};
      if (!filled) {
        setNotice({ kind: "info", text: stillOpen ? "Nobody available for the open slots. Open a slot to see why." : "Nothing open to fill." });
      } else {
        const parts = [`Filled ${plural(filled, "slot")}`, isPublished ? "not sent yet (press Send changes)" : "not sent yet"];
        if (stillOpen) parts.push(`${stillOpen} still open`);
        setNotice({ kind: "success", text: `${parts.join(", ")}.` });
      }
      await reload();
    } catch (err) {
      setNotice({ kind: "error", text: apiError(err, "Couldn't auto-fill") });
    } finally {
      setAutoFilling(false);
      setAutoFillOpen(false);
    }
  };

  const dayRows = rowsByDay.get(day) || [];
  const loose = (looseByDay.get(day) || []).filter((s) => s.status !== "call_out");

  return (
    <View style={kit.screen}>
      <ScrollView
        contentContainerStyle={[kit.content, { paddingTop: 12 }]}
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
          />
        }
      >
        {/* Week + publish */}
        <View style={{ gap: 12 }}>
          <View style={styles.weekRow}>
            <Pressable style={styles.navBtn} onPress={() => weekStart && goToWeek(addDaysToKey(weekStart, -7))} accessibilityLabel="Previous week">
              <Feather name="chevron-left" size={18} color={IOS.ink} />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={styles.weekTitle}>{weekStart ? formatWeek(weekStart) : "Loading…"}</Text>
              {week && (
                <Chip
                  style={{ alignSelf: "center" }}
                  label={isPublished ? "Published" : "Draft"}
                  color={isPublished ? IOS.green : IOS.orange}
                  textColor={isPublished ? IOS.greenText : IOS.orangeText}
                />
              )}
            </View>
            <Pressable style={styles.navBtn} onPress={() => weekStart && goToWeek(addDaysToKey(weekStart, 7))} accessibilityLabel="Next week">
              <Feather name="chevron-right" size={18} color={IOS.ink} />
            </Pressable>
          </View>

          {data && (
            <Card
              style={[
                { gap: 10 },
                isPublished && changes > 0 && { backgroundColor: tint(IOS.orange, 0.08), borderColor: tint(IOS.orange, 0.5) },
              ]}
            >
              <Text style={kit.muted}>
                {plural(counts.shifts || 0, "shift")} ·{" "}
                <Text style={counts.openSlots ? { color: IOS.orangeText, fontWeight: "600" } : undefined}>{plural(counts.openSlots || 0, "open slot")}</Text>
                {counts.callOuts ? ` · ${plural(counts.callOuts, "call-out")}` : ""}
              </Text>
              {canEdit && (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {hasFeature("autoFill") && (
                    <Button
                      kind="tinted"
                      icon="zap"
                      title="Auto-fill"
                      style={{ flex: 1 }}
                      disabled={fillableOpen === 0}
                      onPress={() => setAutoFillOpen(true)}
                    />
                  )}
                  <Button
                    icon={isPublished && !changes ? "check" : "send"}
                    title={publishing ? "Sending…" : isPublished ? (changes ? `Send changes (${changes})` : "Published") : "Publish week"}
                    style={[{ flex: 1.8 }, isPublished && !changes && { backgroundColor: tint(IOS.green, 0.14) }]}
                    color={isPublished && changes ? IOS.orange : undefined}
                    disabled={!canPublish || publishing}
                    onPress={() => setConfirmPublish(true)}
                  />
                </View>
              )}
              <Text style={kit.caption}>
                {isPublished
                  ? changes
                    ? `${plural(changes, "person has", "people have")} changes not sent yet. Nobody is told until you press Send changes.`
                    : "Published. Changes wait here until you send them."
                  : "Staff don't see this week yet. Fill the open slots, then publish: everyone gets one text or email with their shifts and their link."}
              </Text>
            </Card>
          )}
        </View>

        {/* Day strip (sticky) */}
        <View style={styles.dayStripWrap}>
          <View style={styles.dayStrip}>
            {days.map((d) => {
              const rows = rowsByDay.get(d) || [];
              const needed = rows.reduce((n, r) => n + r.requiredCount, 0);
              const open = rows.reduce((n, r) => n + Math.max(0, r.requiredCount - r.assignedCount), 0);
              const active = d === day;
              const date = keyToDate(d);
              return (
                <Pressable key={d} style={[styles.dayBtn, active && styles.dayBtnActive]} onPress={() => setDay(d)} accessibilityRole="tab" accessibilityState={{ selected: active }}>
                  <Text style={[styles.dayLetter, active && { color: "#fff" }]}>{date.toLocaleDateString(undefined, { weekday: "narrow" })}</Text>
                  <Text style={[styles.dayNum, active && { color: "#fff" }, d === today && !active && { color: IOS.blue }]}>{date.getDate()}</Text>
                  <View style={[styles.dayDot, { backgroundColor: needed === 0 ? "transparent" : open > 0 ? IOS.orange : IOS.green }]} />
                </Pressable>
              );
            })}
          </View>
        </View>

        {soon && (
          <View style={[styles.soon]}>
            <Text style={[kit.body, { flex: 1, fontSize: 14 }]}>{soon}</Text>
            <Button small title="Send now" onPress={sendNow} />
            <Pressable onPress={() => setSoon(null)} hitSlop={8} accessibilityLabel="Dismiss">
              <Feather name="x" size={16} color={IOS.secondary} />
            </Pressable>
          </View>
        )}
        <Notice notice={notice} onClose={() => setNotice(null)} />
        {session?.readOnlyReason ? (
          <Notice notice={{ kind: "warning", text: "View only: the facility is over its scheduler limit. The owner can change the plan on wisershifts.com." }} />
        ) : null}

        {/* The day */}
        <Text style={kit.title}>{keyToDate(day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
        {!data && <Loading />}
        {data && dayRows.length === 0 && loose.length === 0 && (
          <Empty title="Nothing needed this day" body="Set what you need each day in Weekly Needs on wisershifts.com." />
        )}
        {data &&
          dayRows.map((row) => {
            const people = peopleByCoverage.get(row._id) || [];
            const outs = outsByCoverage.get(row._id) || 0;
            const label = slotLabel(facilityPreferences, row);
            const short = row.requiredCount - row.assignedCount;
            const color = roleColor(row.role, roleFamilies);
            return (
              <Pressable key={row._id} onPress={() => setOpenRowId(row._id)} style={({ pressed }) => [pressed && { opacity: 0.75 }]}>
                <Card style={styles.slot}>
                  <View style={[styles.slotBar, { backgroundColor: color }]} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[kit.title, { flex: 1 }]} numberOfLines={1}>
                        {getRoleDisplayName(row.role)}
                        {row.unitArea ? <Text style={kit.muted}>{`  ${toLabel(row.unitArea)}`}</Text> : null}
                      </Text>
                      <Chip
                        label={`${row.assignedCount}/${row.requiredCount}`}
                        color={short > 0 ? IOS.orange : short < 0 ? IOS.purple : IOS.green}
                        textColor={short > 0 ? IOS.orangeText : short < 0 ? IOS.purple : IOS.greenText}
                      />
                    </View>
                    <Text style={kit.muted}>
                      {label.name} · {label.time}
                      {outs ? <Text style={{ color: IOS.redText }}>{` · ${outs} called out`}</Text> : null}
                    </Text>
                    <View style={styles.names}>
                      {people.map((s) => (
                        <View key={s._id} style={[styles.name, s.state === "draft" && styles.nameDraft]}>
                          <Text style={[styles.nameText, s.state === "draft" && { color: IOS.orangeText }]} numberOfLines={1}>
                            {staffName(s)}
                          </Text>
                        </View>
                      ))}
                      {Array.from({ length: Math.max(0, short) }).map((_, i) => (
                        <View key={`open-${i}`} style={styles.openSlot}>
                          <Text style={[styles.nameText, { color: IOS.orangeText }]}>Open</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        {loose.length > 0 && (
          <Card padded={false}>
            <Text style={[kit.caption, { paddingHorizontal: 14, paddingTop: 10, fontWeight: "700" }]}>OTHER SHIFTS</Text>
            {loose.map((s) => (
              <View key={s._id} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={[kit.body, { fontWeight: "600" }]}>{staffName(s)}</Text>
                <Text style={kit.caption}>
                  {getRoleDisplayName(s.role)} · {new Date(s.startTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}–
                  {new Date(s.endTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  {s.state === "draft" ? " · Not sent yet" : ""}
                </Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {openRow && weekStart && (
        <SlotSheet
          key={openRow._id}
          row={openRow}
          weekStart={weekStart}
          weekPublished={isPublished}
          callOuts={outsByCoverage.get(openRow._id) || 0}
          people={peopleByCoverage.get(openRow._id) || []}
          canEdit={canEdit}
          onClose={() => setOpenRowId(null)}
          onChanged={reload}
          onEdited={onEdited}
        />
      )}

      <Sheet
        open={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        title={isPublished ? "Send changes?" : `Publish ${weekStart ? formatWeek(weekStart) : "week"}?`}
        footer={
          <>
            <Button kind="gray" title="Cancel" style={{ flex: 1 }} onPress={() => setConfirmPublish(false)} />
            <Button title={isPublished ? "Send" : "Publish"} style={{ flex: 1 }} onPress={publish} />
          </>
        }
      >
        <View style={{ gap: 12 }}>
          <Text style={kit.body}>
            {isPublished
              ? `${changes === 1 ? "The 1 person whose shifts changed gets" : `The ${changes} people whose shifts changed each get`} one message with their updated week. Changes that cancel out aren't sent.`
              : "Everyone on this week gets one text or email with their shifts and a link to swap, pick up shifts or call out."}
          </Text>
          {!isPublished && (counts.openSlots || 0) > 0 && (
            <Notice notice={{ kind: "warning", text: `${plural(counts.openSlots || 0, "slot is", "slots are")} still open. You can publish now and fill them later.` }} />
          )}
        </View>
      </Sheet>

      <Sheet
        open={autoFillOpen}
        onClose={() => setAutoFillOpen(false)}
        title="Auto-fill open slots?"
        footer={
          <>
            <Button kind="gray" title="Cancel" style={{ flex: 1 }} onPress={() => setAutoFillOpen(false)} />
            <Button title={`Fill ${fillableOpen}`} icon="zap" style={{ flex: 1 }} busy={autoFilling} onPress={runAutoFill} />
          </>
        }
      >
        <Text style={kit.body}>
          We&apos;ll put the best available people on each open slot: right role, area and certifications, not on time off, and spreading hours
          fairly.{" "}
          {isPublished
            ? "This week is already published. They'll show as Not sent yet; press Send changes when you're ready."
            : "Nothing is sent until you publish."}
        </Text>
      </Sheet>

      <Sheet
        open={Boolean(result)}
        onClose={() => setResult(null)}
        title={result?.error ? "Couldn't publish" : "Schedule sent"}
        footer={<Button title="Done" style={{ flex: 1 }} onPress={() => setResult(null)} />}
      >
        {result?.error ? (
          <Notice notice={{ kind: "error", text: result.error }} />
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={kit.body}>
              {result?.messaged
                ? `${(result.sent?.sms || 0) + (result.sent?.email || 0)} of ${plural(result.messaged, "person", "people")} got their schedule: ${result.sent?.sms || 0} by text, ${result.sent?.email || 0} by email.`
                : "Nobody needed a message."}
            </Text>
            {(result?.notReached?.length || 0) > 0 && (
              <Notice
                notice={{
                  kind: "warning",
                  text: `Not reached: ${result!.notReached!.map((p) => `${p.name} (${notSentReason(p.reason)})`).join(", ")}. You can share their link from Staff.`,
                }}
              />
            )}
          </View>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: IOS.fill, alignItems: "center", justifyContent: "center" },
  weekTitle: { fontSize: 20, fontWeight: "700", color: IOS.ink, letterSpacing: -0.3, marginBottom: 4 },
  dayStripWrap: { backgroundColor: IOS.canvas, paddingVertical: 4, marginHorizontal: -16, paddingHorizontal: 16 },
  dayStrip: { flexDirection: "row", gap: 4 },
  dayBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 14, gap: 2 },
  dayBtnActive: { backgroundColor: IOS.ink },
  dayLetter: { fontSize: 12, fontWeight: "600", color: IOS.secondary },
  dayNum: { fontSize: 18, fontWeight: "700", color: IOS.ink },
  dayDot: { width: 6, height: 6, borderRadius: 3 },
  soon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: tint(IOS.blue, 0.1),
  },
  slot: { flexDirection: "row", gap: 12, padding: 14 },
  slotBar: { width: 4, borderRadius: 2 },
  names: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  name: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: IOS.fill, maxWidth: "100%" },
  nameDraft: { backgroundColor: tint(IOS.orange, 0.1), borderWidth: 1, borderStyle: "dashed", borderColor: tint(IOS.orange, 0.6) },
  openSlot: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderStyle: "dashed", borderColor: tint(IOS.orange, 0.6) },
  nameText: { fontSize: 13, fontWeight: "600", color: IOS.ink },
});
