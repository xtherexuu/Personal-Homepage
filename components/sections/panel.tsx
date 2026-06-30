"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { PanelActiveContext, useSection } from "./section-context";

/**
 * Panel — one full-screen slide in the deck. All panels are stacked (absolute
 * inset-0); only the active one is shown. The swap is a soft crossfade with a
 * subtle scale so it reads as depth rather than a scroll. Inactive panels keep
 * their content in the DOM (crawlable, server-rendered) but are hidden from the
 * a11y tree and pointer events.
 *
 * Duration is kept in sync with the deck's TRANSITION_MS.
 */
export function Panel({ id, children }: { id: string; children: ReactNode }) {
  const { active } = useSection();
  const isActive = active === id;

  return (
    <PanelActiveContext.Provider value={isActive}>
      <div
        aria-hidden={!isActive}
        className={cn(
          "absolute inset-0 overflow-hidden transition-[opacity,transform,visibility] duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          isActive
            ? "visible z-10 scale-100 opacity-100"
            : "pointer-events-none invisible z-0 scale-[1.03] opacity-0",
        )}
      >
        {children}
      </div>
    </PanelActiveContext.Provider>
  );
}
