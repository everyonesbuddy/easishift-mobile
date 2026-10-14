import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Card, Chip, Empty, Field, Loading, Notice, type NoticeValue, SectionLabel, Segmented, Sheet, kit } from "@/components/ios/kit";
import { type LinkShift, StaffHeader, useStaffFormat } from "@/components/staff-link/shared";
import { IOS, apiError, toLabel } from "@/constants/ios";
import { useStaffLink } from "@/context/staff-link-context";
import { syncShiftReminders } from "@/services/staff-link/reminders";

const DAY = 86400000;
const WEEK = 7 * DAY;
const PAST_STEP_WEEKS = 4;

type Candidate = { staffId: string; name: string };

export default function MyShifts() {
  const { client, me } = useStaffLink();
  const fmt = useStaffFormat();
  const features = me?.features || {};
  const [shifts, setShifts] = useState<LinkShift[] | null>(null);
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const [past, setPast] = useState<LinkShift[] | null>(null);
  const [pastWeeks, setPastWeeks] = useState(0);
  const [pastLoading, setPastLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<NoticeValue>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [callOut, setCallOut] = useState<LinkShift | null>(null);
  const [swapShift, setSwapShift] = useState<LinkShift | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [swapTo, setSwapTo] = useState("");
  const [swapNote, setSwapNote] = useState("");

  const { fmtTime } = fmt;
  const load = useCallback(async () => {
    if (!client) return;
    try {
      const res = await client.get("/schedule");
      const list = (res.data.shifts || []) as LinkShift[];
      setShifts(list);
      setNow(Date.now());
      void syncShiftReminders(list, fmtTime);
    } catch (err) {
      setShifts((prev) => prev || []);
      setNotice({ kind: "error", text: apiError(err, "Couldn't load your shifts") });
    }
  }, [client, fmtTime]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const loadMorePast = async () => {
    if (!client) return;
    setPastLoading(true);
    try {
      const to = pastWeeks === 0 ? new Date() : new Date(Date.now() - pastWeeks * WEEK);
      const from = new Date(Date.now() - (pastWeeks + PAST_STEP_WEEKS) * WEEK);
      const res = await client.get("/schedule", { params: { from: from.toISOString(), to: to.toISOString() } });
      const older = ((res.data.shifts || []) as LinkShift[]).filter((x) => new Date(x.endTime).getTime() <= Date.now());
      setPast((prev) => {
        const seen = new Set((prev || []).map((x) => x._id));
        return [...(prev || []), ...older.filter((x) => !seen.has(x._id))];
      });
      setPastWeeks((w) => w + PAST_STEP_WEEKS);
    } catch (err) {
      setNotice({ kind: "error", text: apiError(err, "Couldn't load past shifts") });
    } finally {
      setPastLoading(false);
    }
  };

  const showPast = () => {
    setView("past");
    if (past === null && !pastLoading) void loadMorePast();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const run = async (fn: () => Promise<unknown>, success: string) => {
    if (!client) return false;
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      setNotice({ kind: "success", text: success });
      return true;
    } catch (err) {
      setNotice({ kind: "error", text: apiError(err, "Something went wrong") });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmCallOut = async () => {
    const shift = callOut;
    setCallOut(null);
    if (!shift || !client) return;
    await run(() => client.post(`/schedules/${shift._id}/call-out`), "Got it. Your scheduler has been told you can't make it.");
    void load();
  };

  const openSwap = async (shift: LinkShift) => {
    setSwapShift(shift);
    setSwapTo("");
    setSwapNote("");
    setCandidates(null);
    try {
      const res = await client!.get(`/swap-candidates/${shift._id}`);
      setCandidates(res.data || []);
    } catch (err) {
      setCandidates([]);
      setNotice({ kind: "error", text: apiError(err, "Couldn't load coworkers") });
    }
  };

  const sendSwap = async () => {
    const shift = swapShift;
    setSwapShift(null);
    if (!shift || !client) return;
    await run(() => client.post(`/schedules/${shift._id}/swap`, { receiverStaffId: swapTo, note: swapNote }), "Swap request sent.");
  };

  const upcoming = (shifts || []).filter((s) => new Date(s.endTime).getTime() > now);
  const next = upcoming.find((s) => s.status === "scheduled" || s.status === "in_progress") || null;
  const rest = upcoming.filter((s) => s !== next);
  const weekStartMs = (() => {
    const d = new Date(now);
    const offset = (d.getDay() - (me?.facility?.weekStartsOn ?? 0) + 7) % 7;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    return d.getTime();
  })();
  const laterGroups = [
    { label: "This week", shifts: rest.filter((s) => new Date(s.startTime).getTime() < weekStartMs + WEEK) },
    {
      label: "Next week",
      shifts: rest.filter((s) => {
        const t = new Date(s.startTime).getTime();
        return t >= weekStartMs + WEEK && t < weekStartMs + 2 * WEEK;
      }),
    },
    { label: "Later", shifts: rest.filter((s) => new Date(s.startTime).getTime() >= weekStartMs + 2 * WEEK) },
  ].filter((g) => g.shifts.length);

  const pastGroups = (() => {
    const list = [...(past || [])].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    const groups = new Map<number, { key: number; label: string; shifts: LinkShift[]; minutes: number }>();
    for (const x of list) {
      const t = new Date(x.startTime).getTime();
      const key = t >= weekStartMs ? 0 : Math.floor((weekStartMs - t) / WEEK) + 1;
      if (!groups.has(key)) {
        const start = new Date(weekStartMs - key * WEEK);
        groups.set(key, {
          key,
          label:
            key === 0
              ? "This week"
              : key === 1
                ? "Last week"
                : `Week of ${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
          shifts: [],
          minutes: 0,
        });
      }
      const g = groups.get(key)!;
      g.shifts.push(x);
      if (x.status !== "call_out") g.minutes += (new Date(x.endTime).getTime() - new Date(x.startTime).getTime()) / 60000;
    }
    return [...groups.values()].sort((a, b) => a.key - b.key);
  })();

  const relativeDay = (iso: string) => {
    const day = new Date(iso);
    day.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((day.getTime() - today.getTime()) / DAY);
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    if (diff > 1 && diff < 7) return `in ${diff} days`;
    return "";
  };

  const canAct = (s: LinkShift) => s.status === "scheduled" && new Date(s.startTime).getTime() > now;
  const detail = (s: LinkShift) => `${toLabel(s.role)}${s.unitArea ? `, ${toLabel(s.unitArea)}` : ""}`;

  return (
    <View style={kit.screen}>
      <StaffHeader />
      <ScrollView contentContainerStyle={kit.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {me?.staff?.hasPhone && me.staff.smsStatus === "opted_out" && (
          <Notice notice={{ kind: "info", text: "You've turned off texts. Reply START to any of our texts to turn them back on." }} />
        )}
        <Notice notice={notice} onClose={() => setNotice(null)} />
        <Segmented
          value={view}
          onChange={(v) => (v === "past" ? showPast() : setView("upcoming"))}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "past", label: "Past" },
          ]}
        />

        {view === "upcoming" &&
          (shifts === null ? (
            <Loading />
          ) : (
            <>
              {upcoming.length === 0 && (
                <Empty
                  title="No upcoming shifts"
                  body={features.pickup ? "Check Open to pick one up." : "You'll get a message when your schedule is out."}
                />
              )}
              {next && (
                <View style={styles.hero}>
                  <Text style={styles.heroKicker}>
                    Your next shift{relativeDay(next.startTime) ? `, ${relativeDay(next.startTime)}` : ""}
                  </Text>
                  <Text style={styles.heroDay}>{fmt.fmtDay(next.startTime)}</Text>
                  <Text style={styles.heroTime}>
                    {fmt.fmtTime(next.startTime)}–{fmt.fmtTime(next.endTime)}
                  </Text>
                  <Text style={styles.heroDetail}>{detail(next)}</Text>
                  {canAct(next) && (
                    <View style={styles.heroActions}>
                      {features.swaps && (
                        <Pressable style={[styles.heroGhost, { backgroundColor: "#fff" }]} onPress={() => openSwap(next)}>
                          <Text style={[styles.heroGhostText, { color: IOS.blueDark, fontWeight: "700" }]}>Swap</Text>
                        </Pressable>
                      )}
                      <Pressable style={styles.heroGhost} onPress={() => setCallOut(next)}>
                        <Text style={styles.heroGhostText}>Can&apos;t make it</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
              {laterGroups.map((group) => (
                <View key={group.label}>
                  <SectionLabel>{group.label}</SectionLabel>
                  <Card padded={false}>
                    {group.shifts.map((s, i) => (
                      <ShiftRow
                        key={s._id}
                        first={i === 0}
                        weekday={fmt.fmtWeekday(s.startTime)}
                        date={fmt.fmtDate(s.startTime)}
                        time={`${fmt.fmtTime(s.startTime)}–${fmt.fmtTime(s.endTime)}`}
                        detail={`${detail(s)}${s.status !== "scheduled" ? `, ${toLabel(s.status)}` : ""}`}
                        actions={
                          canAct(s) ? (
                            <View style={{ alignItems: "flex-end" }}>
                              {features.swaps && <Button small kind="plain" title="Swap" onPress={() => openSwap(s)} />}
                              <Button small kind="plain" color={IOS.redText} title="Can't make it" onPress={() => setCallOut(s)} />
                            </View>
                          ) : null
                        }
                      />
                    ))}
                  </Card>
                </View>
              ))}
            </>
          ))}

        {view === "past" &&
          (past === null ? (
            <Loading />
          ) : (
            <>
              {pastGroups.length === 0 && <Empty title={`No past shifts in the last ${pastWeeks} weeks`} />}
              {pastGroups.map((group) => {
                const worked = group.shifts.filter((x) => x.status !== "call_out").length;
                return (
                  <View key={group.key}>
                    <SectionLabel right={`${worked} shift${worked === 1 ? "" : "s"} · ${Math.round((group.minutes / 60) * 10) / 10}h`}>
                      {group.label}
                    </SectionLabel>
                    <Card padded={false}>
                      {group.shifts.map((x, i) => (
                        <ShiftRow
                          key={x._id}
                          first={i === 0}
                          muted
                          weekday={fmt.fmtWeekday(x.startTime)}
                          date={fmt.fmtDate(x.startTime)}
                          time={`${fmt.fmtTime(x.startTime)}–${fmt.fmtTime(x.endTime)}`}
                          detail={detail(x)}
                          actions={
                            x.status === "call_out" ? (
                              <Chip label="Called out" color={IOS.red} textColor={IOS.redText} />
                            ) : (
                              <Chip label="Worked" color={IOS.green} textColor={IOS.greenText} />
                            )
                          }
                        />
                      ))}
                    </Card>
                  </View>
                );
              })}
              <Button kind="plain" busy={pastLoading} title={`Show earlier (before ${pastWeeks} weeks ago)`} onPress={loadMorePast} />
            </>
          ))}

        <Text style={[kit.caption, { textAlign: "center", marginTop: 8 }]}>
          This is your personal schedule. Don&apos;t share your link. Powered by WiserShifts.
        </Text>
      </ScrollView>

      <Sheet
        open={Boolean(callOut)}
        onClose={() => setCallOut(null)}
        title="Can't make this shift?"
        footer={
          <>
            <Button kind="gray" title="Keep shift" style={{ flex: 1 }} onPress={() => setCallOut(null)} />
            <Button kind="destructive" title="I can't make it" style={{ flex: 1 }} busy={busy} onPress={confirmCallOut} />
          </>
        }
      >
        <Text style={kit.body}>
          {callOut ? fmt.shiftLine(callOut) : ""}. We&apos;ll tell your scheduler right away so they can find cover.
        </Text>
      </Sheet>

      <Sheet
        open={Boolean(swapShift)}
        onClose={() => setSwapShift(null)}
        title="Ask someone to swap"
        subtitle={swapShift ? fmt.shiftLine(swapShift) : ""}
        footer={
          <>
            <Button kind="gray" title="Cancel" style={{ flex: 1 }} onPress={() => setSwapShift(null)} />
            <Button title="Send request" style={{ flex: 1 }} disabled={!swapTo} busy={busy} onPress={sendSwap} />
          </>
        }
      >
        {candidates === null ? (
          <Loading />
        ) : candidates.length === 0 ? (
          <Text style={kit.muted}>No coworkers are free for this shift.</Text>
        ) : (
          <View style={{ gap: 14 }}>
            <Card padded={false}>
              {candidates.map((c, i) => (
                <Pressable
                  key={c.staffId}
                  onPress={() => setSwapTo(c.staffId)}
                  style={[styles.pickRow, i > 0 && styles.pickBorder]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: swapTo === c.staffId }}
                >
                  <Text style={[kit.body, { flex: 1 }]}>{c.name}</Text>
                  {swapTo === c.staffId && <Text style={{ color: IOS.blue, fontSize: 17, fontWeight: "700" }}>✓</Text>}
                </Pressable>
              ))}
            </Card>
            <Field label="Note (optional)" value={swapNote} onChangeText={setSwapNote} placeholder="Anything they should know" />
          </View>
        )}
      </Sheet>
    </View>
  );
}

function ShiftRow({
  weekday,
  date,
  time,
  detail,
  actions,
  first,
  muted,
}: {
  weekday: string;
  date: string;
  time: string;
  detail: string;
  actions?: React.ReactNode;
  first?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={[styles.row, !first && styles.rowBorder]}>
      <View style={styles.dateCol}>
        <Text style={styles.weekday}>{weekday}</Text>
        <Text style={[styles.date, muted && { color: IOS.secondary }]}>{date}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.time} numberOfLines={1}>
          {time}
        </Text>
        <Text style={kit.muted} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: "#0A72F0",
    shadowColor: IOS.blue,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroKicker: { color: "rgba(255,255,255,0.85)", fontSize: 14 },
  heroDay: { color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 4 },
  heroTime: { color: "#fff", fontSize: 20, fontWeight: "700" },
  heroDetail: { color: "rgba(255,255,255,0.85)", marginTop: 4, fontSize: 15 },
  heroActions: { flexDirection: "row", gap: 8, marginTop: 16 },
  heroGhost: {
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
  },
  heroGhostText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: IOS.hairline },
  dateCol: { width: 40, alignItems: "center" },
  weekday: { fontSize: 12, fontWeight: "600", color: IOS.secondary },
  date: { fontSize: 20, fontWeight: "800", color: IOS.ink },
  time: { fontSize: 15, fontWeight: "700", color: IOS.ink },
  pickRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, minHeight: 48 },
  pickBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: IOS.hairline },
});
