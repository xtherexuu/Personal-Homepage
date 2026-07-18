"use client";

import { createContext, useContext } from "react";

/**
 * Shared state for the single-page site. The page is one ordinary, natively-
 * scrolling document (see SectionDeck) — there are no panels and no custom scroll
 * takeover — so all this needs to carry is what the navigation reads: which
 * section is currently in view (the rail / menu highlight), the mobile-menu open
 * state, and a smooth-scroll `go` to jump to a section.
 */
export type SectionContextValue = {
  /** nav-section id currently crossing the spy band — the rail / menu highlight. */
  activeSection: string;
  /** Smooth-scroll a section into view; no-op if it isn't in the DOM yet. */
  go: (sectionId: string) => void;
  /**
   * Scroll to the contact block so the „Wiadomość" form sits in view from the
   * tiles down (not the „złap KONTAKT" header), and optionally preselect the
   * „Temat" of the package the visitor came from. The „Moja oferta" CTAs use it.
   */
  goContact: (topic?: string) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
};

export const SectionContext = createContext<SectionContextValue | null>(null);

export function useSection(): SectionContextValue {
  const ctx = useContext(SectionContext);
  if (!ctx) throw new Error("useSection must be used within <SectionDeck>");
  return ctx;
}

/**
 * The `go` action, split out from the state above — and the split earns its keep.
 * `activeSection` changes every time the scroll-spy crosses a section, so anything
 * reading the full context re-renders on a scroll tick. Offer only wants `go` for
 * its contact CTA; because `go` is a stable useCallback this value never changes
 * identity, so subscribing here means never re-rendering for a scroll you don't
 * read.
 *
 * Use `useSection` when you actually render the state (the nav rail's highlight);
 * use `useSectionActions` when you only need to CALL `go` / `goContact`.
 */
export type SectionActions = Pick<SectionContextValue, "go" | "goContact">;

export const SectionActionsContext = createContext<SectionActions | null>(null);

export function useSectionActions(): SectionActions {
  const ctx = useContext(SectionActionsContext);
  if (!ctx)
    throw new Error("useSectionActions must be used within <SectionDeck>");
  return ctx;
}
