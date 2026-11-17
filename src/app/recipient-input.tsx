"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { LuX } from "react-icons/lu";

export type Contact = { name: string; email: string; company?: string; count?: number };

export const emailOf = (value: string) => value.match(/<([^>]+)>/)?.[1]?.trim() ?? value.trim();
export const nameOf = (value: string) => value.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || emailOf(value);
export const isValidEmail = (value: string) => /^[^\s@<>(),;:]+@[^\s@<>(),;:]+\.[a-z]{2,}$/i.test(emailOf(value));

type Props = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  contacts: Contact[];
  autoFocus?: boolean;
  trailing?: React.ReactNode;
};

/** Recipient field: type, paste or pick; Enter, comma, semicolon, Tab or leaving the field turns text into a chip. */
export default function RecipientInput({ label, values, onChange, contacts, autoFocus, trailing }: Props) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    const taken = new Set(values.map((v) => emailOf(v).toLowerCase()));
    // Empty field: offer the people you email most. Typing: match name, email or company, most-emailed first.
    if (!q) return contacts.filter((c) => (c.count ?? 0) > 0 && !taken.has(c.email.toLowerCase())).slice(0, 5);
    return contacts
      .filter((c) => !taken.has(c.email.toLowerCase()) && [c.name, c.email, c.company ?? ""].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)) || (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 6);
  }, [text, contacts, values]);

  function commit(raw: string) {
    const parts = raw.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return;
    const existing = new Set(values.map((v) => emailOf(v).toLowerCase()));
    const next = [...values];
    for (const part of parts) {
      const key = emailOf(part).toLowerCase();
      if (existing.has(key)) continue;
      const known = contacts.find((c) => c.email.toLowerCase() === key);
      next.push(known && !part.includes("<") ? `${known.name} <${known.email}>` : part);
      existing.add(key);
    }
    onChange(next);
    setText("");
    setActive(0);
  }

  function pick(contact: Contact) {
    onChange([...values, `${contact.name} <${contact.email}>`]);
    setText("");
    setActive(0);
    inputRef.current?.focus();
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setActive((i) => (i + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
      return;
    }
    if (event.key === "Enter" || event.key === "," || event.key === ";" || (event.key === "Tab" && text.trim())) {
      if (!text.trim()) return;
      event.preventDefault();
      if (suggestions.length && event.key !== ",") pick(suggestions[active] ?? suggestions[0]);
      else commit(text);
    } else if (event.key === "Backspace" && !text && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className={`recipient-field ${focused ? "focused" : ""}`} onClick={() => inputRef.current?.focus()}>
      <span className="recipient-label">{label}</span>
      <div className="recipient-chips">
        {values.map((value) => {
          const valid = isValidEmail(value);
          return (
            <span key={value} className={`recipient-chip ${valid ? "" : "invalid"}`} title={valid ? emailOf(value) : `“${value}” doesn’t look like an email address`}>
              {nameOf(value)}
              <button type="button" aria-label={`Remove ${nameOf(value)}`} onClick={(e) => { e.stopPropagation(); onChange(values.filter((v) => v !== value)); }}><LuX /></button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          aria-label={label}
          value={text}
          onChange={(e) => { setText(e.target.value); setActive(0); }}
          onKeyDown={onKey}
          onPaste={(e) => { const pasted = e.clipboardData.getData("text"); if (/[,;\n]/.test(pasted)) { e.preventDefault(); commit(pasted); } }}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); window.setTimeout(() => { if (inputRef.current && document.activeElement !== inputRef.current) commit(inputRef.current.value); }, 120); }}
          placeholder={values.length ? "" : "Name or email"}
        />
      </div>
      {trailing}
      {focused && suggestions.length > 0 && (
        <ul className="recipient-suggest" role="listbox" aria-label={`${label} suggestions`}>
          {!text.trim() && <li className="recipient-suggest-head" role="presentation">Frequently contacted</li>}
          {suggestions.map((c, i) => (
            <li key={c.email} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? "active" : ""} onMouseDown={(e) => { e.preventDefault(); pick(c); }}>
                <span className="recipient-suggest-avatar">{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                <span><strong>{c.name}</strong><small>{c.email}{c.company ? ` · ${c.company}` : ""}</small></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
