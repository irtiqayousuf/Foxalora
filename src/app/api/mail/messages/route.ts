import { FOLDERS, folderPaths, listFolder, withImap, type FolderKey, type ListItem } from "@/lib/mail";
import { getSession } from "@/lib/session";

/** GET /api/mail/messages?folders=inbox,sent → newest messages from each folder. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const asked = (new URL(request.url).searchParams.get("folders") ?? FOLDERS.join(",")).split(",").filter((f): f is FolderKey => (FOLDERS as readonly string[]).includes(f));
  try {
    const result = await withImap(session, async (c) => {
      const paths = await folderPaths(c);
      const messages: ListItem[] = [];
      for (const f of asked) {
        const path = paths[f];
        if (!path) continue;
        try { messages.push(...(await listFolder(c, f, path))); } catch (e) { console.error(`[foxalora] list ${path}:`, (e as Error).message); }
      }
      return { messages, folders: Object.keys(paths) };
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[foxalora] messages:", (e as Error).message);
    return Response.json({ error: "Couldn’t load your mail. Try again in a moment." }, { status: 502 });
  }
}
