export type StaffUser = {
  _id?: string;
  name?: string;
  role?: string;
  allowedAreas?: unknown[];
  allowedShiftTags?: unknown[];
  allowedShiftTypes?: unknown[];
  certificationTags?: unknown[];
};

export type ScheduleStatus = "scheduled" | "completed" | "call_out";

export type ScheduleItem = {
  _id?: string;
  staffId?: StaffUser | string | null;
  role?: string;
  unitArea?: string;
  shiftType?: string;
  shiftTag?: string;
  certificationTags?: string[];
  startTime?: string;
  endTime?: string;
  status?: ScheduleStatus;
  notes?: string;
  createdAt?: string;
  timezone?: string;
};

export type CoverageItem = {
  _id?: string;
  role?: string;
  unitArea?: string;
  shiftType?: string;
  shiftTag?: string;
  requiredCertificationTags?: string[];
  startTime?: string;
  endTime?: string;
  requiredCount?: number;
  remaining?: number;
  assignedCount?: number;
  date?: string;
  location?: string;
};

export type SwapRequestItem = {
  _id?: string;
  role?: string;
  status?:
    | "pending"
    | "pending_admin"
    | "pending_receiver"
    | "accepted"
    | "denied"
    | "admin_denied"
    | "cancelled"
    | "expired";
  shiftStartTime?: string;
  shiftEndTime?: string;
  requestNote?: string;
  responseNote?: string;
  requesterStaffId?: StaffUser;
  receiverStaffId?: StaffUser;
};

export const ROLE_COLORS: Record<string, string> = {
  admin: "#7c3aed",
  doctor: "#0ea5a4",
  nurse: "#f97316",
  rn: "#14b8a6",
  lpn: "#fb923c",
  cna: "#fdba74",
  med_aide: "#a855f7",
  caregiver: "#10b981",
  activity_aide: "#22c55e",
  dietary_aide: "#f59e0b",
  housekeeper: "#64748b",
  receptionist: "#2563eb",
  billing: "#f59e0b",
  staff: "#6b7280",
  other: "#6b7280",
  general: "#6b7280",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  doctor: "Doctor",
  nurse: "Nurse",
  rn: "RN",
  lpn: "LPN",
  cna: "CNA",
  med_aide: "Med Aide",
  caregiver: "Caregiver",
  activity_aide: "Activity Aide",
  dietary_aide: "Dietary Aide",
  housekeeper: "Housekeeper",
  receptionist: "Receptionist",
  billing: "Billing",
  staff: "Staff",
  other: "Other",
  general: "General",
};

export const STATUS_COLORS: Record<string, string> = {
  scheduled: "#f59e0b",
  completed: "#16a34a",
  call_out: "#ef4444",
};

export function getRoleDisplayName(role?: string) {
  if (!role) {
    return "Unknown";
  }

  return ROLE_LABELS[role] || `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
}

export function formatLocal(date?: string) {
  if (!date) {
    return "-";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatWindow(startTime?: string, endTime?: string) {
  return `${formatLocal(startTime)} - ${formatLocal(endTime)}`;
}

export function getScheduleDayKey(schedule: ScheduleItem) {
  const source = schedule.startTime || schedule.createdAt;
  if (!source) {
    return "Unknown date";
  }

  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function extractStaffId(schedule: ScheduleItem) {
  if (typeof schedule.staffId === "string") {
    return schedule.staffId;
  }

  return schedule.staffId?._id || "";
}

export function extractStaffName(schedule: ScheduleItem) {
  if (typeof schedule.staffId === "string") {
    return schedule.staffId;
  }

  return schedule.staffId?.name || "Unknown";
}
