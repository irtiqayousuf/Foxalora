"use client";

import { useEffect, useRef, useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

type Props = {
  selected: Date;
  today: Date;
  onPick: (date: Date) => void;
  onClose: () => void;
};

/** Compact month picker: plain dates, today circled, the selected day outlined. */
export default function MiniCalendar({ selected, today, onPick, onClose }: Props) {
  const [view, setView] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const start = new Date(view.getFullYear(), view.getMonth(), 1 - view.getDay()); // Sunday first, like the reference
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const shift = (n: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));

  return (
    <div className="mini-cal" ref={ref} role="dialog" aria-label="Pick a date">
      <div className="mini-cal-head">
        <strong>{view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)}><LuChevronLeft /></button>
        <button type="button" aria-label="Next month" onClick={() => shift(1)}><LuChevronRight /></button>
      </div>
      <div className="mini-cal-grid" role="grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="mini-cal-dow" role="columnheader">{d}</span>)}
        {days.map((d) => (
          <button
            key={d.toISOString()}
            type="button"
            role="gridcell"
            aria-selected={same(d, selected)}
            aria-label={d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            className={`mini-cal-day ${d.getMonth() !== view.getMonth() ? "outside" : ""} ${same(d, today) ? "today" : ""} ${same(d, selected) ? "selected" : ""}`}
            onClick={() => onPick(d)}
          >
            {d.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}
