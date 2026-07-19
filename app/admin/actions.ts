"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { and, eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth/dal";
import { destroySession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { folders, messageFolders, messages } from "@/lib/db/schema";
import { isFolderColor } from "@/lib/folder-colors";
import { stripControl } from "@/lib/strings";

/**
 * Panel mutations. Server Actions are public POST endpoints no matter where
 * the buttons render, so EVERY action re-verifies the session itself — the
 * page-level check does not extend here.
 */

export async function logout(): Promise<void> {
  // No requireAdmin: an expired session should still be able to clear its
  // cookie, and the redirect target is the login screen either way.
  await destroySession();
  redirect("/admin/login");
}

/** Both list revalidations in one place — every mutation touches both views. */
function revalidateMessage(id: number) {
  revalidatePath("/admin");
  revalidatePath(`/admin/messages/${id}`);
}

const validId = (id: unknown): id is number =>
  typeof id === "number" && Number.isInteger(id) && id > 0;

/* --------------------------------- flags ---------------------------------- */

/** Called on message open (MarkRead). Only ever sets read → no unread race. */
export async function markRead(id: number): Promise<void> {
  await requireAdmin();
  if (!validId(id)) return;
  db.update(messages)
    .set({ readAt: Date.now() })
    .where(eq(messages.id, id))
    .run();
  revalidateMessage(id);
}

/**
 * Marking unread must NOT revalidate the detail path we're leaving: doing so
 * re-commits it with readAt=null, remounting <MarkRead>, which fires markRead()
 * and flips the message straight back. Revalidate only the inbox, then let the
 * thrown redirect navigate — no intermediate detail commit happens.
 */
export async function markUnread(id: number): Promise<void> {
  await requireAdmin();
  if (!validId(id)) return;
  db.update(messages)
    .set({ readAt: null })
    .where(eq(messages.id, id))
    .run();
  revalidatePath("/admin");
  redirect("/admin");
}

/**
 * Read toggle for the LIST context menu (no redirect, no detail-path touch):
 * from a list there is no <MarkRead> mounted, so a plain toggle + inbox
 * revalidate is safe and stays where the admin is.
 */
export async function setReadState(id: number, read: boolean): Promise<void> {
  await requireAdmin();
  if (!validId(id)) return;
  db.update(messages)
    .set({ readAt: read ? Date.now() : null })
    .where(eq(messages.id, id))
    .run();
  revalidatePath("/admin");
}

export async function toggleStar(id: number, starred: boolean): Promise<void> {
  await requireAdmin();
  if (!validId(id)) return;
  db.update(messages)
    .set({ starredAt: starred ? Date.now() : null })
    .where(eq(messages.id, id))
    .run();
  revalidateMessage(id);
}

export async function setArchived(id: number, archived: boolean): Promise<void> {
  await requireAdmin();
  if (!validId(id)) return;
  db.update(messages)
    .set({ archivedAt: archived ? Date.now() : null })
    .where(eq(messages.id, id))
    .run();
  revalidateMessage(id);
}

/* ------------------------------ folder membership ------------------------- */

export async function assignFolder(
  messageId: number,
  folderId: number,
  member: boolean,
): Promise<void> {
  await requireAdmin();
  if (!validId(messageId) || !validId(folderId)) return;

  if (member) {
    // Guard BOTH FKs explicitly so a stale id fails quietly rather than
    // throwing a constraint error back at the client (onConflictDoNothing only
    // swallows PK/UNIQUE conflicts, never FK violations).
    const folderOk = db
      .select({ id: folders.id })
      .from(folders)
      .where(eq(folders.id, folderId))
      .get();
    const messageOk = db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.id, messageId))
      .get();
    if (!folderOk || !messageOk) return;
    db.insert(messageFolders)
      .values({ messageId, folderId })
      .onConflictDoNothing()
      .run();
  } else {
    db.delete(messageFolders)
      .where(
        and(
          eq(messageFolders.messageId, messageId),
          eq(messageFolders.folderId, folderId),
        ),
      )
      .run();
  }
  revalidateMessage(messageId);
}

/* --------------------------------- folder CRUD ---------------------------- */

const MAX_FOLDER_NAME = 40;

export type FolderResult =
  | { ok: true; id: number; name: string; color: string }
  | { ok: false; error: string };

function cleanFolderName(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 200) return null;
  const name = stripControl(raw).slice(0, MAX_FOLDER_NAME).trim();
  return name || null;
}

export async function createFolder(
  name: string,
  color: string,
): Promise<FolderResult> {
  await requireAdmin();
  const clean = cleanFolderName(name);
  if (!clean) return { ok: false, error: "Podaj nazwę folderu." };
  if (!isFolderColor(color)) return { ok: false, error: "Nieznany kolor." };

  const row = db
    .insert(folders)
    .values({ name: clean, color, createdAt: Date.now() })
    .returning({ id: folders.id })
    .get();

  revalidatePath("/admin");
  return { ok: true, id: row.id, name: clean, color };
}

export async function updateFolder(
  id: number,
  name: string,
  color: string,
): Promise<FolderResult> {
  await requireAdmin();
  if (!validId(id)) return { ok: false, error: "Nieprawidłowy folder." };
  const clean = cleanFolderName(name);
  if (!clean) return { ok: false, error: "Podaj nazwę folderu." };
  if (!isFolderColor(color)) return { ok: false, error: "Nieznany kolor." };

  db.update(folders)
    .set({ name: clean, color })
    .where(eq(folders.id, id))
    .run();

  revalidatePath("/admin");
  return { ok: true, id, name: clean, color };
}

export async function deleteFolder(id: number): Promise<void> {
  await requireAdmin();
  if (!validId(id)) return;
  // Memberships cascade away with the folder; the messages themselves stay put.
  db.delete(folders).where(eq(folders.id, id)).run();
  revalidatePath("/admin");
}
