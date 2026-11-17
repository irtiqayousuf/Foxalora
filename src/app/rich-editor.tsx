"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuAlignCenter, LuAlignLeft, LuAlignRight, LuBold, LuEraser, LuImage, LuItalic, LuLink, LuList, LuListOrdered,
  LuPaperclip, LuQuote, LuSmile, LuStrikethrough, LuType, LuUnderline, LuX,
} from "react-icons/lu";
import { sanitizeOutgoingHtml } from "./email-html";

type Props = {
  /** Initial HTML; the editor is uncontrolled after mount (remount with a new key to reset). */
  initialHtml: string;
  onChange: (html: string) => void;
  plain: boolean;
  plainText: string;
  onPlainTextChange: (text: string) => void;
  onTogglePlain: () => void;
  onAttach?: () => void;
  ariaLabel?: string;
  onNotice: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Render the formatting toolbar into this element (e.g. the composer footer). */
  toolbarTarget?: HTMLElement | null;
};

const EMOJIS = ["😀", "😊", "😂", "🙂", "😉", "😍", "🤔", "😅", "🙏", "👍", "👏", "🎉", "❤️", "🔥", "✨", "✅", "👀", "💡", "📎", "📅", "☕", "🌿", "🚀", "🙌"];
const MAX_INLINE_IMAGE = 3 * 1024 * 1024;

type Cmd = "bold" | "italic" | "underline" | "strikeThrough" | "insertUnorderedList" | "insertOrderedList" | "justifyLeft" | "justifyCenter" | "justifyRight";

export default function RichEditor(props: Props) {
  const { plain } = props;
  const editorRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [activeCmds, setActiveCmds] = useState<Record<string, boolean>>({});
  const [pop, setPop] = useState<"emoji" | "link" | null>(null);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [empty, setEmpty] = useState(!props.initialHtml);

  // Mount: load initial HTML once.
  useEffect(() => {
    if (editorRef.current && !plain) {
      editorRef.current.innerHTML = sanitizeOutgoingHtml(props.initialHtml);
      if (props.autoFocus) placeCaretAtStart(editorRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uncontrolled editor: only on mount / mode switch
  }, [plain]);

  // Reflect bold/italic/… state of the current selection in the toolbar.
  useEffect(() => {
    const update = () => {
      const el = editorRef.current;
      const sel = document.getSelection();
      if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return;
      const cmds: Cmd[] = ["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList", "justifyCenter", "justifyRight"];
      const next: Record<string, boolean> = {};
      for (const c of cmds) { try { next[c] = document.queryCommandState(c); } catch { next[c] = false; } }
      setActiveCmds(next);
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  function emit() {
    const el = editorRef.current;
    if (!el) return;
    setEmpty(!el.textContent?.trim() && !el.querySelector("img"));
    props.onChange(el.innerHTML);
  }

  function saveSelection() {
    const sel = document.getSelection();
    if (sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  }
  function restoreSelection() {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = document.getSelection();
    if (savedRange.current && sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
    else placeCaretAtEnd(el);
  }

  function exec(command: string, value?: string) {
    restoreSelection();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(command, false, value);
    saveSelection();
    emit();
  }

  function toggleBlock(tag: "blockquote" | "h2") {
    restoreSelection();
    const current = document.queryCommandValue("formatBlock").toLowerCase();
    document.execCommand("formatBlock", false, current === tag ? "p" : tag);
    emit();
  }

  function insertLink() {
    let url = linkUrl.trim();
    if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = url.includes("@") && !url.includes("/") ? `mailto:${url}` : `https://${url}`;
    const ok = /^mailto:[^\s"<>]+@[^\s"<>]+$/i.test(url) || (() => { try { return ["http:", "https:"].includes(new URL(url).protocol); } catch { return false; } })();
    if (!ok) { setLinkError("Enter a web address or email"); return; }
    restoreSelection();
    const sel = document.getSelection();
    const hasSelection = sel && !sel.isCollapsed;
    if (hasSelection && !linkText.trim()) document.execCommand("createLink", false, url);
    else {
      const label = (linkText.trim() || url.replace(/^mailto:/, "")).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
      document.execCommand("insertHTML", false, `<a href="${url.replace(/"/g, "%22")}">${label}</a>&nbsp;`);
    }
    setPop(null); setLinkText(""); setLinkUrl(""); setLinkError("");
    emit();
  }

  function insertImages(files: FileList | null) {
    if (!files?.length) return;
    Array.from(files).forEach((file) => {
      if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) return props.onNotice(`${file.name} isn’t a supported image`);
      if (file.size > MAX_INLINE_IMAGE) return props.onNotice(`${file.name} is over 3 MB. Attach it instead.`);
      const reader = new FileReader();
      reader.onload = () => {
        restoreSelection();
        const alt = file.name.replace(/\.[^.]+$/, "").replace(/[&<>"']/g, "");
        document.execCommand("insertHTML", false, `<img src="${reader.result}" alt="${alt}"><br>`);
        emit();
      };
      reader.readAsDataURL(file);
    });
  }

  const btn = ({ cmd, label, icon, onClick }: { cmd?: Cmd; label: string; icon: React.ReactNode; onClick?: () => void }) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={cmd ? Boolean(activeCmds[cmd]) : undefined}
      className={cmd && activeCmds[cmd] ? "on" : ""}
      disabled={plain && cmd !== undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick ?? (() => cmd && exec(cmd))}
    >{icon}</button>
  );

  const toolbarEl = (
      <div className="rich-toolbar" role="toolbar" aria-label="Formatting">
        <div className="rich-group">
          {btn({ cmd: "bold", label: "Bold (Ctrl+B)", icon: <LuBold /> })}
          {btn({ cmd: "italic", label: "Italic (Ctrl+I)", icon: <LuItalic /> })}
          {btn({ cmd: "underline", label: "Underline (Ctrl+U)", icon: <LuUnderline /> })}
          {btn({ cmd: "strikeThrough", label: "Strikethrough", icon: <LuStrikethrough /> })}
        </div>
        <span className="rich-sep" />
        <div className="rich-group">
          {btn({ cmd: "insertUnorderedList", label: "Bulleted list", icon: <LuList /> })}
          {btn({ cmd: "insertOrderedList", label: "Numbered list", icon: <LuListOrdered /> })}
          <button type="button" title="Quote" aria-label="Quote" onMouseDown={(e) => e.preventDefault()} onClick={() => !plain && toggleBlock("blockquote")}><LuQuote /></button>
          <button type="button" title="Heading" aria-label="Heading" onMouseDown={(e) => e.preventDefault()} onClick={() => !plain && toggleBlock("h2")}><LuType /></button>
        </div>
        <span className="rich-sep" />
        <div className="rich-group">
          {btn({ cmd: "justifyLeft", label: "Align left", icon: <LuAlignLeft /> })}
          {btn({ cmd: "justifyCenter", label: "Align center", icon: <LuAlignCenter /> })}
          {btn({ cmd: "justifyRight", label: "Align right", icon: <LuAlignRight /> })}
        </div>
        <span className="rich-sep" />
        <div className="rich-group">
          <button type="button" title="Insert link (Ctrl+K)" aria-label="Insert link (Ctrl+K)" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (plain) return; saveSelection(); setLinkText(document.getSelection()?.toString() ?? ""); setLinkUrl(""); setLinkError(""); setPop(pop === "link" ? null : "link"); }}><LuLink /></button>
          <button type="button" title="Insert image" aria-label="Insert image" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (plain) return; saveSelection(); imageRef.current?.click(); }}><LuImage /></button>
          <button type="button" title="Emoji" aria-label="Emoji" onMouseDown={(e) => e.preventDefault()} onClick={() => { saveSelection(); setPop(pop === "emoji" ? null : "emoji"); }}><LuSmile /></button>
          {props.onAttach && <button type="button" title="Attach files" aria-label="Attach files" onMouseDown={(e) => e.preventDefault()} onClick={props.onAttach}><LuPaperclip /></button>}
          <button type="button" title="Clear formatting" aria-label="Clear formatting" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (plain) return; exec("removeFormat"); exec("formatBlock", "p"); }}><LuEraser /></button>
        </div>

        {pop === "emoji" && (
          <div className="compose-pop emoji-pop" role="dialog" aria-label="Pick an emoji">
            {EMOJIS.map((emoji) => (
              <button key={emoji} type="button" aria-label={`Insert ${emoji}`} onMouseDown={(e) => e.preventDefault()} onClick={() => {
                setPop(null);
                if (plain) props.onPlainTextChange(props.plainText + emoji);
                else exec("insertText", emoji);
              }}>{emoji}</button>
            ))}
          </div>
        )}
        {pop === "link" && (
          <div className="compose-pop link-pop" role="dialog" aria-label="Insert link">
            <label>Text<input value={linkText} placeholder="Text to show (optional)" onChange={(e) => setLinkText(e.target.value)} /></label>
            <label>Link<input autoFocus value={linkUrl} placeholder="https://example.com or name@example.com" onChange={(e) => { setLinkUrl(e.target.value); setLinkError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertLink(); } if (e.key === "Escape") setPop(null); }} /></label>
            {linkError && <span className="link-pop-error" role="alert">{linkError}</span>}
            <div className="link-pop-actions">
              <button type="button" className="link-pop-cancel" onClick={() => setPop(null)}><LuX /> Cancel</button>
              <button type="button" className="link-pop-insert" onClick={insertLink}>Insert</button>
            </div>
          </div>
        )}
      </div>
  );

  return (
    <div className="rich-editor">
      {plain ? (
        <textarea
          className="rich-plain"
          aria-label="Message (plain text)"
          placeholder={props.placeholder}
          value={props.plainText}
          autoFocus={props.autoFocus}
          onChange={(e) => props.onPlainTextChange(e.target.value)}
        />
      ) : (
        <div className="rich-surface-wrap">
          {empty && <span className="rich-placeholder" aria-hidden="true">{props.placeholder}</span>}
          <div
            ref={editorRef}
            className="rich-surface"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={props.ariaLabel ?? "Message"}
            onInput={emit}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onBlur={saveSelection}
            onKeyDown={(e) => {
              if (!(e.metaKey || e.ctrlKey)) return;
              const k = e.key.toLowerCase();
              if (k === "b" || k === "i" || k === "u") { e.preventDefault(); exec(k === "b" ? "bold" : k === "i" ? "italic" : "underline"); }
              if (k === "k") { e.preventDefault(); saveSelection(); setLinkText(document.getSelection()?.toString() ?? ""); setPop("link"); }
            }}
            onPaste={(e) => {
              // Never paste raw HTML from other sites: clean it first.
              e.preventDefault();
              const html = e.clipboardData.getData("text/html");
              const text = e.clipboardData.getData("text/plain");
              const clean = html ? sanitizeOutgoingHtml(html) : text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`).replace(/\n/g, "<br>");
              document.execCommand("insertHTML", false, clean);
              emit();
            }}
            onDrop={(e) => {
              const images = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
              if (images.length && e.altKey) { e.preventDefault(); e.stopPropagation(); const dt = new DataTransfer(); images.forEach((f) => dt.items.add(f)); insertImages(dt.files); }
            }}
          />
        </div>
      )}

      {props.toolbarTarget ? createPortal(toolbarEl, props.toolbarTarget) : toolbarEl}
      <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={(e) => { insertImages(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

function placeCaretAtEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = document.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
function placeCaretAtStart(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.setStart(el, 0);
  range.collapse(true);
  const sel = document.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
