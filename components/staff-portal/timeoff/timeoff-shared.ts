import { getInitials } from "@/components/staff-portal/staff/staff-shared";

export type TimeOffStatus = "pending" | "approved" | "denied";

export type TimeOffRequest = {
  _id?: string;
  status?: TimeOffStatus | string;
  startTime?: string;
  endTime?: string;
  startDate?: string;
  endDate?: string;
  start?: string;
  end?: string;
  reason?: string;
  reviewNotes?: string;
  requestedAt?: string;
  reviewedAt?: string;
  reviewedBy?: unknown;
  createdAt?: string;
  staffName?: string;
  staffId?:
    | string
    | {
        _id?: string;
        id?: string;
        name?: string;
      };
};

export function normalizeTimeOffPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload as TimeOffRequest[];
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    Array.isArray((payload as { data?: unknown[] }).data)
  ) {
    return (payload as { data: TimeOffRequest[] }).data;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    Array.isArray((payload as { timeOff?: unknown[] }).timeOff)
  ) {
    return (payload as { timeOff: TimeOffRequest[] }).timeOff;
  }

  return [] as TimeOffRequest[];
}

export function getRequestId(request: TimeOffRequest) {
  return request._id || "";
}

export function getStaffName(request: TimeOffRequest) {
  if (typeof request.staffId === "string") {
    return request.staffName || "Unknown Staff";
  }

  return request.staffId?.name || request.staffName || "Unknown Staff";
}

export function getStaffUserId(request: TimeOffRequest) {
  if (typeof request.staffId === "string") {
    return request.staffId;
  }

  return request.staffId?._id || request.staffId?.id || "";
}

export function getStartValue(request: TimeOffRequest) {
  return request.startTime || request.startDate || request.start || "";
}

export function getEndValue(request: TimeOffRequest) {
  return request.endTime || request.endDate || request.end || "";
}

export function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString();
}

export function formatDateTime(value?: string) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleString();
}

export function calculateDaysInclusive(start?: string, end?: string) {
  try {
    if (!start || !end) {
      return 1;
    }

    const s = new Date(start);
    const e = new Date(end);

    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return 1;
    }

    const startFloor = new Date(s);
    startFloor.setHours(0, 0, 0, 0);
    const endFloor = new Date(e);
    endFloor.setHours(0, 0, 0, 0);

    const msPerDay = 24 * 60 * 60 * 1000;
    const diff =
      Math.round((endFloor.getTime() - startFloor.getTime()) / msPerDay) + 1;
    return diff > 0 ? diff : 1;
  } catch {
    return 1;
  }
}

export function getStatusStyle(status?: string) {
  switch (status) {
    case "pending":
      return { bg: "#fffbeb", color: "#92400e", border: "#fcd34d" };
    case "approved":
      return { bg: "#ecfdf5", color: "#065f46", border: "#86efac" };
    case "denied":
      return { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5" };
    default:
      return { bg: "#f3f4f6", color: "#111827", border: "#d1d5db" };
  }
}

export function getStatusIconName(status?: string) {
  if (status === "approved") {
    return "check" as const;
  }

  if (status === "denied") {
    return "x" as const;
  }

  return "alert-circle" as const;
}

export function getAvatarLabel(request: TimeOffRequest) {
  return getInitials(getStaffName(request));
}
