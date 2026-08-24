import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api from "@/config/api";
import {
  getEffectivePermissions,
  getUserRoles,
  normalizeRole,
} from "@/constants/industry-roles";

const USER_KEY = "user";
const ROLE_KEY = "role";
const TOKEN_KEY = "token";

type AuthUser = {
  role?: string;
  roles?: string[];
  permissions?: string[];
  tenantId?: string;
  firstName?: string;
  [key: string]: unknown;
};

type Tenant = {
  subscriptionStatus?: string;
  seatLimit?: number | null;
  [key: string]: unknown;
};

type FacilityPreferencesState = Record<string, unknown>;

type LoginData = {
  user?: AuthUser;
  patient?: AuthUser;
  role?: string;
  token?: string;
  accessToken?: string;
  firstName?: string;
  [key: string]: unknown;
};

type AuthContextValue = {
  user: AuthUser | null;
  role: string;
  roles: string[];
  permissions: string[];
  tenant: Tenant | null;
  facilityPreferences: FacilityPreferencesState | null;
  fetchFacilityPreferences: () => Promise<FacilityPreferencesState>;
  loading: boolean;
  isPatient: boolean;
  isStaff: boolean;
  isAdmin: boolean;
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

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

function normalizeUser(user: AuthUser | null): AuthUser | null {
  if (!user) return null;
  const roles = getUserRoles(user);
  return {
    ...user,
    roles,
    permissions: getEffectivePermissions(user),
    role: normalizeRole(user.role || roles[0] || "staff"),
  };
}

function parseMaybeUser(value: string | null): AuthUser | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as AuthUser;
    return parsed ?? null;
  } catch {
    return null;
  }
}

function extractToken(data: LoginData): string | null {
  if (typeof data.token === "string" && data.token.length > 0) {
    return data.token;
  }

  if (typeof data.accessToken === "string" && data.accessToken.length > 0) {
    return data.accessToken;
  }

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState("");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [facilityPreferences, setFacilityPreferences] =
    useState<FacilityPreferencesState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFacilityPreferences = useCallback(async () => {
    try {
      const res = await api.get("/facility-preferences");
      const nextPrefs = (res.data || {}) as FacilityPreferencesState;
      setFacilityPreferences(nextPrefs);
      return nextPrefs;
    } catch (error) {
      console.warn("Failed to fetch facility preferences", error);
      setFacilityPreferences({});
      return {};
    }
  }, []);

  const fetchTenantByUser = async (candidate: AuthUser | null) => {
    if (!candidate?.tenantId) {
      setTenant(null);
      setFacilityPreferences(null);
      return null;
    }

    try {
      const res = await api.get(`/tenants/${candidate.tenantId}`);
      const nextTenant = (res.data?.tenant ||
        res.data ||
        null) as Tenant | null;
      setTenant(nextTenant);
      await fetchFacilityPreferences();
      return nextTenant;
    } catch (error) {
      console.warn("Failed to fetch tenant in AuthProvider", error);
      setTenant(null);
      setFacilityPreferences({});
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          USER_KEY,
          ROLE_KEY,
          TOKEN_KEY,
        ]);
        const map = new Map(entries);
        const savedUser = normalizeUser(
          parseMaybeUser(map.get(USER_KEY) ?? null),
        );
        const savedRole = normalizeRole(
          map.get(ROLE_KEY) ?? savedUser?.role ?? "staff",
        );
        const savedToken = map.get(TOKEN_KEY);

        if (savedToken) {
          api.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
        }

        if (!mounted) {
          return;
        }

        setUser(savedUser);
        setRole(savedRole);

        if (savedUser?.tenantId) {
          await fetchTenantByUser(savedUser);
        }
      } catch (error) {
        console.warn("Failed to restore auth session", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (data: LoginData) => {
    let userData: AuthUser;
    let detectedRole = "staff";

    if (data.user) {
      userData = data.user;
      detectedRole = normalizeRole(data.user.role);
    } else if (data.patient || data.firstName) {
      userData = (data.patient || data) as AuthUser;
      detectedRole = "patient";
    } else if (data.role) {
      userData = data as AuthUser;
      detectedRole = normalizeRole(data.role);
    } else {
      userData = data as AuthUser;
      detectedRole = normalizeRole(data.role);
    }

    const token = extractToken(data);
    userData = normalizeUser(userData) || userData;

    setUser(userData);
    setRole(detectedRole);

    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    }

    await AsyncStorage.multiSet([
      [USER_KEY, JSON.stringify(userData)],
      [ROLE_KEY, detectedRole],
      ...(token ? ([[TOKEN_KEY, token]] as [string, string][]) : []),
    ]);

    if (!token) {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }

    await fetchTenantByUser(userData);
  };

  const refreshTenant = async () => {
    if (!user || !user.tenantId) {
      return null;
    }

    try {
      const res = await api.get(`/tenants/${user.tenantId}`);
      const nextTenant = (res.data?.tenant ||
        res.data ||
        null) as Tenant | null;
      setTenant(nextTenant);
      return nextTenant;
    } catch (error) {
      console.warn("Failed to refresh tenant", error);
      return null;
    }
  };

  const logout = async () => {
    setUser(null);
    setRole("");
    setTenant(null);
    setFacilityPreferences(null);
    delete api.defaults.headers.common.Authorization;

    await AsyncStorage.multiRemove([USER_KEY, ROLE_KEY, TOKEN_KEY]);
  };

  const updateCurrentUser = useCallback(async (patch: Partial<AuthUser>) => {
    if (!patch) {
      return;
    }

    setUser((prev) => {
      const nextUser = normalizeUser({ ...(prev || {}), ...patch }) as AuthUser;

      AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser)).catch(() => {
        // Ignore persistence errors here; state is still updated.
      });

      if (typeof nextUser.role === "string" && nextUser.role.length > 0) {
        const nextRole = normalizeRole(nextUser.role);
        setRole(nextRole);
        AsyncStorage.setItem(ROLE_KEY, nextRole).catch(() => {
          // Ignore persistence errors here; state is still updated.
        });
      }

      return nextUser;
    });
  }, []);

  const roles = getUserRoles(user);
  const permissions = getEffectivePermissions(user);
  const normalizedRole = normalizeRole(role);
  const isPatient = normalizedRole === "patient";
  const hasRole = (targetRole: string) =>
    roles.includes(normalizeRole(targetRole));
  const can = (permission: string) => permissions.includes(permission);
  const isAdmin = hasRole("admin") || hasRole("owner");
  const isStaff = Boolean(user) && !isPatient;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      roles,
      permissions,
      tenant,
      facilityPreferences,
      fetchFacilityPreferences,
      refreshTenant,
      isPatient,
      isStaff,
      isAdmin,
      hasRole,
      can,
      login,
      logout,
      loading,
      updateCurrentUser,
    }),
    [
      isAdmin,
      isPatient,
      isStaff,
      loading,
      role,
      roles,
      permissions,
      tenant,
      facilityPreferences,
      fetchFacilityPreferences,
      updateCurrentUser,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
