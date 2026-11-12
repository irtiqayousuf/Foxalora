"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LuAlignLeft, LuClock, LuMapPin, LuUsers, LuX } from "react-icons/lu";

export type EventTone = "blue" | "amber" | "green" | "violet" | "rose";
export type QuickEvent = {
  kind: "event" | "task" | "reminder";
  title: string;
  date: string; // yyyy-mm-dd
  start: string; // HH:MM
  end: string;
  allDay: boolean;
  guests: string[];
  place: string;
  description: string;
  tone: EventTone;
};

type Props = {
  /** Where the click happened (viewport coords); the card is placed next to it. */
  anchor?: { x: number; y: number };
  /** "panel" renders inline (e.g. in the calendar side panel) instead of floating. */
  variant?: "float" | "panel";
  initial: { date: string; start: string; end: string };
  onSave: (event: QuickEvent) => void;
  onClose: () => void;
};

const TONES: EventTone[] = ["blue", "green", "amber", "violet", "rose"];
const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export default function QuickEventCard({ anchor = { x: 0, y: 0 }, initial, onSave, onClose, variant = "float" }: Props) {
  const inPanel = variant === "panel";
  const [e, setE] = useState<QuickEvent>({ kind: "event", title: "", ...initial, allDay: false, guests: [], place: "", description: "", tone: "blue" });
  const [guestText, setGuestText] = useState("");
  const [open, setOpen] = useState<{ guests: boolean; place: boolean; description: boolean }>({ guests: false, place: false, description: false });
  const [pos, setPos] = useState({ left: anchor.x + 12, top: anchor.y - 40 });
  const ref = useRef<HTMLFormElement>(null);
  const set = (patch: Partial<QuickEvent>) => setE((cur) => ({ ...cur, ...patch }));

  // Keep the card on screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || inPanel) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 12;
    let left = anchor.x + 14;
    if (left + width > window.innerWidth - pad) left = Math.max(pad, anchor.x - width - 14);
    const top = Math.min(Math.max(pad, anchor.y - 60), window.innerHeight - height - pad);
    setPos({ left, top });
  }, [anchor, open, inPanel]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); };
    const onDown = (ev: MouseEvent) => { if (!inPanel && ref.current && !ref.current.contains(ev.target as Node)) onClose(); };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); window.clearTimeout(t); };
  }, [onClose, inPanel]);

  const addGuest = () => {
    const parts = guestText.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length) set({ guests: [...new Set([...e.guests, ...parts])] });
    setGuestText("");
  };

  const endOptions = TIMES.filter((t) => toMin(t) > toMin(e.start));
  const placeholder = e.kind === "task" ? "Add a task" : e.kind === "reminder" ? "Remind me to…" : "Add title";

  return (
    <form
      ref={ref}
      className={`quick-event ${inPanel ? "in-panel" : ""}`}
      role="dialog"
      aria-label="New event"
      style={inPanel ? undefined : { left: pos.left, top: pos.top }}
      onSubmit={(ev) => {
        ev.preventDefault();
        const pending = guestText.trim() ? [...new Set([...e.guests, ...guestText.split(/[,;\s]+/).filter(Boolean)])] : e.guests;
        onSave({ ...e, title: e.title.trim() || "(No title)", guests: pending });
      }}
    >
      <div className="qe-top">
        <span className="qe-grip" aria-hidden="true" />
        <button type="button" className="row-action" aria-label="Close" onClick={onClose}><LuX /></button>
      </div>

      <input className="qe-title" autoFocus value={e.title} placeholder={placeholder} aria-label="Title" onChange={(ev) => set({ title: ev.target.value })} />

      <div className="qe-kinds" role="radiogroup" aria-label="Type">
        {(["event", "task", "reminder"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={e.kind === k} className={e.kind === k ? "active" : ""} onClick={() => set({ kind: k })}>
            {k === "event" ? "Event" : k === "task" ? "Task" : "Reminder"}
          </button>
        ))}
      </div>

      <div className="qe-row">
        <LuClock className="qe-icon" aria-hidden="true" />
        <div className="qe-when">
          <div className="qe-when-line">
            <input type="date" value={e.date} aria-label="Date" onChange={(ev) => set({ date: ev.target.value })} />
            {!e.allDay && (
              <>
                <select value={e.start} aria-label="Start time" onChange={(ev) => { const start = ev.target.value; const dur = toMin(e.end) - toMin(e.start); const endMin = Math.min(toMin(start) + Math.max(dur, 15), 23 * 60 + 45); set({ start, end: TIMES[endMin / 15] ?? e.end }); }}>
                  {TIMES.map((t) => <option key={t} value={t}>{fmt(t)}</option>)}
                </select>
                {e.kind === "event" && (
                  <>
                    <span className="qe-dash">–</span>
                    <select value={e.end} aria-label="End time" onChange={(ev) => set({ end: ev.target.value })}>
                      {endOptions.map((t) => <option key={t} value={t}>{fmt(t)}</option>)}
                    </select>
                  </>
                )}
              </>
            )}
          </div>
          <label className="qe-allday"><input type="checkbox" checked={e.allDay} onChange={(ev) => set({ allDay: ev.target.checked })} /> All day</label>
        </div>
      </div>

      {e.kind === "event" && (
        <>
          <div className="qe-row">
            <LuUsers className="qe-icon" aria-hidden="true" />
            {open.guests || e.guests.length ? (
              <div className="qe-guests">
                {e.guests.map((g) => (
                  <span key={g} className="recipient-chip">{g}<button type="button" aria-label={`Remove ${g}`} onClick={() => set({ guests: e.guests.filter((x) => x !== g) })}><LuX /></button></span>
                ))}
                <input autoFocus={open.guests} value={guestText} placeholder="Add guests by email" aria-label="Guests" onChange={(ev) => setGuestText(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === ",") { ev.preventDefault(); addGuest(); } }} onBlur={addGuest} />
              </div>
            ) : <button type="button" className="qe-add" onClick={() => setOpen((o) => ({ ...o, guests: true }))}>Add guests</button>}
          </div>
          <div className="qe-row">
            <LuMapPin className="qe-icon" aria-hidden="true" />
            {open.place || e.place ? <input className="qe-field" autoFocus={open.place} value={e.place} placeholder="Add location" aria-label="Location" onChange={(ev) => set({ place: ev.target.value })} />
              : <button type="button" className="qe-add" onClick={() => setOpen((o) => ({ ...o, place: true }))}>Add location</button>}
          </div>
        </>
      )}

      <div className="qe-row">
        <LuAlignLeft className="qe-icon" aria-hidden="true" />
        {open.description || e.description ? <textarea className="qe-field" autoFocus={open.description} rows={3} value={e.description} placeholder="Add description" aria-label="Description" onChange={(ev) => set({ description: ev.target.value })} />
          : <button type="button" className="qe-add" onClick={() => setOpen((o) => ({ ...o, description: true }))}>Add description</button>}
      </div>

      <div className="qe-row qe-colors" role="radiogroup" aria-label="Colour">
        <span className="qe-icon" aria-hidden="true" />
        {TONES.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={e.tone === t} aria-label={t} className={`qe-swatch ${t} ${e.tone === t ? "on" : ""}`} onClick={() => set({ tone: t })} />
        ))}
      </div>

      <div className="qe-foot">
        <button type="button" className="reader-action" onClick={onClose}>Cancel</button>
        <button type="submit" className="reader-action primary">Save</button>
      </div>
    </form>
  );
}
