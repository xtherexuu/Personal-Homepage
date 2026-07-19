/**
 * Attachment caps shared by the composer (UX-side checks with friendly
 * messages) and lib/attachments.ts (the server's actual enforcement).
 * Directive-free so the client bundle may import it; the numbers keep the
 * base64-inflated message (~+37%) under Proton's 25 MB ceiling.
 */
export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
