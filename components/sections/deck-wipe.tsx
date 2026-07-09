"use client";

import { cn } from "@/lib/utils";
import { COL_GRID, COL_VISIBILITY, MAX_COLS } from "./deck-columns";

/**
 * DeckWipe — the deck's section-change transition, after the eszterbial.com
 * loader: a full-viewport set of vertical bars, one per background-grid column
 * (deck-columns keeps them exactly as wide as the section's rectangles).
 *
 * Phases (driven by SectionDeck):
 *   "cover"  — bars slide up from below the viewport, left → right, until the
 *              screen is fully covered; the deck swaps the active panel under
 *              them at the end of this phase.
 *   "reveal" — bars keep travelling up and out, left → right, unveiling the
 *              incoming panel (whose own entrance animations are running).
 *   null     — parked below the viewport with transitions disabled, so the
 *              reset jump (from −100% back to +100%) can never be seen.
 *
 * Each bar carries faint mint hairlines on its leading (top) and trailing
 * (bottom) edges so the sweep reads over the site's dark fields, plus a
 * hairline left border so the covered screen previews the section's grid.
 * Sits above everything (nav rail, mobile toggle) for the duration — like a
 * loader. pointer-events stay off; the deck's gesture lock covers input.
 */

export type WipePhase = "cover" | "reveal" | null;

export const WIPE_STAGGER_MS = 48; // per-bar delay, left → right
const COVER_BAR_MS = 520; // one bar's rise
const REVEAL_BAR_MS = 620; // one bar's exit

/** Full phase lengths (= last bar's delay + its travel) — the deck's timers. */
export const WIPE_COVER_MS = COVER_BAR_MS + WIPE_STAGGER_MS * (MAX_COLS - 1);
export const WIPE_REVEAL_MS = REVEAL_BAR_MS + WIPE_STAGGER_MS * (MAX_COLS - 1);

export function DeckWipe({ phase }: { phase: WipePhase }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-[80] grid overflow-hidden",
        COL_GRID,
      )}
    >
      {Array.from({ length: MAX_COLS }, (_, i) => (
        <div
          key={i}
          style={{
            transitionDelay: phase ? `${i * WIPE_STAGGER_MS}ms` : "0ms",
            transitionDuration:
              phase === "cover"
                ? `${COVER_BAR_MS}ms`
                : phase === "reveal"
                  ? `${REVEAL_BAR_MS}ms`
                  : undefined,
          }}
          className={cn(
            "relative h-full w-full bg-surface will-change-transform",
            "border-l border-paper/5",
            "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-mint/20",
            "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-mint/25",
            COL_VISIBILITY[i],
            // cover: rise into place (strong in-out); reveal: launch out the top
            // (expo-out — fast release, soft landing for the unveiled content).
            phase === "cover" &&
              "translate-y-0 transition-transform ease-[cubic-bezier(0.76,0,0.24,1)]",
            phase === "reveal" &&
              "-translate-y-full transition-transform ease-[cubic-bezier(0.16,1,0.3,1)]",
            phase === null && "translate-y-full transition-none",
          )}
        />
      ))}
    </div>
  );
}
