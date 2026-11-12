"use client";

import { useEffect, useMemo, useState } from "react";
import { LuArrowLeft, LuCheck, LuEye, LuEyeOff, LuPaperclip, LuPlus, LuSearch, LuTrash2, LuWandSparkles, LuX, LuMail } from "react-icons/lu";
import type { AdminConfig } from "./settings-store";

type Tab = "general" | "forwarding" | "aliases" | "autoreply" | "antivirus";
export type Account = {
  name?: string; role?: "admin" | "member";
  id: number; local: string; domain: string; password: string; panelAccess: boolean;
  mailbox: boolean; sizeMode: "default" | "custom"; sizeValue: number; sizeUnit: "MB" | "GB"; description: string;
  fwdOn: boolean; fwdTo: string[]; fwdKeepCopy: boolean;
  aliases: string[];
  arOn: boolean; arSubject: string; arFormat: "plain" | "html"; arMessage: string; arFrom: string; arTimesPerDay: number; arUntil: string; arForwardTo: string; arFiles: { name: string; size: number }[];
  avMode: "off" | "in" | "out" | "both"; spamOn: boolean; spamLevel: number; spamAction: "tag" | "move" | "delete";
};

export const DEFAULT_MB = 25 * 1024;
export const blank = (domain: string): Account => ({
  id: 0, local: "", domain, password: "", panelAccess: false,
  mailbox: true, sizeMode: "default", sizeValue: 500, sizeUnit: "MB", description: "",
  fwdOn: false, fwdTo: [], fwdKeepCopy: true, aliases: [],
  arOn: false, arSubject: "Out of office", arFormat: "plain", arMessage: "Thanks for your email. I’m away right now and will reply when I’m back.", arFrom: "", arTimesPerDay: 1, arUntil: "", arForwardTo: "", arFiles: [],
  avMode: "both", spamOn: true, spamLevel: 5, spamAction: "move",
});
const seed = (domain: string): Account[] => [
  { ...blank(domain), id: 1, local: "contact", password: "Sunny-Desk-42", panelAccess: true, description: "Main contact address on the website." },
  { ...blank(domain), id: 2, local: "sales", password: "Blue-River-17", fwdOn: true, fwdTo: ["alex@example.com"], aliases: ["orders"] },
  { ...blank(domain), id: 3, local: "support", password: "Quiet-Lamp-08", arOn: true },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const LOCAL = /^[a-z0-9._-]+$/i;
const genPassword = () => {
  const words = ["Maple", "River", "Cloud", "Stone", "Amber", "Cedar", "Coral", "Frost", "Lunar", "Pixel", "Sunny", "Quiet"];
  const pick = () => words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length];
  return `${pick()}-${pick()}-${String(crypto.getRandomValues(new Uint32Array(1))[0] % 100).padStart(2, "0")}!`;
};
const strength = (p: string) => {
  let s = 0;
  if (p.length >= 8) s++; if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
  return s <= 2 ? { label: "Weak", cls: "weak" } : s <= 3 ? { label: "Okay", cls: "ok" } : { label: "Strong", cls: "strong" };
};
export const sizeMb = (a: Account) => (a.sizeMode === "default" ? DEFAULT_MB : a.sizeValue * (a.sizeUnit === "GB" ? 1024 : 1));

export default function MailAccounts({ admin, onNotice }: { admin: AdminConfig; onNotice: (t: string) => void }) {
  const domains = admin.mappings.map((m) => m.domain);
  const first = domains[0] ?? "example.com";
  const [accounts, setAccounts] = useState<Account[]>(() => seed(first));
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Account | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => !q || `${a.local}@${a.domain} ${a.aliases.join(" ")}`.toLowerCase().includes(q));
  }, [accounts, query]);

  if (editing) {
    return (
      <AccountEditor
        key={editing.id}
        account={editing}
        domains={domains.length ? domains : [first]}
        taken={(addr, id) => accounts.some((a) => a.id !== id && (`${a.local}@${a.domain}` === addr || a.aliases.some((al) => `${al}@${a.domain}` === addr)))}
        onApply={(a) => {
          const saved = a.id ? a : { ...a, id: Date.now() };
          setAccounts((xs) => (a.id ? xs.map((x) => (x.id === a.id ? saved : x)) : [...xs, saved]));
          return saved;
        }}
        onClose={() => setEditing(null)}
        onNotice={onNotice}
      />
    );
  }

  return (
    <div className="set-card ma-card">
      <div className="ma-head">
        <div>
          <h3 className="set-card-title">Email accounts</h3>
          <p className="set-card-hint">Mailboxes on your domains. Open one to change its password, forwarding, aliases, auto-reply and virus protection.</p>
        </div>
        <button type="button" className="reader-action primary" onClick={() => setEditing(blank(first))}><LuPlus /> Create email address</button>
      </div>
      <label className="ct-search ma-search">
        <LuSearch aria-hidden="true" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an address" aria-label="Search email accounts" />
        {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><LuX /></button>}
      </label>
      <ul className="ma-list">
        {list.map((a) => (
          <li key={a.id}>
            <button type="button" className="ma-row" onClick={() => setEditing(a)}>
              <span className="ma-icon"><LuMail /></span>
              <span className="ma-addr"><strong>{a.local}@{a.domain}</strong><small>{a.description || (a.mailbox ? `Mailbox · ${sizeMb(a) >= 1024 ? `${Math.round(sizeMb(a) / 1024)} GB` : `${sizeMb(a)} MB`}` : "Forwarding only")}</small></span>
              <span className="ma-tags">
                {a.fwdOn && <span>Forwarding</span>}
                {a.aliases.length > 0 && <span>{a.aliases.length} alias{a.aliases.length === 1 ? "" : "es"}</span>}
                {a.arOn && <span>Auto-reply on</span>}
                {a.avMode === "off" && <span className="warn">No virus check</span>}
              </span>
            </button>
            <button type="button" className="row-action ma-del" aria-label={`Delete ${a.local}@${a.domain}`} onClick={() => { if (window.confirm(`Delete ${a.local}@${a.domain}? Its mailbox and all email will be removed. You can’t undo this.`)) { setAccounts((xs) => xs.filter((x) => x.id !== a.id)); onNotice(`${a.local}@${a.domain} deleted`); } }}><LuTrash2 /></button>
          </li>
        ))}
        {!list.length && <p className="set-empty">{query ? `No address matches “${query}”.` : "No email accounts yet."}</p>}
      </ul>
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" }, { id: "forwarding", label: "Forwarding" }, { id: "aliases", label: "Email aliases" },
  { id: "autoreply", label: "Auto-reply" }, { id: "antivirus", label: "Antivirus" },
];

export function AccountEditor({ account, domains, taken, onApply, onClose, onNotice, roleCheck, title }: {
  account: Account; domains: string[]; taken: (addr: string, id: number) => boolean;
  onApply: (a: Account) => Account; onClose: () => void; onNotice: (t: string) => void; roleCheck?: (a: Account) => string | null; title?: string;
}) {
  const isNew = account.id === 0;
  const [saved, setSaved] = useState(account);
  const [a, setA] = useState(account);
  const [tab, setTab] = useState<Tab>("general");
  const [confirmPw, setConfirmPw] = useState(account.password);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fwdText, setFwdText] = useState(account.fwdTo.join("\n"));
  const fwdBad = [...new Set(fwdText.split(/[\s,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))].filter((t) => !EMAIL.test(t) || t === `${a.local}@${a.domain}`.toLowerCase());
  const [aliasDraft, setAliasDraft] = useState("");
  const dirty = JSON.stringify(a) !== JSON.stringify(saved) || confirmPw !== saved.password;
  const set = (p: Partial<Account>) => setA((x) => ({ ...x, ...p }));
  const addr = `${a.local || "…"}@${a.domain}`;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (a.name !== undefined && !a.name.trim()) e.name = "Add the person’s name";
    const roleErr = a.role ? roleCheck?.(a) : null;
    if (roleErr) e.role = roleErr;
    if (!LOCAL.test(a.local)) e.local = "Use letters, numbers, dots, dashes or underscores";
    else if (taken(`${a.local.toLowerCase()}@${a.domain}`, a.id)) e.local = "That address is already in use";
    if (a.mailbox || a.panelAccess) {
      if (a.password.length < 8) e.password = "Use at least 8 characters";
      else if (confirmPw !== a.password) e.confirm = "The two passwords don’t match";
    }
    if (a.mailbox && a.sizeMode === "custom") {
      const mb = sizeMb(a);
      if (!(a.sizeValue > 0)) e.size = "Enter a size above 0";
      else if (mb > DEFAULT_MB) e.size = `The mailbox can’t be bigger than the default (${DEFAULT_MB / 1024} GB)`;
    }
    if (a.fwdOn && !a.fwdTo.length) e.fwd = "Add at least one valid address, or switch forwarding off";
    else if (a.fwdOn && fwdBad.length) e.fwd = "Fix or remove the addresses that aren’t valid";
    if (!a.mailbox && !a.fwdOn) e.mailbox = "Without a mailbox, turn on forwarding so mail still goes somewhere";
    if (a.arOn) {
      if (!a.arSubject.trim()) e.arSubject = "Add a subject";
      if (!a.arMessage.trim()) e.ar = "Write the reply people will get";
      if (a.arForwardTo.trim() && !EMAIL.test(a.arForwardTo.trim())) e.arForwardTo = "Enter a full email address, like name@example.com";
      else if (a.arForwardTo.trim().toLowerCase() === `${a.local}@${a.domain}`.toLowerCase()) e.arForwardTo = "Forwarding to itself would loop forever";
      if (!Number.isInteger(a.arTimesPerDay) || a.arTimesPerDay < 1 || a.arTimesPerDay > 100) e.arTimes = "Enter a whole number from 1 to 100";
      if (a.arUntil && a.arUntil < new Date().toISOString().slice(0, 10)) e.arUntil = "Pick today or a later date";
    }
    setErrors(e);
    if (Object.keys(e).length) {
      const where: Tab = e.fwd ? "forwarding" : (e.ar || e.arSubject || e.arForwardTo || e.arTimes || e.arUntil) ? "autoreply" : "general";
      setTab(where);
      return false;
    }
    return true;
  };

  const apply = (close: boolean) => {
    if (!validate()) return;
    const result = onApply({ ...a, local: a.local.toLowerCase() });
    setA(result); setSaved(result);
    onNotice(isNew && !saved.id ? `${result.local}@${result.domain} created` : "Changes saved");
    if (close) onClose();
  };
  const cancel = () => { if (!dirty || window.confirm("Leave without saving? Your changes will be lost.")) onClose(); };

  const addAlias = () => {
    const v = aliasDraft.trim().toLowerCase();
    if (!LOCAL.test(v)) return setErrors((e) => ({ ...e, alias: "Use letters, numbers, dots, dashes or underscores" }));
    if (v === a.local || a.aliases.includes(v) || taken(`${v}@${a.domain}`, a.id)) return setErrors((e) => ({ ...e, alias: `${v}@${a.domain} is already in use` }));
    set({ aliases: [...a.aliases, v] }); setAliasDraft(""); setErrors((e) => ({ ...e, alias: "" }));
  };
  const pw = strength(a.password);

  return (
    <div className="set-card ma-editor">
      <div className="ma-editor-head">
        <button type="button" className="row-action ct-icon" aria-label="Back to email accounts" onClick={cancel}><LuArrowLeft /></button>
        <h3>{isNew && !saved.id ? (title ?? "New email address") : a.name ? <>{a.name} <small className="ma-h-addr">{addr}</small></> : addr}</h3>
        {dirty && <span className="ma-dirty">Unsaved changes</span>}
      </div>

      <div className="ma-tabs" role="tablist" aria-label="Account settings">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
            {((t.id === "forwarding" && a.fwdOn) || (t.id === "autoreply" && a.arOn) || (t.id === "aliases" && a.aliases.length > 0)) && <span className="ma-dot" aria-label="on" />}
          </button>
        ))}
      </div>

      <div className="ma-panel" role="tabpanel">
        {tab === "general" && (
          <>
            {a.name !== undefined && (
              <>
                <div className="ma-field">
                  <label htmlFor="ma-name">Full name <em>*</em></label>
                  <div>
                    <input id="ma-name" className="set-input" autoFocus={isNew} value={a.name} maxLength={80} aria-invalid={Boolean(errors.name)} onChange={(e) => set({ name: e.target.value })} />
                    {errors.name && <span className="set-error">{errors.name}</span>}
                  </div>
                </div>
                <div className="ma-field">
                  <label htmlFor="ma-role">Role</label>
                  <div>
                    <select id="ma-role" className="set-input" value={a.role} onChange={(e) => set({ role: e.target.value as Account["role"] })}>
                      <option value="member">Member: uses email</option>
                      <option value="admin">Admin: can manage settings</option>
                    </select>
                    {errors.role && <span className="set-error">{errors.role}</span>}
                  </div>
                </div>
              </>
            )}
            <p className="ma-intro">Basic details for this address. If <strong>Access to the customer panel</strong> is on, the same email and password also sign in to the hosting panel.</p>
            <div className="ma-field">
              <label htmlFor="ma-local">Email address <em>*</em></label>
              <div>
                <div className="ma-email">
                  <input id="ma-local" className="set-input" value={a.local} placeholder="contact" aria-invalid={Boolean(errors.local)} onChange={(e) => set({ local: e.target.value })} />
                  <span>@</span>
                  <select className="set-input" value={a.domain} onChange={(e) => set({ domain: e.target.value })} aria-label="Domain">{domains.map((d) => <option key={d}>{d}</option>)}</select>
                </div>
                {errors.local && <span className="set-error">{errors.local}</span>}
              </div>
            </div>
            <div className="ma-field">
              <span />
              <label className="ma-check"><input type="checkbox" checked={a.panelAccess} onChange={(e) => set({ panelAccess: e.target.checked })} /> Access to the customer panel <small>(username: {addr})</small></label>
            </div>
            <div className="ma-field">
              <label htmlFor="ma-pw">Password {(a.mailbox || a.panelAccess) && <em>*</em>}</label>
              <div>
                <div className="ma-pw">
                  <input id="ma-pw" className="set-input" type={showPw ? "text" : "password"} autoComplete="new-password" value={a.password} aria-invalid={Boolean(errors.password)} onChange={(e) => set({ password: e.target.value })} />
                  <button type="button" className="reader-action" onClick={() => { const p = genPassword(); set({ password: p }); setConfirmPw(p); setShowPw(true); }}><LuWandSparkles /> Generate</button>
                  <button type="button" className="reader-action" aria-pressed={showPw} onClick={() => setShowPw((v) => !v)}>{showPw ? <><LuEyeOff /> Hide</> : <><LuEye /> Show</>}</button>
                </div>
                {a.password && <span className={`ma-strength ${pw.cls}`}><i /><i /><i /> {pw.label}</span>}
                {errors.password ? <span className="set-error">{errors.password}</span> : <small className="ma-help">Used to open the mailbox{a.panelAccess ? " and to sign in to the hosting panel" : ""}.</small>}
              </div>
            </div>
            <div className="ma-field">
              <label htmlFor="ma-pw2">Confirm password</label>
              <div>
                <input id="ma-pw2" className="set-input" type={showPw ? "text" : "password"} autoComplete="new-password" value={confirmPw} aria-invalid={Boolean(errors.confirm)} onChange={(e) => setConfirmPw(e.target.value)} />
                {errors.confirm && <span className="set-error">{errors.confirm}</span>}
              </div>
            </div>
            <div className="ma-field">
              <label className="ma-check"><input type="checkbox" checked={a.mailbox} onChange={(e) => set({ mailbox: e.target.checked })} /> Mailbox</label>
              <div>
                <fieldset className="ma-radios" disabled={!a.mailbox}>
                  <label><input type="radio" checked={a.sizeMode === "default"} onChange={() => set({ sizeMode: "default" })} /> Default size ({DEFAULT_MB / 1024} GB)</label>
                  <label><input type="radio" checked={a.sizeMode === "custom"} onChange={() => set({ sizeMode: "custom" })} /> Another size
                    <input className="set-input set-num" type="number" min={1} value={a.sizeValue} disabled={a.sizeMode !== "custom"} aria-invalid={Boolean(errors.size)} onChange={(e) => set({ sizeValue: Number(e.target.value) })} aria-label="Mailbox size" />
                    <select className="set-input ma-unit" value={a.sizeUnit} disabled={a.sizeMode !== "custom"} onChange={(e) => set({ sizeUnit: e.target.value as Account["sizeUnit"] })} aria-label="Unit"><option>MB</option><option>GB</option></select>
                  </label>
                </fieldset>
                {errors.size ? <span className="set-error">{errors.size}</span> : errors.mailbox ? <span className="set-error">{errors.mailbox}</span> : <small className="ma-help">{a.mailbox ? "The mailbox size can’t be bigger than the default." : "No mailbox: mail is only forwarded, nothing is stored."}</small>}
              </div>
            </div>
            <div className="ma-field">
              <label htmlFor="ma-desc">Description</label>
              <div>
                <textarea id="ma-desc" className="set-input set-textarea" rows={3} maxLength={300} value={a.description} onChange={(e) => set({ description: e.target.value })} />
                <small className="ma-help">Everyone who can manage this account can see the description.</small>
              </div>
            </div>
          </>
        )}

        {tab === "forwarding" && (
          <>
            <p className="ma-intro">Send every email that reaches <strong>{addr}</strong> on to one or more other addresses. {a.mailbox ? <>Because this address has a mailbox, a copy is also kept here unless you untick it below.</> : <>This address has no mailbox, so mail is only forwarded.</>}</p>
            <div className="ma-switch-row">
              <div><strong>Switch on mail forwarding</strong><small>{a.fwdOn ? `On: going to ${a.fwdTo.length || "no"} address${a.fwdTo.length === 1 ? "" : "es"}` : "Off"}</small></div>
              <SwitchBtn on={a.fwdOn} label="Switch on mail forwarding" onChange={(fwdOn) => set({ fwdOn })} />
            </div>
            <fieldset className="ma-block" disabled={!a.fwdOn}>
              <div className="ma-field">
                <label htmlFor="ma-fwd">Forward incoming messages to <em>*</em></label>
                <div>
                  <textarea id="ma-fwd" className="set-input set-textarea ma-fwd-text" rows={5} value={fwdText} aria-invalid={Boolean(fwdBad.length || errors.fwd)} placeholder={"john@example.com\njane@example.com"}
                    onChange={(e) => {
                      const text = e.target.value;
                      setFwdText(text);
                      const tokens = [...new Set(text.split(/[\s,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))];
                      set({ fwdTo: tokens.filter((t) => EMAIL.test(t) && t !== `${a.local}@${a.domain}`) });
                      setErrors((er) => ({ ...er, fwd: "" }));
                    }} />
                  <small className="ma-help">Type each address on a new line, or separate them with spaces, commas or semicolons.</small>
                  {a.fwdTo.length > 0 && <ul className="ma-chips ma-chips-ok">{a.fwdTo.map((f) => <li key={f}><LuCheck /> {f}</li>)}</ul>}
                  {fwdBad.length > 0 && <span className="set-error">{fwdBad.map((b) => (b === `${a.local}@${a.domain}` ? `${b} (can’t forward to itself)` : b)).join(", ")} {fwdBad.length === 1 ? "isn’t" : "aren’t"} valid and won’t be used.</span>}
                  {errors.fwd && <span className="set-error">{errors.fwd}</span>}
                </div>
              </div>
              <div className="ma-field">
                <span />
                <label className="ma-check"><input type="checkbox" checked={a.mailbox && a.fwdKeepCopy} disabled={!a.mailbox} onChange={(e) => set({ fwdKeepCopy: e.target.checked })} /> Keep a copy in this mailbox {!a.mailbox && <small>(turn on Mailbox in General first)</small>}</label>
              </div>
            </fieldset>
          </>
        )}

        {tab === "aliases" && (
          <>
            <p className="ma-intro">Aliases are extra addresses that land in the <em>same</em> mailbox. Mail to <strong>{aliasDraft.trim() || "orders"}@{a.domain}</strong> would arrive in {addr}.</p>
            <ul className="ma-alias-list">
              {a.aliases.map((al) => (
                <li key={al}><span>{al}<b>@{a.domain}</b></span><button type="button" className="row-action ma-del" aria-label={`Remove ${al}@${a.domain}`} onClick={() => set({ aliases: a.aliases.filter((x) => x !== al) })}><LuTrash2 /></button></li>
              ))}
              {!a.aliases.length && <li className="ma-none">No aliases yet.</li>}
            </ul>
            <form className="ma-add" onSubmit={(e) => { e.preventDefault(); addAlias(); }}>
              <span className="ma-email ma-email-alias">
                <input className="set-input" value={aliasDraft} placeholder="orders" onChange={(e) => setAliasDraft(e.target.value)} aria-label="New alias" />
                <span>@{a.domain}</span>
              </span>
              <button type="submit" className="reader-action"><LuPlus /> Add alias</button>
            </form>
            {errors.alias && <span className="set-error">{errors.alias}</span>}
          </>
        )}

        {tab === "autoreply" && (
          <>
            <p className="ma-intro">Set up an automatic answer to any email that reaches <strong>{addr}</strong>. It’s the usual way to let people know you’re out of office or on holiday.</p>
            <div className="ma-switch-row">
              <div><strong>Switch on auto-reply</strong><small>{a.arOn ? (a.arUntil ? `On until ${new Date(`${a.arUntil}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : "On until you turn it off") : "Off"}</small></div>
              <SwitchBtn on={a.arOn} label="Switch on auto-reply" onChange={(arOn) => set({ arOn })} />
            </div>
            <fieldset className="ma-block" disabled={!a.arOn}>
              <div className="ma-field">
                <label htmlFor="ma-ar-subj">Subject <em>*</em></label>
                <div><input id="ma-ar-subj" className="set-input" value={a.arSubject} maxLength={120} aria-invalid={Boolean(errors.arSubject)} onChange={(e) => set({ arSubject: e.target.value })} />{errors.arSubject && <span className="set-error">{errors.arSubject}</span>}</div>
              </div>
              <div className="ma-field">
                <label>Message format</label>
                <div>
                  <div className="ma-radios">
                    <label><input type="radio" name="ar-format" checked={a.arFormat === "plain"} onChange={() => set({ arFormat: "plain" })} /> Plain text</label>
                    <label><input type="radio" name="ar-format" checked={a.arFormat === "html"} onChange={() => set({ arFormat: "html" })} /> HTML</label>
                  </div>
                  <small className="ma-help">{a.arFormat === "plain" ? "Plain text works in every email app, so everyone sees it exactly as you write it." : "HTML lets you use bold, links and lists, but a few email apps show it as plain text."}</small>
                </div>
              </div>
              <div className="ma-field">
                <label htmlFor="ma-ar-msg">Message <em>*</em></label>
                <div>
                  <textarea id="ma-ar-msg" className="set-input set-textarea" rows={6} value={a.arMessage} aria-invalid={Boolean(errors.ar)} onChange={(e) => set({ arMessage: e.target.value })} />
                  {errors.ar ? <span className="set-error">{errors.ar}</span> : <small className="ma-help">{a.arFormat === "plain" ? "Plain text only: any HTML tags are removed." : "You can use simple HTML like <b>, <a href> and <br>."}</small>}
                </div>
              </div>
              <div className="ma-field">
                <label htmlFor="ma-ar-fwd">Forward to <small>(optional)</small></label>
                <div>
                  <input id="ma-ar-fwd" className="set-input" type="email" value={a.arForwardTo} placeholder="john@example.net" aria-invalid={Boolean(errors.arForwardTo)} onChange={(e) => set({ arForwardTo: e.target.value })} />
                  {errors.arForwardTo ? <span className="set-error">{errors.arForwardTo}</span> : <small className="ma-help">After the automatic reply goes out, the original email is passed on to this address, for example a colleague covering for you.</small>}
                </div>
              </div>
              <div className="ma-field">
                <label htmlFor="ma-ar-times">Reply to the same sender at most <em>*</em></label>
                <div>
                  <span className="set-inline"><input id="ma-ar-times" className="set-input set-num" type="number" min={1} max={100} value={a.arTimesPerDay} aria-invalid={Boolean(errors.arTimes)} onChange={(e) => set({ arTimesPerDay: Number(e.target.value) })} /> time{a.arTimesPerDay === 1 ? "" : "s"} a day</span>
                  {errors.arTimes ? <span className="set-error">{errors.arTimes}</span> : <small className="ma-help">Stops two auto-replies from bouncing back and forth forever.</small>}
                </div>
              </div>
              <div className="ma-field">
                <label>Attachments</label>
                <div>
                  {a.arFiles.length > 0 && (
                    <ul className="ma-files">{a.arFiles.map((f, i) => (
                      <li key={`${f.name}-${i}`}><LuPaperclip /> <span>{f.name}</span><small>{f.size < 1024 * 1024 ? `${Math.max(1, Math.round(f.size / 1024))} KB` : `${(f.size / 1024 / 1024).toFixed(1)} MB`}</small>
                        <button type="button" className="ma-link" onClick={() => set({ arFiles: a.arFiles.filter((_, j) => j !== i) })}>Remove</button></li>
                    ))}</ul>
                  )}
                  <label className="reader-action ma-attach"><LuPlus /> Add an attachment
                    <input type="file" multiple hidden onChange={(e) => {
                      const files = [...(e.target.files ?? [])]; e.target.value = "";
                      const total = [...a.arFiles, ...files].reduce((t, f) => t + f.size, 0);
                      if (total > 5 * 1024 * 1024) { setErrors((er) => ({ ...er, arFiles: "Attachments can be 5 MB in total" })); return; }
                      setErrors((er) => ({ ...er, arFiles: "" }));
                      set({ arFiles: [...a.arFiles, ...files.map((f) => ({ name: f.name, size: f.size }))] });
                    }} />
                  </label>
                  {errors.arFiles ? <span className="set-error">{errors.arFiles}</span> : <small className="ma-help">Sent with every automatic reply. Up to 5 MB in total.</small>}
                </div>
              </div>
              <div className="ma-field">
                <label className="ma-check"><input type="checkbox" checked={Boolean(a.arUntil)} onChange={(e) => { const d = new Date(); d.setDate(d.getDate() + 7); set({ arUntil: e.target.checked ? d.toISOString().slice(0, 10) : "" }); }} /> Switch off auto-reply on</label>
                <div>
                  <input className="set-input ma-date" type="date" value={a.arUntil} disabled={!a.arUntil} min={new Date().toISOString().slice(0, 10)} aria-label="Switch-off date" aria-invalid={Boolean(errors.arUntil)} onChange={(e) => set({ arUntil: e.target.value })} />
                  {errors.arUntil ? <span className="set-error">{errors.arUntil}</span> : <small className="ma-help">{a.arUntil ? "Auto-reply turns itself off at the start of this day." : "Leave unticked to keep it on until you switch it off."}</small>}
                </div>
              </div>
              <div className="ma-preview">
                <span className="set-preview-label">What people get back</span>
                <strong>{a.arSubject || "(no subject)"}</strong>
                <p>{a.arFormat === "html" ? a.arMessage.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "") || "…" : a.arMessage.replace(/<[^>]+>/g, "") || "…"}</p>
                {a.arFiles.length > 0 && <small className="ma-help"><LuPaperclip /> {a.arFiles.length} attachment{a.arFiles.length === 1 ? "" : "s"}</small>}
              </div>
            </fieldset>
          </>
        )}

        {tab === "antivirus" && (
          <>
            <p className="ma-intro">Check email for viruses and junk before it reaches the inbox or leaves it.</p>
            <label className="ma-sub">Virus protection</label>
            <div className="ma-options" role="radiogroup" aria-label="Virus protection">
              {([["both", "Incoming and outgoing", "Recommended. Protects you and the people you write to."], ["in", "Incoming only", "Check email that arrives."], ["out", "Outgoing only", "Check email you send."], ["off", "Off", "No checks. Not recommended."]] as const).map(([id, label, hint]) => (
                <label key={id} className={`${a.avMode === id ? "on" : ""} ${id === "off" ? "risk" : ""}`}>
                  <input type="radio" name="av" checked={a.avMode === id} onChange={() => set({ avMode: id })} />
                  <span><strong>{label}</strong><small>{hint}</small></span>
                </label>
              ))}
            </div>
            <div className="ma-switch-row">
              <div><strong>Spam filter</strong><small>Catch junk and phishing email.</small></div>
              <SwitchBtn on={a.spamOn} label="Spam filter" onChange={(spamOn) => set({ spamOn })} />
            </div>
            <fieldset className="ma-block ma-grid" disabled={!a.spamOn}>
              <label className="ma-span">How strict <small>{a.spamLevel <= 3 ? "Relaxed: only obvious spam" : a.spamLevel <= 6 ? "Balanced" : "Strict: may catch some real email"}</small>
                <input type="range" min={1} max={10} value={a.spamLevel} onChange={(e) => set({ spamLevel: Number(e.target.value) })} className="ma-range" />
              </label>
              <label className="ma-span">When email looks like spam
                <select className="set-input" value={a.spamAction} onChange={(e) => set({ spamAction: e.target.value as Account["spamAction"] })}>
                  <option value="tag">Deliver it, but add [SPAM] to the subject</option>
                  <option value="move">Move it to the Spam folder</option>
                  <option value="delete">Delete it straight away</option>
                </select>
              </label>
            </fieldset>
          </>
        )}
      </div>

      <div className="ma-foot">
        <small><em>*</em> Required fields</small>
        <button type="button" className="reader-action primary" onClick={() => apply(true)}>OK</button>
        <button type="button" className="reader-action" disabled={!dirty} onClick={() => apply(false)}>Apply</button>
        <button type="button" className="reader-action" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );
}

function SwitchBtn({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`set-toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)}><span /></button>;
}
