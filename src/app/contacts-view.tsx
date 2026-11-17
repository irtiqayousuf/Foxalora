"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuMail, LuPhone, LuBuilding2, LuPlus, LuSearch, LuStar, LuTrash2, LuX, LuStickyNote, LuArrowLeft, LuEllipsisVertical,
  LuCalendar, LuCake, LuCircleHelp, LuCopy, LuCamera, LuUpload, LuDownload, LuTrendingUp,
} from "react-icons/lu";
import {
  COLORS, EMAIL_LABELS, contactScore, downloadFile, mainEmail, parseContactsCsv, parseVCards, toVCard, validEmail,
  type Contact, type ContactEmail, type Frequency, type ImportedContact,
} from "./contacts-store";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const fmtBirthday = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

type Draft = { name: string; emails: ContactEmail[]; phone: string; company: string; note: string; birthday: string; photo: string };
const EMPTY: Draft = { name: "", emails: [{ address: "", label: "Work" }], phone: "", company: "", note: "", birthday: "", photo: "" };

function Avatar({ c, className = "" }: { c: { name: string; color: string; photo: string }; className?: string }) {
  return (
    <span className={`sender-avatar ${c.color} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL photo */}
      {c.photo ? <img src={c.photo} alt="" /> : initials(c.name)}
    </span>
  );
}

type Props = {
  contacts: Contact[];
  onContacts: (next: Contact[] | ((cur: Contact[]) => Contact[])) => void;
  frequency: Frequency;
  onEmail: (address: string) => void;
  onNotice: (text: string) => void;
};

type ImportPreview = { source: string; fresh: ImportedContact[]; dupes: number };

export default function ContactsView({ contacts, onContacts, frequency, onEmail, onNotice }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "frequent" | "favorites">("all");
  const [selectedId, setSelectedId] = useState<number | null>(contacts[0]?.id ?? null);
  const [editing, setEditing] = useState<"new" | number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (c: Contact) => !q || [c.name, c.company, c.phone, ...c.emails.map((e) => e.address)].some((v) => v.toLowerCase().includes(q));
    const base = contacts.filter((c) => match(c) && (filter !== "favorites" || c.favorite) && (filter !== "frequent" || contactScore(c, frequency) > 0));
    return filter === "frequent"
      ? base.sort((a, b) => contactScore(b, frequency) - contactScore(a, frequency) || a.name.localeCompare(b.name))
      : base.sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, query, filter, frequency]);

  const groups = useMemo(() => {
    if (filter === "frequent") return [["Most emailed", list] as [string, Contact[]]];
    const map = new Map<string, Contact[]>();
    for (const c of list) { const k = c.name[0]?.toUpperCase() ?? "#"; map.set(k, [...(map.get(k) ?? []), c]); }
    return [...map.entries()];
  }, [list, filter]);

  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  const startNew = () => { setDraft(EMPTY); setError(""); setEditing("new"); };
  const startEdit = (c: Contact) => {
    setDraft({ name: c.name, emails: c.emails.length ? c.emails.map((e) => ({ ...e })) : [{ address: "", label: "Work" }], phone: c.phone, company: c.company, note: c.note, birthday: c.birthday, photo: c.photo });
    setError(""); setEditing(c.id);
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [ioOpen, setIoOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ioRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen && !ioOpen) return;
    const down = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
      if (!ioRef.current?.contains(e.target as Node)) setIoOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [menuOpen, ioOpen]);

  const patch = (id: number, p: Partial<Contact>) => onContacts((cs) => cs.map((c) => (c.id === id ? { ...c, ...p, edited: new Date().toISOString() } : c)));

  const pickPhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return onNotice("That photo is over 2 MB");
    const r = new FileReader();
    r.onload = () => setDraft((d) => ({ ...d, photo: String(r.result) }));
    r.readAsDataURL(file);
  };

  const setEmail = (i: number, p: Partial<ContactEmail>) => setDraft((d) => ({ ...d, emails: d.emails.map((e, j) => (j === i ? { ...e, ...p } : e)) }));
  const makeMain = (i: number) => setDraft((d) => ({ ...d, emails: [d.emails[i], ...d.emails.filter((_, j) => j !== i)] }));

  const save = () => {
    const name = draft.name.trim();
    const emails = draft.emails.map((e) => ({ ...e, address: e.address.trim().toLowerCase() })).filter((e) => e.address);
    if (!name) return setError("Add a name");
    if (!emails.length && !draft.phone.trim()) return setError("Add an email or a phone number so you can reach them");
    const bad = emails.find((e) => !validEmail(e.address));
    if (bad) return setError(`“${bad.address}” doesn’t look right. Check for typos.`);
    if (new Set(emails.map((e) => e.address)).size !== emails.length) return setError("The same email is listed twice");
    const clash = emails.find((e) => contacts.some((c) => c.id !== editing && c.emails.some((x) => x.address === e.address)));
    if (clash) return setError(`${clash.address} already belongs to another contact`);
    const now = new Date().toISOString();
    const fields = { name, emails, phone: draft.phone.trim(), company: draft.company.trim(), note: draft.note, birthday: draft.birthday, photo: draft.photo };
    if (editing === "new") {
      const c: Contact = { id: Date.now(), ...fields, color: COLORS[contacts.length % COLORS.length], favorite: false, labels: [], added: now, edited: now };
      onContacts((cs) => [...cs, c]);
      setSelectedId(c.id);
      onNotice(`${name} added`);
    } else if (typeof editing === "number") {
      patch(editing, fields);
      onNotice("Contact updated");
    }
    setEditing(null);
  };

  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);
  useEffect(() => {
    if (!confirmDelete && !preview) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setConfirmDelete(null); setPreview(null); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [confirmDelete, preview]);

  const remove = (c: Contact) => {
    onContacts((cs) => cs.filter((x) => x.id !== c.id));
    setSelectedId(null);
    onNotice(`${c.name} removed`);
  };

  const toggleFav = (c: Contact) => onContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, favorite: !x.favorite } : x)));
  const addLabel = (c: Contact) => {
    const l = (labelDraft ?? "").trim();
    setLabelDraft(null);
    if (!l || c.labels.some((x) => x.toLowerCase() === l.toLowerCase())) return;
    patch(c.id, { labels: [...c.labels, l] });
  };

  /* ----- import / export ----- */
  async function readFile(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return onNotice("That file is over 5 MB");
    const text = await file.text();
    const isVcf = /\.vcf$/i.test(file.name) || /BEGIN:VCARD/i.test(text);
    const parsed = isVcf ? parseVCards(text) : parseContactsCsv(text);
    if (!parsed.length) return onNotice(isVcf ? "No contacts found in that vCard file" : "No contacts found. The CSV needs a header row with name and email columns.");
    const known = new Set(contacts.flatMap((c) => c.emails.map((e) => e.address)));
    const seen = new Set<string>();
    const fresh: ImportedContact[] = [];
    let dupes = 0;
    for (const p of parsed) {
      const keys = p.emails.map((e) => e.address);
      if (keys.some((k) => known.has(k) || seen.has(k))) { dupes++; continue; }
      keys.forEach((k) => seen.add(k));
      fresh.push(p);
    }
    setPreview({ source: file.name, fresh, dupes });
  }

  function confirmImport() {
    if (!preview) return;
    const now = new Date().toISOString();
    const start = Date.now();
    const added: Contact[] = preview.fresh.map((p, i) => ({
      id: start + i, ...p, labels: p.labels ?? [], photo: "", color: COLORS[(contacts.length + i) % COLORS.length], favorite: false, added: now, edited: now,
    }));
    onContacts((cs) => [...cs, ...added]);
    onNotice(`${added.length} ${added.length === 1 ? "contact" : "contacts"} imported`);
    if (added[0]) setSelectedId(added[0].id);
    setPreview(null);
  }

  const exportAll = () => {
    if (!contacts.length) return onNotice("There are no contacts to export");
    downloadFile("foxalora-contacts.vcf", toVCard(contacts), "text/vcard");
    onNotice(`${contacts.length} contacts exported`);
  };

  const sentCount = selected ? contactScore(selected, frequency) : 0;

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
            {([["all", "All"], ["frequent", "Frequent"], ["favorites", "Favourites"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={filter === id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
          <div className="ct-io" ref={ioRef}>
            <button type="button" className="reader-action" aria-haspopup="menu" aria-expanded={ioOpen} onClick={() => setIoOpen((v) => !v)}><LuUpload /> Import / export</button>
            {ioOpen && (
              <div className="ct-menu ct-io-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setIoOpen(false); fileRef.current?.click(); }}><LuUpload /> Import CSV or vCard…</button>
                <button type="button" role="menuitem" onClick={() => { setIoOpen(false); exportAll(); }}><LuDownload /> Export all as vCard</button>
                <p className="ct-io-hint">CSV from Gmail, Outlook and most apps works. vCard files (.vcf) can hold one or many contacts.</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".csv,.vcf,text/csv,text/vcard,text/x-vcard" hidden onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <button type="button" className="reader-action primary ct-add" onClick={startNew}><LuPlus /> Add contact</button>
        </header>

        <div className="ct-body">
          <nav className="ct-list" aria-label="Contact list">
            {!list.length && <p className="ct-empty">{query ? `No one matches “${query}”.` : filter === "favorites" ? "No favourites yet. Star someone to keep them here." : filter === "frequent" ? "People you email most will show up here." : "No contacts yet."}</p>}
            {groups.map(([letter, people]) => (
              <div key={letter} className="ct-group">
                <p className="ct-letter">{letter}</p>
                {people.map((c) => {
                  const n = contactScore(c, frequency);
                  return (
                    <button key={c.id} type="button" className={`ct-item ${c.id === selectedId && editing === null ? "active" : ""}`} aria-current={c.id === selectedId ? "true" : undefined} onClick={() => { setSelectedId(c.id); setEditing(null); }}>
                      <Avatar c={c} />
                      <span className="ct-item-text"><strong>{c.name}</strong><small>{mainEmail(c) || c.phone}{c.emails.length > 1 ? ` +${c.emails.length - 1}` : ""}</small></span>
                      {filter === "frequent" && n > 0 && <span className="ct-freq" title={`${n} emails sent`}>{n}</span>}
                      {filter !== "frequent" && c.favorite && <LuStar className="ct-fav-dot" aria-label="Favourite" />}
                    </button>
                  );
                })}
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

                <fieldset className="ct-emails">
                  <legend>Email addresses</legend>
                  {draft.emails.map((em, i) => (
                    <div key={i} className="ct-email-row">
                      <input className="set-input" type="email" value={em.address} placeholder="name@example.com" aria-label={`Email ${i + 1}`} onChange={(e) => setEmail(i, { address: e.target.value })} />
                      <select className="set-input" value={em.label} aria-label={`Type of email ${i + 1}`} onChange={(e) => setEmail(i, { label: e.target.value as ContactEmail["label"] })}>
                        {EMAIL_LABELS.map((l) => <option key={l}>{l}</option>)}
                      </select>
                      {i === 0
                        ? <span className="ct-main-tag" title="Used when you click Email">Main</span>
                        : <button type="button" className="ct-make-main" onClick={() => makeMain(i)} title="Make this the main email">Make main</button>}
                      {draft.emails.length > 1 && <button type="button" className="row-action ct-icon" aria-label={`Remove email ${i + 1}`} onClick={() => setDraft((d) => ({ ...d, emails: d.emails.filter((_, j) => j !== i) }))}><LuX /></button>}
                    </div>
                  ))}
                  {draft.emails.length < 6 && <button type="button" className="ct-add-email" onClick={() => setDraft((d) => ({ ...d, emails: [...d.emails, { address: "", label: d.emails.length ? "Personal" : "Work" }] }))}><LuPlus /> Add email</button>}
                </fieldset>

                <div className="ct-form-pair">
                  <label><span>Phone <em>optional</em></span><input className="set-input" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></label>
                  <label><span>Company <em>optional</em></span><input className="set-input" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></label>
                </div>
                <div className="ct-form-pair">
                  <label><span>Birthday <em>optional</em></span><input className="set-input" type="date" value={draft.birthday} onChange={(e) => setDraft({ ...draft, birthday: e.target.value })} /></label>
                  <span />
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
                          {mainEmail(selected) && <button type="button" role="menuitem" onClick={() => { navigator.clipboard?.writeText(mainEmail(selected)); onNotice("Email copied"); setMenuOpen(false); }}><LuCopy /> Copy email</button>}
                          {selected.phone && <button type="button" role="menuitem" onClick={() => { navigator.clipboard?.writeText(selected.phone); onNotice("Phone number copied"); setMenuOpen(false); }}><LuCopy /> Copy phone number</button>}
                          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setLabelDraft(""); }}><LuPlus /> Add label</button>
                          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); downloadFile(`${selected.name.replace(/[^\w\s-]/g, "").trim() || "contact"}.vcf`, toVCard([selected]), "text/vcard"); onNotice("Contact exported"); }}><LuDownload /> Export as vCard</button>
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
                    { label: "Email", icon: LuMail, ok: Boolean(mainEmail(selected)), run: () => onEmail(mainEmail(selected)), why: "Add an email first" },
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
                      {selected.emails.length ? selected.emails.map((em, i) => (
                        <li key={em.address}><LuMail />
                          <span>
                            <a href={`mailto:${em.address}`} onClick={(e) => { e.preventDefault(); onEmail(em.address); }}>{em.address}</a>
                            {" "}<small>· {em.label}{i === 0 && selected.emails.length > 1 ? " · Main" : ""}</small>
                          </span>
                        </li>
                      )) : <li><LuMail /><button type="button" className="ct-add-link" onClick={() => startEdit(selected)}>Add email</button></li>}
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
                    <p><LuTrendingUp className="ct-hist-icon" /> {sentCount ? `You’ve emailed them ${sentCount} ${sentCount === 1 ? "time" : "times"}` : "You haven’t emailed them yet"}</p>
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

      {preview && (
        <div className="ct-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreview(null); }}>
          <div className="ct-modal ct-import" role="dialog" aria-modal="true" aria-labelledby="ct-imp-title">
            <span className="ct-modal-icon ct-imp-icon"><LuUpload /></span>
            <h2 id="ct-imp-title">Import contacts</h2>
            <p>From <strong>{preview.source}</strong>: {preview.fresh.length} new {preview.fresh.length === 1 ? "contact" : "contacts"}{preview.dupes ? `, ${preview.dupes} already in your contacts (skipped)` : ""}.</p>
            {preview.fresh.length > 0 ? (
              <ul className="ct-imp-list">
                {preview.fresh.slice(0, 50).map((p, i) => (
                  <li key={i}>
                    <Avatar c={{ name: p.name, color: COLORS[i % COLORS.length], photo: "" }} />
                    <span><strong>{p.name}</strong><small>{[p.emails.map((e) => e.address).join(", "), p.phone, p.company].filter(Boolean).join(" · ")}</small></span>
                  </li>
                ))}
                {preview.fresh.length > 50 && <li className="ct-imp-more">…and {preview.fresh.length - 50} more</li>}
              </ul>
            ) : <p className="ct-imp-empty">Everyone in this file is already in your contacts.</p>}
            <div className="ct-modal-foot">
              <button type="button" className="reader-action" onClick={() => setPreview(null)}>Cancel</button>
              <button type="button" className="reader-action primary" disabled={!preview.fresh.length} onClick={confirmImport}>Import {preview.fresh.length || ""}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
