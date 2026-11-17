/**
 * Settings live apart from mailbox content.
 * - UserPreferences: one person's choices (per browser in this prototype; per account on a server).
 * - AdminConfig: the hosting administrator's configuration for the whole installation.
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

export type DomainMapping = { id: number; domain: string; imap: string; smtp: string };
export type ControlPanel = "cpanel" | "plesk" | "directadmin";
export type PanelIntegration = {
  enabled: boolean;
  url: string;
  token: string;
  sso: boolean;
  autoMailbox: boolean;
  loginRedirect: string;
  accountLinks: boolean;
  logoutSync: boolean;
};

export type AdminConfig = {
  appName: string;
  logo: string; // data URL, light mode
  logoDark: string; // data URL, dark mode (falls back to logo)
  accent: string;
  supportEmail: string;
  panelType: "cpanel" | "plesk" | "directadmin" | "other";
  panelUrl: string; // where admins manage mailboxes, passwords and storage
  defaultLanguage: string;
  defaultTheme: "light" | "dark" | "system";
  loginTitle: string;
  loginMessage: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: "ssl" | "starttls";
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: "ssl" | "starttls";
  mappings: DomainMapping[];
  sessionTimeout: number; // minutes
  uploadLimitMb: number;
  requireTls: boolean;
  blockRemoteImages: boolean;
  maxLoginAttempts: number;
  allowedDomains: string[]; // empty = any domain may sign in
  navCalendar: boolean;
  navContacts: boolean;
  navNotes: boolean;
  integrations: Record<ControlPanel, PanelIntegration>;
};

export const PREFS_KEY = "foxalora.preferences.v1";
export const ADMIN_KEY = "foxalora.admin-config.v1";

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

const blankPanel: PanelIntegration = { enabled: false, url: "", token: "", sso: true, autoMailbox: true, loginRedirect: "", accountLinks: false, logoutSync: true };

export const defaultAdminConfig: AdminConfig = {
  appName: "Foxalora",
  logo: "",
  logoDark: "",
  accent: "#111114",
  supportEmail: "support@foxalora.app",
  panelType: "cpanel",
  panelUrl: "",
  defaultLanguage: "en",
  defaultTheme: "light",
  loginTitle: "Welcome back",
  loginMessage: "Sign in with your email address and password.",
  imapHost: "", // empty = detect automatically
  imapPort: 993,
  imapSecurity: "ssl",
  smtpHost: "",
  smtpPort: 465,
  smtpSecurity: "ssl",
  mappings: [],
  sessionTimeout: 60,
  uploadLimitMb: 25,
  requireTls: true,
  blockRemoteImages: true,
  maxLoginAttempts: 5,
  allowedDomains: [],
  navCalendar: true,
  navContacts: true,
  navNotes: true,
  integrations: { cpanel: { ...blankPanel }, plesk: { ...blankPanel }, directadmin: { ...blankPanel } },
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

/* ---------- validation for admin-managed servers (SSRF-safe) ---------- */

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i;

export function validDomain(value: string) {
  return DOMAIN_RE.test(value.trim());
}

/**
 * Mail hosts must be public hostnames picked by the administrator.
 * IP literals, localhost and internal names are refused so the server can never be pointed at the internal network.
 */
export function mailHostProblem(value: string): string | null {
  const host = value.trim().toLowerCase();
  if (!host) return "Enter a server name";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return "Use a server name, not an IP address";
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) return "Internal server names aren’t allowed";
  if (!DOMAIN_RE.test(host)) return "That doesn’t look like a server name";
  return null;
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
