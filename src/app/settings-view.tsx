"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  LuArrowLeft, LuBell, LuBookOpen, LuCheck, LuGlobe, LuImage, LuLink2, LuPalette, LuPenLine, LuPlus,
  LuServer, LuShieldCheck, LuTrash2, LuUser, LuUsers, LuX,
} from "react-icons/lu";
import {
  LANGUAGES, formatDateWith, mailHostProblem, validDomain,
  type AdminConfig, type ControlPanel, type DomainMapping, type PanelIntegration, type UserPreferences,
} from "./settings-store";
import UsersSection from "./users-section";

type SectionId = "profile" | "signature" | "region" | "appearance" | "reading" | "notifications" | "users" | "branding" | "servers" | "security" | "integrations";

const USER_SECTIONS: { id: SectionId; label: string; icon: typeof LuUser; blurb: string }[] = [
  { id: "profile", label: "Profile", icon: LuUser, blurb: "How you appear to the people you email." },
  { id: "signature", label: "Signature", icon: LuPenLine, blurb: "Added to the end of the emails you write." },
  { id: "region", label: "Language & region", icon: LuGlobe, blurb: "Language, time zone and how dates look." },
  { id: "appearance", label: "Appearance", icon: LuPalette, blurb: "Theme and how much fits on screen." },
  { id: "reading", label: "Reading & writing", icon: LuBookOpen, blurb: "Replies, previews and images in emails." },
  { id: "notifications", label: "Notifications", icon: LuBell, blurb: "When Foxalora should get your attention." },
];
const ADMIN_SECTIONS: { id: SectionId; label: string; icon: typeof LuUser; blurb: string }[] = [
  { id: "branding", label: "Branding & sign-in", icon: LuImage, blurb: "Name, logo, defaults and the sign-in page everyone sees." },
  { id: "servers", label: "Mail servers", icon: LuServer, blurb: "Which server each email domain uses." },
  { id: "users", label: "Users", icon: LuUsers, blurb: "Everyone with a mailbox. Open a person to change their password, forwarding, aliases, auto-reply and virus protection." },
  { id: "security", label: "Security", icon: LuShieldCheck, blurb: "Sessions, uploads and safety policies." },
  { id: "integrations", label: "Control panels", icon: LuLink2, blurb: "Optional connections to cPanel, Plesk and DirectAdmin." },
];

type Props = {
  prefs: UserPreferences;
  onPrefs: (patch: Partial<UserPreferences>) => void;
  admin: AdminConfig;
  onAdmin: (patch: Partial<AdminConfig>) => void;
  email: string;
  onBack: () => void;
  onNotice: (text: string) => void;
};

/* ---------- small building blocks ---------- */

function Row({ title, hint, children, wide }: { title: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`set-row ${wide ? "wide" : ""}`}>
      <div className="set-row-text"><strong>{title}</strong>{hint && <p>{hint}</p>}</div>
      <div className="set-row-control">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`set-toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="set-segment" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? "on" : ""} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- main view ---------- */

export default function SettingsView({ prefs, onPrefs, admin, onAdmin, email, onBack, onNotice }: Props) {
  const [section, setSection] = useState<SectionId>("profile");
  const [isAdmin, setIsAdmin] = useState(true);
  const all = [...USER_SECTIONS, ...ADMIN_SECTIONS];
  const current = all.find((s) => s.id === section) ?? USER_SECTIONS[0];
  const isAdminSection = ADMIN_SECTIONS.some((s) => s.id === section);

  const timeZones = useMemo(() => {
    try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone"); } catch { return ["UTC", "Europe/London", "America/New_York", "Asia/Karachi", "Asia/Kolkata", "Asia/Tokyo"]; }
  }, []);
  const deviceTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const sample = useMemo(() => new Date(2026, 10, 24, 14, 30), []);

  return (
    <section className="workspace-content settings-screen">
      <div className="message-panel set-panel">
        <header className="set-head">
          <button type="button" className="reader-pill" onClick={onBack}><LuArrowLeft /> <span>Back to mail</span></button>
          <h1>Settings</h1>
          <span className="set-saved"><LuCheck /> Changes save automatically</span>
        </header>

        <div className="set-body">
          <nav className="set-nav" aria-label="Settings sections">
            <p className="set-nav-label">Your preferences</p>
            {USER_SECTIONS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={section === id ? "active" : ""} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}><Icon /> {label}</button>
            ))}
            {isAdmin && (
              <>
                <p className="set-nav-label">Administration <span className="set-badge">Admin</span></p>
                {ADMIN_SECTIONS.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" className={section === id ? "active" : ""} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}><Icon /> {label}</button>
                ))}
              </>
            )}
            <label className="set-role">
              <input type="checkbox" checked={isAdmin} onChange={(e) => { setIsAdmin(e.target.checked); if (!e.target.checked && isAdminSection) setSection("profile"); }} />
              Preview as hosting administrator
            </label>
          </nav>

          <div className="set-content">
            <div className="set-content-head">
              <h2>{current.label}</h2>
              <p>{current.blurb}</p>
            </div>

            {section === "profile" && (
              <div className="set-card">
                <Row title="Display name" hint="The name people see next to your emails.">
                  <input className="set-input" value={prefs.displayName} maxLength={80} onChange={(e) => onPrefs({ displayName: e.target.value })} aria-label="Display name" />
                </Row>
                <div className="set-preview">
                  <span className="set-preview-label">How it looks to recipients</span>
                  <div className="set-preview-mail">
                    <span className="sender-avatar green">{(prefs.displayName || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                    <div><strong>{prefs.displayName.trim() || email}</strong><small>&lt;{email}&gt;</small></div>
                  </div>
                </div>
              </div>
            )}

            {section === "signature" && (
              <div className="set-card">
                <Row title="Default signature" hint="Added to new emails, replies and forwards. You can still remove it in any email." wide>
                  <textarea className="set-input set-textarea" rows={4} value={prefs.signature} onChange={(e) => onPrefs({ signature: e.target.value })} aria-label="Signature" placeholder="Your name&#10;Your role" />
                </Row>
                <div className="set-preview">
                  <span className="set-preview-label">Preview</span>
                  <pre className="set-sig-preview">{prefs.signature.trim() ? `--\n${prefs.signature}` : "No signature. Emails end with your message."}</pre>
                </div>
              </div>
            )}

            {section === "region" && (
              <div className="set-card">
                <Row title="Language" hint="Used for menus and buttons.">
                  <select className="set-input" value={prefs.language} onChange={(e) => onPrefs({ language: e.target.value })} aria-label="Language">
                    {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </Row>
                <Row title="Time zone" hint={`Times in your inbox and calendar follow this. Your device says ${deviceTz}.`}>
                  <select className="set-input" value={prefs.timeZone} onChange={(e) => onPrefs({ timeZone: e.target.value })} aria-label="Time zone">
                    <option value="auto">Use my device’s time zone</option>
                    {timeZones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                  </select>
                </Row>
                <Row title="Date format" hint="How dates appear in lists and emails.">
                  <select className="set-input" value={prefs.dateFormat} onChange={(e) => onPrefs({ dateFormat: e.target.value as UserPreferences["dateFormat"] })} aria-label="Date format">
                    {(["auto", "mdy", "dmy", "ymd"] as const).map((f) => (
                      <option key={f} value={f}>
                        {f === "auto" ? "Automatic" : f === "mdy" ? "Month first" : f === "dmy" ? "Day first" : "Year first"} — {formatDateWith(sample, f, prefs.timeZone)}
                      </option>
                    ))}
                  </select>
                </Row>
              </div>
            )}

            {section === "appearance" && (
              <div className="set-card">
                <Row title="Theme" hint="System follows your device’s light or dark setting.">
                  <Segmented label="Theme" value={prefs.theme} onChange={(theme) => onPrefs({ theme })} options={[{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }, { id: "system", label: "System" }]} />
                </Row>
                <Row title="Inbox density" hint="Compact fits more emails; comfortable is easier to scan.">
                  <Segmented label="Inbox density" value={prefs.density} onChange={(density) => onPrefs({ density })} options={[{ id: "comfortable", label: "Comfortable" }, { id: "compact", label: "Compact" }]} />
                </Row>
                <div className="set-density-demo" aria-hidden="true">
                  {[0, 1, 2].map((i) => <span key={i} className={prefs.density} />)}
                </div>
              </div>
            )}

            {section === "reading" && (
              <div className="set-card">
                <Row title="Reply format" hint="Formatted lets you use bold, lists and links. Plain text works everywhere.">
                  <Segmented label="Reply format" value={prefs.replyFormat} onChange={(replyFormat) => onPrefs({ replyFormat })} options={[{ id: "html", label: "Formatted" }, { id: "plain", label: "Plain text" }]} />
                </Row>
                <Row title="Message preview" hint="Show the first line of each email in your inbox.">
                  <Toggle label="Message preview" checked={prefs.showPreview} onChange={(showPreview) => onPrefs({ showPreview })} />
                </Row>
                <Row title="Images in emails" hint="Images can tell senders when you open their email. Asking first keeps that private.">
                  <Segmented label="Images in emails" value={prefs.remoteImages} onChange={(remoteImages) => onPrefs({ remoteImages })} options={[{ id: "ask", label: "Ask first" }, { id: "always", label: "Always show" }]} />
                </Row>
                {admin.blockRemoteImages && prefs.remoteImages === "always" && <p className="set-note">Your administrator blocks outside images for everyone, so they stay hidden.</p>}
              </div>
            )}

            {section === "notifications" && (
              <div className="set-card">
                <Row title="New email" hint="A desktop notification when an email arrives.">
                  <Toggle label="New email notifications" checked={prefs.notifyNewMail} onChange={(v) => {
                    onPrefs({ notifyNewMail: v });
                    if (v && typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().then((r) => { if (r === "denied") onNotice("Your browser blocked notifications. You can allow them in its site settings."); });
                  }} />
                </Row>
                <Row title="Sound" hint="Play a soft sound with notifications.">
                  <Toggle label="Notification sound" checked={prefs.notifySound} onChange={(notifySound) => onPrefs({ notifySound })} />
                </Row>
                <Row title="Calendar reminders" hint="A heads-up before events start.">
                  <Toggle label="Calendar reminders" checked={prefs.notifyCalendar} onChange={(notifyCalendar) => onPrefs({ notifyCalendar })} />
                </Row>
              </div>
            )}

            {section === "branding" && <BrandingSection admin={admin} onAdmin={onAdmin} onNotice={onNotice} />}
            {section === "users" && <UsersSection admin={admin} onNotice={onNotice} />}
            {section === "servers" && <ServersSection admin={admin} onAdmin={onAdmin} onNotice={onNotice} />}
            {section === "security" && (
              <div className="set-card">
                <Row title="Sign people out after" hint="How long someone can be inactive before signing in again.">
                  <select className="set-input" value={admin.sessionTimeout} onChange={(e) => onAdmin({ sessionTimeout: Number(e.target.value) })} aria-label="Session timeout">
                    {[15, 30, 60, 240, 480, 1440].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : m === 1440 ? "1 day" : `${m / 60} hour${m === 60 ? "" : "s"}`}</option>)}
                  </select>
                </Row>
                <Row title="Attachment limit" hint="The largest total size for one email’s attachments.">
                  <div className="set-inline"><input className="set-input set-num" type="number" min={1} max={100} value={admin.uploadLimitMb} onChange={(e) => onAdmin({ uploadLimitMb: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })} aria-label="Attachment limit in MB" /><span>MB</span></div>
                </Row>
                <Row title="Failed sign-in attempts" hint="Accounts pause for 15 minutes after this many wrong passwords.">
                  <select className="set-input" value={admin.maxLoginAttempts} onChange={(e) => onAdmin({ maxLoginAttempts: Number(e.target.value) })} aria-label="Failed sign-in attempts">
                    {[3, 5, 10].map((n) => <option key={n} value={n}>{n} attempts</option>)}
                  </select>
                </Row>
                <Row title="Require encrypted connections" hint="Only connect to mail servers over SSL/TLS.">
                  <Toggle label="Require encrypted connections" checked={admin.requireTls} onChange={(requireTls) => onAdmin({ requireTls })} />
                </Row>
                <Row title="Block outside images for everyone" hint="Protects people from tracking pixels, whatever their own setting.">
                  <Toggle label="Block outside images" checked={admin.blockRemoteImages} onChange={(blockRemoteImages) => onAdmin({ blockRemoteImages })} />
                </Row>
              </div>
            )}
            {section === "integrations" && <IntegrationsSection admin={admin} onAdmin={onAdmin} onNotice={onNotice} />}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- admin: branding ---------- */

function BrandingSection({ admin, onAdmin, onNotice }: { admin: AdminConfig; onAdmin: (p: Partial<AdminConfig>) => void; onNotice: (t: string) => void }) {
  const [emailError, setEmailError] = useState("");
  return (
    <div className="set-brand-layout">
      <div className="set-brand-form">
      <div className="set-card">
        <Row title="App name" hint="Shown in the top bar, sign-in page and browser tab.">
          <input className="set-input" value={admin.appName} maxLength={40} onChange={(e) => onAdmin({ appName: e.target.value })} aria-label="App name" />
        </Row>
        <Row title="Logo" hint="A square PNG or SVG works best. Up to 500 KB.">
          <div className="set-logo">
            <span className="set-logo-preview" style={{ background: admin.logo ? undefined : admin.accent }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the uploaded logo */}
              {admin.logo ? <img src={admin.logo} alt="Logo preview" /> : (admin.appName || "F").slice(0, 1).toUpperCase()}
            </span>
            <label className="reader-action set-file">Upload<input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 500 * 1024) return onNotice("That logo is over 500 KB");
              const reader = new FileReader();
              reader.onload = () => onAdmin({ logo: String(reader.result) });
              reader.readAsDataURL(file);
            }} /></label>
            {admin.logo && <button type="button" className="reader-action" onClick={() => onAdmin({ logo: "" })}>Remove</button>}
          </div>
        </Row>
        <Row title="Brand colour" hint="Used for the logo background and highlights.">
          <div className="set-inline"><input type="color" className="set-color" value={admin.accent} onChange={(e) => onAdmin({ accent: e.target.value })} aria-label="Brand colour" /><code>{admin.accent}</code></div>
        </Row>
        <Row title="Support email" hint="Where people go when they need help.">
          <div className="set-field-wrap">
            <input className="set-input" type="email" value={admin.supportEmail} aria-invalid={Boolean(emailError)} onChange={(e) => { onAdmin({ supportEmail: e.target.value }); setEmailError(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.target.value) ? "" : "Enter a valid email address"); }} aria-label="Support email" />
            {emailError && <span className="set-error">{emailError}</span>}
          </div>
        </Row>
      </div>

      <div className="set-card">
        <Row title="Sign-in page heading" hint="The first thing people read.">
          <input className="set-input" value={admin.loginTitle} maxLength={60} onChange={(e) => onAdmin({ loginTitle: e.target.value })} aria-label="Sign-in heading" />
        </Row>
        <Row title="Sign-in message" hint="A short line under the heading, like who to contact.">
          <textarea className="set-input set-textarea" rows={2} maxLength={200} value={admin.loginMessage} onChange={(e) => onAdmin({ loginMessage: e.target.value })} aria-label="Sign-in message" />
        </Row>
      </div>
      </div>
      <aside className="set-brand-aside">
        <div className="set-preview set-brand-preview">
          <span className="set-preview-label">Live sign-in preview</span>
          <div className="set-login-preview">
            <span className="set-logo-preview small" style={{ background: admin.logo ? undefined : admin.accent }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              {admin.logo ? <img src={admin.logo} alt="" /> : (admin.appName || "F").slice(0, 1).toUpperCase()}
            </span>
            <strong>{admin.loginTitle || "Welcome back"}</strong>
            <p>{admin.loginMessage}</p>
            <span className="set-login-field">Email address</span>
            <span className="set-login-field">Password</span>
            <span className="set-login-btn" style={{ background: admin.accent }}>Sign in to {admin.appName || "Foxalora"}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ---------- admin: servers + domain mapping ---------- */

function ServersSection({ admin, onAdmin, onNotice }: { admin: AdminConfig; onAdmin: (p: Partial<AdminConfig>) => void; onNotice: (t: string) => void }) {
  const [draft, setDraft] = useState({ domain: "", imap: "", smtp: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const imapProblem = mailHostProblem(admin.imapHost);
  const smtpProblem = mailHostProblem(admin.smtpHost);

  const add = () => {
    const e: Record<string, string> = {};
    const domain = draft.domain.trim().toLowerCase();
    if (!validDomain(domain)) e.domain = "Enter a domain like example.com";
    else if (admin.mappings.some((m) => m.domain === domain)) e.domain = "That domain is already mapped";
    const imap = mailHostProblem(draft.imap); if (imap) e.imap = imap;
    const smtp = mailHostProblem(draft.smtp || draft.imap); if (smtp) e.smtp = smtp;
    setErrors(e);
    if (Object.keys(e).length) return;
    const next: DomainMapping = { id: Date.now(), domain, imap: draft.imap.trim().toLowerCase(), smtp: (draft.smtp || draft.imap).trim().toLowerCase() };
    onAdmin({ mappings: [...admin.mappings, next] });
    setDraft({ domain: "", imap: "", smtp: "" });
    onNotice(`${domain} added`);
  };

  return (
    <>
      <div className="set-callout">
        <LuShieldCheck />
        <p><strong>Only domains listed here can sign in.</strong> People never type a server address themselves, so nobody can point Foxalora at an internal or unknown server.</p>
      </div>

      <div className="set-card">
        <h3 className="set-card-title">Domains and their servers</h3>
        <div className="set-table" role="table" aria-label="Domain mappings">
          <div className="set-tr head" role="row"><span role="columnheader">Domain</span><span role="columnheader">IMAP (incoming)</span><span role="columnheader">SMTP (outgoing)</span><span /></div>
          {admin.mappings.map((m) => (
            <div key={m.id} className="set-tr" role="row">
              <span role="cell"><strong>{m.domain}</strong></span>
              <span role="cell"><code>{m.imap}</code></span>
              <span role="cell"><code>{m.smtp}</code></span>
              <button type="button" className="row-action" aria-label={`Remove ${m.domain}`} onClick={() => { onAdmin({ mappings: admin.mappings.filter((x) => x.id !== m.id) }); onNotice(`${m.domain} removed`); }}><LuTrash2 /></button>
            </div>
          ))}
          {!admin.mappings.length && <p className="set-empty">No domains yet. Add one below so people can sign in.</p>}
        </div>
        <form className="set-add-mapping" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <label><span>Domain</span><input className="set-input" placeholder="example4.com" value={draft.domain} aria-invalid={Boolean(errors.domain)} onChange={(e) => setDraft({ ...draft, domain: e.target.value })} />{errors.domain && <em>{errors.domain}</em>}</label>
          <label><span>IMAP server</span><input className="set-input" placeholder="mail4.host.com" value={draft.imap} aria-invalid={Boolean(errors.imap)} onChange={(e) => setDraft({ ...draft, imap: e.target.value })} />{errors.imap && <em>{errors.imap}</em>}</label>
          <label><span>SMTP server</span><input className="set-input" placeholder="Same as IMAP" value={draft.smtp} aria-invalid={Boolean(errors.smtp)} onChange={(e) => setDraft({ ...draft, smtp: e.target.value })} />{errors.smtp && <em>{errors.smtp}</em>}</label>
          <button type="submit" className="reader-action primary"><LuPlus /> Add domain</button>
        </form>
      </div>

      <div className="set-card">
        <h3 className="set-card-title">Default servers</h3>
        <p className="set-card-hint">Used for any mapped domain that doesn’t name its own server.</p>
        <Row title="IMAP (incoming mail)" hint={imapProblem ?? undefined}>
          <div className="set-server">
            <input className="set-input" value={admin.imapHost} aria-invalid={Boolean(imapProblem)} onChange={(e) => onAdmin({ imapHost: e.target.value })} aria-label="IMAP host" />
            <input className="set-input set-num" type="number" value={admin.imapPort} onChange={(e) => onAdmin({ imapPort: Number(e.target.value) })} aria-label="IMAP port" />
            <select className="set-input" value={admin.imapSecurity} onChange={(e) => onAdmin({ imapSecurity: e.target.value as AdminConfig["imapSecurity"] })} aria-label="IMAP security"><option value="ssl">SSL/TLS</option><option value="starttls">STARTTLS</option></select>
          </div>
        </Row>
        <Row title="SMTP (outgoing mail)" hint={smtpProblem ?? undefined}>
          <div className="set-server">
            <input className="set-input" value={admin.smtpHost} aria-invalid={Boolean(smtpProblem)} onChange={(e) => onAdmin({ smtpHost: e.target.value })} aria-label="SMTP host" />
            <input className="set-input set-num" type="number" value={admin.smtpPort} onChange={(e) => onAdmin({ smtpPort: Number(e.target.value) })} aria-label="SMTP port" />
            <select className="set-input" value={admin.smtpSecurity} onChange={(e) => onAdmin({ smtpSecurity: e.target.value as AdminConfig["smtpSecurity"] })} aria-label="SMTP security"><option value="ssl">SSL/TLS</option><option value="starttls">STARTTLS</option></select>
          </div>
        </Row>
      </div>
    </>
  );
}

/* ---------- admin: control panel integrations ---------- */

const PANELS: { id: ControlPanel; name: string; hint: string }[] = [
  { id: "cpanel", name: "cPanel", hint: "WHM API token from your cPanel server." },
  { id: "plesk", name: "Plesk", hint: "API key from Plesk → Tools & Settings." },
  { id: "directadmin", name: "DirectAdmin", hint: "Login key from DirectAdmin." },
];

function IntegrationsSection({ admin, onAdmin, onNotice }: { admin: AdminConfig; onAdmin: (p: Partial<AdminConfig>) => void; onNotice: (t: string) => void }) {
  const [openPanel, setOpenPanel] = useState<ControlPanel | null>(null);
  const update = (id: ControlPanel, patch: Partial<PanelIntegration>) => onAdmin({ integrations: { ...admin.integrations, [id]: { ...admin.integrations[id], ...patch } } });

  return (
    <>
      <div className="set-callout neutral">
        <LuLink2 />
        <p><strong>These are optional.</strong> Foxalora works on its own; a control panel just lets people jump in from their hosting account without signing in again.</p>
      </div>
      {PANELS.map((panel) => {
        const cfg = admin.integrations[panel.id];
        const open = openPanel === panel.id;
        const ready = cfg.enabled && cfg.url && cfg.token;
        return (
          <div key={panel.id} className={`set-card set-integration ${open ? "open" : ""}`}>
            <div className="set-int-head">
              <span className={`set-int-logo ${panel.id}`}>{panel.name.slice(0, 2)}</span>
              <div><strong>{panel.name}</strong><span className={`set-status ${ready ? "on" : cfg.enabled ? "warn" : ""}`}>{ready ? "Connected" : cfg.enabled ? "Needs details" : "Not connected"}</span></div>
              <button type="button" className="reader-action" aria-expanded={open} onClick={() => setOpenPanel(open ? null : panel.id)}>{open ? "Close" : cfg.enabled ? "Manage" : "Set up"}</button>
            </div>
            {open && (
              <div className="set-int-body">
                <Row title="Use this integration">
                  <Toggle label={`Enable ${panel.name}`} checked={cfg.enabled} onChange={(enabled) => update(panel.id, { enabled })} />
                </Row>
                <Row title="Server address" hint={`The ${panel.name} panel URL, starting with https://`}>
                  <input className="set-input" placeholder="https://panel.yourhost.com:2087" value={cfg.url} onChange={(e) => update(panel.id, { url: e.target.value })} aria-label={`${panel.name} URL`} />
                </Row>
                <Row title="API token" hint={panel.hint}>
                  <input className="set-input" type="password" autoComplete="off" placeholder="••••••••" value={cfg.token} onChange={(e) => update(panel.id, { token: e.target.value })} aria-label={`${panel.name} API token`} />
                </Row>
                <Row title="Single sign-on" hint="Open mail straight from the hosting panel without another password."><Toggle label="Single sign-on" checked={cfg.sso} onChange={(sso) => update(panel.id, { sso })} /></Row>
                <Row title="Find the mailbox automatically" hint="Use the account the person is signed in to on the panel."><Toggle label="Automatic mailbox identification" checked={cfg.autoMailbox} onChange={(autoMailbox) => update(panel.id, { autoMailbox })} /></Row>
                <Row title="After signing in, go to" hint="Optional. Leave empty to open the inbox.">
                  <input className="set-input" placeholder="/inbox" value={cfg.loginRedirect} onChange={(e) => update(panel.id, { loginRedirect: e.target.value })} aria-label="Login redirect" />
                </Row>
                <Row title="Show account management links" hint="Links back to the panel for passwords and quotas."><Toggle label="Account management links" checked={cfg.accountLinks} onChange={(accountLinks) => update(panel.id, { accountLinks })} /></Row>
                <Row title="Sign out of both together" hint="Signing out here also ends the panel session, and the other way round."><Toggle label="Shared sign-out" checked={cfg.logoutSync} onChange={(logoutSync) => update(panel.id, { logoutSync })} /></Row>
                <div className="set-int-foot">
                  <button type="button" className="reader-action" disabled={!cfg.url || !cfg.token} onClick={() => onNotice(/^https:\/\//i.test(cfg.url) ? `Couldn’t reach ${panel.name} from this preview. Connect a server to test.` : "The address must start with https://")}>Test connection</button>
                  {cfg.enabled && <button type="button" className="reader-action" onClick={() => { update(panel.id, { enabled: false, url: "", token: "" }); onNotice(`${panel.name} disconnected`); }}><LuX /> Disconnect</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
