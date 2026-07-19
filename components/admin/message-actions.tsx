"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import {
  Archive,
  ArchiveRestore,
  FolderTree,
  Mail,
  Star,
} from "lucide-react";

import { markUnread, setArchived, toggleStar } from "@/app/admin/actions";
import { FolderAssign } from "@/components/admin/folder-assign";
import type { FolderLite } from "@/components/admin/types";

const BTN =
  "inline-flex items-center gap-2 rounded-lg border border-(--ap-line-strong) px-3 py-1.5 " +
  "text-sm text-(--ap-muted) transition-colors hover:border-(--ap-accent) " +
  "hover:text-(--ap-text) disabled:opacity-50";

export function MessageActions({
  id,
  archived,
  starred,
  folders,
  memberIds,
}: {
  id: number;
  archived: boolean;
  starred: boolean;
  folders: FolderLite[];
  memberIds: number[];
}) {
  const [pending, start] = useTransition();
  const [optimisticStar, setOptimisticStar] = useState(starred);
  const [foldersOpen, setFoldersOpen] = useState(false);
  const folderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!foldersOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!folderRef.current?.contains(e.target as Node)) setFoldersOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFoldersOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [foldersOpen]);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setOptimisticStar((v) => !v);
          start(() => toggleStar(id, !optimisticStar));
        }}
        className={BTN}
      >
        <Star
          size={15}
          aria-hidden
          className={optimisticStar ? "fill-(--ap-star) text-(--ap-star)" : ""}
        />
        {optimisticStar ? "Wyróżniona" : "Wyróżnij"}
      </button>

      <div className="relative" ref={folderRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={foldersOpen}
          onClick={() => setFoldersOpen((v) => !v)}
          className={BTN}
        >
          <FolderTree size={15} aria-hidden />
          Foldery
        </button>
        {foldersOpen && (
          <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-xl border border-(--ap-line-strong) bg-(--ap-surface) shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            <FolderAssign
              messageId={id}
              folders={folders}
              initialMemberIds={memberIds}
            />
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={pending}
        // markUnread revalidates only the inbox and redirects there itself, so
        // the open detail page never re-commits to re-trigger MarkRead.
        onClick={() => start(() => markUnread(id))}
        className={BTN}
      >
        <Mail size={15} aria-hidden />
        Oznacz jako nieprzeczytaną
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => setArchived(id, !archived))}
        className={BTN}
      >
        {archived ? (
          <>
            <ArchiveRestore size={15} aria-hidden />
            Przywróć do odebranych
          </>
        ) : (
          <>
            <Archive size={15} aria-hidden />
            Archiwizuj
          </>
        )}
      </button>
    </div>
  );
}
