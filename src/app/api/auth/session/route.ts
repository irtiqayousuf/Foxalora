import { deleteSession, getSession } from "@/lib/session";

/** Who is signed in? Never returns the password. */
export async function GET() {
  const session = await getSession();
  return session ? Response.json({ email: session.email, localAdmin: Boolean(session.localAdmin) }) : Response.json({ email: null }, { status: 401 });
}

/** Sign out. */
export async function DELETE() {
  await deleteSession();
  return Response.json({ ok: true });
}
