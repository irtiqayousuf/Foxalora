"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  LuArrowLeft, LuBell, LuCamera, LuCheck, LuGlobe, LuImage, LuLayoutGrid, LuLock, LuMail, LuMailOpen, LuEye, LuPalette, LuPenLine, LuPlus,
  LuMonitor, LuMoon, LuRows3, LuRows4, LuServer, LuShieldCheck, LuSun, LuTrash2, LuUpload, LuUser, LuUsers,
} from "react-icons/lu";
import {
  LANGUAGES, formatDateWith, mailHostProblem, validDomain,
  type AdminConfig, type DomainMapping, type UserPreferences,
} from "./settings-store";
import UsersSection from "./users-section";
import RichEditor from "./rich-editor";
import { useT } from "./i18n";
import { sanitizeOutgoingHtml, signatureHasContent, toSignatureHtml } from "./email-html";

type SectionId = "profile" | "navigation" | "signature" | "region" | "appearance" | "notifications" | "users" | "branding" | "servers" | "security" | "integrations";

const USER_SECTIONS: { id: SectionId; label: string; icon: typeof LuUser; blurb: string }[] = [
  { id: "profile", label: "Profile", icon: LuUser, blurb: "How you appear to the people you email." },
  { id: "signature", label: "Signature", icon: LuPenLine, blurb: "Added to the end of the emails you write." },
  { id: "region", label: "Language & region", icon: LuGlobe, blurb: "Language, time zone and how dates look." },
  { id: "appearance", label: "Appearance & reading", icon: LuPalette, blurb: "Theme, density, replies, previews and images in emails." },
  { id: "notifications", label: "Notifications", icon: LuBell, blurb: "When Foxalora should get your attention." },
];
const ADMIN_SECTIONS: { id: SectionId; label: string; icon: typeof LuUser; blurb: string }[] = [
  { id: "branding", label: "Branding & sign-in", icon: LuImage, blurb: "Name, logo, defaults and the sign-in page everyone sees." },
  { id: "servers", label: "Mail servers", icon: LuServer, blurb: "Which server each email domain uses." },
  { id: "users", label: "Admins & mailboxes", icon: LuUsers, blurb: "Who can manage Foxalora, and where mailboxes are managed." },
  { id: "navigation", label: "Navigation", icon: LuLayoutGrid, blurb: "Choose which apps appear in the top bar for everyone." },
  { id: "security", label: "Security", icon: LuShieldCheck, blurb: "Sessions, uploads and safety policies." },
];

type Props = {
  /** Decided by the server (FOXALORA_ADMINS), not by the browser. */
  isAdmin: boolean;
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

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; icon?: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="set-segment" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? "on" : ""} onClick={() => onChange(o.id)}>{o.icon}{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- main view ---------- */

export default function SettingsView({ isAdmin, prefs, onPrefs, admin, onAdmin, email, onBack, onNotice }: Props) {
  const t = useT();
  const [section, setSection] = useState<SectionId>("profile");
  const [appearanceTab, setAppearanceTab] = useState<"appearance" | "reading">("appearance");
  const [securityTab, setSecurityTab] = useState<"policies" | "access">("policies");
  const all = [...USER_SECTIONS, ...ADMIN_SECTIONS];
  const current = all.find((s) => s.id === section) ?? USER_SECTIONS[0];

  const timeZones = useMemo(() => {
    try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone"); } catch { return ["UTC", "Europe/London", "America/New_York", "Asia/Karachi", "Asia/Kolkata", "Asia/Tokyo"]; }
  }, []);
  const deviceTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const sample = useMemo(() => new Date(2026, 10, 24, 14, 30), []);

  return (
    <section className="workspace-content settings-screen">
      <div className="message-panel set-panel">
        <header className="set-head">
          <button type="button" className="reader-pill" onClick={onBack}><LuArrowLeft /> <span>{t("Back to mail")}</span></button>
          <h1>{t("Settings")}</h1>
          <span className="set-saved"><LuCheck /> {t("Changes save automatically")}</span>
        </header>

        <div className="set-body">
          <nav className="set-nav" aria-label="Settings sections">
            <p className="set-nav-label">{t("Your preferences")}</p>
            {USER_SECTIONS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={section === id ? "active" : ""} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}><Icon /> {t(label)}</button>
            ))}
            {isAdmin && (
              <>
                <p className="set-nav-label">{t("Administration")} <span className="set-badge">Admin</span></p>
                {ADMIN_SECTIONS.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" className={section === id ? "active" : ""} aria-current={section === id ? "page" : undefined} onClick={() => setSection(id)}><Icon /> {t(label)}</button>
                ))}
              </>
            )}
          </nav>

          <div className="set-content">
            <div className="set-content-head">
              <h2>{t(current.label)}</h2>
              <p>{current.blurb}</p>
            </div>

            {section === "profile" && <ProfileSection prefs={prefs} onPrefs={onPrefs} email={email} onNotice={onNotice} />}

            {section === "navigation" && (
              <div className="set-card">
                <Row title="Mail" hint="Mail is always on.">
                  <Toggle label="Mail" checked onChange={() => {}} />
                </Row>
                <Row title="Calendar" hint="Events, schedules and reminders.">
                  <Toggle label="Calendar" checked={admin.navCalendar} onChange={(navCalendar) => onAdmin({ navCalendar })} />
                </Row>
                <Row title="Contacts" hint="People you email.">
                  <Toggle label="Contacts" checked={admin.navContacts} onChange={(navContacts) => onAdmin({ navContacts })} />
                </Row>
                <Row title="Notes" hint="Notes and tasks.">
                  <Toggle label="Notes" checked={admin.navNotes} onChange={(navNotes) => onAdmin({ navNotes })} />
                </Row>
                {!admin.navCalendar && !admin.navContacts && !admin.navNotes && <p className="set-note">Only Mail is on, so the top bar shows a full search box instead of app tabs.</p>}
              </div>
            )}

            {section === "signature" && <SignatureSection prefs={prefs} onPrefs={onPrefs} email={email} onNotice={onNotice} />}

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
              <div className="set-tabbed">
              <div className="set-segment set-brand-tabs" role="tablist" aria-label="Appearance sections">
                <button type="button" role="tab" aria-selected={appearanceTab === "appearance"} className={appearanceTab === "appearance" ? "on" : ""} onClick={() => setAppearanceTab("appearance")}>Appearance</button>
                <button type="button" role="tab" aria-selected={appearanceTab === "reading"} className={appearanceTab === "reading" ? "on" : ""} onClick={() => setAppearanceTab("reading")}>Reading &amp; writing</button>
              </div>
              {appearanceTab === "appearance" && <div className="set-card" role="tabpanel">
                <Row title="Theme" hint="System follows your device’s light or dark setting.">
                  <Segmented label="Theme" value={prefs.theme} onChange={(theme) => onPrefs({ theme })} options={[{ id: "light", label: "Light", icon: <LuSun /> }, { id: "dark", label: "Dark", icon: <LuMoon /> }, { id: "system", label: "System", icon: <LuMonitor /> }]} />
                </Row>
                <Row title="Inbox density" hint="Compact fits more emails; comfortable is easier to scan.">
                  <Segmented label="Inbox density" value={prefs.density} onChange={(density) => onPrefs({ density })} options={[{ id: "comfortable", label: "Comfortable", icon: <LuRows3 /> }, { id: "compact", label: "Compact", icon: <LuRows4 /> }]} />
                </Row>
              </div>}
              {appearanceTab === "reading" && <div className="set-card" role="tabpanel">
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
              </div>}
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
            {section === "users" && <UsersSection admin={admin} onAdmin={onAdmin} />}
            {section === "servers" && <ServersSection admin={admin} onAdmin={onAdmin} onNotice={onNotice} />}
            {section === "security" && (
              <div className="set-tabbed">
              <div className="set-segment set-brand-tabs" role="tablist" aria-label="Security sections">
                <button type="button" role="tab" aria-selected={securityTab === "policies"} className={securityTab === "policies" ? "on" : ""} onClick={() => setSecurityTab("policies")}>Policies</button>
                <button type="button" role="tab" aria-selected={securityTab === "access"} className={securityTab === "access" ? "on" : ""} onClick={() => setSecurityTab("access")}>Who can sign in</button>
              </div>
              {securityTab === "policies" && <div className="set-card" role="tabpanel">
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
              </div>}
              {securityTab === "access" && <div role="tabpanel"><AllowedDomains admin={admin} onAdmin={onAdmin} /></div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- admin: branding ---------- */

function BrandingSection({ admin, onAdmin, onNotice }: { admin: AdminConfig; onAdmin: (p: Partial<AdminConfig>) => void; onNotice: (t: string) => void }) {
  const [emailError, setEmailError] = useState("");
  const [tab, setTab] = useState<"identity" | "signin">("identity");
  return (
    <div className="set-brand-layout">
      <div className="set-brand-form">
        <div className="set-segment set-brand-tabs" role="tablist" aria-label="Branding sections">
          <button type="button" role="tab" aria-selected={tab === "identity"} className={tab === "identity" ? "on" : ""} onClick={() => setTab("identity")}>Brand identity</button>
          <button type="button" role="tab" aria-selected={tab === "signin"} className={tab === "signin" ? "on" : ""} onClick={() => setTab("signin")}>Sign-in page</button>
        </div>
        {tab === "identity" && <section className="set-card set-brand-card" role="tabpanel">
          <header className="set-brand-card-head">
            <h3>Brand identity</h3>
            <p>Give Foxalora a name and look people recognize.</p>
          </header>
          <Row title="App name" hint="Shown across the app and in the browser tab.">
            <input className="set-input" value={admin.appName} maxLength={40} onChange={(e) => onAdmin({ appName: e.target.value })} aria-label="App name" />
          </Row>
          <div className="set-logo-block">
            <div className="set-logo-block-head">
              <strong>Logos</strong>
              <small>PNG, SVG, JPEG, or WebP. Max 500 KB each. If there’s no dark logo, the light one is used.</small>
            </div>
            <div className="set-logo-slots">
              {([["logo", "Light mode", "light"], ["logoDark", "Dark mode", "dark"]] as const).map(([key, label, mode]) => {
                const src = admin[key];
                return (
                  <div key={key} className={`set-logo-slot ${mode}${src ? " has" : ""}`}>
                    <label className="set-logo-slot-canvas" title={src ? "Replace logo" : "Upload logo"}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the uploaded logo */}
                      {src ? <img src={src} alt={`${label} logo`} /> : <span className="set-logo-placeholder"><LuUpload /><em>Click to upload</em></span>}
                      <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        if (file.size > 500 * 1024) return onNotice("That logo is over 500 KB");
                        const reader = new FileReader();
                        reader.onload = () => onAdmin({ [key]: String(reader.result) });
                        reader.readAsDataURL(file);
                      }} />
                    </label>
                    <div className="set-logo-slot-foot">
                      <span className="set-logo-mode">{mode === "light" ? <LuSun /> : <LuMoon />}{label}</span>
                      {src && <button type="button" className="set-logo-remove" aria-label={`Remove ${label.toLowerCase()} logo`} onClick={() => onAdmin({ [key]: "" })}><LuTrash2 /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="set-color-block">
            <div className="set-logo-block-head">
              <strong>Brand colour</strong>
              <small>Used for buttons and accents.</small>
            </div>
            <div className="set-color-row">
              <div className="set-swatches" role="radiogroup" aria-label="Preset colours">
                {["#111114", "#2563eb", "#316f57", "#7c3aed", "#db2777", "#ea580c"].map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={admin.accent.toLowerCase() === c} aria-label={c} className="set-swatch" style={{ background: c }} onClick={() => onAdmin({ accent: c })}>{admin.accent.toLowerCase() === c && <LuCheck />}</button>
                ))}
              </div>
              <label className="set-hex">
                <input type="color" value={admin.accent} onChange={(e) => onAdmin({ accent: e.target.value })} aria-label="Custom colour" />
                <input type="text" className="set-hex-text" maxLength={7} defaultValue={admin.accent} key={admin.accent} aria-label="Hex code" onBlur={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) onAdmin({ accent: v.toLowerCase() }); else e.target.value = admin.accent; }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
              </label>
            </div>
          </div>
        </section>}

        {tab === "signin" && <section className="set-card set-brand-card" role="tabpanel">
          <header className="set-brand-card-head">
            <h3>Sign-in page</h3>
            <p>Set the welcome message and a contact address for help.</p>
          </header>
          <Row title="Heading" hint="A short welcome, such as “Welcome back”.">
            <input className="set-input" value={admin.loginTitle} maxLength={60} onChange={(e) => onAdmin({ loginTitle: e.target.value })} aria-label="Sign-in heading" />
          </Row>
          <Row title="Message" hint="Optional. Keep it to one short sentence.">
            <textarea className="set-input set-textarea" rows={2} value={admin.loginMessage} maxLength={200} onChange={(e) => onAdmin({ loginMessage: e.target.value })} aria-label="Sign-in message" />
          </Row>
          <Row title="Support email" hint="Shown to people who need help signing in.">
            <div className="set-field-wrap">
              <input className="set-input" type="email" value={admin.supportEmail} aria-invalid={Boolean(emailError)} onChange={(e) => { onAdmin({ supportEmail: e.target.value }); setEmailError(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.target.value) ? "" : "Enter a valid email address"); }} aria-label="Support email" />
              {emailError && <span className="set-error">{emailError}</span>}
            </div>
          </Row>
        </section>}
      </div>

      <aside className="set-brand-aside" aria-label="Sign-in page preview">
        <div className="set-brand-preview">
          <div className="set-brand-preview-head">
            <span className="set-preview-label">Sign-in preview</span>
            <span className="set-brand-live"><i /> Live</span>
          </div>
          <div className="set-desk">
            <div className="set-desk-bar">
              <span className="set-desk-dots"><span /><span /><span /></span>
              <span className="set-desk-url">https://{(admin.appName || "Foxalora").toLowerCase().replace(/\s+/g, "")}.app/sign-in</span>
            </div>
            <div className="set-desk-screen sp-page">
              <div className="sp-panel">
                <div className="sp-top">
                  <span className="sp-brand">
                    <span className="sp-mark" style={{ background: admin.logo ? "transparent" : admin.accent }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                      {admin.logo ? <img src={admin.logo} alt="" /> : <LuMail />}
                    </span>
                    {admin.appName || "Foxalora"}
                  </span>
                  <span className="sp-help">New to {admin.appName || "Foxalora"}? <b>Get in touch</b></span>
                </div>
                <div className="sp-form">
                  <span className="sp-icon"><LuMailOpen /></span>
                  <span className="sp-eyebrow">WELCOME BACK</span>
                  <strong className="sp-title">{admin.loginTitle.trim() || "Sign in to your mail"}</strong>
                  <p className="sp-msg">{admin.loginMessage.trim() || "Use your existing email account to get started."}</p>
                  <span className="sp-label">Email address</span>
                  <span className="sp-field"><LuUser /> you@example.com</span>
                  <span className="sp-label sp-row"><span>Password</span><small>Your email password</small></span>
                  <span className="sp-field"><LuLock /> Enter your password <LuEye className="sp-eye" /></span>
                  <span className="sp-row sp-opts"><span><i className="sp-check" /> Remember me</span><span>Forgot password?</span></span>
                  <span className="sp-btn" style={{ background: admin.accent }}>Continue to inbox</span>
                  <span className="sp-note">Use the same email and password you use for your mail today.</span>
                </div>
                <div className="sp-foot"><span>© {new Date().getFullYear()} {admin.appName || "Foxalora"}</span><span>Privacy · Help</span></div>
              </div>
            </div>
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
  const imapProblem = admin.imapHost.trim() ? mailHostProblem(admin.imapHost) : null;
  const smtpProblem = admin.smtpHost.trim() ? mailHostProblem(admin.smtpHost) : null;

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


function ProfileSection({ prefs, onPrefs, email, onNotice }: { prefs: UserPreferences; onPrefs: (p: Partial<UserPreferences>) => void; email: string; onNotice: (t: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pv, setPv] = useState<"inbox" | "open">("inbox");
  const name = prefs.displayName.trim() || email;
  const initials = name.split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const avatar = (size: string) => prefs.avatar
    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URL
    ? <img src={prefs.avatar} alt="" className={`profile-avatar ${size}`} />
    : <span className={`profile-avatar ${size} initials`}>{initials}</span>;

  function pick(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return onNotice("Choose an image file (JPG, PNG or GIF)");
    if (file.size > 5 * 1024 * 1024) return onNotice("Choose an image under 5 MB");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Centre-crop to a square and shrink to 256px so it stays small in storage
      const side = Math.min(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      c.getContext("2d")?.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      onPrefs({ avatar: c.toDataURL("image/jpeg", 0.85) });
      onNotice("Profile picture updated");
    };
    img.onerror = () => { URL.revokeObjectURL(url); onNotice("That image couldn’t be read"); };
    img.src = url;
  }

  return (
    <div className="profile-layout">
      <div className="set-card profile-main-card">
        <div className="profile-hero">
          <button type="button" className="profile-avatar-btn" aria-label="Change profile picture" onClick={() => fileRef.current?.click()}>
            {avatar("xl")}
            <span className="profile-avatar-overlay"><LuCamera /></span>
          </button>
          <div className="profile-hero-text">
            <strong>{name}</strong>
            <small>{email}</small>
            <div className="profile-hero-actions">
              <button type="button" className="reader-action" onClick={() => fileRef.current?.click()}><LuCamera /> {prefs.avatar ? "Change photo" : "Upload photo"}</button>
              {prefs.avatar && <button type="button" className="reader-action" onClick={() => onPrefs({ avatar: "" })}><LuTrash2 /> Remove</button>}
            </div>
            <p className="profile-hint">JPG, PNG or GIF, up to 5 MB. Square photos look best.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <Row title="Display name" hint="The name people see next to your emails.">
          <input className="set-input" value={prefs.displayName} maxLength={80} placeholder={email} onChange={(e) => onPrefs({ displayName: e.target.value })} aria-label="Display name" />
        </Row>
        <Row title="Email address" hint="Your sign-in address. Ask your administrator to change it.">
          <div className="set-input profile-readonly" aria-label="Email address, cannot be changed"><span>{email}</span><LuLock aria-hidden="true" /></div>
        </Row>
      </div>

      <div className="set-card profile-preview-card">
        <div className="pv-head">
          <span className="set-preview-label">How others see you</span>
          <div className="pv-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={pv === "inbox"} className={pv === "inbox" ? "on" : ""} onClick={() => setPv("inbox")}>Inbox</button>
            <button type="button" role="tab" aria-selected={pv === "open"} className={pv === "open" ? "on" : ""} onClick={() => setPv("open")}>Opened email</button>
          </div>
        </div>

        {pv === "inbox" ? (
          <div className="pv-window">
            <div className="pv-window-bar"><span /><span /><span /><em>Inbox</em></div>
            <div className="pv-list">
              <div className="pv-row ghost"><span className="pv-dot-avatar" /><div className="pv-lines"><i style={{ width: "40%" }} /><i style={{ width: "75%" }} /></div></div>
              <div className="pv-row you">
                {avatar("md")}
                <div className="pv-lines-real">
                  <div><strong>{name}</strong><span>9:41 AM</span></div>
                  <b>Quick update on this week’s plan</b>
                  <p>Hi! Sharing a short summary of where things stand…</p>
                </div>
                <span className="pv-you-tag">You</span>
              </div>
              <div className="pv-row ghost"><span className="pv-dot-avatar" /><div className="pv-lines"><i style={{ width: "32%" }} /><i style={{ width: "62%" }} /></div></div>
            </div>
          </div>
        ) : (
          <div className="pv-window">
            <div className="pv-window-bar"><span /><span /><span /><em>Message</em></div>
            <div className="pv-open">
              <h4>Quick update on this week’s plan</h4>
              <div className="pv-sender">
                {avatar("lg")}
                <div><strong>{name}</strong><small>&lt;{email}&gt;</small><small>to me · 9:41 AM</small></div>
              </div>
              <div className="pv-body"><i style={{ width: "92%" }} /><i style={{ width: "84%" }} /><i style={{ width: "60%" }} /></div>
              {prefs.signature.trim() && <pre className="pv-sig">{`--\n${prefs.signature}`}</pre>}
            </div>
          </div>
        )}
        <p className="pv-note">{prefs.avatar ? "Your photo shows wherever your initials would appear." : "Add a photo so people recognise you at a glance."}</p>
      </div>
    </div>
  );
}

function SignatureSection({ prefs, onPrefs, email, onNotice }: { prefs: UserPreferences; onPrefs: (p: Partial<UserPreferences>) => void; email: string; onNotice: (t: string) => void }) {
  const name = prefs.displayName.trim() || email;
  const sigHtml = prefs.signature ? toSignatureHtml(prefs.signature) : "";
  const has = signatureHasContent(sigHtml);
  const [editorKey, setEditorKey] = useState(0);
  const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const n = esc(name), e = esc(email);
  const templates: { label: string; html: string }[] = [
    { label: "Simple", html: `<p>Thanks,<br><b>${n}</b></p>` },
    { label: "Name & role", html: `<p><b>${n}</b><br>Your role · Company</p>` },
    { label: "Full contact", html: `<p><b>${n}</b><br>Your role · Company<br><a href="mailto:${e}">${e}</a> · +1 555 0100<br><a href="https://www.example.com">www.example.com</a></p>` },
  ];
  const replace = (html: string) => { onPrefs({ signature: html }); setEditorKey((k) => k + 1); };

  return (
    <div className="profile-layout sig-layout">
      <div className="set-card sig-editor">
        <div className="sig-editor-head">
          <strong>Your signature</strong>
          <small>Added to new emails, replies and forwards. Use the toolbar for bold text, links, images and more.</small>
        </div>
        <div className="sig-templates">
          <span>Start from</span>
          {templates.map((t) => <button key={t.label} type="button" onClick={() => replace(t.html)}>{t.label}</button>)}
          {has && <button type="button" className="sig-clear" onClick={() => replace("")}>Clear</button>}
        </div>
        <div className="sig-rich">
          <RichEditor
            key={editorKey}
            initialHtml={sigHtml}
            onChange={(html) => onPrefs({ signature: signatureHasContent(html) ? sanitizeOutgoingHtml(html) : "" })}
            plain={false}
            plainText=""
            onPlainTextChange={() => {}}
            onTogglePlain={() => {}}
            onNotice={onNotice}
            placeholder="Your name, role, links or a logo"
            ariaLabel="Signature"
          />
        </div>
        <p className="profile-hint">Tip: keep it short. A small logo and 2–4 lines look best on phones.</p>
      </div>

      <div className="set-card profile-preview-card">
        <div className="pv-head"><span className="set-preview-label">Live preview</span></div>
        <div className="pv-window">
          <div className="pv-window-bar"><span /><span /><span /><em>New message</em></div>
          <div className="pv-open">
            <div className="sig-pv-fields">
              <div><span>From</span><b>{name} &lt;{email}&gt;</b></div>
              <div><span>To</span><b>sam@example.com</b></div>
              <div><span>Subject</span><b>Quick update</b></div>
            </div>
            <div className="pv-body"><i style={{ width: "88%" }} /><i style={{ width: "94%" }} /><i style={{ width: "52%" }} /></div>
            {has ? (
              <div className="sig-pv">
                <span className="sig-pv-dash">--</span>
                <div className="sig-pv-html" dangerouslySetInnerHTML={{ __html: sanitizeOutgoingHtml(sigHtml) }} />
              </div>
            ) : (
              <div className="sig-pv-empty">No signature — your emails end with your message.</div>
            )}
          </div>
        </div>
        <p className="pv-note">Exactly what recipients see at the end of your emails.</p>
      </div>
    </div>
  );
}

function AllowedDomains({ admin, onAdmin }: { admin: AdminConfig; onAdmin: (p: Partial<AdminConfig>) => void }) {
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const add = () => {
    const d = draft.trim().toLowerCase().replace(/^@/, "");
    if (!d) return;
    if (!validDomain(d)) return setErr("That doesn’t look like a domain, e.g. company.com");
    if (admin.allowedDomains.includes(d)) return setErr("That domain is already on the list");
    onAdmin({ allowedDomains: [...admin.allowedDomains, d] });
    setDraft(""); setErr("");
  };
  return (
    <div className="set-card">
      <Row title="Allowed domains" hint={admin.allowedDomains.length ? "Only email addresses at these domains (and their subdomains) can sign in." : "Anyone with a working email account can sign in. Add domains to limit it."} wide>
        <div className="set-domains">
          <div className="set-domain-chips">
            {admin.allowedDomains.length ? admin.allowedDomains.map((d) => (
              <span key={d} className="ct-label">@{d}<button type="button" aria-label={`Remove ${d}`} onClick={() => onAdmin({ allowedDomains: admin.allowedDomains.filter((x) => x !== d) })}><LuTrash2 /></button></span>
            )) : <span className="set-domain-any">All domains allowed</span>}
          </div>
          <form className="set-inline" onSubmit={(e) => { e.preventDefault(); add(); }}>
            <input className="set-input" value={draft} placeholder="company.com" aria-label="Domain to allow" aria-invalid={Boolean(err)} onChange={(e) => { setDraft(e.target.value); setErr(""); }} />
            <button type="submit" className="reader-action"><LuPlus /> Add</button>
          </form>
          {err && <span className="set-error">{err}</span>}
        </div>
      </Row>
    </div>
  );
}
