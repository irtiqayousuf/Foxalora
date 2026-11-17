"use client";

import { useEffect, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuStickyNote, LuX } from "react-icons/lu";

type DayItem = { id: number; kind: "task" | "note"; text: string; done: boolean };
const ITEMS_KEY = "foxalora.day-items.v1";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export default function TodayRail() {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [selected, setSelected] = useState<Date | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [items, setItems] = useState<Record<string, DayItem[]>>({});
  const [adding, setAdding] = useState<"task" | "note" | null>(null);
  const [draft, setDraft] = useState("");

  // Tasks and notes are kept per day in this browser.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { const raw = localStorage.getItem(ITEMS_KEY); if (raw) setItems(JSON.parse(raw)); } catch { /* storage unavailable */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, []);
  if (!now) return <aside className="today-rail" aria-label="Today" />;

  const today = startOfDay(now);
  const picked = selected ?? today;
  const isToday = sameDay(picked, today);
  const dayDiff = Math.round((picked.getTime() - today.getTime()) / 86_400_000);
  const relative = isToday ? "Today" : dayDiff === 1 ? "Tomorrow" : dayDiff === -1 ? "Yesterday" : picked.toLocaleDateString(undefined, { weekday: "long" });

  const month = now.toLocaleDateString(undefined, { month: "short" });
  const weekday = now.toLocaleDateString(undefined, { weekday: "short" });
  const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const fullDate = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Month grid (Monday first, always 6 weeks)
  const view = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const lead = (view.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => new Date(view.getFullYear(), view.getMonth(), 1 - lead + i));
  const monthLabel = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const pick = (date: Date) => {
    setSelected(date);
    if (date.getMonth() !== view.getMonth() || date.getFullYear() !== view.getFullYear()) {
      setMonthOffset((date.getFullYear() - today.getFullYear()) * 12 + date.getMonth() - today.getMonth());
    }
  };
  const goToday = () => { setSelected(today); setMonthOffset(0); };

  const dayKey = picked.toDateString();
  const dayItems = items[dayKey] ?? [];
  const updateDay = (fn: (list: DayItem[]) => DayItem[]) => setItems((all) => {
    const next = { ...all, [dayKey]: fn(all[dayKey] ?? []) };
    try { localStorage.setItem(ITEMS_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  });
  const addItem = () => {
    const text = draft.trim();
    if (!text || !adding) return;
    updateDay((list) => [...list, { id: Date.now(), kind: adding, text, done: false }]);
    setDraft("");
    setAdding(null);
  };

  return (
    <aside className={`today-rail ${open ? "open" : ""}`} aria-label="Today">
      {!open ? (
        <div className="today-rail-strip">
          <button className="rail-toggle" aria-label="Expand today panel" aria-expanded={false} onClick={() => { goToday(); setOpen(true); }}><LuChevronLeft /></button>
          <button className="rail-date" title={fullDate} onClick={() => { goToday(); setOpen(true); }}>
            <span className="rail-month">{month}</span>
            <strong>{now.getDate()}</strong>
            <span className="rail-weekday">{weekday}</span>
          </button>
        </div>
      ) : (
        <div className="today-rail-panel">
          <div className="rail-panel-top">
            <div className="rail-datecard">
              <div className="rail-datecard-day">
                <span className="rail-month">{picked.toLocaleDateString(undefined, { month: "short" })}</span>
                <strong>{picked.getDate()}</strong>
              </div>
              <div className="rail-datecard-info">
                <span className="rail-time-big">{isToday ? time : relative}</span>
                <span className="rail-weekday">{picked.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
            </div>
            <button className="rail-toggle" aria-label="Collapse today panel" aria-expanded onClick={() => setOpen(false)}><LuChevronRight /></button>
          </div>

          {/* Calendar picker */}
          <section className="rail-picker" aria-label="Pick a date">
            <div className="rail-picker-head">
              <button className="rail-step" aria-label="Previous month" title="Previous month" onClick={() => setMonthOffset((o) => o - 1)}><LuChevronLeft /></button>
              <strong aria-live="polite">{monthLabel}</strong>
              <button className="rail-step" aria-label="Next month" title="Next month" onClick={() => setMonthOffset((o) => o + 1)}><LuChevronRight /></button>
            </div>
            <div className="rail-picker-grid" role="grid" aria-label={monthLabel}>
              {WEEKDAYS.map((d) => <span key={d} className="rail-picker-dow" role="columnheader">{d}</span>)}
              {cells.map((date) => {
                const inMonth = date.getMonth() === view.getMonth();
                const isSel = sameDay(date, picked);
                const isNow = sameDay(date, today);
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    role="gridcell"
                    aria-selected={isSel}
                    aria-current={isNow ? "date" : undefined}
                    aria-label={date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    className={`rail-picker-day ${inMonth ? "" : "outside"} ${isNow ? "today" : ""} ${isSel ? "selected" : ""}`}
                    onClick={() => pick(date)}
                  >
                    {date.getDate()}
                    {(items[date.toDateString()]?.length ?? 0) > 0 && <span className="rail-picker-dot" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </section>

          {adding && (
            <form className="rail-add-item" onSubmit={(e) => { e.preventDefault(); addItem(); }}>
              {adding === "task"
                ? <input autoFocus value={draft} placeholder={`Task for ${relative.toLowerCase() === "today" ? "today" : picked.toLocaleDateString(undefined, { month: "short", day: "numeric" })}…`} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setAdding(null); }} aria-label="New task" />
                : <textarea autoFocus value={draft} rows={3} placeholder="Write a note…" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setAdding(null); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addItem(); } }} aria-label="New note" />}
              <div>
                <button type="button" className="rail-today-btn" onClick={() => setAdding(null)}>Cancel</button>
                <button type="submit" className="rail-today-btn rail-save" disabled={!draft.trim()}>Save</button>
              </div>
            </form>
          )}

          {dayItems.length > 0 && (
            <ul className="rail-items" aria-label={`Tasks and notes for ${picked.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`}>
              {dayItems.map((item) => (
                <li key={item.id} className={`rail-item ${item.kind} ${item.done ? "done" : ""}`}>
                  {item.kind === "task"
                    ? <input type="checkbox" checked={item.done} aria-label={`Mark “${item.text}” ${item.done ? "not done" : "done"}`} onChange={() => updateDay((list) => list.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)))} />
                    : <LuStickyNote className="rail-item-icon" aria-hidden="true" />}
                  <span>{item.text}</span>
                  <button aria-label={`Delete ${item.kind}`} onClick={() => updateDay((list) => list.filter((x) => x.id !== item.id))}><LuX /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
