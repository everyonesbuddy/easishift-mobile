import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar, Button, Card, Loading, Notice, type NoticeValue, SectionLabel, Sheet, kit } from "@/components/ios/kit";
import api from "@/config/api";
import { getRoleDisplayName } from "@/constants/industry-roles";
import { IOS, apiError, apiStatus, roleColor, toLabel } from "@/constants/ios";
import { useAuth } from "@/context/auth-context";

import { type Candidate, type CoverageRow, type WeekSchedule, ineligibleReason, notSentReason, slotLabel, staffName } from "./week-utils";

type Props = {
  row: CoverageRow | null;
  weekStart: string;
  weekPublished: boolean;
  callOuts: number;
  people: WeekSchedule[];
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
  /** After an edit: what happened, and whether it was already sent. */
  onEdited: (message: string, sentAlready: boolean, row: CoverageRow) => void;
};

/**
 * One day's need for one shift + role (the web's slot drawer): who's on
 * it, who could be, how many are needed, and call-outs.
 */
export default function SlotSheet({ row, weekStart, weekPublished, callOuts, people, canEdit, onClose, onChanged, onEdited }: Props) {
  const { facilityPreferences, hasFeature } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const [notice, setNotice] = useState<NoticeValue>(null);
  // Call-out flow: confirm, then fill.
  const [outFor, setOutFor] = useState<WeekSchedule | null>(null);
  const [fill, setFill] = useState<{ coverage: CoverageRow & { remaining: number }; candidates: Candidate[] } | null>(null);
  // The parent remounts this sheet per slot (key), so "now" is per opening.
  const [now] = useState(() => Date.now());
  const [textResult, setTextResult] = useState<{ sentTo?: number; bySms?: number; byEmail?: number; notReached?: { name: string; reason: string }[] } | null>(null);

  const rowId = row?._id;
  const assignedCount = row?.assignedCount;

  useEffect(() => {
    if (!rowId || !canEdit) return;
    let cancelled = false;
    api
      .get(`/weeks/${weekStart}/candidates`, { params: { coverageId: rowId } })
      .then((res) => !cancelled && setCandidates(res.data || []))
      .catch(() => !cancelled && setCandidates([]));
    return () => {
      cancelled = true;
    };
  }, [rowId, weekStart, canEdit, assignedCount]);

  if (!row) return null;

  const label = slotLabel(facilityPreferences, row);
  const color = roleColor(row.role, (facilityPreferences as { roleFamilies?: unknown[] } | null)?.roleFamilies);
  const isPast = new Date(row.endTime).getTime() < now;
  const eligible = (candidates || []).filter((c) => c.eligible);
  const others = (candidates || []).filter((c) => !c.eligible);
  const remaining = Math.max(0, row.requiredCount - row.assignedCount);
  const day = new Date(row.startTime).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  const fail = (err: unknown, fallback: string) => {
    if (apiStatus(err) === 402) setNotice({ kind: "warning", text: apiError(err, "Your plan doesn't include this. Manage your plan on wisershifts.com.") });
    else setNotice({ kind: "error", text: apiError(err, fallback) });
  };

  const setCount = async (next: number) => {
    if (next < 0 || next > 50) return;
    setBusyId("count");
    try {
      await api.put(`/coverage/${row._id}`, { requiredCount: next });
      onChanged();
    } catch (err) {
      fail(err, "Couldn't change the count");
    } finally {
      setBusyId(null);
    }
  };

  const assign = async (c: Candidate, coverage: CoverageRow = row, urgent = false) => {
    setBusyId(c.staffId);
    setNotice(null);
    // Covering a call-out in a sent week is urgent: tell them now.
    const sendNow = weekPublished && (urgent || callOuts > 0);
    try {
      await api.post("/schedules", {
        staffId: c.staffId,
        coverageId: coverage._id,
        role: coverage.role,
        unitArea: coverage.unitArea || null,
        shiftType: coverage.shiftType || null,
        shiftTag: coverage.shiftTag || null,
        startTime: coverage.startTime,
        endTime: coverage.endTime,
        ...(sendNow ? { sendNow: true } : {}),
      });
      onEdited(`${c.name} added`, sendNow, coverage);
      onChanged();
      if (fill) {
        setFill(null);
        setOutFor(null);
      }
    } catch (err) {
      fail(err, "Couldn't assign");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (s: WeekSchedule) => {
    setBusyId(s._id);
    try {
      await api.delete(`/schedules/${s._id}`);
      onEdited(`${staffName(s)} removed`, false, row);
      setConfirmRemoveId(null);
      onChanged();
    } catch (err) {
      fail(err, "Couldn't remove");
    } finally {
      setBusyId(null);
    }
  };

  const markOut = async () => {
    if (!outFor) return;
    setBusyId("out");
    try {
      const res = await api.post(`/schedules/${outFor._id}/call-out`);
      setFill({ coverage: res.data.coverage, candidates: res.data.candidates || [] });
      onChanged();
    } catch (err) {
      fail(err, "Couldn't mark the call-out");
    } finally {
      setBusyId(null);
    }
  };

  const textEligible = async () => {
    if (!fill) return;
    setBusyId("text");
    try {
      const res = await api.post(`/coverage/${fill.coverage._id}/fill-by-text`, {});
      setTextResult(res.data);
    } catch (err) {
      fail(err, "Couldn't send the texts");
    } finally {
      setBusyId(null);
    }
  };

  // --- call-out: confirm / fill ---
  if (outFor) {
    const fillEligible = (fill?.candidates || []).filter((c) => c.eligible);
    return (
      <Sheet
        open
        onClose={onClose}
        title={fill ? "Fill the shift" : "Mark as called out?"}
        subtitle={`${getRoleDisplayName(row.role)} · ${day} · ${label.time}`}
        footer={
          fill ? (
            <Button kind="gray" title="Done" style={{ flex: 1 }} onPress={onClose} />
          ) : (
            <>
              <Button kind="gray" title="Cancel" style={{ flex: 1 }} onPress={() => setOutFor(null)} />
              <Button kind="destructive" title="Mark called out" style={{ flex: 1 }} busy={busyId === "out"} onPress={markOut} />
            </>
          )
        }
      >
        <View style={{ gap: 14 }}>
          <Notice notice={notice} onClose={() => setNotice(null)} />
          {!fill ? (
            <Text style={kit.body}>
              <Text style={{ fontWeight: "700" }}>{staffName(outFor)}</Text> won&apos;t be working this shift. The slot opens up and
              we&apos;ll show you who can cover.
            </Text>
          ) : (
            <>
              {fill.coverage.remaining <= 0 && <Notice notice={{ kind: "success", text: "This shift is already covered." }} />}
              {textResult ? (
                <Notice
                  notice={{
                    kind: "success",
                    text: `Offered to ${textResult.sentTo} ${textResult.sentTo === 1 ? "person" : "people"}: ${textResult.bySms || 0} by text, ${
                      textResult.byEmail || 0
                    } by email. The first to say yes gets the shift.${
                      textResult.notReached?.length
                        ? ` Not reached: ${textResult.notReached.map((p) => `${p.name} (${notSentReason(p.reason)})`).join(", ")}.`
                        : ""
                    }`,
                  }}
                />
              ) : (
                fillEligible.length > 0 &&
                hasFeature("calloutText") && (
                  <View style={{ gap: 4 }}>
                    <Button
                      title={`Text ${fillEligible.length} eligible. First YES gets it`}
                      icon="message-circle"
                      busy={busyId === "text"}
                      disabled={fill.coverage.remaining <= 0}
                      onPress={textEligible}
                    />
                    <Text style={kit.caption}>People this would put into overtime are skipped.</Text>
                  </View>
                )
              )}
              <View>
                <SectionLabel>{`Can cover (${fillEligible.length})`}</SectionLabel>
                {fillEligible.length === 0 ? (
                  <Text style={kit.muted}>Nobody eligible is free.</Text>
                ) : (
                  <Card padded={false}>
                    {fillEligible.map((c, i) => (
                      <PersonRow
                        key={c.staffId}
                        first={i === 0}
                        name={c.name}
                        detail={`${c.weekHours}h this week${c.overtimeIfAssigned ? ", would be overtime" : ""}${c.hasPhone === false ? ", no phone" : ""}`}
                        warn={c.overtimeIfAssigned}
                        action={
                          <Button
                            small
                            title="Assign"
                            busy={busyId === c.staffId}
                            disabled={Boolean(busyId) || fill.coverage.remaining <= 0}
                            onPress={() => assign(c, fill.coverage, true)}
                          />
                        }
                      />
                    ))}
                  </Card>
                )}
              </View>
            </>
          )}
        </View>
      </Sheet>
    );
  }

  // --- the slot ---
  return (
    <Sheet open onClose={onClose} title={getRoleDisplayName(row.role)} subtitle={`${day} · ${label.name} ${label.time}`}>
      <View style={{ gap: 16 }}>
        {(row.unitArea || (row.requiredCertificationTags?.length ?? 0) > 0) && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: color }} />
            <Text style={kit.muted}>
              {[
                row.unitArea && toLabel(row.unitArea),
                row.requiredCertificationTags?.length ? `needs ${row.requiredCertificationTags.map(toLabel).join(", ")}` : null,
              ]
                .filter(Boolean)
                .join(", ")}
            </Text>
          </View>
        )}
        <Notice notice={notice} onClose={() => setNotice(null)} />

        <Card style={styles.countCard}>
          <View style={{ flex: 1 }}>
            <Text style={[kit.body, { fontWeight: "700" }]}>People needed</Text>
            <Text style={kit.caption}>{row.overridden ? "Changed for this day only" : "From Weekly Needs"}</Text>
          </View>
          <Stepper
            disabled={!canEdit || isPast || busyId === "count"}
            value={row.requiredCount}
            onMinus={() => setCount(row.requiredCount - 1)}
            onPlus={() => setCount(row.requiredCount + 1)}
          />
        </Card>

        <View>
          <SectionLabel>{`On this shift (${row.assignedCount} of ${row.requiredCount})`}</SectionLabel>
          {people.length === 0 ? (
            <Text style={kit.muted}>Nobody yet.</Text>
          ) : (
            <Card padded={false}>
              {people.map((s, i) => (
                <PersonRow
                  key={s._id}
                  first={i === 0}
                  name={staffName(s)}
                  color={color}
                  detail={s.state === "draft" ? "Not sent yet" : toLabel(s.status)}
                  warn={s.state === "draft"}
                  action={
                    canEdit && !isPast ? (
                      <View style={{ flexDirection: "row", gap: 2 }}>
                        {s.status === "scheduled" && s.state !== "draft" && (
                          <Button small kind="plain" color={IOS.redText} title="Out" onPress={() => setOutFor(s)} />
                        )}
                        {confirmRemoveId === s._id ? (
                          <Button small kind="destructive" title="Remove" busy={busyId === s._id} onPress={() => remove(s)} />
                        ) : (
                          <Button small kind="plain" color={IOS.secondary} title="Remove" onPress={() => setConfirmRemoveId(s._id)} />
                        )}
                      </View>
                    ) : null
                  }
                />
              ))}
            </Card>
          )}
        </View>

        {canEdit && !isPast && (
          <View>
            <SectionLabel>{remaining > 0 ? `Can take it (${eligible.length})` : "Others who could work it"}</SectionLabel>
            {candidates === null ? (
              <Loading />
            ) : eligible.length === 0 ? (
              <Notice
                notice={{
                  kind: "info",
                  text: `Nobody with this role${row.unitArea ? ", area" : ""}${row.requiredCertificationTags?.length ? " and certification" : ""} is free then.`,
                }}
              />
            ) : (
              <Card padded={false}>
                {eligible.map((c, i) => (
                  <PersonRow
                    key={c.staffId}
                    first={i === 0}
                    name={c.name}
                    detail={`${c.weekHours}h this week${c.overtimeIfAssigned ? ", would be overtime" : ""}`}
                    warn={c.overtimeIfAssigned}
                    action={
                      <Button
                        small
                        kind={remaining > 0 ? "filled" : "tinted"}
                        title="Assign"
                        busy={busyId === c.staffId}
                        disabled={Boolean(busyId)}
                        onPress={() => assign(c)}
                      />
                    }
                  />
                ))}
              </Card>
            )}
            {others.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Pressable onPress={() => setShowOthers((v) => !v)} style={{ paddingVertical: 6 }}>
                  <Text style={{ color: IOS.blue, fontSize: 14 }}>
                    {showOthers ? "Hide" : "Show"} {others.length} who can&apos;t
                  </Text>
                </Pressable>
                {showOthers &&
                  others.map((c) => (
                    <Text key={c.staffId} style={[kit.caption, { fontSize: 13, marginTop: 2 }]}>
                      {c.name}: {(c.reasons || []).map(ineligibleReason).join(", ")}
                    </Text>
                  ))}
              </View>
            )}
          </View>
        )}
      </View>
    </Sheet>
  );
}

function Stepper({ value, onMinus, onPlus, disabled }: { value: number; onMinus: () => void; onPlus: () => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Pressable
        style={[styles.stepBtn, (disabled || value === 0) && { opacity: 0.4 }]}
        disabled={disabled || value === 0}
        onPress={onMinus}
        accessibilityLabel="One fewer"
      >
        <Feather name="minus" size={16} color={IOS.ink} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable style={[styles.stepBtn, disabled && { opacity: 0.4 }]} disabled={disabled} onPress={onPlus} accessibilityLabel="One more">
        <Feather name="plus" size={16} color={IOS.ink} />
      </Pressable>
    </View>
  );
}

function PersonRow({
  name,
  detail,
  action,
  first,
  warn,
  color = IOS.secondary,
}: {
  name: string;
  detail: string;
  action?: React.ReactNode;
  first?: boolean;
  warn?: boolean;
  color?: string;
}) {
  return (
    <View style={[styles.person, !first && styles.personBorder]}>
      <Avatar name={name} color={color} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[kit.body, { fontWeight: "600" }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[kit.caption, warn && { color: IOS.orangeText }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  countCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: IOS.fill, alignItems: "center", justifyContent: "center" },
  stepValue: { fontSize: 22, fontWeight: "800", minWidth: 28, textAlign: "center", color: IOS.ink, fontVariant: ["tabular-nums"] },
  person: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 9 },
  personBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: IOS.hairline },
});
