import { adminServersFor, domainAllowed, readAdminConfig } from "@/lib/admin-config";
import { appPasswordHint, candidatesFor, verifyLogin, type ImapServer } from "@/lib/imap";
import { createSession } from "@/lib/session";
import { timingSafeEqual } from "node:crypto";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCK_MINUTES = 15;

// In-memory throttle per email. The limit comes from the administrator's security settings.
const failures = new Map<string, { count: number; until: number }>();

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown; remember?: unknown };
  const remember = body.remember === true;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!EMAIL.test(email) || !password) return Response.json({ error: "Enter your email address and password." }, { status: 400 });

  // Optional local-only admin login for developing the admin UI without a mail server.
  const localEmail = process.env.NODE_ENV !== "production" ? process.env.FOXALORA_LOCAL_ADMIN_EMAIL?.trim().toLowerCase() : "";
  const localPassword = process.env.NODE_ENV !== "production" ? process.env.FOXALORA_LOCAL_ADMIN_PASSWORD : "";
  if (localEmail && localPassword && email === localEmail) {
    const supplied = Buffer.from(password);
    const expected = Buffer.from(localPassword);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    await createSession({ email: localEmail, password: "", host: "", port: 993, secure: true, localAdmin: true }, undefined, remember);
    return Response.json({ email: localEmail, localAdmin: true });
  }

  const config = await readAdminConfig();

  // Allowed domains (empty list = everyone).
  if (!domainAllowed(config, email)) {
    return Response.json({ error: `Accounts at ${email.split("@")[1]} can’t sign in here. Ask your administrator if you think this is a mistake.` }, { status: 403 });
  }

  const f = failures.get(email);
  if (f && f.count >= config.maxLoginAttempts && f.until > Date.now()) {
    return Response.json({ error: `Too many attempts. Wait ${LOCK_MINUTES} minutes and try again.` }, { status: 429 });
  }

  // Servers: the administrator's mapping or defaults first; otherwise detect automatically.
  const chosen = adminServersFor(config, email);
  const requireTLS = config.requireTls;
  const candidates: ImapServer[] = (chosen ? [chosen.imap] : await candidatesFor(email)).map((c) => ({ ...c, requireTLS }));

  let server = candidates[0];
  let result = await verifyLogin(email, password, server);
  for (const next of candidates.slice(1)) {
    if (result.ok || result.reason === "credentials") break;
    server = next;
    result = await verifyLogin(email, password, server);
  }
  // Some hosts want just the part before the @ as the username.
  if (!result.ok && result.reason === "credentials") {
    const short = await verifyLogin(email, password, server, email.split("@")[0]);
    if (short.ok) result = short;
  }

  if (!result.ok) {
    if (result.reason === "credentials") {
      const prev = f && f.until > Date.now() ? f.count : 0;
      failures.set(email, { count: prev + 1, until: Date.now() + LOCK_MINUTES * 60 * 1000 });
      const left = config.maxLoginAttempts - prev - 1;
      const hint = appPasswordHint(email, server.host);
      const said = result.detail ? ` Your mail server (${server.host}) said: “${result.detail}”` : "";
      const warn = left > 0 && left <= 2 ? ` ${left} ${left === 1 ? "attempt" : "attempts"} left before a ${LOCK_MINUTES}-minute lock.` : "";
      return Response.json({ error: `${hint ? `Email or password is incorrect. ${hint}` : "Email or password is incorrect."}${warn}${said}` }, { status: 401 });
    }
    const tls = requireTLS && !server.secure ? " Your administrator requires an encrypted connection, and this server may not offer one." : "";
    return Response.json({ error: `We couldn’t reach a mail server for ${email.split("@")[1]} (tried ${candidates.map((c) => c.host).join(", ")}).${tls} Check the email address, or ask your administrator to add your mail server.` }, { status: 502 });
  }

  failures.delete(email);
  const stored = server.host === "imap.gmail.com" && /^[a-z ]{16,19}$/i.test(password.trim()) ? password.replace(/\s+/g, "") : password.trim();
  await createSession({ email, user: result.user, password: stored, ...server, smtp: chosen?.smtp }, config.sessionTimeout * 60, remember);
  return Response.json({ email });
}
