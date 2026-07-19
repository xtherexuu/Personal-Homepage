import Link from "next/link";

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  type SQL,
} from "drizzle-orm";
import { Archive, FolderTree, Inbox, LogOut, Star } from "lucide-react";

import { logout } from "@/app/admin/actions";
import { FoldersManager } from "@/components/admin/folders-manager";
import { MessageList } from "@/components/admin/message-list";
import type { MessageListItem } from "@/components/admin/types";
import { requireAdmin } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { folders, messageFolders, messages, replies } from "@/lib/db/schema";
import { folderDot } from "@/lib/folder-colors";
import { formatWhen } from "@/lib/format";

/** One line of preview under the subject — whitespace collapsed, hard-capped. */
const snippet = (body: string) =>
  body.replace(/\s+/g, " ").trim().slice(0, 140);

type View = "inbox" | "starred" | "archived" | "folder" | "folders";

export default async function AdminInbox({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const sp = await searchParams;

  /* ------------------------------ folders + counts ------------------------ */

  const foldersRaw = db
    .select()
    .from(folders)
    .orderBy(asc(folders.createdAt))
    .all();

  const folderCountRows = db
    .select({ folderId: messageFolders.folderId, n: count() })
    .from(messageFolders)
    .innerJoin(messages, eq(messages.id, messageFolders.messageId))
    .where(isNull(messages.archivedAt))
    .groupBy(messageFolders.folderId)
    .all();
  const countByFolder = new Map(folderCountRows.map((r) => [r.folderId, r.n]));

  const foldersLite = foldersRaw.map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
  }));

  /* --------------------------------- routing ------------------------------ */

  const folderParam =
    typeof sp.folder === "string" ? Number(sp.folder) : Number.NaN;
  const currentFolder =
    Number.isInteger(folderParam) && folderParam > 0
      ? foldersRaw.find((f) => f.id === folderParam)
      : undefined;

  const view: View = currentFolder
    ? "folder"
    : sp.view === "wyroznione"
      ? "starred"
      : sp.view === "archiwum"
        ? "archived"
        : sp.view === "foldery"
          ? "folders"
          : "inbox";

  /* --------------------------------- messages ----------------------------- */

  let items: MessageListItem[] = [];

  if (view !== "folders") {
    const where: SQL =
      view === "archived"
        ? isNotNull(messages.archivedAt)
        : view === "starred"
          ? and(isNull(messages.archivedAt), isNotNull(messages.starredAt))!
          : isNull(messages.archivedAt);

    // Folder view adds an inner join on membership; every other view queries
    // messages directly. Both fold in the reply count for the „Odpowiedziano"
    // stamp. Archived messages are excluded everywhere except the archive.
    const rows =
      view === "folder"
        ? db
            .select({ m: messages, replyCount: count(replies.id) })
            .from(messages)
            .innerJoin(
              messageFolders,
              and(
                eq(messageFolders.messageId, messages.id),
                eq(messageFolders.folderId, currentFolder!.id),
              ),
            )
            .leftJoin(replies, eq(replies.messageId, messages.id))
            .where(isNull(messages.archivedAt))
            .groupBy(messages.id)
            .orderBy(desc(messages.createdAt))
            .all()
        : db
            .select({ m: messages, replyCount: count(replies.id) })
            .from(messages)
            .leftJoin(replies, eq(replies.messageId, messages.id))
            .where(where)
            .groupBy(messages.id)
            .orderBy(desc(messages.createdAt))
            .all();

    const ids = rows.map((r) => r.m.id);
    const membershipRows = ids.length
      ? db
          .select()
          .from(messageFolders)
          .where(inArray(messageFolders.messageId, ids))
          .all()
      : [];
    const membersByMsg = new Map<number, number[]>();
    for (const mf of membershipRows) {
      const arr = membersByMsg.get(mf.messageId);
      if (arr) arr.push(mf.folderId);
      else membersByMsg.set(mf.messageId, [mf.folderId]);
    }

    items = rows.map(({ m, replyCount }) => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      email: m.email,
      subject: m.subject,
      snippet: snippet(m.body),
      when: formatWhen(m.createdAt),
      unread: m.readAt === null,
      starred: m.starredAt !== null,
      archived: m.archivedAt !== null,
      replied: replyCount > 0,
      budget: m.budget,
      folderIds: membersByMsg.get(m.id) ?? [],
    }));
  }

  /* ---------------------------------- counts ------------------------------ */

  const c = (where: SQL) =>
    db.select({ n: count() }).from(messages).where(where).get()?.n ?? 0;

  const inboxCount = c(isNull(messages.archivedAt));
  const unreadCount = c(and(isNull(messages.archivedAt), isNull(messages.readAt))!);
  const starredCount = c(
    and(isNull(messages.archivedAt), isNotNull(messages.starredAt))!,
  );
  const archiveCount = c(isNotNull(messages.archivedAt));

  /* ---------------------------------- render ------------------------------ */

  const tabCls = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
      active
        ? "bg-(--ap-raised) text-(--ap-text)"
        : "text-(--ap-muted) hover:text-(--ap-text)"
    }`;

  const countCls = "font-mono text-xs text-(--ap-muted)";

  const heading =
    view === "folder"
      ? currentFolder!.name
      : view === "starred"
        ? "Wyróżnione"
        : view === "archived"
          ? "Archiwum"
          : view === "folders"
            ? "Foldery"
            : "Skrzynka";

  const emptyText =
    view === "archived"
      ? "Archiwum jest puste."
      : view === "starred"
        ? "Brak wyróżnionych wiadomości. Oznacz je gwiazdką z menu (PPM albo przycisk ⋯)."
        : view === "folder"
          ? "Ten folder jest pusty. Przypisz wiadomości z menu (PPM albo przycisk ⋯)."
          : "Pusto — nowe zapytania z formularza pojawią się tutaj.";

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-(--ap-line) py-5">
        <div className="mr-auto flex items-center gap-2.5">
          {view === "folder" && (
            <span
              aria-hidden
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: folderDot(currentFolder!.color) }}
            />
          )}
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-(--ap-muted) uppercase">
              bartoszzaleski.com
            </p>
            <h1 className="font-display text-xl font-bold">{heading}</h1>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1" aria-label="Widoki">
          <Link href="/admin" className={tabCls(view === "inbox")}>
            <Inbox size={15} aria-hidden />
            Odebrane
            <span className={countCls}>{inboxCount}</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-(--ap-accent) px-1.5 font-mono text-[10px] font-bold text-[#0d1420]">
                {unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/admin?view=wyroznione"
            className={tabCls(view === "starred")}
          >
            <Star size={15} aria-hidden />
            Wyróżnione
            <span className={countCls}>{starredCount}</span>
          </Link>
          <Link
            href="/admin?view=foldery"
            className={tabCls(view === "folders" || view === "folder")}
          >
            <FolderTree size={15} aria-hidden />
            Foldery
            <span className={countCls}>{foldersRaw.length}</span>
          </Link>
          <Link
            href="/admin?view=archiwum"
            className={tabCls(view === "archived")}
          >
            <Archive size={15} aria-hidden />
            Archiwum
            <span className={countCls}>{archiveCount}</span>
          </Link>
        </nav>

        <form action={logout}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-(--ap-line-strong) px-3 py-1.5 text-sm text-(--ap-muted) transition-colors hover:border-(--ap-danger) hover:text-(--ap-danger)"
          >
            <LogOut size={15} aria-hidden />
            Wyloguj
          </button>
        </form>
      </header>

      {view === "folder" && (
        <div className="flex items-center gap-2 py-4 text-sm text-(--ap-muted)">
          <Link
            href="/admin?view=foldery"
            className="transition-colors hover:text-(--ap-text)"
          >
            Foldery
          </Link>
          <span aria-hidden>/</span>
          <span className="text-(--ap-text)">{currentFolder!.name}</span>
          <span className={countCls}>
            {countByFolder.get(currentFolder!.id) ?? 0}
          </span>
        </div>
      )}

      {view === "folders" ? (
        <FoldersManager
          folders={foldersRaw.map((f) => ({
            id: f.id,
            name: f.name,
            color: f.color,
            count: countByFolder.get(f.id) ?? 0,
          }))}
        />
      ) : (
        <MessageList items={items} folders={foldersLite} emptyText={emptyText} />
      )}
    </main>
  );
}
