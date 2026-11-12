"use client";

import { useEffect, useRef, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuDownload, LuFileText, LuX } from "react-icons/lu";

export type PreviewItem = {
  name: string;
  /** Pretty size, e.g. "2.4 MB". */
  size?: string;
  from?: string;
  /** blob: or data: URL to show; missing means "can't preview". */
  url?: string;
  /** Why there is no url, shown instead of the preview. */
  unavailable?: string;
};

export type PreviewKind = "pdf" | "image" | "other";

export function previewKind(name: string): PreviewKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  return "other";
}

/* ---------- sample files for the demo emails (no mail server yet) ---------- */

const sampleCache = new Map<string, string>();

function ascii(text: string) {
  return text.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/[\\()]/g, (c) => `\\${c}`);
}

/** Build a small, valid one-page PDF so the viewer has something real to show. */
function samplePdf(title: string, from: string) {
  const lines = [
    { size: 22, y: 770, text: title.replace(/\.pdf$/i, "") },
    { size: 11, y: 744, text: `From ${from}` },
    { size: 12, y: 700, text: "This is a sample document generated for the Foxalora demo." },
    { size: 12, y: 682, text: "Once a mail server is connected, the real attachment opens here." },
    { size: 12, y: 646, text: "Overview" },
    { size: 11, y: 626, text: "1. Context and goals" },
    { size: 11, y: 610, text: "2. Directions and rationale" },
    { size: 11, y: 594, text: "3. Next steps and timeline" },
  ];
  const stream = lines.map((l) => `BT /F1 ${l.size} Tf 60 ${l.y} Td (${ascii(l.text)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
}

function sampleImage(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const hues = [[214, 36], [28, 60], [150, 30], [270, 30], [190, 40]][hash % 5];
  const label = name.replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hues[0]},${hues[1]}%,86%)"/><stop offset="1" stop-color="hsl(${hues[0]},${hues[1]}%,70%)"/></linearGradient></defs>`
    + `<rect width="1200" height="800" fill="url(#g)"/><circle cx="930" cy="200" r="70" fill="hsl(45,90%,80%)"/>`
    + `<path d="M0 640 L300 380 L520 560 L760 340 L1200 620 L1200 800 L0 800 Z" fill="hsl(${hues[0]},${hues[1]}%,55%)" opacity=".7"/>`
    + `<path d="M0 720 L380 520 L640 680 L900 540 L1200 700 L1200 800 L0 800 Z" fill="hsl(${hues[0]},${hues[1]}%,45%)" opacity=".8"/>`
    + `<text x="48" y="80" font-family="Arial" font-size="34" fill="#1f2433" opacity=".75">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** URL for a demo attachment (cached), or undefined if the type can't be previewed. */
export function sampleUrlFor(name: string, from = "Foxalora") {
  const kind = previewKind(name);
  if (kind === "other") return undefined;
  const key = `${kind}:${from}:${name}`;
  if (!sampleCache.has(key)) sampleCache.set(key, kind === "pdf" ? samplePdf(name, from) : sampleImage(name));
  return sampleCache.get(key);
}

/* ---------- viewer ---------- */

type Props = {
  items: PreviewItem[];
  startIndex: number;
  onClose: () => void;
  onDownload: (item: PreviewItem) => void;
};

export default function AttachmentPreview({ items, startIndex, onClose, onDownload }: Props) {
  const [index, setIndex] = useState(startIndex);
  const closeRef = useRef<HTMLButtonElement>(null);
  const item = items[index];
  const kind = item ? previewKind(item.name) : "other";
  const many = items.length > 1;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight" && many) setIndex((i) => (i + 1) % items.length);
      else if (event.key === "ArrowLeft" && many) setIndex((i) => (i - 1 + items.length) % items.length);
      else return;
      event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [items.length, many, onClose]);

  if (!item) return null;

  return (
    <div className="preview-backdrop" role="dialog" aria-modal="true" aria-label={`Preview of ${item.name}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="preview-shell">
        <header className="preview-head">
          <span className={`file-badge ${kind === "pdf" ? "pdf" : kind === "image" ? "img" : "file"}`}>{kind === "pdf" ? "PDF" : kind === "image" ? "IMG" : (item.name.split(".").pop() ?? "FILE").slice(0, 3).toUpperCase()}</span>
          <div className="preview-title">
            <strong title={item.name}>{item.name}</strong>
            <small>{[item.size, item.from, many ? `${index + 1} of ${items.length}` : ""].filter(Boolean).join(" · ")}</small>
          </div>
          <button type="button" className="preview-btn" onClick={() => onDownload(item)}><LuDownload /> <span>Download</span></button>
          <button type="button" ref={closeRef} className="preview-icon" aria-label="Close preview" title="Close (Esc)" onClick={onClose}><LuX /></button>
        </header>

        <div className={`preview-stage ${kind}`}>
          {many && <button type="button" className="preview-nav prev" aria-label="Previous file" onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}><LuChevronLeft /></button>}

          {item.url && kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob/data preview
            <img key={item.url} src={item.url} alt={item.name} />
          ) : item.url && kind === "pdf" ? (
            <iframe key={item.url} src={item.url} title={`PDF preview of ${item.name}`} />
          ) : (
            <div className="preview-empty">
              <LuFileText />
              <strong>{kind === "other" ? "No preview for this file type" : "Preview isn’t available"}</strong>
              <p>{item.unavailable ?? "Download the file to open it on your device."}</p>
              <button type="button" className="preview-btn" onClick={() => onDownload(item)}><LuDownload /> Download</button>
            </div>
          )}

          {many && <button type="button" className="preview-nav next" aria-label="Next file" onClick={() => setIndex((i) => (i + 1) % items.length)}><LuChevronRight /></button>}
        </div>

        {many && (
          <div className="preview-strip" role="tablist" aria-label="Files">
            {items.map((it, i) => {
              const k = previewKind(it.name);
              return (
                <button key={`${it.from}-${it.name}-${i}`} type="button" role="tab" aria-selected={i === index} className={i === index ? "active" : ""} title={it.name} onClick={() => setIndex(i)}>
                  {k === "image" && it.url
                    // eslint-disable-next-line @next/next/no-img-element -- thumbnail
                    ? <img src={it.url} alt="" />
                    : <span className={`file-badge ${k === "pdf" ? "pdf" : k === "image" ? "img" : "file"}`}>{k === "pdf" ? "PDF" : k === "image" ? "IMG" : (it.name.split(".").pop() ?? "").slice(0, 3).toUpperCase()}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
