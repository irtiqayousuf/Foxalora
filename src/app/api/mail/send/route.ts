import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { folderPaths, withImap } from "@/lib/mail";
import { getSession, type Session } from "@/lib/session";
import { APP_CONFIG } from "@/app/settings-store";

/** Outgoing (SMTP) server that pairs with the IMAP server the user signed in to. */
function smtpFor(s: Session): { host: string; port: number; secure: boolean } {
  if (process.env.SMTP_HOST) return { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 465), secure: (process.env.SMTP_SECURE ?? "true") !== "false" };
  const known: Record<string, string> = {
    "imap.gmail.com": "smtp.gmail.com",
    "outlook.office365.com": "smtp.office365.com",
    "imap.zoho.com": "smtp.zoho.com",
    "imap.mail.yahoo.com": "smtp.mail.yahoo.com",
    "imap.mail.me.com": "smtp.mail.me.com",
    "imap.aol.com": "smtp.aol.com",
    "imap.ethereal.email": "smtp.ethereal.email",
  };
  const host = known[s.host] ?? s.host.replace(/^imap\./, "smtp.");
  const starttls = ["smtp.office365.com", "smtp.mail.me.com", "smtp.ethereal.email"].includes(host);
  return { host, port: starttls ? 587 : 465, secure: !starttls };
}

// Gmail and Microsoft 365 save sent mail to Sent themselves.
const AUTO_SAVES_SENT = new Set(["smtp.gmail.com", "smtp.office365.com"]);
const list = (v: FormDataEntryValue | null) => String(v ?? "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

/** POST /api/mail/send (multipart form): to, cc, bcc, subject, html, text, inReplyTo, references, files[] */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const form = await request.formData();
  const to = list(form.get("to")), cc = list(form.get("cc")), bcc = list(form.get("bcc"));
  if (!to.length && !cc.length && !bcc.length) return Response.json({ error: "Add at least one recipient." }, { status: 400 });

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const { uploadLimitMb, requireTls } = APP_CONFIG;
  if (files.reduce((t, f) => t + f.size, 0) > uploadLimitMb * 1024 * 1024) return Response.json({ error: `Attachments can be ${uploadLimitMb} MB in total.` }, { status: 400 });
  const attachments = await Promise.all(files.map(async (f) => ({ filename: f.name, content: Buffer.from(await f.arrayBuffer()), contentType: f.type || undefined })));

  const html = String(form.get("html") ?? "");
  const message = {
    from: { name: String(form.get("fromName") ?? ""), address: session.email },
    to, cc, bcc,
    subject: String(form.get("subject") ?? ""),
    text: String(form.get("text") ?? ""),
    html: html || undefined,
    inReplyTo: String(form.get("inReplyTo") ?? "") || undefined,
    references: String(form.get("references") ?? "") || undefined,
    attachments,
  };

  const smtp = smtpFor(session);
  const transport = nodemailer.createTransport({ ...smtp, requireTLS: requireTls && !smtp.secure, auth: { user: session.user ?? session.email, pass: session.password }, connectionTimeout: 15_000 });
  try {
    // Build once so the exact same message is sent and saved to Sent.
    const raw = await new MailComposer(message).compile().build();
    await transport.sendMail({ envelope: { from: session.email, to: [...to, ...cc, ...bcc] }, raw });
    if (!AUTO_SAVES_SENT.has(smtp.host)) {
      try {
        await withImap(session, async (c) => {
          const sent = (await folderPaths(c)).sent;
          if (sent) await c.append(sent, raw, ["\\Seen"]);
        });
      } catch (e) { console.error("[foxalora] save to Sent:", (e as Error).message); }
    }
    return Response.json({ ok: true });
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; message?: string };
    console.error(`[foxalora] SMTP ${smtp.host}:${smtp.port}:`, err.code, err.responseCode, err.message);
    const msg = err.code === "EAUTH" ? "Your mail server didn’t accept the password for sending."
      : err.responseCode && err.responseCode >= 500 ? `Your mail server refused this email: ${err.message?.replace(/\s+/g, " ").slice(0, 160)}`
      : `Couldn’t reach your outgoing mail server (${smtp.host}). Your email wasn’t sent.`;
    return Response.json({ error: msg }, { status: 502 });
  } finally { transport.close(); }
}
