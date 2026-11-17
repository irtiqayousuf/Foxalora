/**
 * Contacts: shared data, saving, frequency tracking, and CSV / vCard import-export.
 * Saved per browser in this prototype (localStorage); a server would store them per account.
 */

export type ContactEmail = { address: string; label: "Work" | "Personal" | "Other" };
export type Contact = {
  id: number;
  name: string;
  emails: ContactEmail[]; // first one is the main address
  phone: string;
  company: string;
  note: string;
  color: string;
  favorite: boolean;
  birthday: string;
  labels: string[];
  photo: string;
  added: string;
  edited: string;
};
export type Frequency = Record<string, { count: number; last: string }>;

export const CONTACTS_KEY = "foxalora.contacts.v2";
export const FREQUENCY_KEY = "foxalora.contact-frequency.v1";
export const COLORS = ["lilac", "blue", "green", "yellow", "peach", "rose"];
export const EMAIL_LABELS: ContactEmail["label"][] = ["Work", "Personal", "Other"];

export const validEmail = (v: string) => /^[^\s@<>(),;:]+@[^\s@<>(),;:]+\.[a-z]{2,}$/i.test(v.trim());
export const mainEmail = (c: Contact) => c.emails[0]?.address ?? "";

const seed = (id: number, name: string, emails: ContactEmail[], phone: string, company: string, color: string, extra: Partial<Contact> = {}): Contact => ({
  id, name, emails, phone, company, note: "", color, favorite: false, birthday: "", labels: [], photo: "",
  added: new Date(2025, 7, 14 - id).toISOString(), edited: new Date(2025, 8, 7 - id).toISOString(), ...extra,
});

export const SEED_CONTACTS: Contact[] = [
  seed(1, "Sofia Chen", [{ address: "sofia@northstar.studio", label: "Work" }, { address: "sofia.chen@gmail.com", label: "Personal" }], "+1 415 555 0142", "Northstar Studio", "lilac", { favorite: true, note: "Prefers mornings for calls.", birthday: "1994-03-18", labels: ["Design"] }),
  seed(2, "Marcus Lee", [{ address: "marcus@fieldnotes.design", label: "Work" }], "", "Fieldnotes", "blue"),
  seed(3, "Priya Kapoor", [{ address: "priya@softthings.co", label: "Work" }], "+44 20 7946 0958", "Soft Things", "green", { favorite: true, labels: ["Clients"] }),
  seed(4, "Daniel Foster", [{ address: "daniel@hey.com", label: "Personal" }], "", "", "yellow"),
  seed(5, "Mina Park", [{ address: "mina@slowstudio.jp", label: "Work" }], "+81 3 5555 0199", "Slow Studio", "peach"),
  seed(6, "Studio Fieldwork", [{ address: "hello@fieldwork.studio", label: "Work" }], "", "Fieldwork", "rose"),
];

export function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    const list = raw ? (JSON.parse(raw) as Contact[]) : null;
    return Array.isArray(list) ? list : SEED_CONTACTS;
  } catch { return SEED_CONTACTS; }
}
export function saveContacts(list: Contact[]) {
  try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}
export function loadFrequency(): Frequency {
  try { return JSON.parse(localStorage.getItem(FREQUENCY_KEY) || "{}"); } catch { return {}; }
}
export function saveFrequency(f: Frequency) {
  try { localStorage.setItem(FREQUENCY_KEY, JSON.stringify(f)); } catch { /* storage full or blocked */ }
}
/** Count one more email sent to each address. */
export function bumpFrequency(f: Frequency, addresses: string[]): Frequency {
  const next = { ...f };
  const now = new Date().toISOString();
  for (const a of new Set(addresses.map((x) => x.trim().toLowerCase()).filter(Boolean))) {
    next[a] = { count: (next[a]?.count ?? 0) + 1, last: now };
  }
  return next;
}
export const contactScore = (c: Contact, f: Frequency) => c.emails.reduce((n, e) => n + (f[e.address.toLowerCase()]?.count ?? 0), 0);

/* ---------- CSV ---------- */

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export type ImportedContact = Omit<Contact, "id" | "color" | "favorite" | "added" | "edited" | "photo" | "labels"> & { labels?: string[] };

/** Reads CSV exports from Gmail, Outlook and most other apps by matching common column names. */
export function parseContactsCsv(text: string): ImportedContact[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const find = (...names: RegExp[]) => head.findIndex((h) => names.some((n) => n.test(h)));
  const col = {
    name: find(/^name$/, /^full ?name$/, /^display ?name$/),
    first: find(/^first ?name$/, /^given ?name$/),
    last: find(/^last ?name$/, /^family ?name$/, /^surname$/),
    company: find(/^company$/, /^organi[sz]ation( 1 - name| name)?$/, /^organi[sz]ation$/),
    phone: find(/^phone$/, /^mobile( phone)?$/, /^phone 1 - value$/, /^primary phone$/, /^business phone$/, /^home phone$/, /^telephone$/),
    note: find(/^notes?$/),
    birthday: find(/^birthday$/),
  };
  const emailCols = head.map((h, i) => (/e-?mail( address)?( \d)?( - value)?$/.test(h) || /^e-?mail \d? ?address$/.test(h) ? i : -1)).filter((i) => i >= 0);
  const out: ImportedContact[] = [];
  for (const r of rows.slice(1)) {
    const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    const emails: ContactEmail[] = [];
    for (const i of emailCols) for (const part of get(i).split(/\s*:::\s*|[;,]\s*/)) {
      const a = part.trim().toLowerCase();
      if (validEmail(a) && !emails.some((e) => e.address === a)) emails.push({ address: a, label: emails.length ? "Other" : "Work" });
    }
    const name = get(col.name) || [get(col.first), get(col.last)].filter(Boolean).join(" ") || emails[0]?.address.split("@")[0] || "";
    const phone = get(col.phone);
    if (!name || (!emails.length && !phone)) continue;
    const bday = get(col.birthday);
    out.push({ name, emails, phone, company: get(col.company), note: get(col.note), birthday: /^\d{4}-\d{2}-\d{2}$/.test(bday) ? bday : "" });
  }
  return out;
}

/* ---------- vCard ---------- */

const vEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const vUnesc = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

export function parseVCards(text: string): ImportedContact[] {
  const unfolded = text.replace(/\r\n|\r/g, "\n").replace(/\n[ \t]/g, "");
  const cards = unfolded.split(/BEGIN:VCARD/i).slice(1).map((c) => c.split(/END:VCARD/i)[0]);
  const out: ImportedContact[] = [];
  for (const card of cards) {
    let name = "", n = "", company = "", phone = "", note = "", birthday = "";
    const emails: ContactEmail[] = [];
    for (const line of card.split("\n")) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const [prop, ...params] = line.slice(0, idx).split(";");
      const key = prop.replace(/^item\d+\./i, "").toUpperCase();
      const value = vUnesc(line.slice(idx + 1).trim());
      const type = params.join(";").toUpperCase();
      if (key === "FN") name = value;
      else if (key === "N") n = value.split(";").slice(0, 2).reverse().filter(Boolean).join(" ");
      else if (key === "ORG") company = value.split(";")[0];
      else if (key === "TEL" && !phone) phone = value;
      else if (key === "NOTE") note = value;
      else if (key === "BDAY") { const d = value.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"); if (/^\d{4}-\d{2}-\d{2}/.test(d)) birthday = d.slice(0, 10); }
      else if (key === "EMAIL") {
        const a = value.replace(/^mailto:/i, "").toLowerCase();
        if (validEmail(a) && !emails.some((e) => e.address === a)) {
          const label: ContactEmail["label"] = type.includes("HOME") ? "Personal" : type.includes("WORK") ? "Work" : emails.length ? "Other" : "Work";
          emails[type.includes("PREF") ? "unshift" : "push"]({ address: a, label });
        }
      }
    }
    name = name || n || emails[0]?.address.split("@")[0] || "";
    if (!name || (!emails.length && !phone)) continue;
    out.push({ name, emails, phone, company, note, birthday });
  }
  return out;
}

export function toVCard(list: Contact[]): string {
  return list.map((c) => {
    const parts = c.name.trim().split(/\s+/);
    const last = parts.length > 1 ? parts.pop()! : "";
    const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vEsc(c.name)}`, `N:${vEsc(last)};${vEsc(parts.join(" "))};;;`];
    c.emails.forEach((e, i) => lines.push(`EMAIL;TYPE=INTERNET,${e.label === "Personal" ? "HOME" : e.label === "Work" ? "WORK" : "OTHER"}${i === 0 ? ",PREF" : ""}:${e.address}`));
    if (c.phone) lines.push(`TEL;TYPE=CELL:${vEsc(c.phone)}`);
    if (c.company) lines.push(`ORG:${vEsc(c.company)}`);
    if (c.birthday) lines.push(`BDAY:${c.birthday}`);
    if (c.note) lines.push(`NOTE:${vEsc(c.note)}`);
    lines.push("END:VCARD");
    return lines.join("\r\n");
  }).join("\r\n") + "\r\n";
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
