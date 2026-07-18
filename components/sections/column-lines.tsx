"use client";

import { cn } from "@/lib/utils";
import { COL_GRID, COL_VISIBILITY, MAX_COLS } from "./deck-columns";

/**
 * ColumnLines — the hairline layer that cuts a section into the deck's equal
 * columns (deck-columns: the shared column grid the whole page snaps to).
 *
 * Rendered PER SECTION rather than once across the whole scroll flow, for two
 * reasons: each section draws its own lines in as it's revealed (a canvas-wide
 * layer would have to scaleY-draw across the entire ~7000px flow, which reads as
 * nothing at all in the viewport you're actually looking at), and a section that
 * needs no grid simply doesn't render one. Because every section is the same
 * width and uses the same COL_GRID, adjacent sections' lines land on identical x
 * positions and read as one continuous set of bars running down the page.
 *
 * All of a section's lines draw in TOGETHER — a single simultaneous scaleY, once,
 * when the section is revealed (see .why-line-in in globals.css). They used to
 * stagger in left → right to mirror the old DeckWipe reveal; with the wipe gone
 * that stagger just read as the lines lagging in one column at a time, so they
 * now land as one motion.
 *
 * The layer sits inside the section (absolute inset-0), so it spans exactly that
 * section's height and stays clear of the flow's scrollbar — the lines therefore
 * always align with the content grid.
 */
export function ColumnLines({ revealed }: { revealed: boolean }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 grid", COL_GRID)}
    >
      {Array.from({ length: MAX_COLS }, (_, i) => (
        <div key={i} className={cn("relative", COL_VISIBILITY[i])}>
          <span
            className={cn(
              "absolute inset-y-0 right-0 w-px origin-top bg-line",
              revealed ? "why-line-in" : "scale-y-0",
            )}
          />
        </div>
      ))}
    </div>
  );
}
