"use client";

import { useState } from "react";

import Link from "next/link";

import { MoreVertical, Star } from "lucide-react";

import { MessageContextMenu } from "@/components/admin/message-context-menu";
import { Stamp } from "@/components/admin/stamp";
import type { FolderLite, MessageListItem } from "@/components/admin/types";
import { folderDot } from "@/lib/folder-colors";

/**
 * The message list — a client island so each row can host the right-click (and
 * „⋯") action menu. The whole row is a link to the thread; the menu opens at
 * the cursor and floats above everything.
 */
export function MessageList({
  items,
  folders,
  emptyText,
}: {
  items: MessageListItem[];
  folders: FolderLite[];
  emptyText: string;
}) {
  const [menu, setMenu] = useState<{
    item: MessageListItem;
    x: number;
    y: number;
  } | null>(null);

  const byId = new Map(folders.map((f) => [f.id, f]));

  if (items.length === 0) {
    return <p className="py-24 text-center text-(--ap-muted)">{emptyText}</p>;
  }

  const open = (item: MessageListItem, x: number, y: number) =>
    setMenu({ item, x, y });

  return (
    <>
      <ul className="divide-y divide-(--ap-line)">
        {items.map((m) => {
          const memberFolders = m.folderIds
            .map((id) => byId.get(id))
            .filter((f): f is FolderLite => Boolean(f));
          return (
            <li
              key={m.id}
              className="relative"
              onContextMenu={(e) => {
                e.preventDefault();
                open(m, e.clientX, e.clientY);
              }}
            >
              <Link
                href={`/admin/messages/${m.id}`}
                className="group grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-4 pr-11 pl-3 transition-colors hover:bg-(--ap-surface) sm:grid-cols-[auto_minmax(0,15rem)_minmax(0,1fr)_auto] sm:items-baseline sm:gap-x-4"
              >
                <span
                  aria-label={m.unread ? "Nieprzeczytana" : undefined}
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full sm:mt-0 sm:self-center ${
                    m.unread ? "bg-(--ap-accent)" : "bg-transparent"
                  }`}
                />

                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`truncate ${
                        m.unread ? "font-semibold" : "font-medium"
                      }`}
                    >
                      {m.name}
                    </span>
                    {m.starred && (
                      <Star
                        size={13}
                        aria-label="Wyróżniona"
                        className="shrink-0 fill-(--ap-star) text-(--ap-star)"
                      />
                    )}
                  </span>
                  <span className="block truncate font-mono text-xs text-(--ap-muted)">
                    {m.email}
                  </span>
                </span>

                <span className="col-span-2 min-w-0 sm:col-span-1">
                  <span
                    className={`block truncate ${
                      m.unread ? "text-(--ap-text)" : "text-(--ap-muted)"
                    }`}
                  >
                    {m.subject}
                  </span>
                  <span className="block truncate text-sm text-(--ap-muted)/70">
                    {m.snippet}
                  </span>
                  {memberFolders.length > 0 && (
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      {memberFolders.map((f) => (
                        <span
                          key={f.id}
                          title={f.name}
                          className="inline-flex items-center gap-1 rounded-full border border-(--ap-line) px-1.5 py-0.5 text-[10px] text-(--ap-muted)"
                        >
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: folderDot(f.color) }}
                          />
                          {f.name}
                        </span>
                      ))}
                    </span>
                  )}
                </span>

                <span className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:flex-col sm:items-end sm:gap-1.5">
                  <span className="font-mono text-xs whitespace-nowrap text-(--ap-muted)">
                    {m.when}
                  </span>
                  <span className="flex gap-1.5">
                    {m.replied && <Stamp tone="ok">Odpowiedziano</Stamp>}
                    {m.unread && <Stamp tone="accent">Nowa</Stamp>}
                    {m.budget && <Stamp>{m.budget}</Stamp>}
                  </span>
                </span>
              </Link>

              <button
                type="button"
                aria-label={`Akcje: ${m.subject}`}
                onClick={(e) => {
                  e.preventDefault();
                  open(m, e.clientX, e.clientY);
                }}
                className="absolute top-3 right-1.5 grid h-8 w-8 place-items-center rounded-lg text-(--ap-muted) transition-colors hover:bg-(--ap-raised) hover:text-(--ap-text) sm:top-1/2 sm:-translate-y-1/2"
              >
                <MoreVertical size={17} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      {menu && (
        <MessageContextMenu
          item={menu.item}
          folders={folders}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
