import type axiosType from "axios";
import type { AxiosInstance } from "axios";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE } from "@/config/api";
import {
  forgetLink,
  readDeviceToken,
  readSavedLink,
  saveDeviceToken,
  saveLink,
} from "@/services/staff-link/storage";

const axios = require("axios/dist/browser/axios.cjs") as typeof axiosType;

/**
 * Staff in the app use the same personal link as on the web: no account,
 * the link token is the key. Everything goes through /api/v1/s/:token.
 */

export type StaffLinkMe = {
  locked: boolean;
  pin: { required: boolean; set: boolean };
  staff: {
    _id?: string;
    name?: string;
    firstName?: string;
    roles?: string[];
    hasPhone?: boolean;
    hasEmail?: boolean;
    smsStatus?: string;
  };
  facility: {
    name?: string;
    timezone?: string;
    weekStartsOn?: number;
    currentWeekStart?: string;
  };
  features?: {
    swaps?: boolean;
    pickup?: boolean;
    timeOff?: boolean;
    messages?: boolean;
    clockIn?: boolean;
  };
};

type StaffLinkValue = {
  token: string | null;
  ready: boolean; // finished reading the saved link
  me: StaffLinkMe | null;
  loadError: string;
  client: AxiosInstance | null;
  reload: () => Promise<void>;
  submitPin: (mode: "setup" | "verify", pin: string) => Promise<string | null>;
  signOutDevice: () => Promise<void>;
  forget: () => Promise<void>;
  openLink: (token: string) => Promise<void>;
};

const StaffLinkContext = createContext<StaffLinkValue | undefined>(undefined);

export function useStaffLink() {
  const value = useContext(StaffLinkContext);
  if (!value) throw new Error("useStaffLink must be used inside StaffLinkProvider");
  return value;
}

type ApiError = {
  response?: { status?: number; data?: { errorCode?: string; message?: string; attemptsLeft?: number } };
};

export function StaffLinkProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<StaffLinkMe | null>(null);
  const [loadError, setLoadError] = useState("");
  const deviceRef = useRef<string | null>(null);
  const relockRef = useRef<(() => void) | null>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await readSavedLink();
      const device = saved ? await readDeviceToken(saved) : null;
      // A link opened meanwhile (deep link) wins over the saved one.
      if (cancelled || openedRef.current) return;
      deviceRef.current = device;
      setToken(saved);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const client = useMemo(() => {
    if (!token) return null;
    const instance = axios.create({ baseURL: `${API_BASE}/api/v1/s/${token}` });
    instance.interceptors.request.use((config) => {
      if (deviceRef.current) config.headers.set("X-Staff-Device", deviceRef.current);
      return config;
    });
    instance.interceptors.response.use(
      (res) => res,
      (err: ApiError) => {
        // This phone's PIN pass was reset or signed out: ask again.
        if (err?.response?.status === 401 && err.response.data?.errorCode === "PIN_REQUIRED") {
          deviceRef.current = null;
          void saveDeviceToken(token, null);
          relockRef.current?.();
        }
        return Promise.reject(err);
      },
    );
    return instance;
  }, [token]);

  const reload = useCallback(async () => {
    if (!client) return;
    try {
      const res = await client.get("/me");
      setMe(res.data as StaffLinkMe);
      setLoadError("");
    } catch (err) {
      const status = (err as ApiError)?.response?.status;
      setLoadError(
        status === 404
          ? "This link isn't active any more. Ask your scheduler to send you a new one."
          : "Couldn't load your schedule. Check your connection and try again.",
      );
    }
  }, [client]);

  useEffect(() => {
    relockRef.current = () => void reload();
    if (client) void reload();
  }, [client, reload]);

  const submitPin = useCallback(
    async (mode: "setup" | "verify", pin: string) => {
      if (!client || !token) return "No link";
      try {
        const res = await client.post(`/pin/${mode}`, { pin });
        deviceRef.current = res.data.deviceToken;
        await saveDeviceToken(token, res.data.deviceToken);
        await reload();
        return null;
      } catch (err) {
        const data = (err as ApiError)?.response?.data || {};
        if (data.errorCode === "PIN_ALREADY_SET" || data.errorCode === "PIN_NOT_SET") await reload();
        const left = data.attemptsLeft;
        return `${data.message || "Couldn't check your PIN. Try again."}${
          left ? ` ${left} ${left === 1 ? "try" : "tries"} left.` : ""
        }`;
      }
    },
    [client, token, reload],
  );

  const signOutDevice = useCallback(async () => {
    try {
      await client?.post("/pin/sign-out");
    } catch {
      // already signed out
    }
    deviceRef.current = null;
    if (token) await saveDeviceToken(token, null);
    setMe(null);
    await reload();
  }, [client, token, reload]);

  // Remove the link from this phone (back to the welcome screen).
  const forget = useCallback(async () => {
    if (me?.pin?.required) {
      try {
        await client?.post("/pin/sign-out");
      } catch {
        // ignore
      }
    }
    if (token) await saveDeviceToken(token, null);
    await forgetLink();
    deviceRef.current = null;
    setMe(null);
    setToken(null);
  }, [client, token, me]);

  // A link opened from a text/email, or pasted: keep it on this phone.
  const openLink = useCallback(
    async (next: string) => {
      if (next === token) {
        await reload();
        return;
      }
      openedRef.current = true;
      await saveLink(next);
      deviceRef.current = await readDeviceToken(next);
      setMe(null);
      setLoadError("");
      setToken(next);
      setReady(true);
    },
    [token, reload],
  );

  const value = useMemo(
    () => ({ token, ready, me, loadError, client, reload, submitPin, signOutDevice, forget, openLink }),
    [token, ready, me, loadError, client, reload, submitPin, signOutDevice, forget, openLink],
  );

  return <StaffLinkContext.Provider value={value}>{children}</StaffLinkContext.Provider>;
}
