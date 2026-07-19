import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * The admin panel's data — enquiries captured by POST /api/contact and the
 * replies sent from the panel. Timestamps are epoch milliseconds (integers),
 * matching what `Date.now()` hands out and what `new Date(n)` reads back;
 * SQLite has no richer date type worth converting through.
 */

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    /** Server-derived at intake: the allowlisted menu label, or „Inny" free text. */
    subject: text("subject").notNull(),
    budget: text("budget"),
    body: text("body").notNull(),
    /** First X-Forwarded-For hop at submit time — spam triage, nothing more. */
    ip: text("ip"),
    createdAt: integer("created_at").notNull(),
    /** Null = unread. Set the first time the admin opens the message. */
    readAt: integer("read_at"),
    /** Null = inbox. Archiving hides, never deletes. */
    archivedAt: integer("archived_at"),
    /** Null = not starred. Set/cleared from the „Wyróżnione" toggle. */
    starredAt: integer("starred_at"),
  },
  (t) => [index("messages_created_at_idx").on(t.createdAt)],
);

/**
 * Admin-defined folders. A folder is just a colored label; its `color` is one
 * of the allow-listed keys in lib/folder-colors (validated server-side). An
 * archived message stays a member but is hidden from the folder view — the
 * membership survives so restoring the message brings it back to its folders.
 */
export const folders = sqliteTable("folders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  /** A key from lib/folder-colors.FOLDER_COLORS, not a raw hex. */
  color: text("color").notNull(),
  createdAt: integer("created_at").notNull(),
});

/**
 * Message ↔ folder membership (many-to-many): one message can sit in several
 * folders. Both sides cascade-delete, so removing a folder drops its
 * memberships without touching the messages, and deleting a message (never
 * exposed in the UI, but the FK is correct regardless) drops its rows here.
 */
export const messageFolders = sqliteTable(
  "message_folders",
  {
    messageId: integer("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    folderId: integer("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.messageId, t.folderId] }),
    index("message_folders_folder_idx").on(t.folderId),
  ],
);

export const replies = sqliteTable(
  "replies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    messageId: integer("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    /** The SANITIZED html that was actually mailed — stored post-sanitize only. */
    html: text("html").notNull(),
    /** Plain-text alternative part, derived server-side from the editor doc. */
    text: text("text").notNull(),
    /** JSON array of { name, size, type } — metadata only, bytes are not kept. */
    attachments: text("attachments").notNull().default("[]"),
    smtpMessageId: text("smtp_message_id"),
    sentAt: integer("sent_at").notNull(),
  },
  (t) => [index("replies_message_id_idx").on(t.messageId)],
);

export type MessageRow = typeof messages.$inferSelect;
export type ReplyRow = typeof replies.$inferSelect;
export type FolderRow = typeof folders.$inferSelect;
export type AttachmentMeta = { name: string; size: number; type: string };
