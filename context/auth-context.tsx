import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import api from "@/config/api";
import { getEffectivePermissions, getUserRoles, normalizeRole } from "@/constants/industry-roles";
import { cancelAllUserNotifications } from "@/services/notifications/notification-service";

/**
 * Scheduler / owner session. Staff don't sign in (they use their personal
 * link, see staff-link-context). Mirrors the web app: POST /auth/login,
 * then GET /auth/me (plan, limits, usage) + GET /tenants/me.
 */

const USER_KEY = "user";
const ROLE_KEY = "role";
const TOKEN_KEY = "token";

type AuthUser = {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  tenantId?: string;
  [key: string]: unknown;
};

type Tenant = {
  _id?: string;
  name?: string;
  subscriptionStatus?: string;
  [key: string]: unknown;
};

export type Plan = {
  key?: string;
  label?: string;
  limits?: { staff?: number | null; schedulers?: number | null };
  features?: string[];
};

export type Usage = {
  staff?: number;
  schedulers?: number;
  overLimit?: boolean;
  [key: string]: unknown;
};

type Session = {
  plan: Plan | null;
  paidPlan: string;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  usage: Usage | null;
  readOnlyReason: string | null;
};

type FacilityPreferencesState = Record<string, unknown>;

type LoginData = { token?: string; accessToken?: string; user?: AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  role: string;
  roles: string[];
  permissions: string[];
  tenant: Tenant | null;
  session: Session | null;
  plan: Plan | null;
  usage: Usage | null;
  hasFeature: (feature: string) => boolean;
  refreshSession: () => Promise<unknown>;
  // Kept for older screens; white-label branding is web-only.
  publicBranding: Record<string, unknown> | null;
  facilityPreferences: FacilityPreferencesState | null;
  fetchFacilityPreferences: () => Promise<FacilityPreferencesState>;
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  hasRole: (targetRole: string) => boolean;
  can: (permission: string) => boolean;
  login: (data: LoginData) => Promise<void>;
  logout: () => Promise<void>;
  refreshTenant: () => Promise<Tenant | null>;
  updateCurrentUser: (patch: Partial<AuthUser>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

// Backend permissions win; the role fallback (incl. viewer) is only for
// sessions saved before the backend sent them.
const SCHEDULER_PERMISSIONS = [
  "schedule.view",
  "schedule.manage",
  "coverage.view",
  "coverage.manage",
  "staff.view",
  "staff.manage",
  "staff.reset_password",
  "timeoff.review",
  "messages.manage",
  "messages.use",
  "facility_preferences.view",
  "facility_preferences.manage",
];
const FALLBACK: Record<string, string[]> = {
  scheduler: SCHEDULER_PERMISSIONS,
  admin: SCHEDULER_PERMISSIONS,
  // Admin: owner powers except deleting the facility / transferring ownership.
  administrator: [...SCHEDULER_PERMISSIONS, "billing.view", "billing.manage", "tenant.settings", "roles.manage"],
  viewer: ["schedule.view", "coverage.view", "staff.view", "facility_preferences.view"],
  owner: [...SCHEDULER_PERMISSIONS, "billing.view", "billing.manage", "tenant.settings", "tenant.delete", "roles.manage", "ownership.transfer"],
};

function permissionsFor(user: AuthUser | null) {
  if (!user) return [];
  const backend = Array.isArray(user.permissions) ? user.permissions.map(String).filter(Boolean) : [];
  if (backend.length) return Array.from(new Set(backend));
  const roles = getUserRoles(user);
  const fromRoles = roles.flatMap((r) => FALLBACK[r] || []);
  return fromRoles.length ? Array.from(new Set(fromRoles)) : getEffectivePermissions(user);
}

function normalizeUser(user: AuthUser | null): AuthUser | null {
  if (!user) return null;
  const roles = getUserRoles(user);
  return { ...user, roles, role: normalizeRole(user.role || roles[0] || "scheduler") };
}

function parseJwtExp(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(globalThis.atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

const tokenExpired = (token: string | null | undefined) => {
  if (!token) return true;
  const exp = parseJwtExp(token);
  return exp ? exp * 1000 < Date.now() : false;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [facilityPreferences, setFacilityPreferences] = useState<FacilityPreferencesState | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(async () => {
    setUser(null);
    setTenant(null);
    setSession(null);
    setFacilityPreferences(null);
    delete api.defaults.headers.common.Authorization;
    await AsyncStorage.multiRemove([USER_KEY, ROLE_KEY, TOKEN_KEY]);
  }, []);

  const fetchFacilityPreferences = useCallback(async () => {
    try {
      const res = await api.get("/facility-preferences");
      const next = (res.data || {}) as FacilityPreferencesState;
      setFacilityPreferences(next);
      return next;
    } catch {
      setFacilityPreferences({});
      return {};
    }
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const [meRes, tenantRes] = await Promise.all([api.get("/auth/me"), api.get("/tenants/me")]);
      const me = meRes.data || {};
      setSession({
        plan: me.plan || null,
        paidPlan: me.paidPlan || "free",
        subscriptionStatus: me.subscriptionStatus || null,
        trialEndsAt: me.trialEndsAt || null,
        usage: me.usage || null,
        readOnlyReason: me.readOnlyReason || null,
      });
      setTenant(tenantRes.data?.tenant || null);
      if (me.user) {
        const next = normalizeUser(me.user);
        setUser(next);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(next));
      }
      void fetchFacilityPreferences();
      return me;
    } catch (err) {
      // e.g. an old staff login from before staff moved to personal links.
      if ((err as { response?: { status?: number } })?.response?.status === 401) await clear();
      return null;
    }
  }, [clear, fetchFacilityPreferences]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const entries = new Map(await AsyncStorage.multiGet([USER_KEY, TOKEN_KEY]));
        const token = entries.get(TOKEN_KEY);
        const savedUser = entries.get(USER_KEY);
        if (!token || tokenExpired(token) || !savedUser) {
          if (token || savedUser) await clear();
          return;
        }
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        const parsed = normalizeUser(JSON.parse(savedUser) as AuthUser);
        if (mounted) setUser(parsed);
        await loadSession();
      } catch (error) {
        console.warn("Failed to restore session", error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clear, loadSession]);

  // Signed out elsewhere or token expired: back to the welcome screen.
  useEffect(() => {
    const id = api.interceptors.response.use(
      (res) => res,
      async (error) => {
        if (error?.response?.status === 401 && api.defaults.headers.common.Authorization) {
          const token = await AsyncStorage.getItem(TOKEN_KEY);
          if (tokenExpired(token)) await clear();
        }
        return Promise.reject(error);
      },
    );
    return () => api.interceptors.response.eject(id);
  }, [clear]);

  const login = useCallback(
    async (data: LoginData) => {
      const token = data.token || data.accessToken;
      if (!token || !data.user) throw new Error("Sign-in didn't return a session");
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      const next = normalizeUser(data.user)!;
      setUser(next);
      await AsyncStorage.multiSet([
        [USER_KEY, JSON.stringify(next)],
        [ROLE_KEY, next.role || "scheduler"],
        [TOKEN_KEY, token],
      ]);
      await loadSession();
    },
    [loadSession],
  );

  const logout = useCallback(async () => {
    if (user?._id) void cancelAllUserNotifications(user._id);
    await clear();
  }, [clear, user]);

  const refreshTenant = useCallback(async () => {
    await loadSession();
    return tenant;
  }, [loadSession, tenant]);

  const updateCurrentUser = useCallback(async (patch: Partial<AuthUser>) => {
    setUser((prev) => {
      const next = normalizeUser({ ...(prev || {}), ...patch }) as AuthUser;
      AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const roles = getUserRoles(user);
    const permissions = permissionsFor(user);
    const hasRole = (r: string) => roles.includes(normalizeRole(r));
    const isOwner = hasRole("owner");
    return {
      user,
      role: user?.role || "",
      roles,
      permissions,
      tenant,
      session,
      plan: session?.plan || null,
      usage: session?.usage || null,
      hasFeature: (f: string) => Boolean(session?.plan?.features?.includes(f)),
      refreshSession: loadSession,
      publicBranding: null,
      facilityPreferences,
      fetchFacilityPreferences,
      loading,
      isStaff: false,
      isAdmin: isOwner || hasRole("administrator") || hasRole("admin") || hasRole("scheduler"),
      isOwner,
      hasRole,
      can: (p: string) => permissions.includes(p),
      login,
      logout,
      refreshTenant,
      updateCurrentUser,
    };
  }, [user, tenant, session, loadSession, facilityPreferences, fetchFacilityPreferences, loading, login, logout, refreshTenant, updateCurrentUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
