"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { LuFolderInput, LuFolderPlus } from "react-icons/lu";
import { IoCheckmarkOutline } from "react-icons/io5";

type Folder = { id: string; label: string; icon: ComponentType<{ className?: string }> };

type Props = {
  folders: Folder[];
  currentFolder: string;
  /** How many emails will be moved. */
  count: number;
  /** Returns an error message if the name can't be used, otherwise null. */
  validateName: (name: string) => string | null;
  onMove: (folderId: string) => void;
  onCreateAndMove: (name: string) => void;
};

export default function MoveMenu({ folders, currentFolder, count, validateName, onMove, onCreateAndMove }: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => { if (!wrapRef.current?.contains(event.target as Node)) close(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function close() { setOpen(false); setCreating(false); setName(""); setError(""); }

  function create() {
    const trimmed = name.trim();
    const problem = trimmed ? validateName(trimmed) : "Give the folder a name";
    if (problem) { setError(problem); return; }
    onCreateAndMove(trimmed);
    close();
  }

  return (
    <div className="move-menu" ref={wrapRef}>
      <button className="toolbar-icon" title="Move to folder" aria-label="Move to folder" aria-haspopup="menu" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        <LuFolderInput />
      </button>
      {open && (
        <div className="move-menu-list" role="menu" aria-label="Move to folder">
          <p className="move-menu-title">Move {count} email{count === 1 ? "" : "s"} to</p>
          {folders.map(({ id, label, icon: Icon }) => (
            <button key={id} role="menuitem" disabled={id === currentFolder} onClick={() => { onMove(id); close(); }}>
              <Icon className="move-menu-icon" /> <span>{label}</span>
              {id === currentFolder && <IoCheckmarkOutline className="move-menu-check" aria-label="Current folder" />}
            </button>
          ))}
          <hr />
          {creating ? (
            <form className="move-menu-create" onSubmit={(event) => { event.preventDefault(); create(); }}>
              <input autoFocus aria-label="New folder name" placeholder="Folder name" value={name} onChange={(event) => { setName(event.target.value); setError(""); }} />
              <button type="submit" className="move-menu-add">Create</button>
              {error && <span className="move-menu-error" role="alert">{error}</span>}
            </form>
          ) : (
            <button role="menuitem" onClick={() => setCreating(true)}>
              <LuFolderPlus className="move-menu-icon" /> <span>Create folder</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
