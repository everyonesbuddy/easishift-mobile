// Apple-like look shared by the staff and scheduler screens (matches the web app).

export const IOS = {
  canvas: "#F5F5F7",
  surface: "#FFFFFF",
  ink: "#1D1D1F",
  secondary: "#6E6E73",
  tertiary: "#AEAEB2",
  hairline: "rgba(60,60,67,0.12)",
  separator: "rgba(60,60,67,0.18)",
  fill: "rgba(118,118,128,0.12)",
  blue: "#007AFF",
  blueDark: "#0060DF",
  green: "#34C759",
  greenText: "#248A3D",
  orange: "#FF9500",
  orangeText: "#C93400",
  red: "#FF3B30",
  redText: "#D70015",
  purple: "#AF52DE",
  radius: { card: 16, cell: 12, round: 999 },
} as const;

/** "#RRGGBB" + alpha -> rgba(). */
export function tint(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const ROLE_PALETTE = [
  "#007AFF",
  "#34C759",
  "#AF52DE",
  "#FF9500",
  "#FF2D55",
  "#5AC8FA",
  "#5856D6",
  "#A2845E",
];

/** Stable color per role, ordered like Facility Preferences when given. */
export function roleColor(role: unknown, roleFamilies?: unknown[]) {
  const key = String(role || "").toLowerCase();
  const list = (roleFamilies || []).map((r) => String(r).toLowerCase());
  const index = list.indexOf(key);
  if (index >= 0) return ROLE_PALETTE[index % ROLE_PALETTE.length];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return ROLE_PALETTE[Math.abs(hash) % ROLE_PALETTE.length];
}

// Same as the web app's toLabel: "memory_care" -> "Memory Care", "cna" -> "CNA".
const ACRONYMS = new Set(["cna", "lpn", "lvn", "rn", "np", "cma", "cmt", "hha", "pca", "qmap", "don", "adon", "cpr", "bls", "acls"]);

export function toLabel(value: unknown) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      return ACRONYMS.has(lower) ? lower.toUpperCase() : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** "2026-10-12" -> local Date at midnight. */
export function keyToDate(key: string) {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysToKey(key: string, days: number) {
  const date = keyToDate(key);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const plural = (n: number, word: string, many?: string) =>
  `${n} ${n === 1 ? word : many || `${word}s`}`;

/** Message from an API error, or the fallback. */
export function apiError(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message || fallback;
}

export function apiStatus(err: unknown) {
  return (err as { response?: { status?: number } })?.response?.status;
}
