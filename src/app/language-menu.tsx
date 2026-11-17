"use client";

import { useEffect, useRef, useState } from "react";
import { LuCheck, LuLanguages } from "react-icons/lu";
import { useT } from "./i18n";
const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "ar", label: "العربية" },
  { id: "ur", label: "اردو" },
];

export const RTL_LANGUAGES = new Set(["ar", "ur"]);

export default function LanguageMenu({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  return (
    <div className="help-wrap" ref={wrap}>
      <button type="button" className="icon-button" aria-label={t("Language")} title={t("Language")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}><LuLanguages /></button>
      {open && (
        <div className="help-menu lang-menu" role="menu">
          <div className="help-menu-head"><strong>{t("Language")}</strong><small>{t("Arabic and Urdu switch the layout to right-to-left.")}</small></div>
          {LANGUAGES.map((l) => (
            <button key={l.id} type="button" role="menuitemradio" aria-checked={l.id === value} className={`help-item lang-item ${l.id === value ? "on" : ""}`} onClick={() => { onChange(l.id); setOpen(false); }}>
              <span className="lang-code">{l.id.toUpperCase()}</span>
              <span className="help-item-text" dir="auto"><strong>{l.label}</strong></span>
              {RTL_LANGUAGES.has(l.id) && <small className="lang-rtl">RTL</small>}
              {l.id === value && <LuCheck className="lang-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
