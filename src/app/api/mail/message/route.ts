import { FOLDERS, folderPaths, readAttachment, readMessage, withImap, type FolderKey } from "@/lib/mail";
import { getSession } from "@/lib/session";

function parse(url: string) {
  const q = new URL(url).searchParams;
  const folder = q.get("folder") as FolderKey;
  const uid = Number(q.get("uid"));
  const att = q.get("attachment");
  return { folder: (FOLDERS as readonly string[]).includes(folder) ? folder : null, uid: Number.isInteger(uid) && uid > 0 ? uid : null, att: att === null ? null : Number(att) };
}

/**
 * GET /api/mail/message?folder=inbox&uid=123            → full message (marks it read)
 * GET /api/mail/message?folder=inbox&uid=123&attachment=0 → download that attachment
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (session.localAdmin) return Response.json({ error: "Local admin sessions do not have mailbox access." }, { status: 403 });
  const { folder, uid, att } = parse(request.url);
  if (!folder || !uid) return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    return await withImap(session, async (c) => {
      const path = (await folderPaths(c))[folder];
      if (!path) return Response.json({ error: "Folder not found" }, { status: 404 });
      if (att !== null) {
        const a = await readAttachment(c, path, uid, att);
        if (!a) return Response.json({ error: "Attachment not found" }, { status: 404 });
        const name = (a.filename ?? "attachment").replace(/["\r\n]/g, "");
        return new Response(new Uint8Array(a.content), { headers: { "Content-Type": a.contentType || "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`, "X-Content-Type-Options": "nosniff" } });
      }
      const m = await readMessage(c, path, uid);
      return m ? Response.json(m, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "This email no longer exists." }, { status: 404 });
    });
  } catch (e) {
    console.error("[foxalora] message:", (e as Error).message);
    return Response.json({ error: "Couldn’t open this email. Try again." }, { status: 502 });
  }
}
