"use client";

import { useEffect, useRef, useState } from "react";
import { LuCalendar, LuChevronDown, LuChevronLeft, LuChevronRight, LuSend, LuX } from "react-icons/lu";

const fmtShort = (d: Date) => d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const at = (base: Date, addDays: number, h: number, m = 0) => { const d = new Date(base); d.setDate(d.getDate() + addDays); d.setHours(h, m, 0, 0); return d; };

function presets(now = new Date()) {
  const list: { label: string; date: Date }[] = [{ label: "Tomorrow morning", date: at(now, 1, 8) }];
  if (now.getHours() < 13) list.push({ label: "This afternoon", date: at(now, 0, 13) });
  const toMonday = ((8 - now.getDay()) % 7) || 7;
  list.push({ label: "Monday morning", date: at(now, toMonday, 8) });
  return list;
}

function timeZoneName() {
  try { return Intl.DateTimeFormat(undefined, { timeZoneName: "long" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? ""; } catch { return ""; }
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function SendButton({ disabled, onSend, onSchedule }: { disabled?: boolean; onSend: () => void; onSchedule: (when: Date) => void }) {
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const down = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [menu]);

  return (
    <div className="send-split" ref={wrap}>
      <button type="button" className="send-split-main" onClick={onSend} disabled={disabled}><LuSend /> Send</button>
      <button type="button" className="send-split-arrow" aria-label="More send options" aria-haspopup="menu" aria-expanded={menu} disabled={disabled} onClick={() => setMenu((v) => !v)}><LuChevronDown /></button>
      {menu && (
        <div className="schedule-menu" role="menu">
          <div className="schedule-menu-head">
            <div><strong>Schedule send</strong><small>{timeZoneName()}</small></div>
            <button type="button" className="row-action" aria-label="Close" onClick={() => setMenu(false)}><LuX /></button>
          </div>
          {presets().map((p) => (
            <button key={p.label} type="button" role="menuitem" className="schedule-option" onClick={() => { setMenu(false); onSchedule(p.date); }}>
              <span>{p.label}</span><span className="schedule-when">{fmtShort(p.date)}</span>
            </button>
          ))}
          <div className="schedule-sep" />
          <button type="button" role="menuitem" className="schedule-option schedule-pick" onClick={() => { setMenu(false); setPicker(true); }}><LuCalendar /> Pick date &amp; time</button>
        </div>
      )}
      {picker && <DateTimePicker onCancel={() => setPicker(false)} onConfirm={(d) => { setPicker(false); onSchedule(d); }} />}
    </div>
  );
}

function DateTimePicker({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (d: Date) => void }) {
  const now = new Date();
  const initial = new Date(now.getTime() + 60 * 60 * 1000);
  initial.setMinutes(initial.getMinutes() < 30 ? 30 : 60, 0, 0);
  const [day, setDay] = useState(new Date(initial.getFullYear(), initial.getMonth(), initial.getDate()));
  const [view, setView] = useState(new Date(day.getFullYear(), day.getMonth(), 1));
  const [time, setTime] = useState(`${pad(initial.getHours())}:${pad(initial.getMinutes())}`);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(view); start.setDate(1 - view.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const [h, m] = time.split(":").map(Number);
  const when = new Date(day); when.setHours(h || 0, m || 0, 0, 0);
  const valid = when.getTime() > now.getTime();

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal schedule-picker" role="dialog" aria-modal="true" aria-labelledby="pick-title">
        <h2 id="pick-title">Pick date &amp; time</h2>
        <div className="schedule-picker-body">
          <div className="sp-cal">
            <div className="sp-cal-head">
              <span>{view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
              <button type="button" className="row-action" aria-label="Previous month" disabled={view <= new Date(today.getFullYear(), today.getMonth(), 1)} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><LuChevronLeft /></button>
              <button type="button" className="row-action" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><LuChevronRight /></button>
            </div>
            <div className="sp-cal-grid">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="sp-cal-dow">{d}</span>)}
              {cells.map((d) => {
                const past = d < today;
                const other = d.getMonth() !== view.getMonth();
                const sel = d.getTime() === day.getTime();
                return (
                  <button key={d.toISOString()} type="button" disabled={past} className={`sp-cal-day ${other ? "other" : ""} ${sel ? "selected" : ""} $`} onClick={() => { setDay(d); if (other) setView(new Date(d.getFullYear(), d.getMonth(), 1)); }}>{d.getDate()}</button>
                );
              })}
            </div>
          </div>
          <div className="schedule-fields">
            <input type="text" readOnly aria-label="Date" value={day.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} />
            <input type="time" aria-label="Time" value={time} onChange={(e) => setTime(e.target.value)} />
            {!valid && <small className="schedule-error">Choose a time in the future.</small>}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className="modal-primary" disabled={!valid} onClick={() => onConfirm(when)}>Schedule send</button>
        </div>
      </div>
    </div>
  );
}
