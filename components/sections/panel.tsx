"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { PanelActiveContext, useSection } from "./section-context";

/**
 * Panel — one full-screen slide in the deck. All panels are stacked (absolute
 * inset-0); only the active one is shown, and the swap itself is INSTANT: it
 * always lands while the DeckWipe bars fully cover the viewport (or under
 * reduced motion, where an instant switch is the point), so the incoming panel
 * is composed before it's unveiled. Inactive panels keep their content in the
 * DOM (crawlable, server-rendered) but are hidden from the a11y tree and
 * pointer events.
 */
export function Panel({ id, children }: { id: string; children: ReactNode }) {
  const { active } = useSection();
  const isActive = active === id;

  return (
    <PanelActiveContext.Provider value={isActive}>
      <div
        aria-hidden={!isActive}
        className={cn(
          "absolute inset-0 overflow-hidden",
          isActive ? "visible z-10" : "pointer-events-none invisible z-0",
        )}
      >
        {children}
      </div>
    </PanelActiveContext.Provider>
  );
}
