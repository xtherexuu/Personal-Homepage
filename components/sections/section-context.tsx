"use client";

import { createContext, useContext } from "react";

/**
 * Shared state for the full-screen section deck. The deck (provider) owns the
 * active panel, the custom-scroll transition, and the mobile-menu open state; the
 * nav and the panels consume it. No native scrolling happens — sections are
 * swapped with a crossfade.
 */
export type SectionContextValue = {
  active: string; // active PANEL id (a section can span several panels)
  activeSection: string; // nav-section id of the active panel (for the rail/menu)
  go: (sectionId: string) => void; // jump to a nav section (its first panel); no-op if absent
  next: () => void; // advance one panel (scroll-hint button); no-op at the end
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
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
