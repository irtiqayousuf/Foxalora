"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "./i18n";
import { IoHelpCircleOutline } from "react-icons/io5";
import {
  LuAccessibility, LuArrowLeft, LuCalendarDays, LuSparkles, LuBookText, LuCheck, LuLayoutGrid, LuMail, LuUser, LuChevronDown, LuChevronRight, LuGlobe, LuExternalLink, LuClock, LuGraduationCap,
  LuHeadset, LuKeyboard, LuLifeBuoy, LuSearch, LuSend, LuX,
} from "react-icons/lu";

type View = "help" | "support" | "training" | "docs" | "shortcuts";

/* ---------- Content ---------- */

const FAQ: { q: string; a: string; tag: string }[] = [
  { tag: "Mail", q: "How do I schedule an email to send later?", a: "Write your email, then click the arrow next to Send. Pick a suggested time or choose “Pick date & time”. Keep Foxalora open until it sends." },
  { tag: "Mail", q: "Can I undo sending an email?", a: "Not yet. Before you send, Foxalora checks for a missing subject or a forgotten attachment and asks you to confirm." },
  { tag: "Mail", q: "How do I search with filters?", a: "Open search in the top bar and click the sliders icon. Filter by sender, date, folder, attachments and more. The count updates as you choose." },
  { tag: "Account", q: "How do I change my profile picture?", a: "Go to Settings → Profile and click your picture or “Upload photo”. Square photos look best." },
  { tag: "Account", q: "Why can’t I change my email address?", a: "Your email address is your sign-in. To use a different address, sign out and sign in with that account." },
  { tag: "Account", q: "How do I add or change my signature?", a: "Go to Settings → Signature, or click “Edit” under the signature while writing an email." },
  { tag: "Apps", q: "How do I hide Calendar, Contacts or Notes?", a: "Go to Settings → Navigation and turn apps off. With only Mail on, the top bar shows a full search box instead of tabs." },
  { tag: "Accessibility", q: "How do I make text bigger or easier to read?", a: "Click the accessibility icon in the top bar. You can enlarge text, add line spacing, raise contrast, or have Foxalora read aloud." },
];

type Step = { title: string; body: string; tip?: string };
const LESSONS: { id: string; title: string; blurb: string; mins: number; steps: Step[] }[] = [
  { id: "basics", title: "Getting started", blurb: "Find your way around Foxalora.", mins: 4, steps: [
    { title: "Welcome to Foxalora", body: "Foxalora brings your mail, calendar, contacts and notes together in one calm place. This short course shows you where everything lives.", tip: "You can leave a course at any time. Your place is saved." },
    { title: "The top bar", body: "The top bar holds your apps on the left, search in the middle, and help, accessibility and settings on the right." },
    { title: "Folders", body: "Below the top bar you’ll find your folders: Inbox, Starred, Sent, Drafts, Spam and Trash. The number next to a folder shows unread emails." },
    { title: "Reading an email", body: "Click any email to open it. Use the arrows at the top of the reader to move to the next or previous email.", tip: "Press Esc to close the reader and go back to the list." },
    { title: "Your account", body: "Click your initials or photo in the top right to see how much storage you’ve used, open settings, or sign out." },
    { title: "Getting help", body: "Click the question mark any time to open the Help center, Documentation, Training or Contact support. You’re ready to go!" },
  ] },
  { id: "compose", title: "Write and send emails", blurb: "Compose, format, attach and schedule.", mins: 5, steps: [
    { title: "Start a new email", body: "Click Compose. A writing window opens at the bottom of the screen. You can minimise it or make it full screen." },
    { title: "Add recipients", body: "Type a name or address in To. Pick a suggestion or press Enter. Click Cc or Bcc to add more people.", tip: "Addresses with a problem are highlighted so you can fix them before sending." },
    { title: "Write and format", body: "Use the toolbar for bold, italic, lists and links. Switch to plain text if you prefer simple emails." },
    { title: "Attach files", body: "Click the paperclip or drag files onto the window. Attachments can be up to 25 MB in total." },
    { title: "Schedule for later", body: "Click the arrow next to Send. Choose Tomorrow morning, This afternoon, Monday morning, or pick your own date and time." },
    { title: "Send with confidence", body: "Before sending, Foxalora checks for a missing subject or a forgotten attachment and asks you to confirm.", tip: "Drafts save automatically, so nothing you write is lost." },
  ] },
  { id: "organize", title: "Organise your inbox", blurb: "Stars, folders, search and filters.", mins: 4, steps: [
    { title: "Star what matters", body: "Click the star next to any email to keep it handy. Starred emails are collected in the Starred folder." },
    { title: "Move emails", body: "Open an email and choose Move to put it in another folder. Moving keeps your inbox focused on what’s new." },
    { title: "Mark read or unread", body: "Mark an email unread to come back to it later. Unread emails appear in bold." },
    { title: "Search everything", body: "Click the search icon and type a name, subject or phrase. Results appear as you type." },
    { title: "Use filters", body: "Click the sliders icon in search to filter by sender, date, folder, attachments or read state. The count updates as you choose.", tip: "Press Esc to clear search and see your folder again." },
    { title: "Clean up", body: "Delete emails you don’t need. They go to Trash first, so you can restore anything deleted by mistake." },
  ] },
  { id: "calendar", title: "Plan with Calendar & Contacts", blurb: "Events, reminders and people.", mins: 5, steps: [
    { title: "Open Calendar", body: "Click Calendar in the top bar." },
    { title: "Change the view", body: "Switch between day, week and month to see as much or as little as you need." },
    { title: "Add an event", body: "Click a day or time to add an event quickly. Give it a title, time and place." },
    { title: "Get reminders", body: "Turn on calendar reminders in Settings → Notifications so you never miss a meeting." },
    { title: "Find people", body: "Open Contacts to see everyone you email. Search by name, email or company." },
    { title: "Email a contact", body: "Click Email on any contact to jump back to Mail with their emails ready to view.", tip: "Contacts are added from the people you email." },
  ] },
  { id: "personal", title: "Make Foxalora yours", blurb: "Profile, signature, theme and accessibility.", mins: 4, steps: [
    { title: "Add your photo", body: "Go to Settings → Profile and upload a photo. People will recognise you at a glance." },
    { title: "Set your display name", body: "Change the name people see next to your emails in Settings → Profile." },
    { title: "Create a signature", body: "Write a signature in Settings → Signature. It’s added to the end of new emails and replies." },
    { title: "Pick a theme", body: "Choose light, dark or system in Settings → Appearance. Compact density fits more emails on screen." },
    { title: "Accessibility tools", body: "Click the accessibility icon to enlarge text, add spacing, raise contrast, or have emails read aloud." },
    { title: "Language and region", body: "Set your language, time zone and date format in Settings → Language & region.", tip: "All settings save automatically." },
  ] },
];

const DOCS: { group: string; items: { title: string; body: string[] }[] }[] = [
  { group: "Getting started", items: [
    { title: "Signing in", body: ["Sign in with your full email address and password.", "For security, you’re signed out after a period of inactivity."] },
    { title: "Finding your way around", body: ["The top bar switches between Mail, Calendar, Contacts and Notes.", "Search, help, accessibility tools and settings live on the right.", "Your account menu shows storage use and lets you sign out."] },
  ] },
  { group: "Mail", items: [
    { title: "Composing and sending", body: ["Compose opens a window you can minimise or expand.", "Drafts save automatically while you type.", "Attachments up to 25 MB in total are supported.", "Schedule send holds your email until the time you choose."] },
    { title: "Search and filters", body: ["Search matches senders, subjects and message text.", "Filters narrow results by folder, date, attachments and read state.", "Press Esc to clear search."] },
    { title: "Images and privacy", body: ["Outside images can tell senders when you open their email.", "By default Foxalora asks before showing them.", "Change this in Settings → Reading & writing."] },
  ] },
  { group: "Settings", items: [
    { title: "Profile and signature", body: ["Your display name and picture appear next to emails you send.", "Your signature is added at the end of new emails and replies."] },
    { title: "Appearance and navigation", body: ["Choose light, dark or system theme.", "Compact density fits more emails on screen.", "Hide apps you don’t use in Settings → Navigation."] },
  ] },
];

const SHORTCUTS: [string, string][] = [["Esc", "Close a window or clear search"], ["Tab", "Move to the next control"], ["Enter", "Open the selected item"], ["Ctrl + B / I / U", "Bold, italic, underline while writing"]];

const MENU: { id: View; label: string; hint: string; icon: typeof LuLifeBuoy }[] = [
  { id: "help", label: "Help center", hint: "Answers to common questions", icon: LuLifeBuoy },
  { id: "training", label: "Training", hint: "Short guided lessons", icon: LuGraduationCap },
  { id: "docs", label: "Documentation", hint: "Full guides for every feature", icon: LuBookText },
  { id: "support", label: "Contact support", hint: "Get help from a person", icon: LuHeadset },
];

const PROGRESS_KEY = "foxalora.training.v2";

/* ---------- Component ---------- */

export type HelpPage = "help" | "docs" | "training" | "support";

export default function HelpMenu({ onOpenPage, websiteUrl, appName }: { onOpenPage: (page: HelpPage) => void; websiteUrl?: string; appName?: string }) {
  const t = useT();
  const [menu, setMenu] = useState(false);
  const [overlay, setOverlay] = useState<"shortcuts" | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const down = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setMenu(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [menu]);

  useEffect(() => {
    if (!overlay) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOverlay(null); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [overlay]);

  function choose(id: View) {
    setMenu(false);
    if (id === "shortcuts") setOverlay(id);
    else onOpenPage(id);
  }

  return (
    <div className="help-wrap" ref={wrap}>
      <button type="button" className="icon-button" aria-label={t("Help & support")} title={t("Help")} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><IoHelpCircleOutline /></button>

      {menu && (
        <div className="help-menu" role="menu">
          <div className="help-menu-head"><strong>{t("Help & support")}</strong><small>{t("We’re here to help you get things done.")}</small></div>
          {MENU.map(({ id, label, hint, icon: Icon }) => (
            <button key={id} type="button" role="menuitem" className="help-item" onClick={() => choose(id)}>
              <span className="help-item-icon"><Icon /></span>
              <span className="help-item-text"><strong>{t(label)}</strong><small>{t(hint)}</small></span>
              <LuChevronRight className="help-item-chev" />
            </button>
          ))}
          {websiteUrl && (
            <a role="menuitem" className="help-item" href={websiteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); window.open(websiteUrl, "_blank", "noopener,noreferrer"); setMenu(false); }}>
              <span className="help-item-icon"><LuGlobe /></span>
              <span className="help-item-text"><strong>{t("Visit website")}</strong><small>{websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</small></span>
              <LuExternalLink className="help-item-chev" />
            </a>
          )}
          <div className="help-sep" />
          <button type="button" role="menuitem" className="help-item compact" onClick={() => choose("shortcuts")}>
            <span className="help-item-icon"><LuKeyboard /></span><span className="help-item-text"><strong>{t("Keyboard shortcuts")}</strong></span>
          </button>
        </div>
      )}

      {overlay && createPortal(
        <div className="mail-app help-portal">
          <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOverlay(null); }}>
            <div className="help-sheet" role="dialog" aria-modal="true" aria-labelledby="help-sheet-title">
              <header className="help-sheet-head">
                <span className="help-item-icon"><LuKeyboard /></span>
                <h2 id="help-sheet-title">Keyboard shortcuts</h2>
                <button type="button" className="a11y-close" aria-label="Close" onClick={() => setOverlay(null)}><LuX /></button>
              </header>
              <div className="help-sheet-body">
                <ul className="help-shortcuts">{SHORTCUTS.map(([k, d]) => <li key={k}><kbd>{k}</kbd><span>{d}</span></li>)}</ul>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ---------- Full pages: Help center, Documentation, Contact support ---------- */

const PAGE_META: Record<HelpPage, { title: string; blurb: string }> = {
  help: { title: "Help center", blurb: "Find quick answers to common questions." },
  docs: { title: "Documentation", blurb: "Step-by-step guides for every part of Foxalora." },
  training: { title: "Training", blurb: "Short guided courses, one step at a time." },
  support: { title: "Contact support", blurb: "Tell us what’s going on and a person will get back to you." },
};

export function HelpPages({ page, onPage, onBack, supportEmail, userEmail, onNotice }: { page: HelpPage; onPage: (p: HelpPage) => void; onBack: () => void; supportEmail: string; userEmail: string; onNotice: (t: string) => void }) {
  const meta = PAGE_META[page];
  const t = useT();
  return (
    <section className="workspace-content settings-screen">
      <div className="message-panel set-panel">
        <header className="set-head">
          <button type="button" className="reader-pill" onClick={onBack}><LuArrowLeft /> <span>{t("Back to mail")}</span></button>
          <h1>{t(meta.title)}</h1>
          <nav className="hp-tabs" aria-label="Help pages">
            {(Object.keys(PAGE_META) as HelpPage[]).map((id) => (
              <button key={id} type="button" className={id === page ? "on" : ""} aria-current={id === page ? "page" : undefined} onClick={() => onPage(id)}>{t(PAGE_META[id].title)}</button>
            ))}
          </nav>
        </header>
        {page === "docs" ? <Docs /> : page === "training" ? <Training /> : (
          <div className="set-content hp-content">
            <div className="hp-center">
              {page !== "help" && <div className="set-content-head"><h2>{meta.title}</h2><p>{meta.blurb}</p></div>}
              {page === "help" && <HelpCenter />}
              {page === "support" && <Support supportEmail={supportEmail} userEmail={userEmail} onPage={onPage} onDone={onNotice} />}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Help center: searchable FAQ ---------- */
const TOPICS: { tag: string; icon: typeof LuMail; blurb: string }[] = [
  { tag: "Mail", icon: LuMail, blurb: "Sending, scheduling and search" },
  { tag: "Account", icon: LuUser, blurb: "Profile, signature and sign-in" },
  { tag: "Apps", icon: LuLayoutGrid, blurb: "Calendar, Contacts and Notes" },
  { tag: "Accessibility", icon: LuAccessibility, blurb: "Text size, contrast and reading aloud" },
];

function HelpCenter() {
  const t = useT();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [openQ, setOpenQ] = useState<string | null>(null);
  const term = q.trim().toLowerCase();
  const list = useMemo(() => FAQ.filter((f) => (!tag || f.tag === tag) && (f.q + f.a).toLowerCase().includes(term)), [term, tag]);
  const heading = term ? `Results for “${q.trim()}”` : tag ? tag : t("Popular questions");

  return (
    <div className="hc">
      <section className="hc-hero">
        <h2>{t("How can we help?")}</h2>
        <p>{t("Search our answers or pick a topic below.")}</p>
        <label className="hc-search">
          <LuSearch aria-hidden="true" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setOpenQ(null); }} placeholder="Try “schedule”, “signature” or “dark mode”" aria-label="Search help" />
          {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")}><LuX /></button>}
        </label>
      </section>

      <section className="hc-topics" aria-label="Topics">
        {TOPICS.map(({ tag: tg, icon: Icon, blurb }) => {
          const count = FAQ.filter((f) => f.tag === tg).length;
          const on = tag === tg;
          return (
            <button key={tg} type="button" className={`hc-topic ${on ? "on" : ""}`} aria-pressed={on} onClick={() => { setTag(on ? null : tg); setOpenQ(null); }}>
              <span className="hc-topic-icon"><Icon /></span>
              <strong>{tg}</strong>
              <small>{blurb}</small>
              <em>{count} {count === 1 ? "answer" : "answers"}</em>
            </button>
          );
        })}
      </section>

      <section className="hc-list">
        <div className="hc-list-head">
          <h3>{heading}</h3>
          <span>{list.length} {list.length === 1 ? "answer" : "answers"}</span>
          {(tag || term) && <button type="button" className="help-link" onClick={() => { setTag(null); setQ(""); }}>{t("Show all")}</button>}
        </div>
        {list.length ? (
          <div className="hc-faq">
            {list.map((f) => {
              const open = openQ === f.q;
              return (
                <div key={f.q} className={`hc-faq-item ${open ? "open" : ""}`}>
                  <button type="button" aria-expanded={open} onClick={() => setOpenQ(open ? null : f.q)}>
                    <span className="hc-faq-tag">{f.tag}</span>
                    <span className="hc-faq-q">{f.q}</span>
                    <span className="hc-faq-toggle"><LuChevronDown /></span>
                  </button>
                  {open && <p>{f.a}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="hc-empty">
            <span className="help-item-icon"><LuSearch /></span>
            <strong>No answers found</strong>
            <p>Try different words, browse the documentation, or ask our team.</p>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- Training: course list on the left, step wizard on the right ---------- */
type Progress = Record<string, { step: number; done: boolean }>;
const LESSON_ICONS: Record<string, typeof LuMail> = { basics: LuSparkles, compose: LuSend, organize: LuLayoutGrid, calendar: LuCalendarDays, personal: LuUser };

function Training() {
  const [progress, setProgress] = useState<Progress>(() => {
    try { const v = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); return Array.isArray(v) ? {} : v; } catch { return {}; }
  });
  const [activeId, setActiveId] = useState(() => LESSONS.find((l) => !progress[l.id]?.done)?.id ?? LESSONS[0].id);
  const [finished, setFinished] = useState(false);
  const lesson = LESSONS.find((l) => l.id === activeId) ?? LESSONS[0];
  const step = Math.min(progress[lesson.id]?.step ?? 0, lesson.steps.length - 1);
  const doneCount = LESSONS.filter((l) => progress[l.id]?.done).length;
  const cur = lesson.steps[step];
  const last = step === lesson.steps.length - 1;
  const LessonIcon = LESSON_ICONS[lesson.id] ?? LuGraduationCap;
  const nextLesson = LESSONS.find((l) => !progress[l.id]?.done && l.id !== lesson.id);

  const save = (next: Progress) => { setProgress(next); try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ } };
  const goStep = (n: number) => save({ ...progress, [lesson.id]: { step: n, done: progress[lesson.id]?.done ?? false } });
  const open = (id: string) => { setActiveId(id); setFinished(false); };
  const finish = () => { save({ ...progress, [lesson.id]: { step, done: true } }); setFinished(true); };

  return (
    <div className="set-body">
      <nav className="set-nav hp-doc-nav tr-nav" aria-label="Training courses">
        <p className="set-nav-label">Courses</p>
        <div>
          {LESSONS.map((l, i) => {
            const pr = progress[l.id];
            const on = l.id === lesson.id;
            const state = pr?.done ? "Completed" : pr && pr.step > 0 ? `Step ${pr.step + 1} of ${l.steps.length}` : `${l.mins} min · ${l.steps.length} steps`;
            return (
              <button key={l.id} type="button" className={`tr-course ${on ? "active" : ""} ${pr?.done ? "done" : ""}`} aria-current={on ? "page" : undefined} onClick={() => open(l.id)}>
                <span className="tr-course-num">{pr?.done ? <LuCheck /> : i + 1}</span>
                <span className="tr-course-text"><strong>{l.title}</strong><small>{state}</small></span>
              </button>
            );
          })}
        </div>
        {doneCount > 0 && <button type="button" className="help-link tr-reset" onClick={() => { save({}); setFinished(false); }}>Reset all progress</button>}
      </nav>

      <div className="set-content">
        <div className="tr-main">
          <header className="tr-top">
            <span className="tr-top-icon"><LessonIcon /></span>
            <div className="tr-top-text">
              <small>Course {LESSONS.indexOf(lesson) + 1} of {LESSONS.length}</small>
              <h2>{lesson.title}</h2>
              <p>{lesson.blurb}</p>
            </div>
            <div className="tr-chips">
              <span><LuClock /> {lesson.mins} min</span>
              <span>{lesson.steps.length} steps</span>
              {progress[lesson.id]?.done && <span className="dark"><LuCheck /> Completed</span>}
            </div>
          </header>

          <div className="tr-shell">
            <ol className="tr-outline" aria-label="Steps in this course">
              {lesson.steps.map((st, i) => {
                const state = finished || i < step ? "past" : i === step ? "current" : "";
                return (
                  <li key={st.title} className={state}>
                    <button type="button" onClick={() => { setFinished(false); goStep(i); }} aria-current={!finished && i === step ? "step" : undefined}>
                      <span className="tr-dot">{state === "past" ? <LuCheck /> : i + 1}</span>
                      <span className="tr-outline-text"><small>Step {i + 1}</small><strong>{st.title}</strong></span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <section className="tr-stage" key={finished ? "done" : `${lesson.id}-${step}`}>
              {finished ? (
                <div className="tr-done">
                  <span className="tr-done-badge"><LuCheck /></span>
                  <h3>Course complete!</h3>
                  <p>You finished “{lesson.title}”. {nextLesson ? "Ready for the next one?" : "You’ve completed every course 🎉"}</p>
                  <div className="tr-done-actions">
                    <button type="button" className="reader-action" onClick={() => { goStep(0); setFinished(false); }}>Review again</button>
                    {nextLesson && <button type="button" className="reader-action primary" onClick={() => open(nextLesson.id)}>Start “{nextLesson.title}” <LuChevronRight /></button>}
                  </div>
                </div>
              ) : (
                <>
                  <div className="tr-content">
                    <div className="tr-content-top">
                      <span className="tr-mini-icon"><LessonIcon /></span>
                      <span className="tr-step-count">Step {step + 1} of {lesson.steps.length}</span>
                      <div className="tr-mini-dots" aria-hidden="true">{lesson.steps.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
                    </div>
                    <h3>{cur.title}</h3>
                    <p>{cur.body}</p>
                    {cur.tip && <div className="tr-tip"><span className="tr-tip-icon">💡</span><span>{cur.tip}</span></div>}
                  </div>
                  <footer className="tr-foot">
                    <button type="button" className="reader-action" disabled={step === 0} onClick={() => goStep(step - 1)}><LuArrowLeft /> Back</button>
                    <span className="tr-foot-count">{step + 1} / {lesson.steps.length}</span>
                    {last
                      ? <button type="button" className="reader-action primary" onClick={finish}><LuCheck /> Finish course</button>
                      : <button type="button" className="reader-action primary" onClick={() => goStep(step + 1)}>Next step <LuChevronRight /></button>}
                  </footer>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Documentation: list on the left, article on the right ---------- */
function Docs() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState({ group: DOCS[0].group, title: DOCS[0].items[0].title });
  const groups = DOCS.map((g) => ({ ...g, items: g.items.filter((i) => (i.title + i.body.join(" ")).toLowerCase().includes(q.trim().toLowerCase())) })).filter((g) => g.items.length);
  const flat = DOCS.flatMap((g) => g.items.map((i) => ({ group: g.group, ...i })));
  const idx = flat.findIndex((i) => i.group === open.group && i.title === open.title);
  const article = flat[idx] ?? flat[0];
  const prev = flat[idx - 1], next = flat[idx + 1];

  return (
    <div className="set-body">
      <nav className="set-nav hp-doc-nav" aria-label="Documentation topics">
        <label className="help-search hp-doc-search"><LuSearch aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guides…" aria-label="Search documentation" /></label>
        {groups.length ? groups.map((g) => (
          <div key={g.group}>
            <p className="set-nav-label">{g.group}</p>
            {g.items.map((i) => {
              const on = i.title === article.title && g.group === article.group;
              return <button key={i.title} type="button" className={on ? "active" : ""} aria-current={on ? "page" : undefined} onClick={() => setOpen({ group: g.group, title: i.title })}><LuBookText /> {i.title}</button>;
            })}
          </div>
        )) : <p className="hp-nav-empty">Nothing matches “{q}”.</p>}
      </nav>
      <div className="set-content">
        <article className="hp-article">
          <small className="help-crumb">{article.group}</small>
          <h2>{article.title}</h2>
          <div className="set-card hp-card">
            <ol>{article.body.map((b) => <li key={b}>{b}</li>)}</ol>
          </div>
          <div className="hp-pager">
            {prev ? <button type="button" className="reader-action" onClick={() => setOpen({ group: prev.group, title: prev.title })}><LuArrowLeft /> {prev.title}</button> : <span />}
            {next && <button type="button" className="reader-action" onClick={() => setOpen({ group: next.group, title: next.title })}>{next.title} <LuChevronRight /></button>}
          </div>
        </article>
      </div>
    </div>
  );
}

/* ---------- Contact support: form ---------- */
function Support({ supportEmail, userEmail, onPage, onDone }: { supportEmail: string; userEmail: string; onPage: (p: HelpPage) => void; onDone: (t: string) => void }) {
  const [topic, setTopic] = useState("Something isn’t working");
  const [subject, setSubject] = useState("");
  const [msg, setMsg] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [sent, setSent] = useState(false);
  const valid = subject.trim().length > 2 && msg.trim().length > 9;

  function submit() {
    const body = `${msg.trim()}\n\n—\nTopic: ${topic}\nPriority: ${urgent ? "Urgent" : "Normal"}\nFrom: ${userEmail}\nBrowser: ${navigator.userAgent}`;
    window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(`[${topic}] ${subject.trim()}`)}&body=${encodeURIComponent(body)}`;
    setSent(true);
    onDone("Your email app is opening with the message ready to send");
  }

  return (
    <div className="hp-support">
      <div className="set-card hp-card">
        {sent ? (
          <div className="hp-sent">
            <span className="hp-sent-icon"><LuCheck /></span>
            <h3>Message ready to send</h3>
            <p>Send it from your email app. We’ll reply to <strong>{userEmail}</strong>.</p>
            <button type="button" className="reader-action" onClick={() => { setSent(false); setSubject(""); setMsg(""); setUrgent(false); }}>Write another message</button>
          </div>
        ) : (
          <div className="help-form">
            <label><span>Topic</span>
              <select className="set-input" value={topic} onChange={(e) => setTopic(e.target.value)}>
                {["Something isn’t working", "Question about a feature", "Account or sign-in", "Suggestion", "Other"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label><span>Subject</span><input className="set-input" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="A short summary" /></label>
            <label><span>Message</span><textarea className="set-input set-textarea" rows={7} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="What happened, and what did you expect?" /></label>
            <label className="help-check"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> This is urgent — I can’t work</label>
            <div className="hp-form-foot">
              <small>{valid ? "Ready to send." : "Add a subject and a short message."}</small>
              <button type="button" className="reader-action primary" disabled={!valid} onClick={submit}><LuSend /> Send to support</button>
            </div>
          </div>
        )}
      </div>
      <aside className="hp-side">
        <div className="set-card hp-card hp-side-card">
          <span className="help-item-icon"><LuMail /></span>
          <strong>Email us directly</strong>
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </div>
        <div className="set-card hp-card hp-side-card">
          <span className="help-item-icon"><LuClock /></span>
          <strong>Reply time</strong>
          <small>Usually within one business day. Urgent issues first.</small>
        </div>
        <div className="set-card hp-card hp-side-card">
          <strong>Try these first</strong>
          <button type="button" className="help-doc-row" onClick={() => onPage("help")}><LuLifeBuoy /><span>Help center</span><LuChevronRight /></button>
          <button type="button" className="help-doc-row" onClick={() => onPage("docs")}><LuBookText /><span>Documentation</span><LuChevronRight /></button>
        </div>
      </aside>
    </div>
  );
}
