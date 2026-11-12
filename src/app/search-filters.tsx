"use client";

import { useState } from "react";
import { LuCheck, LuX } from "react-icons/lu";

export type SearchFilters = {
  from: string;
  to: string;
  subject: string;
  words: string;
  dateFrom: string; // yyyy-mm-dd
  dateTo: string;
  hasAttachment: boolean;
  unread: boolean;
  starred: boolean;
  /** Empty = current folder. "all" = every folder except Spam and Trash. Otherwise the chosen folders. */
  folders: string[];
};

export const emptyFilters: SearchFilters = { from: "", to: "", subject: "", words: "", dateFrom: "", dateTo: "", hasAttachment: false, unread: false, starred: false, folders: [] };

export const filtersActive = (f: SearchFilters) =>
  Boolean(f.from.trim() || f.to.trim() || f.subject.trim() || f.words.trim() || f.dateFrom || f.dateTo || f.hasAttachment || f.unread || f.starred || f.folders.length);

/** Human summary chips for the active filters, each with a key to clear it. */
export function filterChips(f: SearchFilters, folderLabel: (id: string) => string): { key: keyof SearchFilters; label: string }[] {
  const chips: { key: keyof SearchFilters; label: string }[] = [];
  if (f.from.trim()) chips.push({ key: "from", label: `From: ${f.from.trim()}` });
  if (f.to.trim()) chips.push({ key: "to", label: `To: ${f.to.trim()}` });
  if (f.subject.trim()) chips.push({ key: "subject", label: `Subject: ${f.subject.trim()}` });
  if (f.words.trim()) chips.push({ key: "words", label: `Contains: ${f.words.trim()}` });
  if (f.dateFrom || f.dateTo) {
    const fmt = (d: string) => new Date(`${d}T00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    chips.push({ key: "dateFrom", label: f.dateFrom && f.dateTo ? `${fmt(f.dateFrom)} – ${fmt(f.dateTo)}` : f.dateFrom ? `After ${fmt(f.dateFrom)}` : `Before ${fmt(f.dateTo)}` });
  }
  if (f.hasAttachment) chips.push({ key: "hasAttachment", label: "Has attachment" });
  if (f.unread) chips.push({ key: "unread", label: "Unread" });
  if (f.starred) chips.push({ key: "starred", label: "Starred" });
  if (f.folders.length) chips.push({ key: "folders", label: f.folders.includes("all") ? "All folders" : f.folders.map(folderLabel).join(", ") });
  return chips;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Props = {
  value: SearchFilters;
  folders: { id: string; label: string }[];
  currentFolderLabel: string;
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
  /** How many emails these filters would find (live preview). */
  countFor?: (filters: SearchFilters) => number;
};

type Range = "any" | "today" | "7" | "30" | "custom";

export default function SearchFilterCard({ value, folders, currentFolderLabel, onApply, onClose, countFor }: Props) {
  const [f, setF] = useState<SearchFilters>(value);
  const set = (patch: Partial<SearchFilters>) => setF((cur) => ({ ...cur, ...patch }));

  const detectRange = (x: SearchFilters): Range => {
    if (!x.dateFrom && !x.dateTo) return "any";
    const today = iso(new Date());
    if (x.dateTo === today) {
      for (const [k, days] of [["today", 0], ["7", 7], ["30", 30]] as const) {
        const s = new Date(); s.setDate(s.getDate() - days);
        if (x.dateFrom === iso(s)) return k;
      }
    }
    return "custom";
  };
  const [range, setRange] = useState<Range>(() => detectRange(value));

  const pickRange = (r: Range) => {
    setRange(r);
    if (r === "any") return set({ dateFrom: "", dateTo: "" });
    if (r === "custom") return;
    const days = r === "today" ? 0 : Number(r);
    const end = new Date();
    const start = new Date(); start.setDate(end.getDate() - days);
    set({ dateFrom: iso(start), dateTo: iso(end) });
  };

  const scope: "here" | "all" | "pick" = !f.folders.length ? "here" : f.folders.includes("all") ? "all" : "pick";
  const toggleFolder = (id: string) => {
    const list = f.folders.filter((x) => x !== "all");
    set({ folders: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };

  const count = countFor?.(f);
  const nothingSet = !filtersActive(f);

  return (
    <form
      className="search-filter-card"
      role="dialog"
      aria-labelledby="sfc-title"
      onMouseDown={(e) => e.stopPropagation()}
      onSubmit={(e) => { e.preventDefault(); onApply(f); }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
    >
      <header className="sfc-head">
        <div>
          <strong id="sfc-title">Find emails</strong>
          <p>Fill in only what you remember. Everything is optional.</p>
        </div>
        <button type="button" className="sfc-x" aria-label="Close" onClick={onClose}><LuX /></button>
      </header>

      <fieldset className="sfc-group">
        <legend>Who</legend>
        <div className="sfc-pair">
          <label className="sfc-field"><span>From</span><input autoFocus value={f.from} placeholder="Name or email" onChange={(e) => set({ from: e.target.value })} /></label>
          <label className="sfc-field"><span>To</span><input value={f.to} placeholder="Includes Cc and Bcc" onChange={(e) => set({ to: e.target.value })} /></label>
        </div>
      </fieldset>

      <fieldset className="sfc-group">
        <legend>What</legend>
        <div className="sfc-pair">
          <label className="sfc-field"><span>Subject has</span><input value={f.subject} placeholder="e.g. invoice" onChange={(e) => set({ subject: e.target.value })} /></label>
          <label className="sfc-field"><span>Message has</span><input value={f.words} placeholder="Words in the email" onChange={(e) => set({ words: e.target.value })} /></label>
        </div>
      </fieldset>

      <fieldset className="sfc-group">
        <legend>When</legend>
        <div className="sfc-chips" role="radiogroup" aria-label="Date">
          {([["any", "Any time"], ["today", "Today"], ["7", "Past week"], ["30", "Past month"], ["custom", "Custom…"]] as const).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={range === k} className={`sfc-chip ${range === k ? "on" : ""}`} onClick={() => pickRange(k)}>{label}</button>
          ))}
        </div>
        {range === "custom" && (
          <div className="sfc-dates">
            <label className="sfc-field"><span>From</span><input type="date" value={f.dateFrom} max={f.dateTo || undefined} onChange={(e) => set({ dateFrom: e.target.value })} /></label>
            <label className="sfc-field"><span>Until</span><input type="date" value={f.dateTo} min={f.dateFrom || undefined} onChange={(e) => set({ dateTo: e.target.value })} /></label>
          </div>
        )}
      </fieldset>

      <fieldset className="sfc-group">
        <legend>Where</legend>
        <div className="sfc-segment" role="radiogroup" aria-label="Folders">
          <button type="button" role="radio" aria-checked={scope === "here"} className={scope === "here" ? "on" : ""} onClick={() => set({ folders: [] })}>{currentFolderLabel}</button>
          <button type="button" role="radio" aria-checked={scope === "all"} className={scope === "all" ? "on" : ""} onClick={() => set({ folders: ["all"] })}>All folders</button>
          <button type="button" role="radio" aria-checked={scope === "pick"} className={scope === "pick" ? "on" : ""} onClick={() => { if (scope !== "pick") set({ folders: folders.slice(0, 1).map((x) => x.id) }); }}>Choose…</button>
        </div>
        {scope === "pick" && (
          <div className="sfc-chips">
            {folders.map((folder) => (
              <button key={folder.id} type="button" aria-pressed={f.folders.includes(folder.id)} className={`sfc-chip ${f.folders.includes(folder.id) ? "on" : ""}`} onClick={() => toggleFolder(folder.id)}>
                {f.folders.includes(folder.id) && <LuCheck />} {folder.label}
              </button>
            ))}
          </div>
        )}
        {scope === "all" && <p className="sfc-note">Spam and Trash are left out.</p>}
      </fieldset>

      <fieldset className="sfc-group">
        <legend>Only show</legend>
        <div className="sfc-chips">
          {([["hasAttachment", "Has attachments"], ["unread", "Unread"], ["starred", "Starred"]] as const).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={f[key]} className={`sfc-chip ${f[key] ? "on" : ""}`} onClick={() => set({ [key]: !f[key] } as Partial<SearchFilters>)}>
              {f[key] && <LuCheck />} {label}
            </button>
          ))}
        </div>
      </fieldset>

      <footer className="sfc-foot">
        <button type="button" className="sfc-clear" disabled={nothingSet} onClick={() => { setF(emptyFilters); setRange("any"); }}>Clear all</button>
        <button type="submit" className="sfc-apply" disabled={count === 0}>
          {count === undefined ? "Search" : count === 0 ? "No matches" : `Show ${count} email${count === 1 ? "" : "s"}`}
        </button>
      </footer>
    </form>
  );
}
