export type StaffMember = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  profilePicture?: string;
  userPhone?: string;
  userPhoneCountryCode?: string;
  phone?: string;
  phoneCountryCode?: string;
  allowedAreas?: unknown[];
  allowedShiftTags?: unknown[];
  allowedShiftTypes?: unknown[];
  certificationTags?: unknown[];
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
  scheduler: "#0f766e",
  owner: "#5b21b6",
  general: "#6b7280",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  scheduler: "Scheduler",
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
  owner: "Owner",
  general: "General",
};

export const STAFF_ROLES = [
  "all",
  "admin",
  "doctor",
  "nurse",
  "rn",
  "lpn",
  "cna",
  "med_aide",
  "caregiver",
  "activity_aide",
  "dietary_aide",
  "housekeeper",
  "receptionist",
  "billing",
  "staff",
  "general",
] as const;

export const CREATE_ROLES = [
  "doctor",
  "nurse",
  "rn",
  "lpn",
  "cna",
  "med_aide",
  "caregiver",
  "activity_aide",
  "dietary_aide",
  "housekeeper",
  "receptionist",
  "billing",
  "staff",
] as const;

export const PHONE_COUNTRY_CODES = [
  { code: "+1", label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+353", label: "Ireland (+353)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+64", label: "New Zealand (+64)" },
  { code: "+27", label: "South Africa (+27)" },
  { code: "+91", label: "India (+91)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
] as const;

export const SAMPLE_CSV =
  "name,email,role,userPhone,userPhoneCountryCode,profilePicture,allowedAreas,allowedShiftTypes,certificationTags\nA,a@x.com,nurse,5551112222,+1,https://example.com/a.jpg,AL|IL,day|evening,med-pass|bilingual\nB,b@x.com,doctor,5553334444,+1,,IL,day,rn";

export const MAX_ROWS = 500;

export function getRoleDisplayName(role?: string) {
  if (!role) {
    return "Unknown";
  }

  return ROLE_LABELS[role] || role;
}

export function getUserRoles(staff: StaffMember) {
  if (Array.isArray(staff.roles) && staff.roles.length) {
    return Array.from(new Set(staff.roles.filter(Boolean)));
  }

  return staff.role ? [staff.role] : [];
}

export function getStaffId(staff: StaffMember) {
  return staff._id || staff.id || "";
}

export function getInitials(name?: string) {
  if (!name) {
    return "SU";
  }

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getPhoneText(staff: StaffMember) {
  const countryCode =
    staff.userPhoneCountryCode || staff.phoneCountryCode || "";
  const phone = staff.userPhone || staff.phone || "";

  if (!phone) {
    return "No phone";
  }

  return `${countryCode}${phone}`;
}

export function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    created: "Created",
    skipped_duplicate: "Skipped Duplicate",
    failed_validation: "Failed Validation",
    failed: "Failed",
  };

  return labels[status || ""] || status || "-";
}
