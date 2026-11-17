/**
 * Settings live apart from mailbox content.
 * - UserPreferences: one person's choices (per browser in this prototype; per account on a server).
 * Nothing here contains mail; mail data never reads or writes these keys.
 */

export type UserPreferences = {
  displayName: string;
  avatar: string; // data URL; empty = initials
  signature: string;
  language: string;
  timeZone: string; // "auto" = device time zone
  dateFormat: "auto" | "mdy" | "dmy" | "ymd";
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
  showPreview: boolean;
  replyFormat: "html" | "plain";
  remoteImages: "ask" | "always";
  notifyNewMail: boolean;
  notifySound: boolean;
  notifyCalendar: boolean;
};

/** Fixed app settings for this client build. Change them here; there is no admin screen. */
export const APP_CONFIG = {
  appName: "Foxalora",
  logo: "", // data URL or /public path, light mode; empty = default icon
  logoDark: "", // dark mode (falls back to logo)
  accent: "#111114",
  supportEmail: "support@foxalora.app",
  websiteUrl: "/website/index.html",
  loginTitle: "Welcome back",
  loginMessage: "Sign in with your email address and password.",
  uploadLimitMb: 25,
  /** Server-side policies. */
  sessionTimeoutMinutes: 60,
  maxLoginAttempts: 5,
  requireTls: true,
} as const;

export const PREFS_KEY = "foxalora.preferences.v1";

export const defaultPreferences: UserPreferences = {
  displayName: "Alex Morgan",
  avatar: "",
  signature: "Alex Morgan\nProduct Designer",
  language: "en",
  timeZone: "auto",
  dateFormat: "auto",
  theme: "light",
  density: "comfortable",
  showPreview: true,
  replyFormat: "html",
  remoteImages: "ask",
  notifyNewMail: true,
  notifySound: false,
  notifyCalendar: true,
};

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "ar", label: "العربية" },
  { id: "ur", label: "اردو" },
];

export function formatDateWith(d: Date, fmt: UserPreferences["dateFormat"], timeZone: string) {
  const tz = timeZone === "auto" ? undefined : timeZone;
  if (fmt === "auto") return d.toLocaleDateString(undefined, { timeZone: tz, year: "numeric", month: "short", day: "numeric" });
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  if (fmt === "mdy") return `${get("month")}/${get("day")}/${get("year")}`;
  if (fmt === "dmy") return `${get("day")}/${get("month")}/${get("year")}`;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
