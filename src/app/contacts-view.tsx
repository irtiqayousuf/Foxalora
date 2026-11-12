"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuMail, LuPhone, LuBuilding2, LuPlus, LuSearch, LuStar, LuTrash2, LuX, LuStickyNote, LuArrowLeft, LuEllipsisVertical,
  LuCalendar, LuCake, LuCircleHelp, LuCopy, LuCamera,
} from "react-icons/lu";

type Contact = {
  id: number; name: string; email: string; phone: string; company: string; note: string; color: string; favorite: boolean;
  birthday: string; labels: string[]; photo: string; added: string; edited: string;
};

const COLORS = ["lilac", "blue", "green", "yellow", "peach", "rose"];

const SEED_RAW: Omit<Contact, "birthday" | "labels" | "photo" | "added" | "edited">[] = [
  { id: 1, name: "Sofia Chen", email: "sofia@northstar.studio", phone: "+1 415 555 0142", company: "Northstar Studio", note: "Prefers mornings for calls.", color: "lilac", favorite: true },
  { id: 2, name: "Marcus Lee", email: "marcus@fieldnotes.design", phone: "", company: "Fieldnotes", note: "", color: "blue", favorite: false },
  { id: 3, name: "Priya Kapoor", email: "priya@softthings.co", phone: "+44 20 7946 0958", company: "Soft Things", note: "", color: "green", favorite: true },
  { id: 4, name: "Daniel Foster", email: "daniel@hey.com", phone: "", company: "", note: "", color: "yellow", favorite: false },
  { id: 5, name: "Mina Park", email: "mina@slowstudio.jp", phone: "+81 3 5555 0199", company: "Slow Studio", note: "", color: "peach", favorite: false },
  { id: 6, name: "Studio Fieldwork", email: "hello@fieldwork.studio", phone: "", company: "Fieldwork", note: "", color: "rose", favorite: false },
];
const SEED: Contact[] = SEED_RAW.map((c, i) => ({
  ...c,
  birthday: i === 0 ? "1994-03-18" : "",
  labels: i === 0 ? ["Design"] : i === 2 ? ["Clients"] : [],
  photo: "",
  added: new Date(2025, 7, 13 - i).toISOString(),
  edited: new Date(2025, 8, 6 - i).toISOString(),
}));
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const fmtBirthday = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim());
const EMPTY = { name: "", email: "", phone: "", company: "", note: "", birthday: "", photo: "" };

function Avatar({ c, className = "" }: { c: { name: string; color: string; photo: string }; className?: string }) {
  return (
    <span className={`sender-avatar ${c.color} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL photo */}
      {c.photo ? <img src={c.photo} alt="" /> : initials(c.name)}
    </span>
  );
}

type Props = { onEmail: (address: string) => void; onNotice: (text: string) => void };

export default function ContactsView({ onEmail, onNotice }: Props) {
  const [contacts, setContacts] = useState<Contact[]>(SEED);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [selectedId, setSelectedId] = useState<number | null>(SEED[0].id);
  const [editing, setEditing] = useState<"new" | number | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => (filter === "all" || c.favorite) && (!q || [c.name, c.email, c.company].some((v) => v.toLowerCase().includes(q))))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, query, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of list) { const k = c.name[0]?.toUpperCase() ?? "#"; map.set(k, [...(map.get(k) ?? []), c]); }
    return [...map.entries()];
  }, [list]);

  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  const startNew = () => { setDraft(EMPTY); setError(""); setEditing("new"); };
  const startEdit = (c: Contact) => { setDraft({ name: c.name, email: c.email, phone: c.phone, company: c.company, note: c.note, birthday: c.birthday, photo: c.photo }); setError(""); setEditing(c.id); };

  const [menuOpen, setMenuOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const down = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [menuOpen]);

  const patch = (id: number, p: Partial<Contact>) => setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, ...p, edited: new Date().toISOString() } : c)));

  const pickPhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return onNotice("That photo is over 2 MB");
    const r = new FileReader();
    r.onload = () => setDraft((d) => ({ ...d, photo: String(r.result) }));
    r.readAsDataURL(file);
  };

  const save = () => {
    const name = draft.name.trim();
    const email = draft.email.trim().toLowerCase();
    if (!name) return setError("Add a name");
    if (!email && !draft.phone.trim()) return setError("Add an email or a phone number so you can reach them");
    if (email && !validEmail(email)) return setError("That email doesn’t look right. Check for typos.");
    if (email && contacts.some((c) => c.email === email && c.id !== editing)) return setError("Someone already has that email");
    const now = new Date().toISOString();
    if (editing === "new") {
      const c: Contact = { id: Date.now(), ...draft, name, email, color: COLORS[contacts.length % COLORS.length], favorite: false, labels: [], added: now, edited: now };
      setContacts((cs) => [...cs, c]);
      setSelectedId(c.id);
      onNotice(`${name} added`);
    } else if (typeof editing === "number") {
      patch(editing, { ...draft, name, email });
      onNotice("Contact updated");
    }
    setEditing(null);
  };

  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);
  useEffect(() => {
    if (!confirmDelete) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setConfirmDelete(null); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [confirmDelete]);

  const remove = (c: Contact) => {
    setContacts((cs) => cs.filter((x) => x.id !== c.id));
    setSelectedId(null);
    onNotice(`${c.name} removed`);
  };

  const toggleFav = (c: Contact) => setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, favorite: !x.favorite } : x)));
  const addLabel = (c: Contact) => {
    const l = (labelDraft ?? "").trim();
    setLabelDraft(null);
    if (!l || c.labels.some((x) => x.toLowerCase() === l.toLowerCase())) return;
    patch(c.id, { labels: [...c.labels, l] });
  };

  return (
    <section className="workspace-content contacts-screen">
      <div className="message-panel ct-panel">
        <header className="ct-head">
          <h1>Contacts <span className="ct-count">{contacts.length}</span></h1>
          <label className="ct-search">
            <LuSearch aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find someone…" aria-label="Search contacts" />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><LuX /></button>}
          </label>
          <div className="set-segment" role="radiogroup" aria-label="Show">
            <button type="button" role="radio" aria-checked={filter === "all"} className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All</button>
            <button type="button" role="radio" aria-checked={filter === "favorites"} className={filter === "favorites" ? "on" : ""} onClick={() => setFilter("favorites")}>Favourites</button>
          </div>
          <button type="button" className="reader-action primary ct-add" onClick={startNew}><LuPlus /> Add contact</button>
        </header>

        <div className="ct-body">
          <nav className="ct-list" aria-label="Contact list">
            {!list.length && <p className="ct-empty">{query ? `No one matches “${query}”.` : filter === "favorites" ? "No favourites yet. Star someone to keep them here." : "No contacts yet."}</p>}
            {groups.map(([letter, people]) => (
              <div key={letter} className="ct-group">
                <p className="ct-letter">{letter}</p>
                {people.map((c) => (
                  <button key={c.id} type="button" className={`ct-item ${c.id === selectedId && editing === null ? "active" : ""}`} aria-current={c.id === selectedId ? "true" : undefined} onClick={() => { setSelectedId(c.id); setEditing(null); }}>
                    <Avatar c={c} />
                    <span className="ct-item-text"><strong>{c.name}</strong><small>{c.email}</small></span>
                    {c.favorite && <LuStar className="ct-fav-dot" aria-label="Favourite" />}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="ct-detail">
            {editing !== null ? (
              <form className="ct-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
                <h2>{editing === "new" ? "New contact" : "Edit contact"}</h2>
                <div className="ct-form-avatar">
                  <label className="ct-photo-pick" title="Add a photo">
                    <Avatar c={{ name: draft.name, photo: draft.photo, color: (typeof editing === "number" ? selected?.color : undefined) ?? COLORS[contacts.length % COLORS.length] }} />
                    <span className="ct-photo-badge"><LuCamera /></span>
                    <input type="file" accept="image/*" hidden onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  {draft.photo && <button type="button" className="reader-action" onClick={() => setDraft({ ...draft, photo: "" })}>Remove photo</button>}
                </div>
                <label><span>Name</span><input className="set-input" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} /></label>
                <div className="ct-form-pair">
                  <label><span>Email</span><input className="set-input" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
                  <label><span>Birthday <em>optional</em></span><input className="set-input" type="date" value={draft.birthday} onChange={(e) => setDraft({ ...draft, birthday: e.target.value })} /></label>
                </div>
                <div className="ct-form-pair">
                  <label><span>Phone <em>optional</em></span><input className="set-input" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></label>
                  <label><span>Company <em>optional</em></span><input className="set-input" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></label>
                </div>
                <label><span>Note <em>optional</em></span><textarea className="set-input set-textarea" rows={3} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
                {error && <p className="set-error" role="alert">{error}</p>}
                <div className="ct-form-foot">
                  <button type="button" className="reader-action" onClick={() => setEditing(null)}>Cancel</button>
                  <button type="submit" className="reader-action primary">{editing === "new" ? "Add contact" : "Save"}</button>
                </div>
              </form>
            ) : selected ? (
              <article className="ct-card">
                <div className="ct-topbar">
                  <button type="button" className="row-action ct-icon" aria-label="Back to list" title="Back" onClick={() => setSelectedId(null)}><LuArrowLeft /></button>
                  <div className="ct-topbar-right">
                    <button type="button" className={`row-action ct-icon ct-star ${selected.favorite ? "on" : ""}`} aria-pressed={selected.favorite} aria-label={selected.favorite ? "Remove from favourites" : "Add to favourites"} title={selected.favorite ? "Favourite" : "Add to favourites"} onClick={() => toggleFav(selected)}><LuStar /></button>
                    <button type="button" className="reader-action primary ct-edit" onClick={() => startEdit(selected)}>Edit</button>
                    <button type="button" className="row-action ct-icon" aria-label="Delete contact" title="Delete" onClick={() => setConfirmDelete(selected)}><LuTrash2 /></button>
                    <div className="ct-more" ref={menuRef}>
                      <button type="button" className="row-action ct-icon" aria-label="More options" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}><LuEllipsisVertical /></button>
                      {menuOpen && (
                        <div className="ct-menu" role="menu">
                          {selected.email && <button type="button" role="menuitem" onClick={() => { navigator.clipboard?.writeText(selected.email); onNotice("Email copied"); setMenuOpen(false); }}><LuCopy /> Copy email</button>}
                          {selected.phone && <button type="button" role="menuitem" onClick={() => { navigator.clipboard?.writeText(selected.phone); onNotice("Phone number copied"); setMenuOpen(false); }}><LuCopy /> Copy phone number</button>}
                          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setLabelDraft(""); }}><LuPlus /> Add label</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="ct-hero">
                  <Avatar c={selected} />
                  <div>
                    <h2>{selected.name}</h2>
                    {selected.company && <p>{selected.company}</p>}
                  </div>
                </div>

                <div className="ct-quick">
                  {[
                    { label: "Email", icon: LuMail, ok: Boolean(selected.email), run: () => onEmail(selected.email), why: "Add an email first" },
                    { label: "Schedule", icon: LuCalendar, ok: true, run: () => onNotice(`Scheduling with ${selected.name} is coming soon`) },
                  ].map(({ label, icon: Icon, ok, run, why }) => (
                    <button key={label} type="button" className="ct-quick-btn" disabled={!ok} title={ok ? `${label} ${selected.name}` : why} onClick={run}>
                      <span><Icon /></span>{label}
                    </button>
                  ))}
                  <span className="ct-quick-rule" aria-hidden="true" />
                </div>

                <div className="ct-labels">
                  {selected.labels.map((l) => (
                    <span key={l} className="ct-label">{l}<button type="button" aria-label={`Remove label ${l}`} onClick={() => patch(selected.id, { labels: selected.labels.filter((x) => x !== l) })}><LuX /></button></span>
                  ))}
                  {labelDraft === null ? (
                    <button type="button" className="ct-label-add" onClick={() => setLabelDraft("")}><LuPlus /> Label</button>
                  ) : (
                    <form className="ct-label-form" onSubmit={(e) => { e.preventDefault(); addLabel(selected); }}>
                      <input autoFocus value={labelDraft} maxLength={24} placeholder="Label name" aria-label="New label" onChange={(e) => setLabelDraft(e.target.value)} onBlur={() => addLabel(selected)} onKeyDown={(e) => { if (e.key === "Escape") setLabelDraft(null); }} />
                    </form>
                  )}
                </div>

                <div className="ct-columns">
                  <section className="ct-details">
                    <h3>Contact details</h3>
                    <ul>
                      <li><LuMail />{selected.email
                        ? <a href={`mailto:${selected.email}`} onClick={(e) => { e.preventDefault(); onEmail(selected.email); }}>{selected.email}</a>
                        : <button type="button" className="ct-add-link" onClick={() => startEdit(selected)}>Add email</button>}</li>
                      <li><LuPhone />{selected.phone
                        ? <span><a href={`tel:${selected.phone.replace(/\s/g, "")}`}>{selected.phone}</a> <small>· Mobile</small></span>
                        : <button type="button" className="ct-add-link" onClick={() => startEdit(selected)}>Add phone</button>}</li>
                      <li><LuCake />{selected.birthday
                        ? <span>{fmtBirthday(selected.birthday)}</span>
                        : <button type="button" className="ct-add-link" onClick={() => startEdit(selected)}>Add birthday</button>}</li>
                      {selected.company && <li><LuBuilding2 /><span>{selected.company}</span></li>}
                      {selected.note && <li><LuStickyNote /><span className="ct-note">{selected.note}</span></li>}
                    </ul>
                  </section>
                  <section className="ct-history">
                    <h3>History <span title="When this contact was created and last changed"><LuCircleHelp /></span></h3>
                    <p>Last edited <small>· {fmtDate(selected.edited)}</small></p>
                    <p>Added to contacts <small>· {fmtDate(selected.added)}</small></p>
                  </section>
                </div>
              </article>
            ) : (
              <div className="ct-placeholder"><p>Pick someone from the list, or add a new contact.</p></div>
            )}
          </div>
        </div>
      </div>
      {confirmDelete && (
        <div className="ct-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="ct-modal" role="alertdialog" aria-modal="true" aria-labelledby="ct-del-title" aria-describedby="ct-del-desc">
            <span className="ct-modal-icon"><LuTrash2 /></span>
            <h2 id="ct-del-title">Delete {confirmDelete.name}?</h2>
            <p id="ct-del-desc">They’ll be removed from your contacts for good. <strong>You can’t recover this contact</strong> once it’s deleted. Your emails with them stay in your inbox.</p>
            <div className="ct-modal-foot">
              <button type="button" className="reader-action" autoFocus onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button type="button" className="reader-action ct-danger" onClick={() => { remove(confirmDelete); setConfirmDelete(null); }}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
