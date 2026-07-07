"use client";

import { createContext, useContext } from "react";

/**
 * Shared state for the full-screen section deck. The deck (provider) owns the
 * active panel, the custom-scroll transition, and the mobile-menu open state; the
 * nav and the panels consume it. No native scrolling happens — sections are
 * swapped with a crossfade.
 */
/**
 * A panel can own INTERNAL steps (e.g. the reveal's three parts). While it's
 * active it registers a SubNav; the deck then consults it at a scroll boundary:
 * a little overscroll advances the panel's internal step before the deck steps to
 * the next panel. `canAdvance(dir)` says whether an internal step exists in that
 * direction (dir: +1 down / -1 up); `advance(dir)` performs it.
 */
export type SubNav = {
  canAdvance: (dir: number) => boolean;
  advance: (dir: number) => void;
};

export type SectionContextValue = {
  active: string; // active PANEL id (a section can span several panels)
  activeSection: string; // nav-section id of the active panel (for the rail/menu)
  go: (sectionId: string) => void; // jump to a nav section (its first panel); no-op if absent
  next: () => void; // advance one panel (scroll-hint button); no-op at the end
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  registerSubNav: (nav: SubNav | null) => void; // active panel opts into boundary sub-stepping
};

export const SectionContext = createContext<SectionContextValue | null>(null);

export function useSection(): SectionContextValue {
  const ctx = useContext(SectionContext);
  if (!ctx) throw new Error("useSection must be used within <SectionDeck>");
  return ctx;
}

/** Whether the enclosing <Panel> is the active one — lets a panel play/reset its
 *  entrance animation when it comes into / leaves view. */
export const PanelActiveContext = createContext(false);
export const usePanelActive = (): boolean => useContext(PanelActiveContext);
