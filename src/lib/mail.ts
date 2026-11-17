import "server-only";
import { ImapFlow, type MessageStructureObject } from "imapflow";
import { simpleParser } from "mailparser";
import type { Session } from "./session";

/** Foxalora's folder ids → what IMAP calls them. */
export const FOLDERS = ["inbox", "sent", "drafts", "archive", "spam", "trash"] as const;
export type FolderKey = (typeof FOLDERS)[number];
const SPECIAL: Record<string, FolderKey> = { "\\Sent": "sent", "\\Drafts": "drafts", "\\Archive": "archive", "\\All": "archive", "\\Junk": "spam", "\\Trash": "trash" };

export async function withImap<T>(s: Session, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({ host: s.host, port: s.port, secure: s.secure, ...(s.requireTLS && !s.secure ? { doSTARTTLS: true } : {}), auth: { user: s.user ?? s.email, pass: s.password }, logger: false, connectionTimeout: 10_000 });
  await client.connect();
  try { return await fn(client); } finally { await client.logout().catch(() => client.close()); }
}

/** Real mailbox path for each Foxalora folder (e.g. sent → "[Gmail]/Sent Mail"). */
export async function folderPaths(c: ImapFlow): Promise<Partial<Record<FolderKey, string>>> {
  const map: Partial<Record<FolderKey, string>> = { inbox: "INBOX" };
  for (const box of await c.list()) {
    const key = box.specialUse ? SPECIAL[box.specialUse] : undefined;
    // Prefer a real \Archive over Gmail's \All
    if (key && (!map[key] || (key === "archive" && box.specialUse === "\\Archive"))) map[key] = box.path;
  }
  return map;
}

function attachmentNames(node?: MessageStructureObject, out: string[] = []) {
  if (!node) return out;
  const name = node.dispositionParameters?.filename ?? node.parameters?.name;
  if (name && node.disposition !== "inline") out.push(name);
  node.childNodes?.forEach((n) => attachmentNames(n, out));
  return out;
}

const addr = (a?: { name?: string; address?: string }) => (a?.name ? `${a.name} <${a.address ?? ""}>` : a?.address ?? "");

export type ListItem = {
  folder: FolderKey; uid: number; subject: string; sender: string; address: string; preview: string;
  receivedAt: string; unread: boolean; starred: boolean; attachments: string[]; to: string[]; cc: string[];
};

/** Newest `limit` messages in a folder, headers + short preview. */
export async function listFolder(c: ImapFlow, folder: FolderKey, path: string, limit = 40): Promise<ListItem[]> {
  const lock = await c.getMailboxLock(path, { readOnly: true });
  try {
    const exists = typeof c.mailbox === "object" ? c.mailbox.exists : 0;
    if (!exists) return [];
    const items: ListItem[] = [];
    for await (const m of c.fetch(`${Math.max(1, exists - limit + 1)}:*`, { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true, source: { maxLength: 8000 } })) {
      let preview = "";
      try {
        const p = await simpleParser(m.source ?? Buffer.alloc(0), { skipHtmlToText: false, skipImageLinks: true });
        preview = (p.text ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
      } catch { /* partial source may not parse */ }
      const from = m.envelope?.from?.[0];
      items.push({
        folder, uid: m.uid,
        subject: m.envelope?.subject || "(no subject)",
        sender: from?.name || from?.address || "Unknown sender",
        address: from?.address ?? "",
        preview,
        receivedAt: new Date(m.internalDate ?? m.envelope?.date ?? Date.now()).toISOString(),
        unread: !m.flags?.has("\\Seen"),
        starred: Boolean(m.flags?.has("\\Flagged")),
        attachments: attachmentNames(m.bodyStructure),
        to: (m.envelope?.to ?? []).map(addr),
        cc: (m.envelope?.cc ?? []).map(addr),
      });
    }
    return items.reverse();
  } finally { lock.release(); }
}

/** Full message: body, attachments (names), inline images as data URLs. Marks it read. */
export async function readMessage(c: ImapFlow, path: string, uid: number) {
  const lock = await c.getMailboxLock(path);
  try {
    const m = await c.fetchOne(String(uid), { source: true }, { uid: true });
    if (!m || !m.source) return null;
    await c.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    const p = await simpleParser(m.source);
    const inlineImages: Record<string, string> = {};
    const attachments: { name: string; size: number }[] = [];
    for (const a of p.attachments) {
      if (a.contentId && a.related && a.size < 2_000_000) inlineImages[a.contentId.replace(/[<>]/g, "")] = `data:${a.contentType};base64,${a.content.toString("base64")}`;
      else attachments.push({ name: a.filename ?? "attachment", size: a.size });
    }
    const list = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).flatMap((x: { value?: { name?: string; address?: string }[] }) => (x.value ?? []).map(addr));
    return {
      bodyHtml: typeof p.html === "string" ? p.html : undefined,
      bodyText: p.text ?? "",
      to: list(p.to), cc: list(p.cc),
      messageId: p.messageId, references: p.references,
      inlineImages, attachments,
    };
  } finally { lock.release(); }
}

/** Download one attachment by its position in the message. */
export async function readAttachment(c: ImapFlow, path: string, uid: number, index: number) {
  const lock = await c.getMailboxLock(path, { readOnly: true });
  try {
    const m = await c.fetchOne(String(uid), { source: true }, { uid: true });
    if (!m || !m.source) return null;
    const p = await simpleParser(m.source);
    const files = p.attachments.filter((a) => !(a.contentId && a.related));
    return files[index] ?? null;
  } finally { lock.release(); }
}
