import Link from "next/link";
import { notFound } from "next/navigation";

import { asc, eq } from "drizzle-orm";
import { ArrowLeft, Folder, Paperclip, Star } from "lucide-react";

import { Composer } from "@/components/admin/composer";
import { MarkRead } from "@/components/admin/mark-read";
import { MessageActions } from "@/components/admin/message-actions";
import { Stamp } from "@/components/admin/stamp";
import { requireAdmin } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import {
  folders,
  messageFolders,
  messages,
  replies,
  type AttachmentMeta,
  type MessageRow,
} from "@/lib/db/schema";
import { folderDot } from "@/lib/folder-colors";
import { formatBytes, formatDateTime } from "@/lib/format";

/* ------------------------------- quote doc -------------------------------- */

type Node = { type: string; content?: Node[]; text?: string };

const para = (text?: string): Node =>
  text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };

/**
 * The composer opens like a real mail client: two blank lines to write into,
 * then the original message quoted below an attribution line. Built here (the
 * server knows the message), consumed as the editor's initial document.
 */
function quoteDoc(m: MessageRow): Node {
  return {
    type: "doc",
    content: [
      para(),
      para(),
      para(
        `W dniu ${formatDateTime(m.createdAt)} ${m.firstName} ${m.lastName} napisał(a):`,
      ),
      { type: "blockquote", content: m.body.split("\n").map((l) => para(l || undefined)) },
    ],
  };
}

/** Stored reply metadata is JSON — parse defensively, render only valid shapes. */
function parseAttachments(json: string): AttachmentMeta[] {
  try {
    const arr: unknown = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (a): a is AttachmentMeta =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as AttachmentMeta).name === "string" &&
        typeof (a as AttachmentMeta).size === "number" &&
        typeof (a as AttachmentMeta).type === "string",
    );
  } catch {
    return [];
  }
}

/* ---------------------------------- page ----------------------------------- */

export default async function MessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) notFound();

  const msg = db.select().from(messages).where(eq(messages.id, id)).get();
  if (!msg) notFound();

  const thread = db
    .select()
    .from(replies)
    .where(eq(replies.messageId, id))
    .orderBy(asc(replies.sentAt))
    .all();

  const allFolders = db
    .select()
    .from(folders)
    .orderBy(asc(folders.createdAt))
    .all();
  const memberIds = db
    .select({ folderId: messageFolders.folderId })
    .from(messageFolders)
    .where(eq(messageFolders.messageId, id))
    .all()
    .map((r) => r.folderId);
  const memberSet = new Set(memberIds);
  const memberFolders = allFolders.filter((f) => memberSet.has(f.id));
  const foldersLite = allFolders.map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
  }));

  const defaultSubject = /^re:/i.test(msg.subject)
    ? msg.subject
    : `Re: ${msg.subject}`;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      {msg.readAt === null && <MarkRead id={msg.id} />}

      <nav className="py-5">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-(--ap-muted) transition-colors hover:text-(--ap-text)"
        >
          <ArrowLeft size={15} aria-hidden />
          Skrzynka
        </Link>
      </nav>

      <header className="border-b border-(--ap-line) pb-6">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {msg.starredAt !== null && (
            <span className="inline-flex items-center gap-1 text-xs text-(--ap-star)">
              <Star size={13} aria-hidden className="fill-(--ap-star)" />
              Wyróżniona
            </span>
          )}
          {msg.archivedAt !== null && <Stamp>Zarchiwizowana</Stamp>}
          {thread.length > 0 && <Stamp tone="ok">Odpowiedziano</Stamp>}
          {msg.budget && <Stamp tone="accent">Budżet: {msg.budget}</Stamp>}
        </div>

        {memberFolders.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {memberFolders.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-(--ap-line) px-2 py-0.5 text-xs text-(--ap-muted)"
              >
                <Folder
                  size={12}
                  aria-hidden
                  style={{ color: folderDot(f.color) }}
                />
                {f.name}
              </span>
            ))}
          </div>
        )}

        <h1 className="mb-4 font-display text-2xl font-bold text-balance">
          {msg.subject}
        </h1>

        <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs text-(--ap-muted)">
          <dt className="uppercase">Od</dt>
          <dd className="text-(--ap-text)">
            {msg.firstName} {msg.lastName}
          </dd>
          <dt className="uppercase">E-mail</dt>
          <dd className="text-(--ap-accent) select-all">{msg.email}</dd>
          <dt className="uppercase">Otrzymano</dt>
          <dd>{formatDateTime(msg.createdAt)}</dd>
          {msg.ip && (
            <>
              <dt className="uppercase">IP</dt>
              <dd>{msg.ip}</dd>
            </>
          )}
        </dl>

        <MessageActions
          id={msg.id}
          archived={msg.archivedAt !== null}
          starred={msg.starredAt !== null}
          folders={foldersLite}
          memberIds={memberIds}
        />
      </header>

      <section aria-label="Treść wiadomości" className="py-8">
        <p className="max-w-[65ch] leading-relaxed whitespace-pre-wrap">
          {msg.body}
        </p>
      </section>

      {thread.length > 0 && (
        <section aria-label="Wysłane odpowiedzi" className="space-y-4 pb-10">
          <h2 className="font-mono text-xs tracking-[0.2em] text-(--ap-muted) uppercase">
            Odpowiedzi · {thread.length}
          </h2>
          {thread.map((r) => (
            <article
              key={r.id}
              className="ap-sheet overflow-hidden rounded-xl shadow-[0_6px_30px_rgba(0,0,0,0.35)]"
            >
              <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-(--ap-paper-line) px-6 py-3">
                <span className="font-medium">{r.subject}</span>
                <span className="ml-auto font-mono text-xs text-neutral-500">
                  wysłano {formatDateTime(r.sentAt)}
                </span>
              </header>
              <div
                className="px-6 py-5"
                // Stored HTML is server-generated and sanitized BEFORE storage
                // (lib/email-html.ts) — the panel renders its own output here.
                dangerouslySetInnerHTML={{ __html: r.html }}
              />
              {parseAttachments(r.attachments).length > 0 && (
                <footer className="flex flex-wrap gap-2 border-t border-(--ap-paper-line) px-6 py-3">
                  {parseAttachments(r.attachments).map((a, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-md border border-(--ap-paper-line) bg-[#f4f2ed] px-2.5 py-1 font-mono text-xs text-neutral-700"
                    >
                      <Paperclip size={12} aria-hidden />
                      {a.name}
                      <span className="text-neutral-400">
                        {formatBytes(a.size)}
                      </span>
                    </span>
                  ))}
                </footer>
              )}
            </article>
          ))}
        </section>
      )}

      <section aria-label="Nowa odpowiedź">
        <h2 className="mb-4 font-mono text-xs tracking-[0.2em] text-(--ap-muted) uppercase">
          Odpowiedz
        </h2>
        <Composer
          messageId={msg.id}
          email={msg.email}
          defaultSubject={defaultSubject}
          initialDoc={quoteDoc(msg)}
        />
      </section>
    </main>
  );
}
