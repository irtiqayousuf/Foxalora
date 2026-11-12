"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LuArrowLeft, LuChevronDown, LuMaximize2, LuMinimize2, LuMinus, LuPaperclip, LuPencil, LuSend, LuTrash2, LuX } from "react-icons/lu";
import RecipientInput, { isValidEmail, type Contact } from "./recipient-input";
import RichEditor from "./rich-editor";
import { htmlToPlainText, plainTextToHtml, sanitizeOutgoingHtml } from "./email-html";
import AttachmentPreview, { type PreviewItem } from "./attachment-preview";

export type Identity = { id: string; name: string; email: string; signature: string };
export type DraftAttachment = { id: number; name: string; size: number; type: string };
export type ComposeMode = "new" | "reply" | "reply-all" | "forward";
export type Draft = {
  id: string;
  mode: ComposeMode;
  identityId: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html: string;
  text: string;
  plain: boolean;
  signature: boolean;
  attachments: DraftAttachment[];
  /** Original message, quoted below replies / forwards (plain text). */
  quoted?: string;
  replyToId?: number;
  updatedAt: number;
};

export type SentEmail = Draft & { finalHtml: string; finalText: string; from: Identity };

type Props = {
  draft: Draft;
  identities: Identity[];
  contacts: Contact[];
  variant: "dock" | "inline" | "page";
  onSave: (draft: Draft) => void;
  onSend: (email: SentEmail) => void;
  onDiscard: (id: string) => void;
  onClose: (draft: Draft | null) => void;
  onEditSignature: (identityId: string, signature: string) => void;
  onNotice: (text: string) => void;
};

const MAX_TOTAL = 25 * 1024 * 1024;
const AUTOSAVE_MS = 1200;

export const newDraftId = () => `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function kindOf(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { kind: "pdf", label: "PDF" };
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return { kind: "img", label: "IMG" };
  if (["doc", "docx"].includes(ext)) return { kind: "doc", label: "DOC" };
  return { kind: "file", label: (ext.slice(0, 3) || "file").toUpperCase() };
}

const hasContent = (d: Draft) => Boolean(d.to.length || d.cc.length || d.bcc.length || d.subject.trim() || (d.plain ? d.text.trim() : htmlToPlainText(d.html).trim() || /<img/i.test(d.html)) || d.attachments.length);

export default function Composer(props: Props) {
  const { identities, contacts, variant } = props;
  const [d, setD] = useState<Draft>(props.draft);
  const [showCc, setShowCc] = useState(props.draft.cc.length > 0);
  const [showBcc, setShowBcc] = useState(props.draft.bcc.length > 0);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(props.draft.updatedAt && hasContent(props.draft) ? props.draft.updatedAt : null);
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState<"normal" | "min" | "max">("normal");
  const [showQuote, setShowQuote] = useState(props.draft.mode === "forward");
  const [editingSig, setEditingSig] = useState(false);
  const [sigText, setSigText] = useState("");
  const [check, setCheck] = useState<null | { title: string; body: string; confirm: string }>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Local previews of files attached in this session (not persisted). */
  const [fileUrls, setFileUrls] = useState<Record<number, string>>({});
  const [preview, setPreview] = useState<number | null>(null);
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null);
  const isPage = props.variant === "page";
  const latest = useRef({ d, dirty });

  const identity = identities.find((i) => i.id === d.identityId) ?? identities[0];
  const totalSize = d.attachments.reduce((sum, a) => sum + a.size, 0);

  const update = (patch: Partial<Draft>) => { setD((cur) => ({ ...cur, ...patch })); setDirty(true); };

  useEffect(() => { latest.current = { d, dirty }; }, [d, dirty]);

  // COMP-012: save drafts automatically, shortly after typing stops.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      if (!hasContent(d)) { setDirty(false); return; }
      const saved = { ...d, updatedAt: Date.now() };
      props.onSave(saved);
      setSavedAt(saved.updatedAt);
      setDirty(false);
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on draft changes only
  }, [d, dirty]);

  // COMP-016: warn before leaving the page while changes aren't saved yet.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current.dirty && hasContent(latest.current.d)) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Moving elsewhere in the app never loses work: flush pending changes on unmount.
  useEffect(() => () => {
    const { d: last, dirty: pending } = latest.current;
    if (pending && hasContent(last)) props.onSave({ ...last, updatedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  function addFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    let total = totalSize;
    const accepted: DraftAttachment[] = [];
    const rejected: string[] = [];
    const urls: Record<number, string> = {};
    files.forEach((f, i) => {
      if (total + f.size > MAX_TOTAL) { rejected.push(f.name); return; }
      total += f.size;
      const id = Date.now() + i;
      accepted.push({ id, name: f.name, size: f.size, type: f.type });
      urls[id] = URL.createObjectURL(f);
    });
    if (accepted.length) { update({ attachments: [...d.attachments, ...accepted] }); setFileUrls((m) => ({ ...m, ...urls })); }
    if (rejected.length) props.onNotice(`${rejected.length === 1 ? rejected[0] : `${rejected.length} files`} would go over the 25 MB limit`);
  }

  function togglePlain() {
    if (d.plain) {
      update({ plain: false, html: plainTextToHtml(d.text) });
    } else {
      const hasFormatting = /<(b|strong|i|em|u|s|ul|ol|a|img|blockquote|h2)\b|text-align/i.test(d.html);
      if (hasFormatting && !window.confirm("Switch to plain text? Formatting, links and inline images will be removed.")) return;
      update({ plain: true, text: htmlToPlainText(d.html) });
    }
    setEditorKey((k) => k + 1);
  }

  const signatureHtml = d.signature && identity.signature ? `<div class="signature" style="color:#6f7180">--<br>${identity.signature.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`).replace(/\n/g, "<br>")}</div>` : "";
  const quotedHtml = d.quoted ? `<blockquote style="margin:16px 0 0;padding-left:12px;border-left:3px solid #e3e5ec;color:#6f7180">${d.quoted.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`).replace(/\n/g, "<br>")}</blockquote>` : "";

  function trySend(skip: string[] = []) {
    const all = [...d.to, ...d.cc, ...d.bcc];
    if (!all.length) return props.onNotice("Add at least one recipient");
    const bad = all.find((r) => !isValidEmail(r));
    if (bad) return props.onNotice(`Check this address: ${bad}`);
    const bodyText = d.plain ? d.text : htmlToPlainText(d.html);
    if (!skip.includes("subject") && !d.subject.trim()) {
      return setCheck({ title: "Send without a subject?", body: "A short subject helps people find this email later.", confirm: "subject" });
    }
    if (!skip.includes("attach") && !d.attachments.length && /\b(attached|attachment|attaching|enclosed)\b/i.test(bodyText)) {
      return setCheck({ title: "Did you mean to attach a file?", body: "Your message mentions an attachment, but nothing is attached.", confirm: "attach" });
    }
    const bodyHtml = d.plain ? plainTextToHtml(d.text) : sanitizeOutgoingHtml(d.html);
    const finalHtml = `${bodyHtml}${signatureHtml}${quotedHtml}`;
    const finalText = [bodyText, d.signature && identity.signature ? `--\n${identity.signature}` : "", d.quoted ? d.quoted.split("\n").map((l) => `> ${l}`).join("\n") : ""].filter(Boolean).join("\n\n");
    props.onSend({ ...d, updatedAt: Date.now(), finalHtml, finalText, from: identity });
  }

  function close() {
    if (hasContent(d)) {
      const saved = { ...d, updatedAt: Date.now() };
      props.onSave(saved);
      setDirty(false);
      latest.current = { d: saved, dirty: false };
      props.onClose(saved);
      props.onNotice("Draft saved");
    } else {
      latest.current = { d, dirty: false };
      props.onClose(null);
    }
  }

  const status = dirty ? "Saving…" : savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "";
  const title = d.mode === "new" ? (d.subject.trim() || "New message") : d.mode === "forward" ? "Forward" : d.mode === "reply-all" ? "Reply all" : "Reply";
  const placeholder = d.mode === "new" ? "Write your message…" : "Write your reply…";

  const shellClass = variant === "dock" ? `composer composer-dock size-${size}` : variant === "page" ? "composer composer-page message-panel" : "composer composer-inline";
  const recipientsCount = useMemo(() => d.to.length + d.cc.length + d.bcc.length, [d.to, d.cc, d.bcc]);

  return (
    <section
      className={`${shellClass} ${dragging ? "dragging" : ""}`}
      aria-label={title}
      onDragEnter={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); } }}
    >
      <header className="composer-head" onDoubleClick={() => variant === "dock" && setSize(size === "min" ? "normal" : "min")}>
        {variant === "page" && <button type="button" className="reader-pill" onClick={close} title="Save draft and go back"><LuArrowLeft /> <span>Back</span></button>}
        <strong>{title}</strong>
        <span className="composer-status" aria-live="polite">{status}</span>
        {variant === "dock" && (
          <>
            <button type="button" className="row-action" title={size === "min" ? "Restore" : "Minimize"} aria-label={size === "min" ? "Restore" : "Minimize"} onClick={() => setSize(size === "min" ? "normal" : "min")}><LuMinus /></button>
            <button type="button" className="row-action" title={size === "max" ? "Exit full screen" : "Full screen"} aria-label={size === "max" ? "Exit full screen" : "Full screen"} onClick={() => setSize(size === "max" ? "normal" : "max")}>{size === "max" ? <LuMinimize2 /> : <LuMaximize2 />}</button>
          </>
        )}
        <button type="button" className="row-action" title="Save & close" aria-label="Save and close" onClick={close}><LuX /></button>
      </header>

      {size !== "min" && (
        <>
        <div className={`composer-body ${isPage ? "composer-split" : ""}`}>
          <div className="composer-main">
            {/* From (identity) */}
            {identities.length > 1 && (
              <label className="composer-row composer-from">
                <span className="recipient-label">From</span>
                <span className="composer-select">
                  <select value={d.identityId} onChange={(e) => update({ identityId: e.target.value })} aria-label="Send from">
                    {identities.map((i) => <option key={i.id} value={i.id}>{i.name} &lt;{i.email}&gt;</option>)}
                  </select>
                  <LuChevronDown aria-hidden="true" />
                </span>
              </label>
            )}

            <RecipientInput
              label="To"
              values={d.to}
              onChange={(to) => update({ to })}
              contacts={contacts}
              autoFocus={d.mode === "new" || d.mode === "forward"}
              trailing={(
                <span className="recipient-toggles">
                  {!showCc && <button type="button" onClick={() => setShowCc(true)}>Cc</button>}
                  {!showBcc && <button type="button" onClick={() => setShowBcc(true)}>Bcc</button>}
                </span>
              )}
            />
            {showCc && <RecipientInput label="Cc" values={d.cc} onChange={(cc) => update({ cc })} contacts={contacts} />}
            {showBcc && <RecipientInput label="Bcc" values={d.bcc} onChange={(bcc) => update({ bcc })} contacts={contacts} />}

            <label className="composer-row">
              <span className="recipient-label">Subject</span>
              <input className="composer-subject" value={d.subject} placeholder="What’s this about?" onChange={(e) => update({ subject: e.target.value })} aria-label="Subject" />
            </label>

            <div className="composer-editor-card">
            <RichEditor
              key={editorKey}
              initialHtml={d.html}
              onChange={(html) => update({ html })}
              plain={d.plain}
              plainText={d.text}
              onPlainTextChange={(text) => update({ text })}
              onTogglePlain={togglePlain}
              onAttach={() => fileRef.current?.click()}
              onNotice={props.onNotice}
              placeholder={placeholder}
              autoFocus={d.mode === "reply" || d.mode === "reply-all"}
              toolbarTarget={toolbarHost}
            />
              <div className="composer-attach" aria-label="Attachments">
                <div className="composer-attach-head">
                  <span>Attachments</span>
                  <span className="side-count">{d.attachments.length}</span>
                  {d.attachments.length > 0 && <span className="composer-attach-total">{formatBytes(totalSize)} of 25 MB</span>}
                </div>
                {d.attachments.length > 0 && (
                  <div className="attach-cards">
                    {d.attachments.map((a) => {
                      const { kind, label } = kindOf(a.name);
                      return (
                        <div key={a.id} className="attach-card" title={`${a.name} · ${formatBytes(a.size)}`}>
                          <button type="button" className="attach-card-open" aria-label={`Preview ${a.name}`} onClick={() => setPreview(d.attachments.indexOf(a))}>
                            <span className={`file-badge ${kind}`}>{label}</span>
                            <span className="attach-card-text"><strong>{a.name}</strong><small>{formatBytes(a.size)}</small></span>
                          </button>
                          <button type="button" aria-label={`Remove ${a.name}`} onClick={() => update({ attachments: d.attachments.filter((x) => x.id !== a.id) })}><LuX /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Signature */}
            <div className="composer-signature">
              {editingSig ? (
                <div className="signature-edit">
                  <textarea value={sigText} onChange={(e) => setSigText(e.target.value)} aria-label={`Signature for ${identity.email}`} rows={3} />
                  <div>
                    <button type="button" className="reader-action" onClick={() => setEditingSig(false)}>Cancel</button>
                    <button type="button" className="reader-action outline-strong" onClick={() => { props.onEditSignature(identity.id, sigText.trim()); setEditingSig(false); update({ signature: Boolean(sigText.trim()) }); }}>Save signature</button>
                  </div>
                </div>
              ) : (
                <>
                  {d.signature && identity.signature ? <pre className="signature-preview">--{"\n"}{identity.signature}</pre> : <span className="signature-off">No signature</span>}
                  <div className="signature-actions">
                    {identity.signature && <button type="button" onClick={() => update({ signature: !d.signature })}>{d.signature ? "Remove" : "Add signature"}</button>}
                    <button type="button" onClick={() => { setSigText(identity.signature); setEditingSig(true); }}><LuPencil /> {identity.signature ? "Edit" : "Create signature"}</button>
                  </div>
                </>
              )}
            </div>

            {/* Quoted original */}
            {d.quoted && (
              <div className="composer-quote">
                <button type="button" className="reader-quote-toggle" aria-expanded={showQuote} onClick={() => setShowQuote((v) => !v)}>{showQuote ? "Hide" : "Show"} {d.mode === "forward" ? "forwarded message" : "original message"}</button>
                {showQuote && <pre className="reader-quote">{d.quoted}</pre>}
              </div>
            )}
          </div>


        </div>

        <footer className="composer-foot">
          <div className="composer-toolbar-host" ref={setToolbarHost} />
          <button type="button" className="reader-action primary" onClick={() => trySend()} disabled={!recipientsCount}><LuSend /> Send</button>
          <button type="button" className="row-action composer-discard" title="Discard draft" aria-label="Discard draft" onClick={() => (hasContent(d) ? setConfirmDiscard(true) : props.onDiscard(d.id))}><LuTrash2 /></button>
        </footer>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </>
      )}

      {preview !== null && (
        <AttachmentPreview
          items={d.attachments.map((a): PreviewItem => ({ name: a.name, size: formatBytes(a.size), url: fileUrls[a.id], unavailable: fileUrls[a.id] ? undefined : "This file was attached in an earlier session. Attach it again to preview it." }))}
          startIndex={preview}
          onClose={() => setPreview(null)}
          onDownload={(item) => { const url = fileUrls[d.attachments.find((a) => a.name === item.name)?.id ?? -1]; if (!url) return props.onNotice("Attach the file again to download it"); const link = document.createElement("a"); link.href = url; link.download = item.name; document.body.appendChild(link); link.click(); link.remove(); }}
        />
      )}
      {dragging && <div className="composer-drop" aria-hidden="true"><LuPaperclip /> Drop files to attach</div>}

      {check && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setCheck(null); }}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="send-check-title">
            <h2 id="send-check-title">{check.title}</h2>
            <p>{check.body}</p>
            <div className="modal-actions">
              <button className="modal-cancel" autoFocus onClick={() => setCheck(null)}>Go back</button>
              <button className="modal-primary" onClick={() => { const skip = check.confirm; setCheck(null); trySend([skip, ...(skip === "attach" ? ["subject"] : [])]); }}>Send anyway</button>
            </div>
          </div>
        </div>
      )}
      {confirmDiscard && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDiscard(false); }}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="discard-title">
            <div className="modal-icon"><LuTrash2 /></div>
            <h2 id="discard-title">Discard this draft?</h2>
            <p>Your message and its attachments will be deleted. This can’t be undone.</p>
            <div className="modal-actions">
              <button className="modal-cancel" autoFocus onClick={() => setConfirmDiscard(false)}>Keep editing</button>
              <button className="modal-danger" onClick={() => { latest.current = { d, dirty: false }; setConfirmDiscard(false); props.onDiscard(d.id); }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
