import * as Location from "expo-location";

export type PunchLocation = { latitude: number; longitude: number; accuracyMeters: number };

/** Current location for a clock-in/out, or null if not allowed / unavailable. */
export async function getPunchLocation(): Promise<PunchLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      latitude: Number(pos.coords.latitude),
      longitude: Number(pos.coords.longitude),
      accuracyMeters: Number(pos.coords.accuracy ?? 9999),
    };
  } catch {
    return null;
  }
}

type GeoData = { errorCode?: string; distanceMeters?: number; message?: string };

// Plain-language answers for clock-in location checks (same as the web link).
export function clockErrorText(data: GeoData | undefined, fallback: string) {
  switch (data?.errorCode) {
    case "GEOFENCE_OUTSIDE": {
      const d = Number(data.distanceMeters || 0);
      const far = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`;
      return `You're ${far} from the facility. Clock in when you're there.`;
    }
    case "GEOFENCE_UNAVAILABLE":
      return "We couldn't get your location. Allow location for WiserShifts in Settings, then try again.";
    case "GEOFENCE_INACCURATE":
      return "Your location isn't precise enough yet. Step outside or turn on Wi-Fi, wait a moment, then try again.";
    case "GEOFENCE_INVALID":
      return "We couldn't read your location. Try again.";
    default:
      return data?.message || fallback;
  }
}
