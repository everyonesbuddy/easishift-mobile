export const SYSTEM_ROLE_OPTIONS = [
  "staff",
  "scheduler",
  "admin",
  "owner",
] as const;
export const COMMON_STAFF_ROLES = ["staff"] as const;
export const ADMIN_ROLES = ["admin", "owner"] as const;
export const FACILITY_BASELINE_ROLE = "staff";

const toDisplayLabel = (value: unknown): string =>
  String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      const normalized = part.toLowerCase();
      if (/^\d+[ap]m?$/.test(normalized)) return normalized;
      if (normalized.length <= 2 && /^[a-z]+$/.test(normalized)) {
        return normalized.toUpperCase();
      }
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(" ");

const normalizeRoleKey = (role: unknown): string =>
  String(role || "")
    .trim()
    .toLowerCase();

const hashToHue = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
};

const fallbackRoleColorCache = new Map<string, string>();

const getFallbackRoleColor = (role: string): string => {
  if (fallbackRoleColorCache.has(role)) {
    return fallbackRoleColorCache.get(role) as string;
  }

  const hue = hashToHue(role);
  const color = `hsl(${hue} 65% 45%)`;
  fallbackRoleColorCache.set(role, color);
  return color;
};

const getTaxonomyDisplayName = (
  value: unknown,
  emptyFallback = "-",
): string => {
  const normalized = normalizeRoleKey(value);
  if (!normalized) return emptyFallback;
  return toDisplayLabel(normalized);
};

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
  scheduler: "Scheduler",
  admin: "Admin",
  staff: "Staff",
  owner: "Owner",
};

const ROLE_COLOR_MAP: Record<string, string> = {
  staff: "#6b7280",
  scheduler: "#0f766e",
  admin: "#7c3aed",
  owner: "#5b21b6",
};

const FALLBACK_SYSTEM_ROLE_PERMISSIONS: Record<string, string[]> = {
  staff: [
    "schedule.view_own",
    "schedule.pick_up",
    "timeoff.request",
    "shift_swap.use",
    "messages.use",
    "preferences.manage_own",
  ],
  scheduler: [
    "schedule.view",
    "schedule.manage",
    "coverage.view",
    "coverage.manage",
    "staff.view",
    "facility_preferences.view",
  ],
  admin: [
    "schedule.view",
    "schedule.manage",
    "coverage.view",
    "coverage.manage",
    "staff.view",
    "staff.manage",
    "staff.reset_password",
    "timeoff.review",
    "messages.manage",
    "facility_preferences.manage",
  ],
  owner: [
    "schedule.view",
    "schedule.manage",
    "coverage.view",
    "coverage.manage",
    "staff.view",
    "staff.manage",
    "staff.reset_password",
    "timeoff.review",
    "messages.manage",
    "facility_preferences.manage",
    "billing.view",
    "billing.manage",
    "tenant.settings",
    "tenant.delete",
    "roles.manage",
  ],
};

export const normalizeRole = (role: unknown): string => {
  const value = normalizeRoleKey(role);
  if (value === "user" || value === "other") return "staff";
  if (value === "superadmin") return "owner";
  return value;
};

export const getUserRoles = (
  user: { roles?: unknown; role?: unknown } | null | undefined,
) => {
  if (Array.isArray(user?.roles) && user.roles.length) {
    return Array.from(new Set(user.roles.map(normalizeRole).filter(Boolean)));
  }

  const legacyRole = normalizeRole(user?.role);
  return legacyRole ? [legacyRole] : [];
};

export const isSystemRole = (role: unknown) =>
  SYSTEM_ROLE_OPTIONS.includes(
    normalizeRole(role) as (typeof SYSTEM_ROLE_OPTIONS)[number],
  );

export const getSystemRolesFromUser = (
  user: { roles?: unknown; role?: unknown } | null | undefined,
) => getUserRoles(user).filter(isSystemRole);

export const getFacilityRolesFromUser = (
  user: { roles?: unknown; role?: unknown } | null | undefined,
  facilityPreferences: { roleFamilies?: unknown[] } | null | undefined,
) => {
  const userRoles = getUserRoles(user);
  const configuredRoles = new Set(
    (facilityPreferences?.roleFamilies || [])
      .map(normalizeRoleKey)
      .filter(Boolean),
  );

  return configuredRoles.size
    ? userRoles.filter((role) => configuredRoles.has(role))
    : userRoles.filter((role) => !isSystemRole(role));
};

export const getEffectivePermissions = (
  user:
    | {
        roles?: unknown;
        role?: unknown;
        permissions?: unknown;
      }
    | null
    | undefined,
) => {
  const backendPermissions = Array.isArray(user?.permissions)
    ? user.permissions
        .map((permission) => String(permission || "").trim())
        .filter(Boolean)
    : [];
  const systemRoles = getSystemRolesFromUser(user);
  const impliedRoles = systemRoles.length
    ? systemRoles
    : [FACILITY_BASELINE_ROLE];

  return Array.from(
    new Set([
      ...backendPermissions,
      ...impliedRoles.flatMap(
        (role) => FALLBACK_SYSTEM_ROLE_PERMISSIONS[role] || [],
      ),
    ]),
  );
};

export const ALL_NON_ADMIN_ROLES = [...COMMON_STAFF_ROLES];

export const ALL_USER_ROLES = [...ADMIN_ROLES, ...ALL_NON_ADMIN_ROLES];

export const getRoleDisplayName = (role: unknown): string => {
  const normalizedRole = normalizeRoleKey(role);
  if (!normalizedRole) return "Unknown";
  return ROLE_LABEL_MAP[normalizedRole] || toDisplayLabel(normalizedRole);
};

export const getRoleColor = (role: unknown): string => {
  const normalizedRole = normalizeRoleKey(role);
  if (!normalizedRole) return "#6b7280";
  return ROLE_COLOR_MAP[normalizedRole] || getFallbackRoleColor(normalizedRole);
};

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
    roles.push(...COMMON_STAFF_ROLES);
  }

  if (includeAdmin) {
    roles.push(...ADMIN_ROLES);
  }

  return Array.from(new Set(roles)).map((role) => ({
    value: role,
    label: getRoleDisplayName(role),
  }));
};

export const getUnitAreaDisplayName = (unitArea: unknown): string =>
  getTaxonomyDisplayName(unitArea, "-");

export const getShiftTypeDisplayName = (shiftType: unknown): string =>
  getTaxonomyDisplayName(shiftType, "-");

export const getShiftTagDisplayName = (shiftTag: unknown): string =>
  getTaxonomyDisplayName(shiftTag, "-");

export const getCertificationTagDisplayName = (
  certificationTag: unknown,
): string => getTaxonomyDisplayName(certificationTag, "-");

const DEFAULT_INDUSTRY_ROLES = [...COMMON_STAFF_ROLES] as const;

export const HEALTHCARE_AND_SENIOR_LIVING_ROLES = [
  "rn",
  "lpn",
  "cna",
  "caregiver",
  "med_tech",
  "charge_nurse",
  "unit_clerk",
  ...DEFAULT_INDUSTRY_ROLES,
] as const;

const RETAIL_ROLES = [
  "cashier",
  "sales_associate",
  "stock_associate",
  "shift_lead",
  ...DEFAULT_INDUSTRY_ROLES,
] as const;

const HOSPITALITY_ROLES = [
  "front_desk",
  "housekeeping",
  "server",
  "bartender",
  "shift_lead",
  ...DEFAULT_INDUSTRY_ROLES,
] as const;

const SECURITY_ROLES = [
  "guard",
  "patrol",
  "supervisor",
  ...DEFAULT_INDUSTRY_ROLES,
] as const;

const WAREHOUSE_AND_LOGISTICS_ROLES = [
  "picker",
  "packer",
  "forklift_operator",
  "dispatcher",
  ...DEFAULT_INDUSTRY_ROLES,
] as const;

const INDUSTRY_ROLE_CATALOG: Record<string, readonly string[]> = {
  healthcare: HEALTHCARE_AND_SENIOR_LIVING_ROLES,
  senior_living: HEALTHCARE_AND_SENIOR_LIVING_ROLES,
  retail: RETAIL_ROLES,
  hospitality: HOSPITALITY_ROLES,
  security_service: SECURITY_ROLES,
  security_services: SECURITY_ROLES,
  police: SECURITY_ROLES,
  warehouse_and_logistics: WAREHOUSE_AND_LOGISTICS_ROLES,
  warehousing_and_logistics: WAREHOUSE_AND_LOGISTICS_ROLES,
  transportation: WAREHOUSE_AND_LOGISTICS_ROLES,
};

export const INDUSTRY_ROLE_OPTIONS = INDUSTRY_ROLE_CATALOG;

const normalizeIndustryKey = (industry: unknown): string =>
  String(industry || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+|_+$/g, "");

export const getRolesForIndustry = (
  industry: unknown,
  options: { includeSystem?: boolean; includeAdmin?: boolean } = {},
) => {
  const { includeSystem = false, includeAdmin = false } = options;
  const key = normalizeIndustryKey(industry);

  const industryRoles = key
    ? INDUSTRY_ROLE_CATALOG[key] || DEFAULT_INDUSTRY_ROLES
    : DEFAULT_INDUSTRY_ROLES;

  const roles = [...industryRoles];

  if (includeSystem) {
    roles.push(...COMMON_STAFF_ROLES);
  }

  if (includeAdmin) {
    roles.push(...ADMIN_ROLES);
  }

  return Array.from(new Set(roles));
};

export const getRoleOptionsForIndustry = (
  industry: unknown,
  options: { includeSystem?: boolean; includeAdmin?: boolean } = {},
) =>
  getRolesForIndustry(industry, options).map((role) => ({
    value: role,
    label: getRoleDisplayName(role),
  }));
