"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ComponentType, type DragEvent } from "react";
import { IoEllipsisHorizontal } from "react-icons/io5";

export type FolderBarItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  count: number;
  removable: boolean;
};

type Props = {
  items: FolderBarItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
};

const MORE_WIDTH = 44; // "⋯" button + gap
const GAP = 6;

export default function FolderBar({ items, activeId, onSelect, onRemove }: Props) {
  const [order, setOrder] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Keep user order; append new folders, drop deleted ones
  const ordered = useMemo(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    const kept = order.filter((id) => byId.has(id));
    const added = items.map((item) => item.id).filter((id) => !kept.includes(id));
    return [...kept, ...added].map((id) => byId.get(id)!);
  }, [items, order]);

  // Measure how many chips fit in the available width
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (!wrap || !measure) return;
    const compute = () => {
      const available = wrap.clientWidth;
      const widths = Array.from(measure.children).map((el) => (el as HTMLElement).offsetWidth);
      const total = widths.reduce((sum, w) => sum + w, 0) + GAP * Math.max(widths.length - 1, 0);
      if (total <= available) { setVisibleCount(widths.length); return; }
      let used = 0; let fit = 0;
      for (const w of widths) {
        const next = used + (fit ? GAP : 0) + w;
        if (next + MORE_WIDTH > available) break;
        used = next; fit++;
      }
      setVisibleCount(Math.max(1, fit));
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [ordered]);

  // Close menu on outside click / Escape
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const visible = ordered.slice(0, visibleCount);
  const hidden = ordered.slice(visibleCount);

  // Move dragged folder to target index; whatever falls past the edge lands in the menu
  const moveTo = (id: string, index: number) => {
    const ids = ordered.map((item) => item.id).filter((x) => x !== id);
    ids.splice(Math.min(index, ids.length), 0, id);
    setOrder(ids);
  };

  const onDragStart = (event: DragEvent, id: string) => {
    setDragId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };
  const onDragEnd = () => { setDragId(null); setOverIndex(null); };
  const onDropAt = (event: DragEvent, index: number) => {
    event.preventDefault();
    const id = dragId ?? event.dataTransfer.getData("text/plain");
    if (id) moveTo(id, index);
    onDragEnd();
    setMenuOpen(false);
  };

  const chip = (item: FolderBarItem, extra?: string) => {
    const Icon = item.icon;
    return (
      <>
        <button className={`folder-link ${extra ?? ""}`} onClick={() => { onSelect(item.id); setMenuOpen(false); }}>
          <Icon className="folder-icon" /><span>{item.label}</span>
          {item.count > 0 && <span className={`folder-count ${item.id === "inbox" ? "count-pill" : ""}`}>{item.count}</span>}
        </button>
        {item.removable && <button className="folder-remove" aria-label={`Delete ${item.label} folder`} onClick={() => onRemove(item.id)}>×</button>}
      </>
    );
  };

  return (
    <div className="folder-bar-wrap" ref={wrapRef}>
      {/* Invisible copy used only to measure chip widths */}
      <div className="folder-measure" ref={measureRef} aria-hidden="true">
        {ordered.map((item) => <div className="folder-nav-row" key={item.id}>{chip(item)}</div>)}
      </div>

      <nav className="folder-nav" aria-label="Mail folders">
        {visible.map((item, index) => (
          <div
            key={item.id}
            className={`folder-nav-row ${activeId === item.id ? "active" : ""} ${dragId === item.id ? "dragging" : ""} ${overIndex === index && dragId !== item.id ? "drop-target" : ""}`}
            draggable
            onDragStart={(event) => onDragStart(event, item.id)}
            onDragEnd={onDragEnd}
            onDragOver={(event) => { event.preventDefault(); setOverIndex(index); }}
            onDragLeave={() => setOverIndex((current) => (current === index ? null : current))}
            onDrop={(event) => onDropAt(event, index)}
          >
            {chip(item)}
          </div>
        ))}

        {hidden.length > 0 && (
          <div className="folder-more" ref={menuRef}>
            <button
              className={`folder-more-button ${hidden.some((item) => item.id === activeId) ? "has-active" : ""}`}
              aria-label={`${hidden.length} more folders`}
              title={`${hidden.length} more folders`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
              onDragOver={(event) => { event.preventDefault(); setMenuOpen(true); }}
            >
              <IoEllipsisHorizontal />
            </button>
            {menuOpen && (
              <div
                className="folder-menu"
                role="menu"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDropAt(event, visibleCount)}
              >
                <p className="folder-menu-hint">Drag a folder onto the bar to pin it</p>
                {hidden.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      role="menuitem"
                      className={`folder-menu-item ${activeId === item.id ? "active" : ""} ${dragId === item.id ? "dragging" : ""}`}
                      draggable
                      onDragStart={(event) => onDragStart(event, item.id)}
                      onDragEnd={onDragEnd}
                    >
                      <button onClick={() => { onSelect(item.id); setMenuOpen(false); }}>
                        <Icon className="folder-icon" /><span>{item.label}</span>
                        {item.count > 0 && <span className="folder-count">{item.count}</span>}
                      </button>
                      {item.removable && <button className="folder-menu-remove" aria-label={`Delete ${item.label} folder`} onClick={() => onRemove(item.id)}>×</button>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}
