/**
 * Shared column geometry for the "Dlaczego ja" background grid and the deck's
 * wipe transition (both after eszterbial.com). The section divides the viewport
 * into equal columns separated by hairlines, and the wipe covers the screen
 * with bars exactly one column wide — the bars must match the rectangles, so
 * both read this single source.
 *
 * Column count by breakpoint: 3 → md:4 → lg:6 → 3xl:8. A container takes
 * COL_GRID and renders MAX_COLS children, each with its index's COL_VISIBILITY
 * class, so exactly as many children show as the breakpoint has tracks.
 */
export const MAX_COLS = 8;

export const COL_GRID =
  "grid-cols-3 md:grid-cols-4 lg:grid-cols-6 3xl:grid-cols-8";

/** Index-aligned visibility for the MAX_COLS children of a COL_GRID container. */
export const COL_VISIBILITY: readonly string[] = [
  "",
  "",
  "",
  "hidden md:block",
  "hidden lg:block",
  "hidden lg:block",
  "hidden 3xl:block",
  "hidden 3xl:block",
];
