import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./auth-context";

export type GuideTourStep = {
  target: string;
  title: string;
  body: string;
};

type ActiveTour = {
  tourId: string;
  steps: GuideTourStep[];
};

type GuideTourContextValue = {
  activeTour: ActiveTour | null;
  stepIndex: number;
  startTour: (tourId: string, steps: GuideTourStep[]) => void;
  startTourIfUnseen: (tourId: string, steps: GuideTourStep[]) => Promise<void>;
  endTour: () => Promise<void>;
  nextStep: () => Promise<void>;
  prevStep: () => void;
  hasSeenTour: (tourId: string) => Promise<boolean>;
};

const GuideTourContext = createContext<GuideTourContextValue | undefined>(
  undefined,
);

function getUserScopeId(
  user: { _id?: unknown; id?: unknown; tenantId?: unknown } | null,
) {
  return String(user?._id || user?.id || user?.tenantId || "default");
}

function getSeenKey(tourId: string, userScopeId: string) {
  return `wisershifts_guide_seen_${tourId}_${userScopeId}`;
}

export function useGuideTour() {
  const context = useContext(GuideTourContext);

  if (!context) {
    throw new Error("useGuideTour must be used within GuideTourProvider");
  }

  return context;
}

export function GuideTourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userScopeId = getUserScopeId(user);
  const [activeTour, setActiveTour] = useState<ActiveTour | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const hasSeenTour = useCallback(
    async (tourId: string) =>
      (await AsyncStorage.getItem(getSeenKey(tourId, userScopeId))) === "1",
    [userScopeId],
  );

  const markTourSeen = useCallback(
    async (tourId: string) => {
      try {
        await AsyncStorage.setItem(getSeenKey(tourId, userScopeId), "1");
      } catch {
        // The tour will be offered again if persistent storage is unavailable.
      }
    },
    [userScopeId],
  );

  const startTour = useCallback((tourId: string, steps: GuideTourStep[]) => {
    if (!steps.length) return;
    setActiveTour({ tourId, steps });
    setStepIndex(0);
  }, []);

  const endTour = useCallback(async () => {
    if (activeTour) {
      await markTourSeen(activeTour.tourId);
    }
    setActiveTour(null);
    setStepIndex(0);
  }, [activeTour, markTourSeen]);

  const nextStep = useCallback(async () => {
    if (!activeTour) return;
    if (stepIndex >= activeTour.steps.length - 1) {
      await endTour();
      return;
    }
    setStepIndex((previous) => previous + 1);
  }, [activeTour, endTour, stepIndex]);

  const prevStep = useCallback(() => {
    setStepIndex((previous) => Math.max(0, previous - 1));
  }, []);

  const startTourIfUnseen = useCallback(
    async (tourId: string, steps: GuideTourStep[]) => {
      if (await hasSeenTour(tourId)) return;
      startTour(tourId, steps);
    },
    [hasSeenTour, startTour],
  );

  const value = useMemo(
    () => ({
      activeTour,
      stepIndex,
      startTour,
      startTourIfUnseen,
      endTour,
      nextStep,
      prevStep,
      hasSeenTour,
    }),
    [
      activeTour,
      endTour,
      hasSeenTour,
      nextStep,
      prevStep,
      startTour,
      startTourIfUnseen,
      stepIndex,
    ],
  );

  return (
    <GuideTourContext.Provider value={value}>
      {children}
    </GuideTourContext.Provider>
  );
}
