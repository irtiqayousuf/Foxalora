"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LuAlignLeft, LuCheck, LuChevronDown, LuChevronLeft, LuChevronRight, LuClock, LuMapPin, LuPlus, LuTrash2, LuUsers, LuX } from "react-icons/lu";
import MiniCalendar from "./mini-calendar";
import QuickEventCard, { type QuickEvent } from "./quick-event";

const USER_EVENTS_KEY = "foxalora.events.v1";
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Current time rounded up to the next half hour, plus a one-hour end (capped at 11:45 PM). */
function nowSlot() {
  const n = new Date();
  const startMin = Math.min(Math.ceil((n.getHours() * 60 + n.getMinutes()) / 30) * 30, 23 * 60);
  const endMin = Math.min(startMin + 60, 23 * 60 + 45);
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return { start: hhmm(startMin), end: hhmm(endMin) };
}

type CalEvent = { id: number; day: number; monthOffset: number; title: string; start: string; end: string; tone: "blue" | "amber" | "green" | "violet" | "rose"; place?: string; /** Absolute date (yyyy-mm-dd) for events you create. */ date?: string; kind?: "event" | "task" | "reminder"; guests?: string[]; description?: string; allDay?: boolean };

/** Sample events relative to the current month so the demo always looks alive. */
const SAMPLE: CalEvent[] = [
  { id: 1, monthOffset: 0, day: 3, title: "Team planning", start: "09:30", end: "10:30", tone: "blue", place: "Studio" },
  { id: 2, monthOffset: 0, day: 9, title: "Design review", start: "14:00", end: "15:00", tone: "violet", place: "Room 2" },
  { id: 3, monthOffset: 0, day: 12, title: "Coffee with Sofia", start: "11:00", end: "11:45", tone: "amber", place: "Little Coffee" },
  { id: 4, monthOffset: 0, day: 12, title: "Brand directions", start: "16:00", end: "17:00", tone: "green" },
  { id: 5, monthOffset: 0, day: 18, title: "Studio catch-up", start: "10:00", end: "10:30", tone: "blue" },
  { id: 6, monthOffset: 0, day: 19, title: "Studio visit · Marcus", start: "14:30", end: "15:30", tone: "green", place: "Fieldnotes studio" },
  { id: 7, monthOffset: 0, day: 24, title: "Project deadline", start: "17:00", end: "17:00", tone: "rose" },
  { id: 8, monthOffset: 0, day: 27, title: "Portfolio shortlist", start: "13:00", end: "14:00", tone: "violet" },
  { id: 9, monthOffset: 1, day: 2, title: "Quarterly review", start: "10:00", end: "12:00", tone: "blue" },
  { id: 10, monthOffset: -1, day: 28, title: "Copenhagen trip", start: "08:00", end: "18:00", tone: "amber" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type CalView = "day" | "4days" | "week" | "month" | "year";
const VIEWS: { id: CalView; label: string; key: string }[] = [
  { id: "day", label: "Day", key: "D" },
  { id: "4days", label: "4 days", key: "X" },
  { id: "week", label: "Week", key: "W" },
  { id: "month", label: "Month", key: "M" },
  { id: "year", label: "Year", key: "Y" },
];
const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_PX = 56;
const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

type Props = { onNotice: (text: string) => void };

export default function CalendarView({ onNotice }: Props) {
  const today = useMemo(() => new Date(), []);
  const [calView, setCalView] = useState<CalView>("month");
  const [viewMenu, setViewMenu] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [userEvents, setUserEvents] = useState<CalEvent[]>([]);
  /** The event whose details are shown in the side panel. */
  const [openEventId, setOpenEventId] = useState<number | null>(null);
  const [dayPop, setDayPop] = useState<null | { date: Date; x: number; y: number }>(null);
  /** New event form shown in the side panel (from the New event button). */
  const [panelNew, setPanelNew] = useState<null | { date: string; start: string; end: string; key: number }>(null);
  const dayPopRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dayPop) return;
    const onDown = (e: MouseEvent) => { if (!dayPopRef.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest(".cal-year-day")) setDayPop(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDayPop(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [dayPop]);
  useEffect(() => {
    const t = window.setTimeout(() => { try { const raw = localStorage.getItem(USER_EVENTS_KEY); if (raw) setUserEvents(JSON.parse(raw)); } catch { /* storage unavailable */ } }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const saveEvent = (q: QuickEvent) => {
    const ev: CalEvent = { id: Date.now(), day: 0, monthOffset: 0, date: q.date, title: q.title, start: q.allDay ? "00:00" : q.start, end: q.allDay ? "00:00" : q.kind === "event" ? q.end : q.start, tone: q.tone, place: q.place || undefined, kind: q.kind, guests: q.guests, description: q.description || undefined, allDay: q.allDay };
    setUserEvents((list) => {
      const next = [...list, ev];
      try { localStorage.setItem(USER_EVENTS_KEY, JSON.stringify(next)); } catch { /* storage full */ }
      return next;
    });
    const [y, m, d] = q.date.split("-").map(Number);
    setSelected(new Date(y, m - 1, d));
    onNotice(`${q.kind === "task" ? "Task" : q.kind === "reminder" ? "Reminder" : "Event"} saved`);
  };
  /** Selecting a day shows that day in the side panel (closes the form or event details). */
  const showDay = (day: Date) => { setPanelNew(null); setOpenEventId(null); setSelected(day); };
  const openEvent = (e: CalEvent, day: Date) => { setPanelNew(null); setSelected(day); setOpenEventId(e.id); };
  const deleteEvent = (id: number) => {
    setUserEvents((list) => {
      const next = list.filter((x) => x.id !== id);
      try { localStorage.setItem(USER_EVENTS_KEY, JSON.stringify(next)); } catch { /* storage full */ }
      return next;
    });
    setOpenEventId(null);
    onNotice("Event deleted");
  };
  /** Open the new-event form in the side panel for a time slot (clicked inside a day column). */
  const openSlot = (ev: React.MouseEvent<HTMLDivElement>, day: Date) => {
    if ((ev.target as HTMLElement).closest(".cal-tg-event")) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const mins = START_HOUR * 60 + Math.floor(((ev.clientY - rect.top) / HOUR_PX) * 2) * 30;
    const clamp = Math.min(Math.max(mins, 0), 23 * 60);
    const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
    setSelected(day);
    setOpenEventId(null);
    setPanelNew({ date: isoDate(day), start: hhmm(clamp), end: hhmm(Math.min(clamp + 60, 23 * 60 + 45)), key: ev.timeStamp });
  };

  const view = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const offset = (view.getFullYear() - today.getFullYear()) * 12 + view.getMonth() - today.getMonth();
  const setOffset = (fn: (o: number) => number) => {
    const next = fn(offset);
    setSelected(new Date(today.getFullYear(), today.getMonth() + next, 1));
  };
  const weekStart = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - ((selected.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));
  const fourDays = Array.from({ length: 4 }, (_, i) => new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + i));
  const gridDays = calView === "week" ? weekDays : calView === "4days" ? fourDays : [selected];
  const rangeLabel = (a: Date, b: Date) => `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${b.getMonth() === a.getMonth() ? b.getDate() : b.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${b.getFullYear()}`;
  const step = (dir: -1 | 1) => {
    if (calView === "year") setSelected(new Date(selected.getFullYear() + dir, selected.getMonth(), 1));
    else if (calView === "month") setSelected(new Date(selected.getFullYear(), selected.getMonth() + dir, 1));
    else setSelected(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + dir * (calView === "week" ? 7 : calView === "4days" ? 4 : 1)));
  };
  const monthLabel = calView === "year"
    ? String(selected.getFullYear())
    : calView === "month"
      ? view.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : calView === "week"
        ? rangeLabel(weekDays[0], weekDays[6])
        : calView === "4days"
          ? rangeLabel(fourDays[0], fourDays[3])
          : selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const stepLabel = calView === "year" ? "year" : calView === "month" ? "month" : calView === "week" ? "week" : calView === "4days" ? "4 days" : "day";

  // View menu: close on outside click; D / W / M shortcuts switch views
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (viewMenu && !viewMenuRef.current?.contains(e.target as Node)) setViewMenu(false); };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const v = VIEWS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (v) { setCalView(v.id); setViewMenu(false); }
      else if (e.key === "Escape") setViewMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [viewMenu]);
  const lead = (view.getDay() + 6) % 7; // Monday first
  const gridStart = new Date(view.getFullYear(), view.getMonth(), 1 - lead);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));

  const eventsOn = (date: Date) => [...SAMPLE, ...userEvents].filter((e) => {
    if (e.date) return e.date === isoDate(date);
    const d = new Date(today.getFullYear(), today.getMonth() + e.monthOffset, e.day);
    return d.toDateString() === date.toDateString();
  }).sort((a, b) => a.start.localeCompare(b.start));

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const fmtTime = (t: string) => { const [h, m] = t.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };
  const selectedEvents = eventsOn(selected);
  const yearDays = calView === "year"
    ? Array.from({ length: 366 }, (_, i) => new Date(selected.getFullYear(), 0, 1 + i)).filter((d) => d.getFullYear() === selected.getFullYear())
    : [];
  const rangeDays = calView === "year" ? yearDays : calView === "month" ? cells.filter((d) => d.getMonth() === view.getMonth()) : gridDays;
  const monthCount = rangeDays.reduce((sum, d) => sum + eventsOn(d).length, 0);

  return (
    <section className="workspace-content calendar-screen">
      <div className="message-panel cal-panel">
        <header className="cal-head">
          <h1>Calendar</h1>
          <div className="cal-nav">
            <button type="button" className="toolbar-icon" aria-label={`Previous ${stepLabel}`} title={`Previous ${stepLabel}`} onClick={() => step(-1)}><LuChevronLeft /></button>
            <div className="cal-month-picker">
              <button type="button" className="cal-month-label" aria-haspopup="dialog" aria-expanded={pickerOpen} onClick={() => setPickerOpen((v) => !v)}>
                <strong aria-live="polite">{monthLabel}</strong> <LuChevronDown />
              </button>
              {pickerOpen && (
                <MiniCalendar
                  selected={selected}
                  today={today}
                  onClose={() => setPickerOpen(false)}
                  onPick={(d) => {
                    setSelected(d);
                    setPickerOpen(false);
                  }}
                />
              )}
            </div>
            <button type="button" className="toolbar-icon" aria-label={`Next ${stepLabel}`} title={`Next ${stepLabel}`} onClick={() => step(1)}><LuChevronRight /></button>
          </div>
          <button type="button" className="cal-today" disabled={sameDay(selected, today)} onClick={() => showDay(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}>Today</button>
          <div className="cal-view-switch" ref={viewMenuRef}>
            <button type="button" className="cal-today cal-view-btn" aria-haspopup="menu" aria-expanded={viewMenu} onClick={() => setViewMenu((v) => !v)}>
              {VIEWS.find((v) => v.id === calView)?.label} <LuChevronDown />
            </button>
            {viewMenu && (
              <div className="cal-view-menu" role="menu" aria-label="Calendar view">
                {VIEWS.map((v) => (
                  <button key={v.id} type="button" role="menuitemradio" aria-checked={calView === v.id} onClick={() => { setCalView(v.id); setViewMenu(false); }}>
                    <span className="cal-view-check">{calView === v.id && <LuCheck />}</span>
                    {v.label}
                    <kbd>{v.key}</kbd>
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="cal-count">{monthCount} event{monthCount === 1 ? "" : "s"} {calView === "4days" ? "in these 4 days" : `this ${stepLabel}`}</span>
          <button type="button" className="cal-new" aria-pressed={Boolean(panelNew)} onClick={() => { setOpenEventId(null); setPanelNew({ date: isoDate(selected), ...nowSlot(), key: Date.now() }); }}><LuPlus /> New event</button>
        </header>

        <div className="cal-body">
          {calView === "year" ? (
            <div className="cal-year" role="grid" aria-label={monthLabel}>
              {Array.from({ length: 12 }, (_, m) => {
                const first = new Date(selected.getFullYear(), m, 1);
                const lead0 = (first.getDay() + 6) % 7;
                const days = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), m, 1 - lead0 + i));
                const isThisMonth = first.getFullYear() === today.getFullYear() && m === today.getMonth();
                const count = days.filter((d) => d.getMonth() === m).reduce((n, d) => n + eventsOn(d).length, 0);
                return (
                  <section key={m} className={`cal-year-month ${isThisMonth ? "current" : ""}`}>
                    <button type="button" className="cal-year-title" onClick={() => { setSelected(first); setCalView("month"); }} title="Open month">
                      <strong>{first.toLocaleDateString(undefined, { month: "long" })}</strong>
                      {count > 0 && <span>{count}</span>}
                    </button>
                    <div className="cal-year-grid">
                      {WEEKDAYS.map((w) => <span key={w} className="cal-year-dow">{w[0]}</span>)}
                      {days.map((d) => {
                        const inMonth = d.getMonth() === m;
                        const has = inMonth && eventsOn(d).length > 0;
                        return (
                          <button
                            key={d.toISOString()}
                            type="button"
                            disabled={!inMonth}
                            aria-label={inMonth ? d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : undefined}
                            className={`cal-year-day ${inMonth ? "" : "outside"} ${inMonth && sameDay(d, today) ? "today" : ""} ${inMonth && sameDay(d, selected) ? "selected" : ""} ${has ? "has" : ""}`}
                            onClick={(ev) => { showDay(d); const r = ev.currentTarget.getBoundingClientRect(); setDayPop({ date: d, x: r.left + r.width / 2, y: r.bottom }); }}
                          >
                            {inMonth ? d.getDate() : ""}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : calView !== "month" ? (
            <div className={`cal-timegrid ${calView === "4days" ? "four" : calView}`} role="grid" aria-label={monthLabel}>
              <div className="cal-tg-head" style={{ gridTemplateColumns: `56px repeat(${gridDays.length}, 1fr)` }}>
                <span />
                {gridDays.map((d) => (
                  <button key={d.toISOString()} type="button" className={`cal-tg-day ${sameDay(d, today) ? "today" : ""} ${sameDay(d, selected) ? "selected" : ""}`} onClick={() => { showDay(d); if (calView !== "day") setCalView("day"); }} title={calView !== "day" ? "Open this day" : undefined}>
                    <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                    <strong>{d.getDate()}</strong>
                  </button>
                ))}
              </div>
              <div className="cal-tg-scroll">
                <div className="cal-tg-body" style={{ gridTemplateColumns: `56px repeat(${gridDays.length}, 1fr)`, height: (END_HOUR - START_HOUR) * HOUR_PX }}>
                  <div className="cal-tg-hours">
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                      <span key={i} style={{ top: i * HOUR_PX }}>{new Date(2000, 0, 1, START_HOUR + i).toLocaleTimeString(undefined, { hour: "numeric" })}</span>
                    ))}
                  </div>
                  {gridDays.map((d) => (
                    <div key={d.toISOString()} className={`cal-tg-col ${sameDay(d, today) ? "today" : ""}`} onClick={(ev) => openSlot(ev, d)} title="Click to add an event">
                      {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => <span key={i} className="cal-tg-line" style={{ top: i * HOUR_PX }} />)}
                      {sameDay(d, today) && (() => {
                        const mins = today.getHours() * 60 + today.getMinutes();
                        return mins >= START_HOUR * 60 && mins <= END_HOUR * 60 ? <span className="cal-tg-now" style={{ top: ((mins - START_HOUR * 60) / 60) * HOUR_PX }} /> : null;
                      })()}
                      {eventsOn(d).map((e) => {
                        const top = ((Math.max(toMinutes(e.start), START_HOUR * 60) - START_HOUR * 60) / 60) * HOUR_PX;
                        const height = Math.max(26, ((toMinutes(e.end) - toMinutes(e.start)) / 60) * HOUR_PX - 4);
                        return (
                          <div key={e.id} role="button" tabIndex={0} className={`cal-tg-event ${e.tone} ${openEventId === e.id ? "open" : ""}`} style={{ top, height }} title={`${e.title} · ${fmtTime(e.start)}`} onClick={(ev) => { ev.stopPropagation(); openEvent(e, d); }} onKeyDown={(ev) => { if (ev.key === "Enter") openEvent(e, d); }}>
                            <strong>{e.title}</strong>
                            <span>{e.start === e.end ? fmtTime(e.start) : `${fmtTime(e.start)} – ${fmtTime(e.end)}`}</span>
                            {calView === "day" && e.place && <span>{e.place}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
          <div className="cal-month" role="grid" aria-label={monthLabel}>
            <div className="cal-weekdays" role="row">{WEEKDAYS.map((d) => <span key={d} role="columnheader">{d}</span>)}</div>
            <div className="cal-cells">
              {cells.map((date) => {
                const inMonth = date.getMonth() === view.getMonth();
                const events = eventsOn(date);
                const isToday = sameDay(date, today);
                const isSel = sameDay(date, selected);
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    role="gridcell"
                    aria-selected={isSel}
                    aria-label={`${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${events.length ? `, ${events.length} event${events.length === 1 ? "" : "s"}` : ""}`}
                    className={`cal-cell ${inMonth ? "" : "outside"} ${isToday ? "today" : ""} ${isSel ? "selected" : ""}`}
                    onClick={() => { showDay(date); if (!inMonth) setOffset((o) => o + (date < view ? -1 : 1)); }}
                  >
                    <span className="cal-date">{date.getDate()}</span>
                    <span className="cal-events">
                      {events.slice(0, 2).map((e) => <span key={e.id} className={`cal-event ${e.tone} ${openEventId === e.id ? "open" : ""}`} onClick={(ev) => { ev.stopPropagation(); openEvent(e, date); }}>{e.title}</span>)}
                      {events.length > 2 && <span className="cal-more">+{events.length - 2} more</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          <aside className="cal-side" aria-label={panelNew ? "New event" : "Selected day"}>
            {panelNew ? (
              <div className="side-card cal-new-panel">
                <p className="cal-day-week">New event</p>
                <QuickEventCard
                  key={panelNew.key}
                  variant="panel"
                  initial={{ date: panelNew.date, start: panelNew.start, end: panelNew.end }}
                  onSave={(q) => { saveEvent(q); setPanelNew(null); }}
                  onClose={() => setPanelNew(null)}
                />
              </div>
            ) : openEventId !== null && eventsOn(selected).some((x) => x.id === openEventId) ? (() => {
              const ev = eventsOn(selected).find((x) => x.id === openEventId)!;
              const mine = Boolean(ev.date);
              return (
                <div className={`side-card cal-event-detail ${ev.tone}`}>
                  <button type="button" className="cal-back" onClick={() => setOpenEventId(null)}><LuChevronLeft /> {selected.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</button>
                  <span className="cal-detail-kind">{ev.kind === "task" ? "Task" : ev.kind === "reminder" ? "Reminder" : "Event"}</span>
                  <h2>{ev.title}</h2>
                  <ul className="cal-detail-list">
                    <li><LuClock /> <span>{selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}<br />{ev.allDay ? "All day" : ev.start === ev.end ? fmtTime(ev.start) : `${fmtTime(ev.start)} – ${fmtTime(ev.end)}`}</span></li>
                    {ev.place && <li><LuMapPin /> <span>{ev.place}</span></li>}
                    {ev.guests && ev.guests.length > 0 && <li><LuUsers /> <span>{ev.guests.join(", ")}</span></li>}
                    {ev.description && <li><LuAlignLeft /> <span className="cal-detail-desc">{ev.description}</span></li>}
                  </ul>
                  {mine ? (
                    <div className="cal-detail-actions">
                      <button type="button" className="reader-action" onClick={() => deleteEvent(ev.id)}><LuTrash2 /> Delete</button>
                    </div>
                  ) : <p className="side-empty">Sample event: editing comes with a connected calendar.</p>}
                </div>
              );
            })() : (
            <div className="side-card cal-day">
              <p className="cal-day-week">{selected.toLocaleDateString(undefined, { weekday: "long" })}</p>
              <h2>{selected.toLocaleDateString(undefined, { month: "long", day: "numeric" })}</h2>
              {selectedEvents.length ? (
                <ol className="cal-agenda">
                  {selectedEvents.map((e) => (
                    <li key={e.id} className={e.tone}>
                      <button type="button" className="cal-agenda-open" onClick={() => openEvent(e, selected)}>
                        <strong>{e.title}</strong>
                        <span><LuClock /> {e.start === e.end ? fmtTime(e.start) : `${fmtTime(e.start)} – ${fmtTime(e.end)}`}</span>
                        {e.place && <span><LuMapPin /> {e.place}</span>}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="side-empty">Nothing planned. Enjoy the space.</p>
              )}
            </div>
            )}
          </aside>
        </div>
      </div>
      {dayPop && calView === "year" && (() => {
        const list = eventsOn(dayPop.date);
        const width = 260;
        const left = Math.min(Math.max(12, dayPop.x - width / 2), (typeof window !== "undefined" ? window.innerWidth : 1200) - width - 12);
        const below = typeof window === "undefined" || dayPop.y + 240 < window.innerHeight;
        return (
          <div ref={dayPopRef} className="day-pop" role="dialog" aria-label={dayPop.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} style={below ? { left, top: dayPop.y + 8, width } : { left, bottom: window.innerHeight - dayPop.y + 40, width }}>
            <button type="button" className="row-action day-pop-close" aria-label="Close" onClick={() => setDayPop(null)}><LuX /></button>
            <span className="day-pop-week">{dayPop.date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}</span>
            <strong className={`day-pop-date ${sameDay(dayPop.date, today) ? "today" : ""}`}>{dayPop.date.getDate()}</strong>
            {list.length ? (
              <ul className="day-pop-list">
                {list.map((e) => (
                  <li key={e.id} className={e.tone}>
                    <span className="day-pop-dot" />
                    <span className="day-pop-time">{e.allDay ? "All day" : fmtTime(e.start)}</span>
                    <span className="day-pop-title">{e.title}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="day-pop-empty">There are no events scheduled on this day.</p>}
            <div className="day-pop-actions">
              <button type="button" onClick={() => { const d = dayPop.date; setDayPop(null); setSelected(d); setOpenEventId(null); setPanelNew({ date: isoDate(d), ...nowSlot(), key: Date.now() }); }}><LuPlus /> Add event</button>
              <button type="button" onClick={() => { setSelected(dayPop.date); setDayPop(null); setCalView("day"); }}>Open day</button>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
