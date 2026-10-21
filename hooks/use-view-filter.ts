import { useCallback, useEffect, useRef, useState } from "react";

import api from "@/config/api";
import { useAuth } from "@/context/auth-context";
import { emptyFilter, type ViewFilterValue } from "@/components/scheduler/week-utils";

type Kind = "schedule" | "needs";

const clean = (f: unknown): ViewFilterValue => {
  const v = (f || {}) as Partial<ViewFilterValue>;
  return { roles: Array.isArray(v.roles) ? v.roles : [], areas: Array.isArray(v.areas) ? v.areas : [] };
};

/**
 * The roles / areas this scheduler chose to see. Saved on their account, so
 * the same filter shows on the website and in the app.
 */
export default function useViewFilter(kind: Kind) {
  const { user, updateCurrentUser } = useAuth();
  const saved = clean(((user?.viewFilters || {}) as Record<string, unknown>)[kind]);
  // What was picked on this screen; falls back to the saved filter (and
  // resets when someone else signs in).
  const [local, setLocal] = useState<{ userId: unknown; value: ViewFilterValue } | null>(null);
  const userId = user?._id;
  const filter = local && local.userId === userId ? local.value : saved;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const setFilter = useCallback(
    (next: ViewFilterValue) => {
      const value = clean(next);
      setLocal({ userId, value });
      void updateCurrentUser({ viewFilters: { ...((user?.viewFilters as object) || {}), [kind]: value } });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        api.patch("/auth/me", { viewFilters: { [kind]: value } }).catch(() => {
          // Still applies on this phone; it just won't be remembered elsewhere.
        });
      }, 400);
    },
    [kind, updateCurrentUser, user?.viewFilters, userId],
  );

  return [filter, setFilter, emptyFilter] as const;
}
