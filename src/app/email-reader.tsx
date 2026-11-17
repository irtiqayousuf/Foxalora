"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IoArchiveOutline,
  IoChevronBackOutline,
  IoChevronDownOutline,
  IoChevronForwardOutline,
  IoChevronUpOutline,
  IoCloseOutline,
  IoDownloadOutline,
  IoMailUnreadOutline,
  IoMailOpenOutline,
  IoOpenOutline,
  IoPrintOutline,
  IoReturnUpBackOutline,
  IoReturnUpForwardOutline,
  IoShieldCheckmarkOutline,
  IoStar,
  IoStarOutline,
  IoTrashOutline,
  IoWarningOutline,
  IoExpandOutline,
  IoAttachOutline,
  IoEllipsisVertical,
} from "react-icons/io5";
import { LuChevronDown, LuChevronUp, LuChevronsDown, LuChevronsUp, LuReplyAll } from "react-icons/lu";
import { inspectLink, sanitizeEmailHtml, type SafeEmailLink } from "./email-html";
import AttachmentPreview, { sampleUrlFor, type PreviewItem } from "./attachment-preview";

export type EmailMessage = {
  id: number;
  sender: string;
  address: string;
  initials: string;
  color: string;
  subject: string;
  preview: string;
  date: string;
  unread: boolean;
  starred: boolean;
  attachments?: string[];
  bodyText?: string;
  bodyHtml?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  receivedAt?: string;
  inlineImages?: Record<string, string>;
  /** Earlier messages in the conversation, oldest first. */
  thread?: ThreadMessage[];
};

export type ThreadMessage = {
  id: number;
  sender: string;
  address: string;
  initials: string;
  color: string;
  receivedAt: string;
  bodyText: string;
  attachments?: string[];
};

type FileFilter = "all" | "docs" | "images" | "other" | "links";

type ReplyMode = "reply" | "reply-all" | "forward";
/** What the reader hands to the composer when you reply or forward. */
export type ReplySeed = {
  mode: ReplyMode;
  to: string[];
  cc: string[];
  subject: string;
  quoted: string;
  attachments: string[];
  replyToId: number;
  key: number;
};

type Props = {
  message: EmailMessage;
  index: number;
  total: number;
  folderLabel: string;
  standalone?: boolean;
  me: { name: string; email: string };
  trustedSenders: string[];
  onTrustSender: (address: string, trusted: boolean) => void;
  onBack: () => void;
  onNavigate: (direction: -1 | 1) => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggleUnread: () => void;
  onToggleStar: () => void;
  /** Real download URL for an attachment (live mailbox); falls back to demo files. */
  fileUrl?: (name: string) => string | undefined;
  onNotice: (text: string) => void;
  /** Renders the composer for a reply / forward; call done() when it closes. */
  renderReply?: (seed: ReplySeed, done: () => void) => React.ReactNode;
};

/* ---------- helpers ---------- */

const emailOf = (value: string) => value.match(/<([^>]+)>/)?.[1]?.trim() ?? value.trim();
const nameOf = (value: string) => value.replace(/<[^>]+>/, "").trim() || emailOf(value);

function fileKind(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { kind: "pdf", label: "PDF" };
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return { kind: "img", label: "IMG" };
  if (["doc", "docx"].includes(ext)) return { kind: "doc", label: "DOC" };
  return { kind: "file", label: (ext.slice(0, 3) || "file").toUpperCase() };
}

/** Stable pretend size for demo attachments. */
function demoSize(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const kb = 80 + (hash % 4200);
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function downloadDemo(name: string, sender: string, real?: string) {
  const sample = real ?? sampleUrlFor(name, sender);
  if (sample) { const a = document.createElement("a"); a.href = sample; a.download = name; document.body.appendChild(a); a.click(); a.remove(); return; }
  const blob = new Blob(
    [`Foxalora demo attachment\n\nFile: ${name}\nFrom: ${sender}\n\nThis prototype has no mail server, so this placeholder stands in for the real file.\n`],
    { type: "application/octet-stream" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function emailDocument(body: string, remoteImages: boolean) {
  const imageSources = remoteImages ? "data: https:" : "data:";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imageSources}; style-src 'unsafe-inline'; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">`
    + `<meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<style>html,body{background:transparent}body{margin:0;padding:4px 2px 12px;color:#2b2d36;font:15px/1.7 Inter,"Segoe UI",system-ui,sans-serif;overflow-wrap:anywhere}`
    + `p{margin:0 0 14px}h1,h2,h3{margin:0 0 12px;color:#111114;font-weight:600;line-height:1.3;letter-spacing:-.2px}h2{font-size:19px}`
    + `blockquote{margin:14px 0;padding:2px 14px;border-left:3px solid #e3e5ec;color:#6f7180}img{max-width:100%;height:auto;border-radius:10px}`
    + `.email-link{color:#1f5fcf;text-decoration:underline;text-underline-offset:2px}.email-link sup{padding-left:3px;color:#6f7180;font-size:10px;text-decoration:none}`
    + `.blocked-image{display:inline-flex;align-items:center;padding:10px 14px;border:1px dashed #d6d8e0;border-radius:12px;color:#6f7180;background:#f7f8fa;font-size:12px}`
    + `table{max-width:100%;border-collapse:collapse}td,th{padding:8px;border:1px solid #eceef3;text-align:left}ul,ol{padding-left:22px}</style></head><body>${body}</body></html>`;
}

/** Plain-text body with URLs turned into checked link buttons. */
function PlainText({ text, onLink }: { text: string; onLink: (link: SafeEmailLink) => void }) {
  const parts: ReactNode[] = [];
  const pattern = /https?:\/\/[^\s<>"')\]]+/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const href = match[0].replace(/[.,;:!?]+$/, "");
    const link = inspectLink(href, href);
    parts.push(link
      ? <button key={match.index} type="button" className="plain-link" onClick={() => onLink(link)}>{href}</button>
      : href);
    last = match.index + href.length;
    pattern.lastIndex = last;
  }
  parts.push(text.slice(last));
  return <div className="plain-email">{parts.map((part, i) => <Fragment key={i}>{part}</Fragment>)}</div>;
}

/* ---------- component ---------- */

export default function EmailReader(props: Props) {
  const { message, index, total, folderLabel, standalone, me, trustedSenders } = props;
  const [detailsFor, setDetailsFor] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number[]>([props.message.id]);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");
  const [nowMs] = useState(() => Date.now());
  const imagesOnce = false;
  const [compose, setCompose] = useState<ReplySeed | null>(null);
  const [link, setLink] = useState<SafeEmailLink | null>(null);
  const [preview, setPreview] = useState<{ items: PreviewItem[]; index: number } | null>(null);
  const composeRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);

  const trusted = trustedSenders.includes(message.address);
  const showImages = imagesOnce || trusted;
  const to = message.to?.length ? message.to : [`${me.name} <${me.email}>`];
  const cc = message.cc ?? [];
  const bcc = message.bcc ?? [];

  const safe = useMemo(
    () => (message.bodyHtml ? sanitizeEmailHtml(message.bodyHtml, showImages, message.inlineImages) : null),
    [message.bodyHtml, message.inlineImages, showImages],
  );
  const plainBody = message.bodyText ?? safe?.text ?? message.preview;
  const isHtml = Boolean(safe);

  // The sandboxed frame can't report its height (no scripts, opaque origin), so estimate it.
  const frameHeight = useMemo(() => {
    if (!safe) return 0;
    const lines = safe.text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 78)), 0);
    const images = (safe.html.match(/<img /g) ?? []).length;
    const blocked = (safe.html.match(/blocked-image/g) ?? []).length;
    return Math.min(2600, Math.max(220, 40 + lines * 24 + images * 300 + blocked * 50));
  }, [safe]);

  const received = message.receivedAt ? new Date(message.receivedAt) : null;
  const fullDate = received
    ? received.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : message.date;

  const summarize = (list: string[]) => {
    const names = [...new Set(list.map((r) => (emailOf(r) === me.email ? "me" : nameOf(r))))];
    return `to ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}`;
  };

  /** Header details for any message in the thread. Earlier messages go between me and the latest sender. */
  const detailsOf = (c: { id: number; address: string }) => {
    if (c.id === message.id) return { to, cc, bcc, summary: summarize([...to, ...cc]) };
    const fromMe = c.address === me.email;
    const t = fromMe ? [`${message.sender} <${message.address}>`] : [`${me.name} <${me.email}>`];
    return { to: t, cc: [] as string[], bcc: [] as string[], summary: summarize(t) };
  };

  const startCompose = (mode: ReplyMode) => {
    const others = [...to, ...cc].filter((r) => emailOf(r) !== me.email && emailOf(r) !== message.address);
    const base = message.subject.replace(/^(re|fwd?):\s*/i, "");
    const forwardHeader = `---------- Forwarded message ----------\nFrom: ${message.sender} <${message.address}>\nDate: ${fullDate}\nSubject: ${message.subject}\nTo: ${to.join(", ")}${cc.length ? `\nCc: ${cc.join(", ")}` : ""}\n\n${plainBody}`;
    setCompose({
      mode,
      to: mode === "forward" ? [] : mode === "reply-all" ? [`${message.sender} <${message.address}>`, ...others.filter((r) => to.includes(r))] : [`${message.sender} <${message.address}>`],
      cc: mode === "reply-all" ? others.filter((r) => cc.includes(r)) : [],
      subject: `${mode === "forward" ? "Fwd" : "Re"}: ${base}`,
      quoted: mode === "forward" ? forwardHeader : `On ${fullDate}, ${message.sender} <${message.address}> wrote:\n\n${plainBody}`,
      attachments: mode === "forward" ? (message.attachments ?? []) : [],
      replyToId: message.id,
      key: Date.now(),
    });
    window.setTimeout(() => composeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  };

  // Keyboard shortcuts (ignored while typing or when a dialog is open) — re-subscribes each render so it always sees fresh props
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (link || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target.closest("input, textarea, select, [contenteditable]")) {
        if (event.key === "Escape") (target as HTMLElement).blur();
        return;
      }
      const key = event.key;
      if (key === "j" || key === "ArrowRight") props.onNavigate(1);
      else if (key === "k" || key === "ArrowLeft") props.onNavigate(-1);
      else if (key === "r") startCompose("reply");
      else if (key === "a") startCompose("reply-all");
      else if (key === "f") startCompose("forward");
      else if (key === "e") props.onArchive();
      else if (key === "#") props.onDelete();
      else if (key === "u") props.onToggleUnread();
      else if (key === "s") props.onToggleStar();
      else if (key === "Escape" && !standalone) { if (compose) setCompose(null); else props.onBack(); }
      else return;
      event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!link) return;
    stayRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setLink(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [link]);

  const attachments = message.attachments ?? [];
  const thread = message.thread ?? [];
  const allFiles = [
    ...thread.flatMap((t) => (t.attachments ?? []).map((name) => ({ name, from: t.sender }))),
    ...attachments.map((name) => ({ name, from: message.sender })),
  ];
  const groupOf = (name: string): Exclude<FileFilter, "all" | "links"> => {
    const kind = fileKind(name).kind;
    return kind === "img" ? "images" : kind === "pdf" || kind === "doc" ? "docs" : "other";
  };
  const fileCounts: Record<FileFilter, number> = { all: allFiles.length, docs: 0, images: 0, other: 0, links: 0 };
  const linkCount = safe?.links.length ?? 0;
  allFiles.forEach((f) => { fileCounts[groupOf(f.name)]++; });
  const shownFiles = fileFilter === "all" || fileFilter === "links" ? allFiles : allFiles.filter((f) => groupOf(f.name) === fileFilter);
  const conversation: ThreadMessage[] = [
    ...thread,
    { id: message.id, sender: message.sender, address: message.address, initials: message.initials, color: message.color, receivedAt: message.receivedAt ?? new Date().toISOString(), bodyText: plainBody, attachments },
  ];
  const allOpen = conversation.every((c) => expanded.includes(c.id));
  const rowStamp = (iso: string) => {
    const d = new Date(iso);
    const days = Math.floor((nowMs - d.getTime()) / 86_400_000);
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (days < 1 && d.toDateString() === new Date().toDateString()) return time;
    const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    return `${date}, ${time} (${days < 1 ? 1 : days} day${days === 1 || days < 1 ? "" : "s"} ago)`;
  };
  const longStamp = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const downloadMessage = (c: ThreadMessage) => {
    const latest = c.id === message.id;
    const lines = [
      `From: ${c.sender} <${c.address}>`,
      `To: ${latest ? to.join(", ") : "—"}`,
      ...(latest && cc.length ? [`Cc: ${cc.join(", ")}`] : []),
      `Subject: ${message.subject}`,
      `Date: ${new Date(c.receivedAt).toUTCString()}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      latest ? plainBody : c.bodyText,
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${message.subject.replace(/[\\/:*?"<>|]+/g, "").slice(0, 80) || "message"}.eml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    props.onNotice("Message downloaded");
  };

  return (
    <div className={`inbox-content reader-wrap ${standalone ? "standalone" : ""}`}>
      <article className="message-panel reader-panel" aria-label={`Email: ${message.subject}`}>
        {/* Toolbar */}
        <div className="reader-bar">
          {standalone ? (
            <button className="reader-pill" onClick={() => window.close()}><IoCloseOutline /> Close window</button>
          ) : (
            <button className="reader-pill" onClick={props.onBack} title="Back (Esc)"><IoChevronBackOutline /> <span>{folderLabel}</span></button>
          )}
          <div className="reader-bar-group">
            <button className="toolbar-icon" title="Archive (e)" aria-label="Archive" onClick={props.onArchive}><IoArchiveOutline /></button>
            <button className="toolbar-icon" title="Delete (#)" aria-label="Delete" onClick={props.onDelete}><IoTrashOutline /></button>
            <button className="toolbar-icon" title={message.unread ? "Mark as read (u)" : "Mark as unread (u)"} aria-label={message.unread ? "Mark as read" : "Mark as unread"} onClick={props.onToggleUnread}>{message.unread ? <IoMailOpenOutline /> : <IoMailUnreadOutline />}</button>
          </div>
          <div className="toolbar-spacer" />
          <div className="reader-bar-group">
            <button className={`toolbar-icon reader-star-tool ${message.starred ? "on" : ""}`} aria-pressed={message.starred} title={message.starred ? "Unstar (s)" : "Star (s)"} aria-label={message.starred ? "Unstar" : "Star"} onClick={props.onToggleStar}>
              {message.starred ? <IoStar /> : <IoStarOutline />}
            </button>
            <button className="toolbar-icon" title="Print" aria-label="Print" onClick={() => window.print()}><IoPrintOutline /></button>
            {!standalone && <button className="toolbar-icon" title="Open in new window" aria-label="Open in new window" onClick={() => window.open(`/?message=${message.id}`, "_blank", "noopener,noreferrer")}><IoExpandOutline /></button>}
          </div>
          {!standalone && total > 0 && (
            <div className="reader-pager">
              <span>{index + 1} of {total}</span>
              <button className="toolbar-icon" title="Previous (k)" aria-label="Previous message" disabled={index <= 0} onClick={() => props.onNavigate(-1)}><IoChevronBackOutline /></button>
              <button className="toolbar-icon" title="Next (j)" aria-label="Next message" disabled={index >= total - 1} onClick={() => props.onNavigate(1)}><IoChevronForwardOutline /></button>
            </div>
          )}
        </div>

        <div className="reader-scroll">
          <div className="reader-layout">
            <div className="reader-main">
            {/* Subject once, then every message in the conversation as a row */}
            <header className="thread-top">
              <h1>{message.subject}</h1>
              <span className="thread-folder">{folderLabel}</span>
              <button
                className="row-action thread-toggle-all"
                title={allOpen ? "Collapse all" : "Expand all"}
                aria-label={allOpen ? "Collapse all" : "Expand all"}
                onClick={() => setExpanded(allOpen ? [message.id] : conversation.map((c) => c.id))}
              >
                {allOpen ? <LuChevronsUp /> : <LuChevronsDown />}
              </button>
            </header>

            <div className="thread-list">
              {conversation.map((c) => {
                const open = expanded.includes(c.id);
                const latest = c.id === message.id;
                const files = c.attachments?.length ?? 0;
                const snippet = (latest ? plainBody : c.bodyText).replace(/\s+/g, " ").trim();
                return (
                  <section key={c.id} className={`thread-row ${open ? "open" : ""}`}>
                    <div className="thread-row-head">
                      <button className="thread-row-toggle" aria-expanded={open} onClick={() => setExpanded((list) => open ? list.filter((x) => x !== c.id) : [...list, c.id])}>
                        <span className={`sender-avatar ${c.color}`}>{c.initials}</span>
                        <span className="thread-row-text">
                          <span className="thread-row-name"><strong>{c.sender}</strong>{open && <span className="reader-from-address">&lt;{c.address}&gt;</span>}</span>
                          {!open && <span className="thread-row-snippet">{snippet}</span>}
                        </span>
                      </button>
                      <div className="thread-row-meta">
                        {files > 0 && <IoAttachOutline className="thread-row-clip" aria-label={`${files} attachment${files === 1 ? "" : "s"}`} />}
                        <time dateTime={c.receivedAt} title={longStamp(c.receivedAt)}>{rowStamp(c.receivedAt)}</time>
                        {open && (
                          <div className="msg-menu">
                            <button className="row-action" aria-label="More actions" aria-haspopup="menu" aria-expanded={menuFor === c.id} onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}><IoEllipsisVertical /></button>
                            {menuFor === c.id && (
                              <div className="msg-menu-list" role="menu" onMouseLeave={() => setMenuFor(null)}>
                                <button role="menuitem" onClick={() => { setMenuFor(null); startCompose("reply"); }}><IoReturnUpBackOutline /> Reply <kbd>r</kbd></button>
                                <button role="menuitem" onClick={() => { setMenuFor(null); startCompose("reply-all"); }}><LuReplyAll /> Reply all <kbd>a</kbd></button>
                                <button role="menuitem" onClick={() => { setMenuFor(null); startCompose("forward"); }}><IoReturnUpForwardOutline /> Forward <kbd>f</kbd></button>
                                <hr />
                                <button role="menuitem" onClick={() => { setMenuFor(null); downloadMessage(c); }}><IoDownloadOutline /> Download message</button>
                                <button role="menuitem" onClick={() => { setMenuFor(null); window.print(); }}><IoPrintOutline /> Print</button>
                                {!standalone && <button role="menuitem" onClick={() => { setMenuFor(null); window.open(`/?message=${message.id}`, "_blank", "noopener,noreferrer"); }}><IoOpenOutline /> Open in new window</button>}
                                {latest && <button role="menuitem" onClick={() => { setMenuFor(null); props.onToggleUnread(); }}><IoMailUnreadOutline /> {message.unread ? "Mark as read" : "Mark as unread"}</button>}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          className="row-action thread-row-chevron"
                          aria-label={open ? "Collapse message" : "Expand message"}
                          title={open ? "Collapse" : "Expand"}
                          onClick={() => setExpanded((list) => open ? list.filter((x) => x !== c.id) : [...list, c.id])}
                        >
                          {open ? <LuChevronUp /> : <LuChevronDown />}
                        </button>
                      </div>
                    </div>

                    {open && (
                      <div className="thread-row-body">
                        {(() => {
                          const info = detailsOf(c);
                          const shown = detailsFor === c.id;
                          return (
                            <div className="details-pop-wrap">
                              <button className="reader-recipients" aria-expanded={shown} aria-haspopup="dialog" onClick={() => setDetailsFor(shown ? null : c.id)}>
                                {info.summary} {shown ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
                              </button>
                              {shown && (
                                <dl className="reader-details details-pop" role="dialog" aria-label="Message details" onMouseLeave={() => setDetailsFor(null)}>
                                  <div><dt>From</dt><dd>{c.sender} &lt;{c.address}&gt;</dd></div>
                                  <div><dt>To</dt><dd>{info.to.join(", ")}</dd></div>
                                  {info.cc.length > 0 && <div><dt>Cc</dt><dd>{info.cc.join(", ")}</dd></div>}
                                  {info.bcc.length > 0 && <div><dt>Bcc</dt><dd>{info.bcc.join(", ")}</dd></div>}
                                  <div><dt>Date</dt><dd>{longStamp(c.receivedAt)}</dd></div>
                                  <div><dt>Security</dt><dd className="reader-secure"><IoShieldCheckmarkOutline /> {latest && safe ? "Shown in a locked-down preview. Scripts, forms and tracking are blocked." : "Plain text email, shown safely"}</dd></div>
                                </dl>
                              )}
                            </div>
                          );
                        })()}
                        <div className="reader-mail-body">
                          {latest && isHtml && safe ? (
                            <iframe
                              className="reader-frame"
                              title={`Email from ${message.sender}`}
                              sandbox=""
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              style={{ height: frameHeight }}
                              srcDoc={emailDocument(safe.html, showImages)}
                            />
                          ) : (
                            <PlainText text={latest ? plainBody : c.bodyText} onLink={setLink} />
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            {/* Reply actions / composer */}
            {!compose ? (
              <div className="reader-actions-row">
                <button className="reader-action primary" onClick={() => startCompose("reply")}><IoReturnUpBackOutline /> Reply</button>
                <button className="reader-action" onClick={() => startCompose("reply-all")}><LuReplyAll /> Reply all</button>
                <button className="reader-action" onClick={() => startCompose("forward")}><IoReturnUpForwardOutline /> Forward</button>
              </div>
            ) : (
              <div ref={composeRef} className="reader-composer-slot">{props.renderReply?.(compose, () => setCompose(null))}</div>
            )}
            </div>

            {/* Side panel: every file in the conversation, then links */}
            <aside className="reader-side" aria-label="Attachments and links">
              <section className="side-card">
                <h2>
                  {fileFilter === "links" ? "Links" : "Attachments"} <span>{fileFilter === "links" ? linkCount : allFiles.length}</span>
                  {fileFilter !== "links" && shownFiles.length > 1 && (
                    <button className="reader-download-all" onClick={() => { shownFiles.forEach((f, i) => window.setTimeout(() => downloadDemo(f.name, f.from, props.fileUrl?.(f.name)), i * 250)); props.onNotice(`Downloading ${shownFiles.length} files`); }}>
                      <IoDownloadOutline /> All
                    </button>
                  )}
                </h2>
                <div className="side-filters" role="tablist" aria-label="Files and links">
                  {(["all", "docs", "images", "other", "links"] as FileFilter[]).map((f) => (
                    <button key={f} role="tab" aria-selected={fileFilter === f} className={fileFilter === f ? "active" : ""} onClick={() => setFileFilter(f)}>
                      {f === "all" ? "All" : f === "docs" ? "Documents" : f === "images" ? "Images" : f === "other" ? "Other" : "Links"} <span>{f === "links" ? linkCount : fileCounts[f]}</span>
                    </button>
                  ))}
                </div>
                {fileFilter === "links" ? (
                  safe && safe.links.length > 0 ? (
                    <div className="reader-links">
                      {safe.links.map((l) => (
                        <button key={l.id} className={`reader-link ${l.suspicious ? "warn" : ""}`} onClick={() => setLink(l)}>
                          <span className="reader-link-num">{l.id}</span>
                          <span className="reader-link-text"><strong>{l.label}</strong><small>{l.host}</small></span>
                          {l.suspicious ? <span className="reader-link-flag"><IoWarningOutline /> Check</span> : <IoOpenOutline />}
                        </button>
                      ))}
                    </div>
                  ) : <p className="side-empty">No links in this email</p>
                ) : shownFiles.length > 0 ? (
                  <div className="side-files">
                    {shownFiles.map((f) => {
                      const { kind, label } = fileKind(f.name);
                      return (
                        <div key={`${f.from}-${f.name}`} className="reader-file">
                          <button type="button" className="reader-file-open" title={`Preview ${f.name}`} onClick={() => setPreview({ index: shownFiles.indexOf(f), items: shownFiles.map((x) => ({ name: x.name, from: x.from, size: demoSize(x.name), url: props.fileUrl?.(x.name) ?? sampleUrlFor(x.name, x.from) })) })}>
                            <span className={`file-badge ${kind}`}>{label}</span>
                            <span className="reader-file-text"><strong title={f.name}>{f.name}</strong><small>{demoSize(f.name)} · {f.from}</small></span>
                          </button>
                          <button className="row-action" title={`Download ${f.name}`} aria-label={`Download ${f.name}`} onClick={() => downloadDemo(f.name, f.from, props.fileUrl?.(f.name))}><IoDownloadOutline /></button>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="side-empty">{fileFilter === "docs" ? "No documents" : fileFilter === "images" ? "No images" : fileFilter === "other" ? "No other files" : "No files in this conversation"}</p>}
              </section>
            </aside>
          </div>
        </div>
      </article>

      {/* Print-only version: plain, safe text with full headers */}
      <div className="print-sheet" aria-hidden="true">
        <h1>{message.subject}</h1>
        <p><b>From:</b> {message.sender} &lt;{message.address}&gt;</p>
        <p><b>To:</b> {to.join(", ")}</p>
        {cc.length > 0 && <p><b>Cc:</b> {cc.join(", ")}</p>}
        {bcc.length > 0 && <p><b>Bcc:</b> {bcc.join(", ")}</p>}
        <p><b>Date:</b> {fullDate}</p>
        {attachments.length > 0 && <p><b>Attachments:</b> {attachments.join(", ")}</p>}
        <hr />
        <pre>{plainBody}</pre>
      </div>

      {preview && (
        <AttachmentPreview
          items={preview.items}
          startIndex={preview.index}
          onClose={() => setPreview(null)}
          onDownload={(item) => downloadDemo(item.name, item.from ?? message.sender, props.fileUrl?.(item.name))}
        />
      )}

      {/* External link check */}
      {link && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setLink(null); }}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="link-title" aria-describedby="link-desc">
            <div className={`modal-icon ${link.suspicious ? "" : "neutral"}`}>{link.suspicious ? <IoWarningOutline /> : <IoOpenOutline />}</div>
            <h2 id="link-title">{link.suspicious ? "This link looks unusual" : "Open this link?"}</h2>
            <div id="link-desc">
              <p>{link.suspicious ? "Only continue if you trust the sender and expected this link." : "You’re about to leave Foxalora for another website."}</p>
              {link.reasons.length > 0 && <ul className="link-reasons">{link.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              <div className="link-destination"><span>Goes to</span><strong>{link.host}</strong><small>{link.href}</small></div>
            </div>
            <div className="modal-actions">
              <button ref={stayRef} className="modal-cancel" onClick={() => setLink(null)}>Stay here</button>
              <a className={link.suspicious ? "modal-danger" : "modal-primary"} href={link.href} target="_blank" rel="noopener noreferrer" onClick={() => setLink(null)}>
                {link.suspicious ? "Open anyway" : "Open link"} <IoOpenOutline />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
