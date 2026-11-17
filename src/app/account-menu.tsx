"use client";

import { useEffect, useRef, useState } from "react";
import { LuCloud, LuLogOut, LuSettings, LuX } from "react-icons/lu";

type Props = {
  name: string;
  email: string;
  initials: string;
  /** Storage in bytes. */
  usedBytes: number;
  quotaBytes: number;
  onSettings: () => void;
  onSignOut: () => void;
  onNotice?: (text: string) => void;
};

const fmt = (b: number) => {
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b >= 100 || i === 0 ? Math.round(b) : b.toFixed(1).replace(/\.0$/, "")} ${u[i]}`;
};

export default function AccountMenu({ name, email, initials, usedBytes, quotaBytes, onSettings, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  const pct = Math.min(100, (usedBytes / quotaBytes) * 100);
  const pctLabel = pct > 0 && pct < 1 ? "Less than 1%" : `${Math.round(pct)}%`;

  return (
    <div className="acct" ref={ref}>
      <button type="button" className="topbar-avatar" aria-label="Your account" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{initials}</button>
      {open && (
        <div className="acct-pop" role="dialog" aria-label="Your account">
          <button type="button" className="acct-close" aria-label="Close" onClick={() => setOpen(false)}><LuX /></button>

          <div className="acct-card">
            <div className="acct-me">
              <span className="acct-avatar big">{initials}</span>
              <div className="acct-me-text">
                <strong>{name}</strong>
                <span>{email}</span>
              </div>
            </div>

            <div className="acct-storage">
              <div className="acct-storage-top"><LuCloud aria-hidden="true" /><span><strong>{pctLabel}</strong> of {fmt(quotaBytes)} used</span></div>
              <div className="acct-bar" role="progressbar" aria-label="Storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                <span style={{ width: `${Math.max(pct, usedBytes > 0 ? 1.5 : 0)}%` }} />
              </div>
              <small>{fmt(usedBytes)} used · {fmt(quotaBytes - usedBytes)} free</small>
            </div>

            <button type="button" className="acct-link" onClick={() => { setOpen(false); onSettings(); }}><LuSettings /> Manage your account</button>
            <button type="button" className="acct-link" onClick={() => { setOpen(false); onSignOut(); }}><LuLogOut /> Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
