import { FOLDERS, folderPaths, withImap, type FolderKey } from "@/lib/mail";
import { getSession } from "@/lib/session";

type Body = { folder?: string; uids?: unknown; action?: string; to?: string };

/**
 * POST /api/mail/action  { folder, uids: number[], action, to? }
 * action: read | unread | star | unstar | move (to = folder key) | delete (forever)
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (session.localAdmin) return Response.json({ error: "Local admin sessions do not have mailbox access." }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as Body;
  const folder = b.folder as FolderKey;
  const uids = Array.isArray(b.uids) ? b.uids.filter((u): u is number => Number.isInteger(u) && u > 0) : [];
  if (!(FOLDERS as readonly string[]).includes(folder) || !uids.length) return Response.json({ error: "Bad request" }, { status: 400 });
  const range = uids.join(",");
  try {
    await withImap(session, async (c) => {
      const paths = await folderPaths(c);
      const path = paths[folder];
      if (!path) throw new Error("Folder not found");
      const lock = await c.getMailboxLock(path);
      try {
        switch (b.action) {
          case "read": await c.messageFlagsAdd(range, ["\\Seen"], { uid: true }); break;
          case "unread": await c.messageFlagsRemove(range, ["\\Seen"], { uid: true }); break;
          case "star": await c.messageFlagsAdd(range, ["\\Flagged"], { uid: true }); break;
          case "unstar": await c.messageFlagsRemove(range, ["\\Flagged"], { uid: true }); break;
          case "delete": await c.messageDelete(range, { uid: true }); break;
          case "move": {
            const dest = paths[b.to as FolderKey];
            if (!dest) throw new Error(`This mailbox has no ${b.to} folder`);
            await c.messageMove(range, dest, { uid: true });
            break;
          }
          default: throw new Error("Unknown action");
        }
      } finally { lock.release(); }
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[foxalora] action:", (e as Error).message);
    return Response.json({ error: (e as Error).message.startsWith("This mailbox") ? (e as Error).message : "That didn’t work on your mail server. Try again." }, { status: 502 });
  }
}
