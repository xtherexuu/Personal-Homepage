"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  FolderTree,
  Mail,
  MailOpen,
  Star,
} from "lucide-react";

import { setArchived, setReadState, toggleStar } from "@/app/admin/actions";
import { FolderAssign } from "@/components/admin/folder-assign";
import type { FolderLite, MessageListItem } from "@/components/admin/types";

const MENU_W = 250;
const SUB_W = 264;
const MENU_H = 250;
const SUB_H = 300;

/**
 * The right-click (and „⋯") menu for a message row. Opens at the cursor,
 * clamped into the viewport, with a folder sub-list that flies out to whichever
 * side has room — or stacks INSIDE the menu when neither flank fits (narrow
 * screens). Single-shot actions (read, star, archive) reflect optimistically
 * and close the menu; the folder sub-list stays open so several folders can be
 * ticked in one go.
 */
export function MessageContextMenu({
  item,
  folders,
  x,
  y,
  onClose,
}: {
  item: MessageListItem;
  folders: FolderLite[];
  x: number;
  y: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [, start] = useTransition();

  const [read, setRead] = useState(!item.unread);
  const [starred, setStarred] = useState(item.starred);
  const [archived, setArchivedState] = useState(item.archived);
  const [showFolders, setShowFolders] = useState(false);

  // Geometry, computed once from the click point. `side` decides where (and
  // whether) the folder flyout appears; when it can't fit either flank the list
  // stacks inline instead. All coordinates are clamped into the viewport.
  const geo = useMemo(() => {
    const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
    const vh = typeof window === "undefined" ? 720 : window.innerHeight;
    const left = Math.max(8, Math.min(x, vw - MENU_W - 8));
    const fitsRight = left + MENU_W + 4 + SUB_W <= vw - 8;
    const fitsLeft = left - 4 - SUB_W >= 8;
    const side: "right" | "left" | "stack" = fitsRight
      ? "right"
      : fitsLeft
        ? "left"
        : "stack";
    // A stacked menu is much taller — clamp its top so it still fits (its own
    // max-height + scroll handles anything left over).
    const menuH = side === "stack" ? Math.min(520, vh - 16) : MENU_H;
    const top = Math.max(8, Math.min(y, vh - menuH - 8));
    const subLeft =
      side === "right" ? left + MENU_W + 4 : left - SUB_W - 4;
    const subTop = Math.max(8, Math.min(top, vh - SUB_H - 8));
    return { left, top, side, subLeft, subTop };
  }, [x, y]);

  // Close on Escape, any outside pointer press, or a scroll of the PAGE — but
  // never a scroll that originates inside the menu (e.g. the folder checklist).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onScroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  const act = (fn: () => void) => {
    start(fn);
    onClose();
  };

  const ROW =
    "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-(--ap-raised) disabled:opacity-60";

  const folderList = (
    <FolderAssign
      messageId={item.id}
      folders={folders}
      initialMemberIds={item.folderIds}
    />
  );

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left: geo.left, top: geo.top, width: MENU_W }}
      className="fixed z-50 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-xl border border-(--ap-line-strong) bg-(--ap-surface) py-1 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
    >
      <button
        type="button"
        role="menuitem"
        className={ROW}
        onClick={() => act(() => router.push(`/admin/messages/${item.id}`))}
      >
        <Mail size={15} aria-hidden />
        Otwórz wiadomość
      </button>

      <hr className="my-1 border-(--ap-line)" />

      <button
        type="button"
        role="menuitem"
        className={ROW}
        onClick={() => {
          setRead(!read);
          act(() => setReadState(item.id, !read));
        }}
      >
        {read ? <Mail size={15} aria-hidden /> : <MailOpen size={15} aria-hidden />}
        {read ? "Oznacz jako nieprzeczytaną" : "Oznacz jako przeczytaną"}
      </button>

      <button
        type="button"
        role="menuitem"
        className={ROW}
        onClick={() => {
          setStarred(!starred);
          act(() => toggleStar(item.id, !starred));
        }}
      >
        <Star
          size={15}
          aria-hidden
          className={starred ? "fill-(--ap-star) text-(--ap-star)" : ""}
        />
        {starred ? "Usuń z wyróżnionych" : "Dodaj do wyróżnionych"}
      </button>

      {/* Folder sub-list — the one item that opens a panel instead of closing. */}
      <div className="relative">
        <button
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={showFolders}
          className={`${ROW} justify-between`}
          onClick={() => setShowFolders((v) => !v)}
        >
          <span className="flex items-center gap-2.5">
            <FolderTree size={15} aria-hidden />
            Przypisz do folderów
          </span>
          <ChevronRight
            size={14}
            aria-hidden
            className={`transition-transform ${showFolders ? "rotate-90" : ""}`}
          />
        </button>

        {showFolders &&
          (geo.side === "stack" ? (
            <div className="mx-1 mb-1 rounded-lg border border-(--ap-line)">
              {folderList}
            </div>
          ) : (
            <div
              style={{
                left: geo.subLeft,
                top: geo.subTop,
                width: SUB_W,
                maxHeight: "calc(100dvh - 16px)",
              }}
              className="fixed z-10 overflow-y-auto rounded-xl border border-(--ap-line-strong) bg-(--ap-surface) shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
            >
              {folderList}
            </div>
          ))}
      </div>

      <hr className="my-1 border-(--ap-line)" />

      <button
        type="button"
        role="menuitem"
        className={ROW}
        onClick={() => {
          setArchivedState(!archived);
          act(() => setArchived(item.id, !archived));
        }}
      >
        {archived ? (
          <>
            <ArchiveRestore size={15} aria-hidden />
            Przywróć do odebranych
          </>
        ) : (
          <>
            <Archive size={15} aria-hidden />
            Przenieś do archiwum
          </>
        )}
      </button>
    </div>
  );
}
