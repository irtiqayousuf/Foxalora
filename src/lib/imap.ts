import "server-only";
import { ImapFlow } from "imapflow";

export type ImapServer = { host: string; port: number; secure: boolean; requireTLS?: boolean };

/** Public providers whose IMAP server doesn't follow the mail.<domain> pattern. */
const KNOWN: Record<string, string> = {
  "gmail.com": "imap.gmail.com",
  "googlemail.com": "imap.gmail.com",
  "outlook.com": "outlook.office365.com",
  "hotmail.com": "outlook.office365.com",
  "live.com": "outlook.office365.com",
  "yahoo.com": "imap.mail.yahoo.com",
  "icloud.com": "imap.mail.me.com",
  "me.com": "imap.mail.me.com",
  "zoho.com": "imap.zoho.com",
  "aol.com": "imap.aol.com",
  "ethereal.email": "imap.ethereal.email",
};

/** Providers that refuse the normal account password over IMAP. */
export function appPasswordHint(email: string, host = "") {
  if (host.includes("zoho")) return "Your mail is hosted by Zoho. In Zoho Mail go to Settings → Mail Accounts → IMAP and tick IMAP Access. If you use two-factor sign-in, create an app-specific password at accounts.zoho.com → Security → App Passwords and use that here.";
  if (host === "imap.gmail.com") return "Your mail is hosted by Google. It needs an app password, not your normal password. Create one at myaccount.google.com/apppasswords (2-Step Verification must be on).";
  if (host === "outlook.office365.com") return "Your mail is hosted by Microsoft. Your administrator may need to allow IMAP for your account.";
  const d = email.split("@")[1]?.toLowerCase() ?? "";
  if (d === "gmail.com" || d === "googlemail.com") return "Gmail needs an app password, not your normal Google password. Create one at myaccount.google.com/apppasswords (2-Step Verification must be on).";
  if (d === "yahoo.com" || d === "aol.com") return "This provider needs an app password. Create one in your account’s security settings.";
  if (d === "icloud.com" || d === "me.com") return "iCloud needs an app-specific password from appleid.apple.com.";
  return null;
}

/**
 * Which IMAP server handles this email address?
 *  1. IMAP_DOMAINS (JSON), e.g. {"company.com":"mail4.host.com"} for per-domain servers
 *  2. IMAP_HOST, one server for everyone
 *  3. mail.<domain>, the usual hosting-provider convention
 * Port/security come from IMAP_PORT (default 993) and IMAP_SECURE (default true).
 */
export function serverFor(email: string): ImapServer {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  let map: Record<string, string> = {};
  try { map = JSON.parse(process.env.IMAP_DOMAINS ?? "{}"); } catch { /* ignore bad JSON */ }
  const host = map[domain] ?? KNOWN[domain] ?? process.env.IMAP_HOST ?? `mail.${domain}`;
  const port = Number(process.env.IMAP_PORT ?? 993);
  const secure = (process.env.IMAP_SECURE ?? "true") !== "false";
  return { host, port, secure };
}

/** MX record → IMAP host, for custom domains hosted by big providers. */
const MX_HINTS: [RegExp, string][] = [
  [/google(mail)?\.com\.?$/i, "imap.gmail.com"],
  [/outlook\.com\.?$|protection\.outlook/i, "outlook.office365.com"],
  [/zoho\.(com|eu|in)\.?$/i, "imap.zoho.com"],
  [/yahoodns\.net\.?$/i, "imap.mail.yahoo.com"],
  [/icloud\.com\.?$/i, "imap.mail.me.com"],
];

/**
 * Servers to try, in order: configured/known host first, then hosts found from
 * the domain's MX records, then imap.<domain> and mail.<domain>.
 */
export async function candidatesFor(email: string): Promise<ImapServer[]> {
  const first = serverFor(email);
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const hosts = [first.host];
  try {
    const { resolveMx } = await import("node:dns/promises");
    const mx = (await resolveMx(domain)).sort((a, b) => a.priority - b.priority);
    for (const r of mx) {
      const hint = MX_HINTS.find(([re]) => re.test(r.exchange))?.[1];
      hosts.push(hint ?? r.exchange);
    }
  } catch { /* no MX */ }
  hosts.push(`imap.${domain}`, `mail.${domain}`);
  return [...new Set(hosts.map((h) => h.toLowerCase().replace(/\.$/, "")))].slice(0, 5).map((host) => ({ ...first, host }));
}

export type LoginResult = { ok: true; user: string } | { ok: false; reason: "credentials" | "unreachable"; detail: string };

/** Try to log in to the user's existing mailbox. Nothing is created or changed. */
export async function verifyLogin(email: string, password: string, server: ImapServer, user = email): Promise<LoginResult> {
  const client = new ImapFlow({
    host: server.host,
    port: server.port,
    secure: server.secure,
    // Admin policy: never send the password over an unencrypted connection.
    ...(server.requireTLS && !server.secure ? { doSTARTTLS: true } : {}),
    // Google app passwords are shown as "abcd efgh ijkl mnop"; the spaces are not part of it.
    auth: { user, pass: server.host === "imap.gmail.com" && /^[a-z ]{16,19}$/i.test(password.trim()) ? password.replace(/\s+/g, "") : password.trim() },
    logger: false,
    connectionTimeout: 6_000,
    greetingTimeout: 6_000,
  });
  try {
    await client.connect();
    await client.logout();
    return { ok: true, user };
  } catch (error) {
    const e = error as { authenticationFailed?: boolean; responseStatus?: string; responseText?: string; code?: string; message?: string };
    console.error(`[foxalora] IMAP login to ${server.host}:${server.port} failed:`, e.code ?? "", e.responseStatus ?? "", e.responseText ?? e.message ?? "");
    const authish = Boolean(e.authenticationFailed) || e.responseStatus === "NO";
    return { ok: false, reason: authish ? "credentials" : "unreachable", detail: (e.responseText ?? e.message ?? "").replace(/\s+/g, " ").slice(0, 200) };
  } finally {
    client.close();
  }
}
