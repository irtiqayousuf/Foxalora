import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { LANGUAGES, defaultAdminConfig, mailHostProblem, validDomain, type AdminConfig } from "@/app/settings-store";

/**
 * The hosting administrator's settings, stored on the server so they apply to every user.
 * File location: FOXALORA_CONFIG_PATH, or data/admin-config.json in the project folder.
 * Who is an administrator: FOXALORA_ADMINS, a comma-separated list of email addresses.
 */

const FILE = process.env.FOXALORA_CONFIG_PATH || path.join(process.cwd(), "data", "admin-config.json");

let cache: { at: number; value: AdminConfig } | null = null;

export async function readAdminConfig(): Promise<AdminConfig> {
  if (cache && Date.now() - cache.at < 5_000) return cache.value;
  let stored: Partial<AdminConfig> = {};
  try { stored = JSON.parse(await readFile(FILE, "utf8")); } catch { /* first run: defaults */ }
  const value = sanitize({ ...defaultAdminConfig, ...stored });
  cache = { at: Date.now(), value };
  return value;
}

export async function writeAdminConfig(next: Partial<AdminConfig>): Promise<AdminConfig> {
  const value = sanitize({ ...(await readAdminConfig()), ...next });
  await mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await rename(tmp, FILE);
  cache = { at: Date.now(), value };
  return value;
}

export function isAdminEmail(email: string | undefined | null) {
  if (!email) return false;
  const localAdminEmail = process.env.NODE_ENV !== "production" ? process.env.FOXALORA_LOCAL_ADMIN_EMAIL?.trim().toLowerCase() : "";
  if (localAdminEmail && email.trim().toLowerCase() === localAdminEmail) return true;
  const admins = (process.env.FOXALORA_ADMINS ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase());
}

/** Settings anyone may see (needed before sign-in for the login page, and by every user). */
export function publicConfig(c: AdminConfig) {
  return {
    appName: c.appName, logo: c.logo, logoDark: c.logoDark, accent: c.accent, supportEmail: c.supportEmail,
    defaultLanguage: c.defaultLanguage, defaultTheme: c.defaultTheme, loginTitle: c.loginTitle, loginMessage: c.loginMessage,
    uploadLimitMb: c.uploadLimitMb, blockRemoteImages: c.blockRemoteImages, sessionTimeout: c.sessionTimeout,
    navCalendar: c.navCalendar, navContacts: c.navContacts, navNotes: c.navNotes,
  };
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const str = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);
const host = (v: unknown) => { const h = str(v, 253).trim().toLowerCase(); return h && !mailHostProblem(h) ? h : ""; };

/** Never trust what the browser sends: clamp numbers, check hosts and domains, cap sizes. */
function sanitize(c: AdminConfig): AdminConfig {
  const d = defaultAdminConfig;
  const img = (v: unknown) => { const s = str(v, 700_000); return /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(s) ? s : ""; };
  return {
    ...c,
    appName: str(c.appName, 40).trim() || d.appName,
    logo: img(c.logo),
    logoDark: img(c.logoDark),
    accent: /^#[0-9a-f]{6}$/i.test(c.accent) ? c.accent : d.accent,
    supportEmail: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(c.supportEmail) ? c.supportEmail.trim() : d.supportEmail,
    panelType: (["cpanel", "plesk", "directadmin", "other"] as const).includes(c.panelType) ? c.panelType : "cpanel",
    panelUrl: (() => { try { const u = new URL(str(c.panelUrl, 300).trim()); return u.protocol === "https:" ? u.toString() : ""; } catch { return ""; } })(),
    defaultLanguage: LANGUAGES.some((l) => l.id === c.defaultLanguage) ? c.defaultLanguage : "en",
    defaultTheme: ["light", "dark", "system"].includes(c.defaultTheme) ? c.defaultTheme : "light",
    loginTitle: str(c.loginTitle, 60), loginMessage: str(c.loginMessage, 200),
    imapHost: host(c.imapHost), imapPort: clampInt(c.imapPort, 1, 65535, 993), imapSecurity: c.imapSecurity === "starttls" ? "starttls" : "ssl",
    smtpHost: host(c.smtpHost), smtpPort: clampInt(c.smtpPort, 1, 65535, 465), smtpSecurity: c.smtpSecurity === "starttls" ? "starttls" : "ssl",
    mappings: (Array.isArray(c.mappings) ? c.mappings : []).slice(0, 500)
      .map((m, i) => ({ id: Number(m?.id) || i + 1, domain: str(m?.domain, 253).trim().toLowerCase(), imap: host(m?.imap), smtp: host(m?.smtp) || host(m?.imap) }))
      .filter((m) => validDomain(m.domain) && m.imap),
    allowedDomains: (Array.isArray(c.allowedDomains) ? c.allowedDomains : []).map((x) => str(x, 253).trim().toLowerCase()).filter(validDomain).slice(0, 500),
    sessionTimeout: clampInt(c.sessionTimeout, 5, 60 * 24 * 30, d.sessionTimeout),
    uploadLimitMb: clampInt(c.uploadLimitMb, 1, 100, d.uploadLimitMb),
    requireTls: Boolean(c.requireTls), blockRemoteImages: Boolean(c.blockRemoteImages),
    maxLoginAttempts: clampInt(c.maxLoginAttempts, 1, 50, d.maxLoginAttempts),
    navCalendar: c.navCalendar !== false, navContacts: c.navContacts !== false, navNotes: c.navNotes !== false,
  };
}

/** Is this email's domain allowed to sign in? An empty list means every domain is allowed. */
export function domainAllowed(c: AdminConfig, email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return !c.allowedDomains.length || c.allowedDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export type ServerChoice = { host: string; port: number; secure: boolean };

/** Admin-chosen servers for an email: a domain mapping first, then the default servers. Null means "detect automatically". */
export function adminServersFor(c: AdminConfig, email: string): { imap: ServerChoice; smtp: ServerChoice } | null {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const m = c.mappings.find((x) => x.domain === domain);
  const imapSecure = c.imapSecurity === "ssl", smtpSecure = c.smtpSecurity === "ssl";
  if (m) return { imap: { host: m.imap, port: c.imapPort, secure: imapSecure }, smtp: { host: m.smtp || m.imap, port: c.smtpPort, secure: smtpSecure } };
  if (c.imapHost) return { imap: { host: c.imapHost, port: c.imapPort, secure: imapSecure }, smtp: { host: c.smtpHost || c.imapHost, port: c.smtpPort, secure: smtpSecure } };
  return null;
}

/** The addresses allowed to manage Foxalora (set by the server owner, never editable from the browser). */
export function listAdmins(): string[] {
  return (process.env.FOXALORA_ADMINS ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
}
