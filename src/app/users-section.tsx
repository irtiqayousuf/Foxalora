"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LuEllipsisVertical, LuKeyRound, LuPause, LuPencil, LuPlay, LuPlus, LuSearch, LuTrash2, LuX, LuUsers } from "react-icons/lu";
import type { AdminConfig } from "./settings-store";
import { AccountEditor, blank, sizeMb, type Account } from "./mail-accounts";

type Role = "admin" | "member";
type Status = "active" | "invited" | "suspended";
/** One person = one mailbox. */
type User = Account & { name: string; role: Role; status: Status; storageGb: number; lastSeen: string | null };

const COLORS = ["lilac", "blue", "green", "yellow", "peach", "rose"];
const ago = (h: number) => new Date(Date.now() - h * 36e5).toISOString();

const seedUsers = (d: string[]): User[] => {
  const dom = (i: number) => d[i] ?? d[0] ?? "example.com";
  const mk = (id: number, name: string, local: string, di: number, role: Role, status: Status, storageGb: number, lastSeen: string | null, extra: Partial<Account> = {}): User =>
    ({ ...blank(dom(di)), id, name, local, role, status, storageGb, lastSeen, password: "Sunny-Desk-42!", ...extra });
  return [
    mk(1, "Alex Morgan", "alex", 0, "admin", "active", 18.6, ago(0.2), { panelAccess: true, sizeMode: "custom", sizeValue: 50, sizeUnit: "GB" }),
    mk(2, "Sara Khan", "sara", 0, "member", "active", 7.2, ago(5), { fwdOn: true, fwdTo: ["sara.khan@gmail.com"], aliases: ["sales"] }),
    mk(3, "Tom Becker", "tom", 1, "member", "active", 22.9, ago(30), { arOn: true }),
    mk(4, "Nadia Ali", "nadia", 1, "member", "invited", 0, null),
    mk(5, "Leo Grant", "leo", 2, "member", "suspended", 3.1, ago(24 * 40), { avMode: "off" }),
  ];
};

const initials = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const seen = (iso: string | null) => {
  if (!iso) return "Never signed in";
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 1) return "Just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  if (h < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const STATUS_LABEL: Record<Status, string> = { active: "Active", invited: "Invite sent", suspended: "Suspended" };
const emailOf = (u: Account) => `${u.local}@${u.domain}`;

export default function UsersSection({ admin, onNotice }: { admin: AdminConfig; onNotice: (t: string) => void }) {
  const domains = admin.mappings.map((m) => m.domain);
  const [users, setUsers] = useState<User[]>(() => seedUsers(domains));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Status | "admin">("all");
  const [picked, setPicked] = useState<number[]>([]);
  const [editing, setEditing] = useState<User | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<User[] | null>(null);
  const menuRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (menu === null) return;
    const down = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(null); };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [menu]);
  useEffect(() => {
    if (!confirm) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setConfirm(null); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [confirm]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) =>
      (filter === "all" || (filter === "admin" ? u.role === "admin" : u.status === filter)) &&
      (!q || `${u.name} ${emailOf(u)} ${u.aliases.join(" ")}`.toLowerCase().includes(q)));
  }, [users, query, filter]);

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    invited: users.filter((u) => u.status === "invited").length,
    suspended: users.filter((u) => u.status === "suspended").length,
    admins: users.filter((u) => u.role === "admin").length,
  };
  const allPicked = list.length > 0 && list.every((u) => picked.includes(u.id));
  const adminsLeft = (removing: number[]) => users.filter((u) => u.role === "admin" && u.status !== "suspended" && !removing.includes(u.id)).length;

  const setStatus = (targets: User[], status: Status) => {
    if (status === "suspended" && targets.some((t) => t.role === "admin") && adminsLeft(targets.map((t) => t.id)) === 0) {
      onNotice("You can’t suspend the last active admin"); return;
    }
    const ids = targets.map((t) => t.id);
    setUsers((us) => us.map((u) => (ids.includes(u.id) ? { ...u, status } : u)));
    setPicked([]); setMenu(null);
    onNotice(`${targets.length === 1 ? targets[0].name : `${targets.length} users`} ${status === "suspended" ? "suspended" : "can sign in again"}`);
  };
  const askDelete = (targets: User[]) => {
    setMenu(null);
    if (targets.some((t) => t.role === "admin") && adminsLeft(targets.map((t) => t.id)) === 0) { onNotice("You can’t delete the last active admin"); return; }
    setConfirm(targets);
  };
  const doDelete = () => {
    if (!confirm) return;
    const ids = confirm.map((t) => t.id);
    setUsers((us) => us.filter((u) => !ids.includes(u.id)));
    setPicked((p) => p.filter((x) => !ids.includes(x)));
    onNotice(`${confirm.length === 1 ? confirm[0].name : `${confirm.length} users`} deleted`);
    setConfirm(null);
  };
  const pickedUsers = users.filter((u) => picked.includes(u.id));

  if (editing) {
    return (
      <AccountEditor
        key={editing.id}
        account={editing}
        title="Add a user"
        domains={domains.length ? domains : [editing.domain]}
        taken={(addr, id) => users.some((u) => u.id !== id && (emailOf(u) === addr || u.aliases.some((al) => `${al}@${u.domain}` === addr)))}
        roleCheck={(a) => {
          const was = users.find((u) => u.id === a.id);
          return was?.role === "admin" && a.role === "member" && adminsLeft([was.id]) === 0 ? "Keep at least one active admin, or nobody can manage Foxalora" : null;
        }}
        onApply={(a) => {
          if (a.id) {
            const next = { ...(users.find((u) => u.id === a.id) as User), ...a } as User;
            setUsers((us) => us.map((u) => (u.id === a.id ? next : u)));
            return next;
          }
          const created: User = { ...a, id: Date.now(), name: a.name ?? "", role: a.role ?? "member", status: "invited", storageGb: 0, lastSeen: null };
          setUsers((us) => [...us, created]);
          onNotice(`Invite sent to ${emailOf(created)}`);
          return created;
        }}
        onClose={() => setEditing(null)}
        onNotice={onNotice}
      />
    );
  }

  return (
    <>
      <div className="us-stats">
        {([["all", "All users", stats.total], ["active", "Active", stats.active], ["invited", "Invite sent", stats.invited], ["suspended", "Suspended", stats.suspended], ["admin", "Admins", stats.admins]] as const).map(([id, label, n]) => (
          <button key={id} type="button" className={`us-stat ${filter === id ? "on" : ""}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            <strong>{n}</strong><span>{label}</span>
          </button>
        ))}
      </div>

      <div className="set-card us-card">
        <div className="us-toolbar">
          {picked.length ? (
            <>
              <span className="us-picked">{picked.length} selected</span>
              <button type="button" className="reader-action" onClick={() => setStatus(pickedUsers, "suspended")}><LuPause /> Suspend</button>
              <button type="button" className="reader-action" onClick={() => setStatus(pickedUsers, "active")}><LuPlay /> Reactivate</button>
              <button type="button" className="reader-action" onClick={() => askDelete(pickedUsers)}><LuTrash2 /> Delete</button>
              <button type="button" className="srb-link" onClick={() => setPicked([])}>Clear</button>
            </>
          ) : (
            <>
              <label className="ct-search us-search">
                <LuSearch aria-hidden="true" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email or alias" aria-label="Search users" />
                {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><LuX /></button>}
              </label>
              <button type="button" className="reader-action primary us-add" onClick={() => setEditing({ ...blank(domains[0] ?? "example.com"), name: "", role: "member", status: "invited", storageGb: 0, lastSeen: null })}><LuPlus /> Add user</button>
            </>
          )}
        </div>

        <div className="us-table" role="table" aria-label="Users">
          <div className="us-tr head" role="row">
            <span role="columnheader"><input type="checkbox" aria-label="Select all users" checked={allPicked} onChange={() => setPicked(allPicked ? [] : list.map((u) => u.id))} /></span>
            <span role="columnheader">User</span>
            <span role="columnheader">Role</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Storage</span>
            <span role="columnheader">Last sign-in</span>
            <span />
          </div>
          {list.map((u, i) => {
            const quotaGb = u.mailbox ? Math.round((sizeMb(u) / 1024) * 10) / 10 : 0;
            const pct = quotaGb ? Math.min(100, (u.storageGb / quotaGb) * 100) : 0;
            return (
              <div key={u.id} role="row" className={`us-tr us-clickable ${picked.includes(u.id) ? "picked" : ""} ${u.status === "suspended" ? "muted" : ""}`}
                onClick={(e) => { if (!(e.target as HTMLElement).closest("button, input, .ct-menu")) setEditing(u); }}>
                <span role="cell"><input type="checkbox" aria-label={`Select ${u.name}`} checked={picked.includes(u.id)} onChange={() => setPicked((p) => (p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id]))} /></span>
                <span role="cell" className="us-user">
                  <span className={`sender-avatar ${COLORS[(u.id + i) % COLORS.length]}`}>{initials(u.name)}</span>
                  <span>
                    <strong>{u.name}</strong>
                    <small>{emailOf(u)}</small>
                    <span className="ma-tags us-tags">
                      {u.fwdOn && <span>Forwarding</span>}
                      {u.aliases.length > 0 && <span title={u.aliases.map((a) => `${a}@${u.domain}`).join(", ")}>{u.aliases.length} alias{u.aliases.length === 1 ? "" : "es"}</span>}
                      {u.arOn && <span>Auto-reply on</span>}
                      {u.avMode === "off" && <span className="warn">No virus check</span>}
                    </span>
                  </span>
                </span>
                <span role="cell"><span className={`us-role ${u.role}`}>{u.role === "admin" ? "Admin" : "Member"}</span></span>
                <span role="cell"><span className={`us-status ${u.status}`}>{STATUS_LABEL[u.status]}</span></span>
                <span role="cell" className="us-storage" title={quotaGb ? `${u.storageGb} GB of ${quotaGb} GB` : "No mailbox"}>
                  {quotaGb ? (
                    <>
                      <span className="us-bar"><span className={pct > 85 ? "full" : ""} style={{ width: `${pct}%` }} /></span>
                      <small>{u.storageGb} / {quotaGb} GB</small>
                    </>
                  ) : <small>Forwarding only</small>}
                </span>
                <span role="cell" className="us-seen">{seen(u.lastSeen)}</span>
                <span role="cell" className="us-more" ref={menu === u.id ? menuRef : undefined}>
                  <button type="button" className="row-action" aria-label={`Actions for ${u.name}`} aria-haspopup="menu" aria-expanded={menu === u.id} onClick={() => setMenu(menu === u.id ? null : u.id)}><LuEllipsisVertical /></button>
                  {menu === u.id && (
                    <div className="ct-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => { setMenu(null); setEditing(u); }}><LuPencil /> Edit user &amp; mailbox</button>
                      {u.status === "invited"
                        ? <button type="button" role="menuitem" onClick={() => { setMenu(null); onNotice(`Invite sent again to ${emailOf(u)}`); }}><LuUsers /> Resend invite</button>
                        : <button type="button" role="menuitem" onClick={() => { setMenu(null); onNotice(`Password reset link sent to ${emailOf(u)}`); }}><LuKeyRound /> Send password reset</button>}
                      {u.status === "suspended"
                        ? <button type="button" role="menuitem" onClick={() => setStatus([u], "active")}><LuPlay /> Reactivate</button>
                        : <button type="button" role="menuitem" onClick={() => setStatus([u], "suspended")}><LuPause /> Suspend</button>}
                      <button type="button" role="menuitem" className="danger" onClick={() => askDelete([u])}><LuTrash2 /> Delete user</button>
                    </div>
                  )}
                </span>
              </div>
            );
          })}
          {!list.length && <p className="set-empty">{query ? `No one matches “${query}”.` : "No users in this view."}</p>}
        </div>
      </div>

      {confirm && (
        <div className="ct-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirm(null); }}>
          <div className="ct-modal" role="alertdialog" aria-modal="true" aria-labelledby="us-del-title">
            <span className="ct-modal-icon"><LuTrash2 /></span>
            <h2 id="us-del-title">{confirm.length === 1 ? `Delete ${confirm[0].name}?` : `Delete ${confirm.length} users?`}</h2>
            <p>Their mailbox{confirm.length === 1 ? "" : "es"}, aliases and all email will be removed. <strong>You can’t recover {confirm.length === 1 ? "this account" : "these accounts"}</strong>. To pause access instead, use Suspend.</p>
            <div className="ct-modal-foot">
              <button type="button" className="reader-action" autoFocus onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="reader-action ct-danger" onClick={doDelete}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
