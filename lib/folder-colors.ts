/**
 * The fixed folder-icon palette, shared by the client pickers and the server
 * validators. Folders can't be an arbitrary hex free-for-all: a closed set of
 * keys is what lets the color double as a validated, allow-listed value on the
 * server AND render as a consistent swatch on the client. Every color is tuned
 * to stay legible as an icon tint on the panel's dark graphite surface.
 *
 * Directive-free on purpose — imported by both client components and Server
 * Actions.
 */

export const FOLDER_COLORS = {
  slate: { label: "Grafit", dot: "#94a3b8" },
  sky: { label: "Błękit", dot: "#82aaff" },
  mint: { label: "Mięta", dot: "#62d9a5" },
  amber: { label: "Bursztyn", dot: "#e8b04a" },
  rose: { label: "Róż", dot: "#ff8095" },
  violet: { label: "Fiolet", dot: "#b28bff" },
  lime: { label: "Limonka", dot: "#b3d95a" },
  cyan: { label: "Cyjan", dot: "#5ad2e0" },
} as const;

export type FolderColor = keyof typeof FOLDER_COLORS;

export const FOLDER_COLOR_KEYS = Object.keys(FOLDER_COLORS) as FolderColor[];

export const DEFAULT_FOLDER_COLOR: FolderColor = "sky";

export const isFolderColor = (v: unknown): v is FolderColor =>
  // hasOwnProperty, not `in`: `in` walks the prototype chain, so „constructor",
  // „toString", „__proto__" etc. would slip past the allow-list.
  typeof v === "string" &&
  Object.prototype.hasOwnProperty.call(FOLDER_COLORS, v);

/** The icon tint for a stored color, falling back if the value is unknown. */
export const folderDot = (color: string): string =>
  (isFolderColor(color) ? FOLDER_COLORS[color] : FOLDER_COLORS[DEFAULT_FOLDER_COLOR])
    .dot;
