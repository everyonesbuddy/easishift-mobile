const HEALTHCARE_AND_SENIOR_LIVING_ROLES = [
  "doctor",
  "nurse",
  "receptionist",
  "billing",
  "rn",
  "lpn",
  "cna",
  "med_aide",
  "caregiver",
  "activity_aide",
  "dietary_aide",
  "housekeeper",
  "al_doctor",
  "al_nurse",
  "al_receptionist",
  "al_billing",
  "al_rn",
  "al_lpn",
  "al_cna",
  "al_med_aide",
  "al_caregiver",
  "al_activity_aide",
  "al_dietary_aide",
  "al_housekeeper",
  "il_doctor",
  "il_nurse",
  "il_receptionist",
  "il_billing",
  "il_rn",
  "il_lpn",
  "il_cna",
  "il_med_aide",
  "il_caregiver",
  "il_activity_aide",
  "il_dietary_aide",
  "il_housekeeper",
] as const;

const POLICE_ROLES = [
  "police_officer",
  "police_sergeant",
  "police_detective",
  "police_patrol",
  "police_traffic",
] as const;

const WAREHOUSE_AND_LOGISTICS_ROLES = [
  "warehouse_staff",
  "forklift_operator",
  "warehouse_supervisor",
  "delivery_driver",
  "inventory_manager",
  "packer",
  "loader",
] as const;

const SECURITY_SERVICE_ROLES = [
  "security_guard",
  "security_supervisor",
  "patrol_officer",
  "control_room_operator",
] as const;

const RETAIL_ROLES = [
  "cashier",
  "sales_associate",
  "stock_associate",
  "retail_supervisor",
  "retail_manager",
  "customer_service",
] as const;

const HOSPITALITY_ROLES = [
  "front_desk",
  "front_desk_manager",
  "housekeeping_staff",
  "housekeeping_supervisor",
  "chef",
  "cook",
  "server",
  "bartender",
  "host",
  "hospitality_manager",
] as const;

const MANUFACTURING_ROLES = [
  "assembly_line",
  "machine_operator",
  "manufacturing_supervisor",
  "quality_control",
  "technician",
  "manufacturing_manager",
] as const;

const EDUCATION_ROLES = [
  "teacher",
  "teacher_aide",
  "counselor",
  "librarian",
  "custodian",
] as const;

const TRANSPORTATION_ROLES = [
  "driver",
  "bus_driver",
  "truck_driver",
  "dispatcher",
  "transportation_supervisor",
] as const;

const FINANCE_ROLES = [
  "accountant",
  "analyst",
  "finance_manager",
  "clerk",
  "advisor",
] as const;

export const COMMON_STAFF_ROLES = ["staff", "other"] as const;
export const ADMIN_ROLES = ["admin", "superadmin"] as const;
export const SYSTEM_ROLE_OPTIONS = [
  "user",
  ...COMMON_STAFF_ROLES,
  ...ADMIN_ROLES,
] as const;

export const INDUSTRY_ROLE_MAP: Record<string, readonly string[]> = {
  Healthcare: HEALTHCARE_AND_SENIOR_LIVING_ROLES,
  "Senior Living": HEALTHCARE_AND_SENIOR_LIVING_ROLES,
  Retail: RETAIL_ROLES,
  Hospitality: HOSPITALITY_ROLES,
  Manufacturing: MANUFACTURING_ROLES,
  Education: EDUCATION_ROLES,
  Transportation: TRANSPORTATION_ROLES,
  Finance: FINANCE_ROLES,
  Police: POLICE_ROLES,
  "Warehouse and Logistics": WAREHOUSE_AND_LOGISTICS_ROLES,
  "Security Service": SECURITY_SERVICE_ROLES,
  Other: COMMON_STAFF_ROLES,
};

const normalizeIndustryKey = (industry: unknown) =>
  String(industry || "")
    .trim()
    .toLowerCase()
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ");

const INDUSTRY_ALIASES: Record<string, string> = {
  healthcare: "Healthcare",
  "health care": "Healthcare",
  "senior living": "Senior Living",
  "healthcare and senior living": "Healthcare",
  "assisted living": "Senior Living",
  "independent living": "Senior Living",
  retail: "Retail",
  hospitality: "Hospitality",
  manufacturing: "Manufacturing",
  education: "Education",
  transportation: "Transportation",
  finance: "Finance",
  police: "Police",
  "warehouse and logistics": "Warehouse and Logistics",
  "security service": "Security Service",
  other: "Other",
};

const toRoleLabel = (role: unknown) =>
  String(role || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const normalizeRoleKey = (role: unknown) =>
  String(role || "")
    .trim()
    .toLowerCase();

export const getRoleFamilyKey = (role: unknown) => {
  const normalizedRole = normalizeRoleKey(role);
  if (!normalizedRole) {
    return "";
  }

  if (
    normalizedRole.startsWith("al_") ||
    normalizedRole.startsWith("il_") ||
    normalizedRole.startsWith("mc_")
  ) {
    return normalizedRole.slice(3);
  }

  return normalizedRole;
};

export const isRoleCompatible = (staffRole: unknown, coverageRole: unknown) => {
  const staffFamily = getRoleFamilyKey(staffRole);
  const coverageFamily = getRoleFamilyKey(coverageRole);

  if (!staffFamily || !coverageFamily) {
    return false;
  }

  return staffFamily === coverageFamily;
};

export const ROLE_LABEL_MAP: Record<string, string> = {
  admin: "Admin",
  superadmin: "Super Admin",
  doctor: "Doctor",
  nurse: "Nurse",
  receptionist: "Receptionist",
  billing: "Billing",
  rn: "RN",
  lpn: "LPN",
  cna: "CNA",
  med_aide: "Med Aide",
  caregiver: "Caregiver",
  activity_aide: "Activity Aide",
  dietary_aide: "Dietary Aide",
  housekeeper: "Housekeeper",
  al_doctor: "AL Doctor",
  al_nurse: "AL Nurse",
  al_receptionist: "AL Receptionist",
  al_billing: "AL Billing",
  al_rn: "AL RN",
  al_lpn: "AL LPN",
  al_cna: "AL CNA",
  al_med_aide: "AL Med Aide",
  al_caregiver: "AL Caregiver",
  al_activity_aide: "AL Activity Aide",
  al_dietary_aide: "AL Dietary Aide",
  al_housekeeper: "AL Housekeeper",
  il_doctor: "IL Doctor",
  il_nurse: "IL Nurse",
  il_receptionist: "IL Receptionist",
  il_billing: "IL Billing",
  il_rn: "IL RN",
  il_lpn: "IL LPN",
  il_cna: "IL CNA",
  il_med_aide: "IL Med Aide",
  il_caregiver: "IL Caregiver",
  il_activity_aide: "IL Activity Aide",
  il_dietary_aide: "IL Dietary Aide",
  il_housekeeper: "IL Housekeeper",
  police_officer: "Police Officer",
  police_sergeant: "Police Sergeant",
  police_detective: "Police Detective",
  police_patrol: "Police Patrol",
  police_traffic: "Police Traffic",
  warehouse_staff: "Warehouse Staff",
  forklift_operator: "Forklift Operator",
  warehouse_supervisor: "Warehouse Supervisor",
  delivery_driver: "Delivery Driver",
  inventory_manager: "Inventory Manager",
  packer: "Packer",
  loader: "Loader",
  security_guard: "Security Guard",
  security_supervisor: "Security Supervisor",
  patrol_officer: "Patrol Officer",
  control_room_operator: "Control Room Operator",
  cashier: "Cashier",
  sales_associate: "Sales Associate",
  stock_associate: "Stock Associate",
  retail_supervisor: "Retail Supervisor",
  retail_manager: "Retail Manager",
  customer_service: "Customer Service",
  front_desk: "Front Desk",
  front_desk_manager: "Front Desk Manager",
  housekeeping_staff: "Housekeeping Staff",
  housekeeping_supervisor: "Housekeeping Supervisor",
  chef: "Chef",
  cook: "Cook",
  server: "Server",
  bartender: "Bartender",
  host: "Host",
  hospitality_manager: "Hospitality Manager",
  assembly_line: "Assembly Line",
  machine_operator: "Machine Operator",
  manufacturing_supervisor: "Manufacturing Supervisor",
  quality_control: "Quality Control",
  technician: "Technician",
  manufacturing_manager: "Manufacturing Manager",
  teacher: "Teacher",
  teacher_aide: "Teacher Aide",
  counselor: "Counselor",
  librarian: "Librarian",
  custodian: "Custodian",
  driver: "Driver",
  bus_driver: "Bus Driver",
  truck_driver: "Truck Driver",
  dispatcher: "Dispatcher",
  transportation_supervisor: "Transportation Supervisor",
  accountant: "Accountant",
  analyst: "Analyst",
  finance_manager: "Finance Manager",
  clerk: "Clerk",
  advisor: "Advisor",
  staff: "Staff",
  other: "Other",
};

const ROLE_COLOR_MAP: Record<string, string> = {
  admin: "#7c3aed",
  superadmin: "#5b21b6",
  doctor: "#0ea5a4",
  nurse: "#f97316",
  receptionist: "#2563eb",
  billing: "#f59e0b",
  rn: "#14b8a6",
  lpn: "#fb923c",
  cna: "#fdba74",
  med_aide: "#a855f7",
  caregiver: "#10b981",
  activity_aide: "#22c55e",
  dietary_aide: "#f59e0b",
  housekeeper: "#64748b",
  staff: "#6b7280",
  other: "#64748b",
};

export const ALL_NON_ADMIN_ROLES = Array.from(
  new Set([
    ...HEALTHCARE_AND_SENIOR_LIVING_ROLES,
    ...POLICE_ROLES,
    ...WAREHOUSE_AND_LOGISTICS_ROLES,
    ...SECURITY_SERVICE_ROLES,
    ...RETAIL_ROLES,
    ...HOSPITALITY_ROLES,
    ...MANUFACTURING_ROLES,
    ...EDUCATION_ROLES,
    ...TRANSPORTATION_ROLES,
    ...FINANCE_ROLES,
    ...COMMON_STAFF_ROLES,
  ]),
);

export const ALL_USER_ROLES = [...ADMIN_ROLES, ...ALL_NON_ADMIN_ROLES];

export const getRoleDisplayName = (role: unknown) => {
  if (!role) {
    return "Unknown";
  }

  const key = String(role);
  return ROLE_LABEL_MAP[key] || toRoleLabel(role);
};

export const getRoleColor = (role: unknown) => {
  const key = String(role || "");
  return ROLE_COLOR_MAP[key] || "#6b7280";
};

export const getRolesForIndustry = (
  industry: unknown,
  options: { includeCommon?: boolean; includeAdmin?: boolean } = {},
) => {
  const { includeCommon = true, includeAdmin = false } = options;

  const normalizedIndustry = normalizeIndustryKey(industry);
  const resolvedIndustry =
    INDUSTRY_ALIASES[normalizedIndustry] || String(industry || "") || "";

  const industryRoles =
    INDUSTRY_ROLE_MAP[resolvedIndustry] || ALL_NON_ADMIN_ROLES;
  const result = [...industryRoles];

  if (includeCommon) {
    result.push(...COMMON_STAFF_ROLES);
  }

  if (includeAdmin) {
    result.unshift(...ADMIN_ROLES);
  }

  return Array.from(new Set(result));
};

export const getRoleOptionsForIndustry = (
  industry: unknown,
  options?: { includeCommon?: boolean; includeAdmin?: boolean },
) =>
  getRolesForIndustry(industry, options).map((role) => ({
    value: role,
    label: getRoleDisplayName(role),
  }));

export const getRoleOptionsFromFacilityPreferences = (
  facilityPreferences: { roleFamilies?: unknown[] } | null | undefined,
  options: { includeSystem?: boolean; includeAdmin?: boolean } = {},
) => {
  const { includeSystem = false, includeAdmin = false } = options;

  const facilityRoles = Array.from(
    new Set(
      (facilityPreferences?.roleFamilies || [])
        .map((role) => normalizeRoleKey(role))
        .filter(Boolean),
    ),
  );

  const roles = [...facilityRoles];

  if (includeSystem) {
    roles.push("user", ...COMMON_STAFF_ROLES);
  }

  if (includeAdmin) {
    roles.push(...ADMIN_ROLES);
  }

  return Array.from(new Set(roles)).map((role) => ({
    value: role,
    label: getRoleDisplayName(role),
  }));
};
