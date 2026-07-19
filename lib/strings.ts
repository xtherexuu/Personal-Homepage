/**
 * Control-character hygiene shared by every route that accepts user text and
 * later puts it anywhere line-oriented — SMTP headers, log lines, the DB rows
 * the admin panel renders. Directive-free on purpose: client code may import
 * these for symmetry, server code depends on them for safety.
 */

/** Single-line fields: no C0/DEL control characters, ever — CRLF included. */
export const stripControl = (s: string) =>
  s.replace(/[\u0000-\u001f\u007f]/g, " ").trim();

/** Multi-line text keeps its line breaks (and tabs); every other control char goes. */
export const stripControlKeepNewlines = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ")
    .trim();
