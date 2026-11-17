import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Foxalora never stores its own passwords. After a successful IMAP login we keep
 * the user's existing mail credentials in an encrypted, httpOnly cookie so the
 * server can talk to IMAP/SMTP on their behalf. The browser can't read it.
 */
export type Session = {
  email: string; user?: string; password: string; host: string; port: number; secure: boolean; expires: number;
  requireTLS?: boolean;
};

const COOKIE = "fx_session";
const DEFAULT_MAX_AGE = 60 * 60 * 8; // 8 hours

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is not set");
  return createHash("sha256").update(secret ?? "foxalora-dev-only-secret").digest();
}

function seal(data: Session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

function unseal(token: string): Session | null {
  try {
    const raw = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as Session;
    return data.expires > Date.now() ? data : null;
  } catch {
    return null;
  }
}

/** maxAgeSeconds comes from APP_CONFIG.sessionTimeoutMinutes. */
export async function createSession(data: Omit<Session, "expires">, maxAgeSeconds = DEFAULT_MAX_AGE, remember = true) {
  (await cookies()).set(COOKIE, seal({ ...data, expires: Date.now() + maxAgeSeconds * 1000 }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    // Without "Remember me" the cookie ends with the browser session; the sealed expiry still applies.
    ...(remember ? { maxAge: maxAgeSeconds } : {}),
  });
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? unseal(token) : null;
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE);
}
