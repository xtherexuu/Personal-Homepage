/**
 * Serializable view shapes the server page hands to the client list + menus.
 * Kept free of drizzle/server imports so both sides can import them; the server
 * flattens DB rows into these (pre-formatting the relative time), and the
 * client renders + mutates against them.
 */

export type FolderLite = { id: number; name: string; color: string };

export type FolderWithCount = FolderLite & { count: number };

export type MessageListItem = {
  id: number;
  name: string;
  email: string;
  subject: string;
  snippet: string;
  /** Pre-formatted on the server (Warsaw-local) to avoid hydration drift. */
  when: string;
  unread: boolean;
  starred: boolean;
  archived: boolean;
  replied: boolean;
  budget: string | null;
  folderIds: number[];
};
