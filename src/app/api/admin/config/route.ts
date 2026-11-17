import { isAdminEmail, listAdmins, publicConfig, readAdminConfig, writeAdminConfig } from "@/lib/admin-config";
import { getSession } from "@/lib/session";

/**
 * GET: everyone gets the public settings (the sign-in page needs them before sign-in).
 *      Administrators also get the full configuration.
 */
export async function GET() {
  const [config, session] = await Promise.all([readAdminConfig(), getSession()]);
  const admin = isAdminEmail(session?.email);
  return Response.json({ isAdmin: admin, config: admin ? config : publicConfig(config), ...(admin ? { admins: listAdmins() } : {}) }, { headers: { "Cache-Control": "no-store" } });
}

/** PUT: administrators only. Saves changes for the whole installation. */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (!isAdminEmail(session.email)) return Response.json({ error: "Only administrators can change these settings." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Invalid settings." }, { status: 400 });
  if (JSON.stringify(body).length > 1_000_000) return Response.json({ error: "Settings are too large. Try a smaller logo." }, { status: 413 });
  try {
    const config = await writeAdminConfig(body);
    return Response.json({ config });
  } catch {
    return Response.json({ error: "The settings couldn’t be saved on the server." }, { status: 500 });
  }
}
