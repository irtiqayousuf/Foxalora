"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LuContrast, LuEyeOff, LuHeadphones, LuHighlighter, LuMinus, LuMoon, LuMousePointer2,
  LuPlus, LuRefreshCw, LuSpace, LuX, LuZoomIn, LuZoomOut, LuArrowUpDown,
} from "react-icons/lu";
import { IoAccessibilityOutline } from "react-icons/io5";
import { useT } from "./i18n";

type A11y = {
  contrast: "none" | "high" | "dark";
  links: boolean;
  textScale: number; // 100 = normal
  lineHeight: boolean;
  spacing: boolean;
  bigCursor: boolean;
  hideImages: boolean;
  reader: boolean;
};

const KEY = "foxalora.accessibility.v1";
const DEFAULTS: A11y = { contrast: "none", links: false, textScale: 100, lineHeight: false, spacing: false, bigCursor: false, hideImages: false, reader: false };
const MIN = 80, MAX = 150, STEP = 10;

function apply(s: A11y) {
  const root = document.documentElement;
  root.classList.toggle("a11y-high-contrast", s.contrast === "high");
  root.classList.toggle("a11y-dark-contrast", s.contrast === "dark");
  root.classList.toggle("a11y-links", s.links);
  root.classList.toggle("a11y-line-height", s.lineHeight);
  root.classList.toggle("a11y-spacing", s.spacing);
  root.classList.toggle("a11y-big-cursor", s.bigCursor);
  root.classList.toggle("a11y-hide-images", s.hideImages);
  document.body.style.zoom = s.textScale === 100 ? "" : String(s.textScale / 100);
}

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 600);
  if (clean) window.speechSynthesis.speak(new SpeechSynthesisUtterance(clean));
}

export default function AccessibilityMenu({ onNotice }: { onNotice?: (t: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<A11y>(DEFAULTS);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Restore saved choices after mount (storage is browser-only, so this can't run during server render)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const raw = localStorage.getItem(KEY); if (raw) { const v = { ...DEFAULTS, ...JSON.parse(raw) }; setS(v); apply(v); } } catch { /* storage unavailable */ }
  }, []);

  const update = (patch: Partial<A11y>) => setS((cur) => {
    const next = { ...cur, ...patch };
    apply(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  });

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  // Screen reader: read aloud whatever the user clicks or tabs to
  useEffect(() => {
    if (!s.reader) { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); return; }
    const read = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const label = el.getAttribute?.("aria-label") || el.closest?.("[aria-label]")?.getAttribute("aria-label");
      speak((el.innerText || "").trim() || label || "");
    };
    document.addEventListener("click", read, true);
    document.addEventListener("focusin", read, true);
    return () => { document.removeEventListener("click", read, true); document.removeEventListener("focusin", read, true); };
  }, [s.reader]);

  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  const active = s.contrast !== "none" || s.links || s.textScale !== 100 || s.lineHeight || s.spacing || s.bigCursor || s.hideImages || s.reader;

  return (
    <div className="a11y-wrap a11y-floating" ref={wrap}>
      <button type="button" className={`a11y-fab ${active ? "a11y-active" : ""}`} aria-label={t("Accessibility tools")} title={t("Accessibility")} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}><IoAccessibilityOutline /></button>
      {open && (
        <div className="a11y-panel" role="dialog" aria-label={t("Accessibility tools")}>
          <div className="a11y-head">
            <strong>{t("Accessibility tools")}</strong>
            <button type="button" className="a11y-close" aria-label="Close" onClick={() => setOpen(false)}><LuX /></button>
          </div>

          <A11ySection collapsedMap={collapsed} onToggle={toggle} id="color" title="Color adjustment">
            <A11yTile on={s.contrast === "high"} icon={<LuContrast />} label="High contrast" onClick={() => update({ contrast: s.contrast === "high" ? "none" : "high" })} />
            <A11yTile on={s.contrast === "dark"} icon={<LuMoon />} label="Dark contrast" onClick={() => update({ contrast: s.contrast === "dark" ? "none" : "dark" })} />
            <A11yTile on={s.links} icon={<LuHighlighter />} label="Highlight links" onClick={() => update({ links: !s.links })} />
          </A11ySection>

          <A11ySection collapsedMap={collapsed} onToggle={toggle} id="text" title="Text size">
            <A11yTile icon={<LuZoomIn />} label="Increase text" disabled={s.textScale >= MAX} onClick={() => update({ textScale: Math.min(MAX, s.textScale + STEP) })} />
            <A11yTile icon={<LuZoomOut />} label="Decrease text" disabled={s.textScale <= MIN} onClick={() => update({ textScale: Math.max(MIN, s.textScale - STEP) })} />
            <A11yTile icon={<LuRefreshCw />} label={s.textScale === 100 ? "Reset" : `Reset (${s.textScale}%)`} onClick={() => update({ textScale: 100 })} />
            <A11yTile on={s.lineHeight} icon={<LuArrowUpDown />} label="Line height" onClick={() => update({ lineHeight: !s.lineHeight })} />
            <A11yTile on={s.spacing} icon={<LuSpace />} label="Text spacing" onClick={() => update({ spacing: !s.spacing })} />
          </A11ySection>

          <A11ySection collapsedMap={collapsed} onToggle={toggle} id="nav" title="Navigation adjustment">
            <A11yTile on={s.bigCursor} icon={<LuMousePointer2 />} label="Big cursor" onClick={() => update({ bigCursor: !s.bigCursor })} />
            <A11yTile on={s.hideImages} icon={<LuEyeOff />} label="Hide images" onClick={() => update({ hideImages: !s.hideImages })} />
            <A11yTile on={s.reader} icon={<LuHeadphones />} label="Screen reader" onClick={() => {
              if (!("speechSynthesis" in window)) return onNotice?.("Reading aloud isn’t supported in this browser");
              const on = !s.reader; update({ reader: on }); if (on) speak("Screen reader on. Click or tab to anything to hear it.");
            }} />
          </A11ySection>

          {active && <button type="button" className="a11y-reset-all" onClick={() => update(DEFAULTS)}>{t("Reset all settings")}</button>}
        </div>
      )}
    </div>
  );
}

function A11ySection({ id, title, children, collapsedMap, onToggle }: { id: string; title: string; children: ReactNode; collapsedMap: Record<string, boolean>; onToggle: (id: string) => void }) {
  const closed = Boolean(collapsedMap[id]);
  const t = useT();
  return (
    <div className="a11y-section">
      <button type="button" className="a11y-section-head" aria-expanded={!closed} onClick={() => onToggle(id)}>
        <span>{t(title)}</span>{closed ? <LuPlus /> : <LuMinus />}
      </button>
      {!closed && <div className="a11y-grid">{children}</div>}
    </div>
  );
}

function A11yTile({ on, icon, label, onClick, disabled }: { on?: boolean; icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  const t = useT();
  return <button type="button" className={`a11y-tile ${on ? "on" : ""}`} aria-pressed={on} disabled={disabled} onClick={onClick}>{icon}<span>{t(label)}</span></button>;
}
