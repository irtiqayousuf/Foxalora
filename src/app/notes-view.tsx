"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LuCalendarClock, LuCheck, LuClock, LuPin, LuPinOff, LuPlus, LuSearch, LuStickyNote, LuTrash2, LuX, LuListTodo } from "react-icons/lu";

type Tab = "notes" | "tasks" | "scheduled";
type Note = { id: number; title: string; body: string; color: string; pinned: boolean; updated: string; railDay?: string };
type Task = { id: number; title: string; done: boolean; due: string; time: string; railDay?: string };

const COLORS = ["paper", "yellow", "blue", "green", "peach", "lilac"];
const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const todayIso = () => day(0);

/* Tasks and notes added from the Today side panel (shared via localStorage). */
type RailItem = { id: number; kind: "task" | "note"; text: string; done: boolean };
const RAIL_KEY = "foxalora.day-items.v1";
const loadRail = (): Record<string, RailItem[]> => { try { return JSON.parse(localStorage.getItem(RAIL_KEY) ?? "{}"); } catch { return {}; } };
const saveRail = (v: Record<string, RailItem[]>) => { try { localStorage.setItem(RAIL_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const isoOf = (dayKey: string) => { const d = new Date(dayKey); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const SEED_NOTES: Note[] = [
  { id: 1, title: "Ideas for the studio", body: "A few thoughts for making the space feel a little more like us. Warm light, a long shared table, somewhere comfortable to read.", color: "yellow", pinned: true, updated: new Date().toISOString() },
  { id: 2, title: "Books to come back to", body: "The Creative Act — Rick Rubin\nFour Thousand Weeks — Oliver Burkeman\nWays of Being — James Bridle", color: "blue", pinned: false, updated: new Date(Date.now() - 864e5).toISOString() },
  { id: 3, title: "Weekend list", body: "Pick up flowers\nWalk by the water\nCall Mum\nMake something slowly", color: "green", pinned: false, updated: new Date(Date.now() - 5 * 864e5).toISOString() },
  { id: 4, title: "A thought to keep", body: "“Pay attention. Be astonished. Tell about it.” — Mary Oliver", color: "peach", pinned: false, updated: new Date(Date.now() - 9 * 864e5).toISOString() },
];
const SEED_TASKS: Task[] = [
  { id: 1, title: "Reply to Sofia about the palette", done: false, due: day(0), time: "11:00" },
  { id: 2, title: "Send invoice to Northstar", done: false, due: day(1), time: "" },
  { id: 3, title: "Book studio walkthrough", done: false, due: day(3), time: "15:30" },
  { id: 4, title: "Review Priya’s copy deck", done: false, due: day(-1), time: "" },
  { id: 5, title: "Archive old project files", done: true, due: "", time: "" },
];

const fmtUpdated = (iso: string) => {
  const d = new Date(iso); const diff = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (diff === 0) return `Today · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const fmtDue = (due: string, time: string) => {
  if (!due) return "";
  const diff = Math.round((new Date(`${due}T00:00:00`).getTime() - new Date(`${todayIso()}T00:00:00`).getTime()) / 864e5);
  const label = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : new Date(`${due}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const t = time ? ` · ${new Date(`2000-01-01T${time}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "";
  return label + t;
};

export default function NotesView({ onNotice }: { onNotice: (t: string) => void }) {
  const [tab, setTab] = useState<Tab>("notes");
  const [notes, setNotes] = useState(SEED_NOTES);
  const [tasks, setTasks] = useState(SEED_TASKS);
  const [query, setQuery] = useState("");
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const [taskDraft, setTaskDraft] = useState({ title: "", due: "", time: "" });
  const [confirm, setConfirm] = useState<{ kind: "note"; id: number; title: string } | { kind: "task"; task: Task } | null>(null);
  useEffect(() => {
    if (!confirm) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); setConfirm(null); } };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [confirm]);
  const taskInput = useRef<HTMLInputElement>(null);

  const [rail, setRail] = useState<Record<string, RailItem[]>>({});
  useEffect(() => { const t = window.setTimeout(() => setRail(loadRail()), 0); return () => window.clearTimeout(t); }, [tab]);
  const updateRail = (day: string, fn: (l: RailItem[]) => RailItem[]) => setRail((all) => { const next = { ...all, [day]: fn(all[day] ?? []) }; saveRail(next); return next; });
  const allTasks = useMemo<Task[]>(() => [
    ...tasks,
    ...Object.entries(rail).flatMap(([day, list]) => list.filter((i) => i.kind === "task").map((i) => ({ id: i.id, title: i.text, done: i.done, due: isoOf(day), time: "", railDay: day }))),
  ], [tasks, rail]);
  const allNotes = useMemo<Note[]>(() => [
    ...notes,
    ...Object.entries(rail).flatMap(([day, list]) => list.filter((i) => i.kind === "note").map((i) => ({ id: i.id, title: "", body: i.text, color: "paper", pinned: false, updated: new Date(i.id).toISOString(), railDay: day }))),
  ], [notes, rail]);
  const q = query.trim().toLowerCase();
  const shownNotes = useMemo(() => allNotes
    .filter((n) => !q || `${n.title} ${n.body}`.toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated.localeCompare(a.updated)), [allNotes, q]);
  const shownTasks = useMemo(() => allTasks.filter((t) => !q || t.title.toLowerCase().includes(q)), [allTasks, q]);
  const openTasks = shownTasks.filter((t) => !t.done);
  const doneTasks = shownTasks.filter((t) => t.done);
  const scheduled = useMemo(() => {
    const t = todayIso();
    const items = shownTasks.filter((x) => x.due && !x.done).sort((a, b) => (a.due + a.time).localeCompare(b.due + b.time));
    return [
      { key: "overdue", label: "Overdue", items: items.filter((x) => x.due < t) },
      { key: "today", label: "Today", items: items.filter((x) => x.due === t) },
      { key: "upcoming", label: "Upcoming", items: items.filter((x) => x.due > t) },
    ].filter((g) => g.items.length);
  }, [shownTasks]);

  const counts = { notes: allNotes.length, tasks: allTasks.filter((t) => !t.done).length, scheduled: allTasks.filter((t) => t.due && !t.done).length };

  const newNote = () => setOpenNote({ id: 0, title: "", body: "", color: "paper", pinned: false, updated: new Date().toISOString() });
  const saveNote = (n: Note) => {
    if (!n.title.trim() && !n.body.trim()) { setOpenNote(null); return; }
    const saved = { ...n, updated: new Date().toISOString() };
    if (n.railDay) {
      // A note from the Today panel: keep it there, but it can grow a title and colour as a full note.
      updateRail(n.railDay, (l) => l.filter((x) => x.id !== n.id));
      setNotes((ns) => [{ ...saved, id: Date.now(), railDay: undefined }, ...ns]);
    } else setNotes((ns) => (n.id ? ns.map((x) => (x.id === n.id ? saved : x)) : [{ ...saved, id: Date.now() }, ...ns]));
    setOpenNote(null);
  };
  const deleteNote = (id: number) => {
    const rn = allNotes.find((x) => x.id === id && x.railDay);
    if (rn?.railDay) updateRail(rn.railDay, (l) => l.filter((x) => x.id !== id));
    else setNotes((ns) => ns.filter((x) => x.id !== id));
    setOpenNote(null); onNotice("Note deleted");
  };

  const addTask = () => {
    const title = taskDraft.title.trim();
    if (!title) return;
    setTasks((ts) => [{ id: Date.now(), title, done: false, due: taskDraft.due, time: taskDraft.due ? taskDraft.time : "" }, ...ts]);
    setTaskDraft({ title: "", due: tab === "scheduled" ? todayIso() : "", time: "" });
    onNotice(taskDraft.due ? `Scheduled for ${fmtDue(taskDraft.due, taskDraft.time)}` : "Task added");
  };
  const toggle = (t: Task) => t.railDay
    ? updateRail(t.railDay, (l) => l.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
    : setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
  const removeTask = (t: Task) => t.railDay
    ? updateRail(t.railDay, (l) => l.filter((x) => x.id !== t.id))
    : setTasks((ts) => ts.filter((x) => x.id !== t.id));

  useEffect(() => { setTaskDraft((d) => ({ ...d, due: tab === "scheduled" && !d.due ? todayIso() : d.due })); }, [tab]);

  const primary = tab === "notes"
    ? <button type="button" className="reader-action primary ct-add" onClick={newNote}><LuPlus /> New note</button>
    : <button type="button" className="reader-action primary ct-add" onClick={() => taskInput.current?.focus()}><LuPlus /> {tab === "tasks" ? "New task" : "Schedule"}</button>;

  const TaskRow = ({ t }: { t: Task }) => {
    const overdue = !t.done && t.due && t.due < todayIso();
    return (
      <li className={`nt-task ${t.done ? "done" : ""}`}>
        <button type="button" className="nt-check" role="checkbox" aria-checked={t.done} aria-label={t.done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`} onClick={() => toggle(t)}>{t.done && <LuCheck />}</button>
        <div className="nt-task-text">
          <span>{t.title}</span>
          <span className="nt-meta">{t.due && <small className={overdue ? "late" : ""}><LuClock /> {fmtDue(t.due, t.time)}</small>}{t.railDay && <small className="nt-src">From your day panel</small>}</span>
        </div>
        <button type="button" className="row-action nt-del" aria-label={`Delete “${t.title}”`} onClick={() => setConfirm({ kind: "task", task: t })}><LuTrash2 /></button>
      </li>
    );
  };

  const taskComposer = (
    <form className="nt-composer" onSubmit={(e) => { e.preventDefault(); addTask(); }}>
      <span className="nt-composer-icon"><LuPlus /></span>
      <input ref={taskInput} value={taskDraft.title} onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })} placeholder={tab === "scheduled" ? "What’s happening, and when?" : "Add a task…"} aria-label="New task" maxLength={140} />
      <input type="date" className="nt-date" value={taskDraft.due} onChange={(e) => setTaskDraft({ ...taskDraft, due: e.target.value })} aria-label="Due date" />
      {taskDraft.due && <input type="time" className="nt-date" value={taskDraft.time} onChange={(e) => setTaskDraft({ ...taskDraft, time: e.target.value })} aria-label="Time" />}
      <button type="submit" className="reader-action primary" disabled={!taskDraft.title.trim()}>Add</button>
    </form>
  );

  return (
    <section className="workspace-content notes-screen">
      <div className="message-panel ct-panel">
        <header className="ct-head">
          <h1>Notes</h1>
          <div className="set-segment" role="tablist" aria-label="Notes sections">
            {([["notes", "Notes", LuStickyNote], ["tasks", "Tasks", LuListTodo], ["scheduled", "Scheduled", LuCalendarClock]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={`nt-tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>
                <Icon /> {label} {counts[id] > 0 && <span className="nt-tab-count">{counts[id]}</span>}
              </button>
            ))}
          </div>
          <label className="ct-search">
            <LuSearch aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${tab}…`} aria-label={`Search ${tab}`} />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><LuX /></button>}
          </label>
          {primary}
        </header>

        <div className="nt-body">
          {tab === "notes" && (
            shownNotes.length ? (
              <div className="nt-grid">
                {shownNotes.map((n) => (
                  <article key={n.id} className={`nt-card nt-${n.color}`} tabIndex={0} onClick={() => setOpenNote(n)} onKeyDown={(e) => { if (e.key === "Enter") setOpenNote(n); }}>
                    <div className="nt-card-top">
                      {n.pinned && <span className="nt-pinned"><LuPin /> Pinned</span>}
                      <button type="button" className="row-action nt-pin" aria-label={n.pinned ? "Unpin note" : "Pin note"} onClick={(e) => { e.stopPropagation(); setNotes((ns) => ns.map((x) => (x.id === n.id ? { ...x, pinned: !x.pinned } : x))); }}>{n.pinned ? <LuPinOff /> : <LuPin />}</button>
                      <button type="button" className="row-action nt-pin nt-card-del" aria-label="Delete note" title="Delete" onClick={(e) => { e.stopPropagation(); setConfirm({ kind: "note", id: n.id, title: n.title }); }}><LuTrash2 /></button>
                    </div>
                    {n.title && <h2>{n.title}</h2>}
                    <p>{n.body}</p>
                    <span className="nt-date-label">{n.railDay ? `From your day panel · ${new Date(n.railDay).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : fmtUpdated(n.updated)}</span>
                  </article>
                ))}
              </div>
            ) : <p className="nt-empty">{q ? `No notes match “${query}”.` : "Nothing here yet. Jot down the first thing on your mind."}</p>
          )}

          {tab === "tasks" && (
            <div className="nt-list-wrap">
              {taskComposer}
              {openTasks.length ? <ul className="nt-tasks">{openTasks.map((t) => <TaskRow key={t.id} t={t} />)}</ul>
                : <p className="nt-empty">{q ? `No tasks match “${query}”.` : "All clear. Nothing left to do."}</p>}
              {doneTasks.length > 0 && (
                <details className="nt-done">
                  <summary>Completed · {doneTasks.length}</summary>
                  <ul className="nt-tasks">{doneTasks.map((t) => <TaskRow key={t.id} t={t} />)}</ul>
                </details>
              )}
            </div>
          )}

          {tab === "scheduled" && (
            <div className="nt-list-wrap">
              {taskComposer}
              {scheduled.length ? scheduled.map((g) => (
                <section key={g.key} className="nt-sched-group">
                  <h3 className={g.key === "overdue" ? "late" : ""}>{g.label} <span>{g.items.length}</span></h3>
                  <ul className="nt-tasks">{g.items.map((t) => <TaskRow key={t.id} t={t} />)}</ul>
                </section>
              )) : <p className="nt-empty">Nothing scheduled. Give a task a date and it shows up here.</p>}
            </div>
          )}
        </div>
      </div>

      {openNote && <NoteEditor note={openNote} onSave={saveNote} onDelete={(id) => setConfirm({ kind: "note", id, title: allNotes.find((x) => x.id === id)?.title ?? "" })} onClose={() => setOpenNote(null)} />}
      {confirm && (
        <div className="ct-modal-backdrop nt-confirm" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirm(null); }}>
          <div className="ct-modal" role="alertdialog" aria-modal="true" aria-labelledby="nt-del-title" aria-describedby="nt-del-desc">
            <span className="ct-modal-icon"><LuTrash2 /></span>
            <h2 id="nt-del-title">{confirm.kind === "note" ? "Delete this note?" : "Delete this task?"}</h2>
            <p id="nt-del-desc">
              {confirm.kind === "note"
                ? <>{confirm.title ? <>“{confirm.title}” will be gone for good.</> : "This note will be gone for good."} <strong>You can’t get it back</strong> once it’s deleted.</>
                : <>“{confirm.task.title}” will be removed{confirm.task.railDay ? " here and from your day panel" : ""}. <strong>You can’t get it back</strong> once it’s deleted.</>}
            </p>
            <div className="ct-modal-foot">
              <button type="button" className="reader-action" autoFocus onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="reader-action ct-danger" onClick={() => {
                if (confirm.kind === "note") deleteNote(confirm.id);
                else { removeTask(confirm.task); onNotice("Task deleted"); }
                setConfirm(null);
              }}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function NoteEditor({ note, onSave, onDelete, onClose }: { note: Note; onSave: (n: Note) => void; onDelete: (id: number) => void; onClose: () => void }) {
  const [n, setN] = useState(note);
  const latest = useRef(n);
  latest.current = n;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onSave(latest.current); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onSave]);

  return (
    <div className="ct-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onSave(n); }}>
      <div className={`nt-editor nt-${n.color}`} role="dialog" aria-modal="true" aria-label={note.id ? "Edit note" : "New note"}>
        <input className="nt-editor-title" autoFocus={!note.id} value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} placeholder="Title" maxLength={100} />
        <textarea className="nt-editor-body" autoFocus={Boolean(note.id)} value={n.body} onChange={(e) => setN({ ...n, body: e.target.value })} placeholder="Write something…" rows={8} />
        <div className="nt-editor-foot">
          <div className="nt-swatches" role="radiogroup" aria-label="Note colour">
            {COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={n.color === c} aria-label={c} className={`nt-swatch nt-${c} ${n.color === c ? "on" : ""}`} onClick={() => setN({ ...n, color: c })} />)}
          </div>
          <button type="button" className="row-action nt-pin" aria-label={n.pinned ? "Unpin" : "Pin"} aria-pressed={n.pinned} onClick={() => setN({ ...n, pinned: !n.pinned })}>{n.pinned ? <LuPinOff /> : <LuPin />}</button>
          <button type="button" className="row-action nt-pin nt-card-del" aria-label="Delete note" title="Delete note" onClick={() => onDelete(note.id)}><LuTrash2 /></button>
          <button type="button" className="reader-action" onClick={onClose}>Discard</button>
          <button type="button" className="reader-action primary" onClick={() => onSave(n)}>Done</button>
        </div>
      </div>
    </div>
  );
}
