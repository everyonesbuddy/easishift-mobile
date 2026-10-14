import { toLabel } from "@/constants/ios";

// Shapes from GET /weeks/:weekStart (only the fields the app uses).
export type CoverageRow = {
  _id: string;
  dateKey: string;
  role: string;
  unitArea?: string | null;
  shiftType?: string | null;
  shiftTag?: string | null;
  startTime: string;
  endTime: string;
  requiredCount: number;
  assignedCount: number;
  remaining: number;
  overridden?: boolean;
  requiredCertificationTags?: string[];
};

export type WeekSchedule = {
  _id: string;
  coverageId?: string | null;
  staffId?: { _id: string; name?: string } | string | null;
  role?: string;
  unitArea?: string | null;
  startTime: string;
  endTime: string;
  status: string;
  state?: string;
};

export type WeekData = {
  week: { status: string; publishedAt?: string; lastPublish?: { sms?: number; email?: number; notReached?: unknown[] } };
  timezone?: string;
  days: string[];
  coverage: CoverageRow[];
  schedules: WeekSchedule[];
  counts: {
    openSlots?: number;
    shifts?: number;
    callOuts?: number;
    unpublishedChanges?: number;
    pendingPeople?: number;
    notSentSections?: { role: string | null; unitArea: string | null; shifts: number; people: number }[];
  };
};

export type Candidate = {
  staffId: string;
  name: string;
  eligible: boolean;
  reasons?: string[];
  weekHours?: number;
  overtimeIfAssigned?: boolean;
  hasPhone?: boolean;
};

type Prefs = { shiftTypeDefinitions?: { key: string; label?: string; timeSlots?: { tag: string; startLocalTime?: string; endLocalTime?: string }[] }[] } | null;

const compactTime = (hhmm: string) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  const suffix = h >= 12 ? "p" : "a";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
};

const clockFromDate = (value?: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "Day" + "7a–3p" for a slot, from Facility Preferences (same as the web grid). */
export function slotLabel(prefs: unknown, row: Pick<CoverageRow, "shiftType" | "shiftTag" | "startTime" | "endTime">) {
  const p = prefs as Prefs;
  const def = row.shiftType ? (p?.shiftTypeDefinitions || []).find((d) => d.key === row.shiftType) : null;
  const slot = (def?.timeSlots || []).find((s) => s.tag === row.shiftTag);
  const name = def?.label || toLabel(row.shiftType) || "Shift";
  const start = slot?.startLocalTime || clockFromDate(row.startTime);
  const end = slot?.endLocalTime || clockFromDate(row.endTime);
  return { name, time: start && end ? `${compactTime(start)}–${compactTime(end)}` : "", start: start || "" };
}

const INELIGIBLE: Record<string, string> = {
  role: "different role",
  area: "not set up for this area",
  shift_type: "doesn't work this shift",
  certification: "missing certification",
  already_assigned: "already on this shift",
  called_out: "called out of this shift",
  conflict: "working another shift then",
  time_off: "on time off",
};
export const ineligibleReason = (code: string) => INELIGIBLE[code] || String(code || "").replace(/_/g, " ");

const NOT_SENT: Record<string, string> = {
  no_contact: "no phone or email on file",
  opted_out: "replied STOP to texts",
  sms_needs_upgrade: "phone only; texting is on paid plans",
  sms_needs_pro: "phone only; texting is on paid plans",
  awaiting_opt_in: "hasn't replied START yet",
  notifications_off: "turned notifications off",
  send_failed: "the message failed to send",
};
export const notSentReason = (code: string) => NOT_SENT[code] || "couldn't be reached";

export const staffName = (s: WeekSchedule) => (typeof s.staffId === "object" && s.staffId ? s.staffId.name : undefined) || "Someone";

// --- Sections: some roles and/or unit areas (Publish / Auto-fill a section) ---

export type SectionValue = { mode: "all" | "section"; roles: string[]; areas: string[] };
export const emptySection: SectionValue = { mode: "all", roles: [], areas: [] };

const tagKey = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");

export type SectionOption = { key: string; label: string };

/** Roles and areas that appear in this week. */
export function sectionOptions(data: WeekData | null, roleLabel: (role: string) => string) {
  const roles = new Map<string, string>();
  const areas = new Map<string, string>();
  for (const item of [...(data?.coverage || []), ...(data?.schedules || [])]) {
    if (item.role) roles.set(tagKey(item.role), item.role);
    if (item.unitArea) areas.set(tagKey(item.unitArea), item.unitArea);
  }
  const sorted = (m: Map<string, string>) => [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return {
    roles: sorted(roles).map(([key, raw]) => ({ key, label: roleLabel(raw) })),
    areas: sorted(areas).map(([key, raw]) => ({ key, label: toLabel(raw) })),
  };
}

export const inSection = (item: { role?: string | null; unitArea?: string | null }, value: SectionValue) => {
  if (value.mode !== "section") return true;
  if (value.roles.length && !value.roles.includes(tagKey(item.role))) return false;
  if (value.areas.length && !value.areas.includes(tagKey(item.unitArea))) return false;
  return true;
};

export const sectionBody = (value: SectionValue) =>
  value.mode === "section" ? { roles: value.roles, areas: value.areas } : {};

export const sectionChosen = (value: SectionValue) =>
  value.mode !== "section" || value.roles.length > 0 || value.areas.length > 0;

export function sectionLabel(value: SectionValue, options: { roles: SectionOption[]; areas: SectionOption[] }) {
  if (value.mode !== "section") return "Everything";
  const name = (list: SectionOption[], key: string) => list.find((o) => o.key === key)?.label || toLabel(key);
  return (
    [value.roles.map((k) => name(options.roles, k)).join(", "), value.areas.map((k) => name(options.areas, k)).join(", ")]
      .filter(Boolean)
      .join(" · ") || "Everything"
  );
}
