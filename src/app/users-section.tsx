"use client";

import { useEffect, useState } from "react";
import { LuExternalLink, LuInfo, LuShieldCheck } from "react-icons/lu";
import type { AdminConfig } from "./settings-store";

/**
 * Foxalora is an email client only (PRD §1.1): it never creates mailboxes, sets passwords
 * or manages storage. Admins see who can manage Foxalora, and a link to the hosting
 * control panel where mailboxes are actually managed (PRD Module 9, "account management links").
 */

const PANELS: { id: AdminConfig["panelType"]; label: string; hint: string }[] = [
  { id: "cpanel", label: "cPanel", hint: "https://host.example.com:2083" },
  { id: "plesk", label: "Plesk", hint: "https://host.example.com:8443" },
  { id: "directadmin", label: "DirectAdmin", hint: "https://host.example.com:2222" },
  { id: "other", label: "Other", hint: "https://panel.example.com" },
];

export default function UsersSection({ admin, onAdmin }: { admin: AdminConfig; onAdmin: (p: Partial<AdminConfig>) => void; onNotice?: (t: string) => void }) {
  const [admins, setAdmins] = useState<string[] | null>(null);
  const [urlDraft, setUrlDraft] = useState(admin.panelUrl);
  const [urlError, setUrlError] = useState("");
  const [tab, setTab] = useState<"admins" | "mailboxes">("admins");

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { admins?: string[] }) => { if (alive) setAdmins(d.admins ?? []); })
      .catch(() => { if (alive) setAdmins([]); });
    return () => { alive = false; };
  }, []);

  const panel = PANELS.find((p) => p.id === admin.panelType) ?? PANELS[0];
  const panelName = panel.id === "other" ? "your control panel" : panel.label;

  const saveUrl = (value: string) => {
    const v = value.trim();
    if (!v) { setUrlError(""); onAdmin({ panelUrl: "" }); return; }
    try {
      const u = new URL(v);
      if (u.protocol !== "https:") throw new Error();
      setUrlError("");
      onAdmin({ panelUrl: u.toString() });
    } catch {
      setUrlError("Enter a full address starting with https://");
    }
  };

  return (
    <div className="set-tabbed">
      <div className="set-segment set-brand-tabs" role="tablist" aria-label="Admins and mailboxes">
        <button type="button" role="tab" aria-selected={tab === "admins"} className={tab === "admins" ? "on" : ""} onClick={() => setTab("admins")}>Administrators</button>
        <button type="button" role="tab" aria-selected={tab === "mailboxes"} className={tab === "mailboxes" ? "on" : ""} onClick={() => setTab("mailboxes")}>Mailboxes</button>
      </div>
      {tab === "admins" && <section className="set-card set-brand-card" role="tabpanel">
        <header className="set-brand-card-head">
          <h3>Administrators</h3>
          <p>People who can open these admin settings.</p>
        </header>
        {admins === null ? (
          <p className="set-note">Loading…</p>
        ) : admins.length === 0 ? (
          <p className="set-note">No administrators are listed on the server.</p>
        ) : (
          <ul className="adm-list">
            {admins.map((a) => (
              <li key={a}>
                <span className="adm-avatar" aria-hidden="true">{a.slice(0, 1).toUpperCase()}</span>
                <span className="adm-email">{a}</span>
                <span className="adm-badge"><LuShieldCheck /> Admin</span>
              </li>
            ))}
          </ul>
        )}
        <p className="adm-help"><LuInfo aria-hidden="true" /> <span>For security, this list is set on the server, not here. To add or remove an admin, change <code>FOXALORA_ADMINS</code> in the server settings and restart Foxalora.</span></p>
      </section>}

      {tab === "mailboxes" && <section className="set-card set-brand-card" role="tabpanel">
        <header className="set-brand-card-head">
          <h3>Mailboxes</h3>
          <p>Create mailboxes, reset passwords and change storage in your hosting control panel. {admin.appName || "Foxalora"} only signs people in to mailboxes that already exist.</p>
        </header>
        <div className="set-row">
          <div className="set-row-text"><strong>Control panel</strong><p>The panel your mailboxes are managed in.</p></div>
          <div className="set-row-control">
            <div className="set-segment" role="radiogroup" aria-label="Control panel">
              {PANELS.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={admin.panelType === p.id} className={admin.panelType === p.id ? "on" : ""} onClick={() => onAdmin({ panelType: p.id })}>{p.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="set-row">
          <div className="set-row-text"><strong>Panel address</strong><p>Where admins sign in to manage mailboxes.</p></div>
          <div className="set-row-control">
            <div className="set-field-wrap">
              <input className="set-input" type="url" inputMode="url" placeholder={panel.hint} value={urlDraft} aria-invalid={Boolean(urlError)} aria-label="Control panel address" onChange={(e) => setUrlDraft(e.target.value)} onBlur={(e) => saveUrl(e.target.value)} />
              {urlError && <span className="set-error">{urlError}</span>}
            </div>
          </div>
        </div>
        <div className="adm-open">
          {admin.panelUrl ? (
            <a className="reader-action primary" href={admin.panelUrl} target="_blank" rel="noopener noreferrer">Manage mailboxes in {panelName} <LuExternalLink /></a>
          ) : (
            <span className="set-note">Add the panel address to get a quick link here.</span>
          )}
        </div>
      </section>}
    </div>
  );
}
