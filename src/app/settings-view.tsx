"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  LuArrowLeft, LuBell, LuCamera, LuCheck, LuGlobe, LuLock, LuPalette, LuPenLine,
  LuMonitor, LuMoon, LuRows3, LuRows4, LuSun, LuTrash2, LuUser,
} from "react-icons/lu";
import { LANGUAGES, formatDateWith, type UserPreferences } from "./settings-store";
import RichEditor from "./rich-editor";
import { useT } from "./i18n";
import { sanitizeOutgoingHtml, signatureHasContent, toSignatureHtml } from "./email-html";

type SectionId = "profile" | "signature" | "region" | "appearance" | "notifications";

const USER_SECTIONS: { id: SectionId; label: string; icon: typeof LuUser; blurb: string }[] = [
  { id: "profile", label: "Profile", icon: LuUser, blurb: "How you appear to the people you email." },
  { id: "signature", label: "Signature", icon: LuPenLine, blurb: "Added to the end of the emails you write." },
  { id: "region", label: "Language & region", icon: LuGlobe, blurb: "Language, time zone and how dates look." },
  { id: "appearance", label: "Appearance & reading", icon: LuPalette, blurb: "Theme, density, replies, previews and images in emails." },
  { id: "notifications", label: "Notifications", icon: LuBell, blurb: "When Foxalora should get your attention." },
];

type Props = {
  prefs: UserPreferences;
  onPrefs: (patch: Partial<UserPreferences>) => void;
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

export default function SettingsView({ prefs, onPrefs, email, onBack, onNotice }: Props) {
  const t = useT();
  const [section, setSection] = useState<SectionId>("profile");
  const [appearanceTab, setAppearanceTab] = useState<"appearance" | "reading">("appearance");
  const current = USER_SECTIONS.find((s) => s.id === section) ?? USER_SECTIONS[0];

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
          </nav>

          <div className="set-content">
            <div className="set-content-head">
              <h2>{t(current.label)}</h2>
              <p>{current.blurb}</p>
            </div>

            {section === "profile" && <ProfileSection prefs={prefs} onPrefs={onPrefs} email={email} onNotice={onNotice} />}

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

          </div>
        </div>
      </div>
    </section>
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
        <Row title="Email address" hint="Your sign-in address. It can’t be changed here.">
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
