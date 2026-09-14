export function getLocalTimeZoneAbbreviation(date = new Date()) {
  return getTimeZoneAbbreviation(date);
}

export function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

type FacilityTimezonePreferences = {
  facilityTimezone?: string;
  facilityTimezoneConfirmed?: boolean;
} | null;

// Returns the confirmed facility timezone, or undefined to fall back to device-local time.
export function getDisplayTimeZone(
  facilityPreferences: FacilityTimezonePreferences,
): string | undefined {
  return facilityPreferences?.facilityTimezoneConfirmed &&
    facilityPreferences?.facilityTimezone
    ? facilityPreferences.facilityTimezone
    : undefined;
}

// IANA zone abbreviation (e.g. "EDT") for a given instant, DST-aware.
export function getTimeZoneAbbreviation(
  date: Date | string | number = new Date(),
  timeZone?: string,
): string {
  try {
    const value = date instanceof Date ? date : new Date(date);
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
      ...(timeZone ? { timeZone } : {}),
    }).formatToParts(value);

    return parts.find((part) => part.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
}

export function getTimeZoneDayKey(
  date: Date | string | number,
  timeZone?: string,
): string {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(value);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function formatInTimeZone(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
  timeZone?: string,
): string {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";

  return value.toLocaleString(undefined, {
    ...options,
    ...(timeZone ? { timeZone } : {}),
  });
}
