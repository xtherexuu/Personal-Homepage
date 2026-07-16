"use client";

import { createContext, useContext } from "react";

/**
 * Shared state for the full-screen section deck. The deck (provider) owns the
 * active panel, the custom-scroll transition, and the mobile-menu open state; the
 * nav and the panels consume it. No native scrolling happens — sections are
 * swapped behind the DeckWipe's column bars.
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
  active: string; // active PANEL id (the content panel holds several nav sections)
  activeSection: string; // nav-section id currently in view (for the rail/menu)
  go: (sectionId: string) => void; // jump to a nav section; no-op if it isn't built yet
  next: () => void; // advance one panel (scroll-hint button); no-op at the end
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  registerSubNav: (nav: SubNav | null) => void; // active panel opts into boundary sub-stepping
  /** ScrollFlow's scroll-spy reports which content section is currently in view. */
  reportSection: (sectionId: string) => void;
};

export const SectionContext = createContext<SectionContextValue | null>(null);

export function useSection(): SectionContextValue {
  const ctx = useContext(SectionContext);
  if (!ctx) throw new Error("useSection must be used within <SectionDeck>");
  return ctx;
}

/**
 * The deck's ACTIONS, split out from the state above — and the split earns its
 * keep. `activeSection` changes every time the scroll-spy crosses a section, so
 * anything reading the full context re-renders on a scroll tick. Most consumers
 * don't care: the offer section only wants `go` for its contact CTA, and
 * ScrollFlow only wants `reportSection`. Because every action is a useCallback
 * with stable deps, this value never changes identity, so subscribing here means
 * never re-rendering for a scroll you don't read.
 *
 * Use `useSection` when you actually render the state (the nav rail's highlight,
 * Panel's active flag); use `useSectionActions` when you only need to CALL
 * something.
 */
export type SectionActions = Pick<
  SectionContextValue,
  "go" | "next" | "setMenuOpen" | "registerSubNav" | "reportSection"
>;

export const SectionActionsContext = createContext<SectionActions | null>(null);

export function useSectionActions(): SectionActions {
  const ctx = useContext(SectionActionsContext);
  if (!ctx)
    throw new Error("useSectionActions must be used within <SectionDeck>");
  return ctx;
}

/** Whether the enclosing <Panel> is the active one — lets a panel play/reset its
 *  entrance animation when it comes into / leaves view. */
export const PanelActiveContext = createContext(false);
export const usePanelActive = (): boolean => useContext(PanelActiveContext);
