"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useSectionActions } from "./section-context";

/**
 * ScrollFlow — the single natively-scrolling region that carries every content
 * section („Dlaczego ja?" → „Moja oferta" → …).
 *
 * The deck owns vertical gestures, so nothing scrolls unless it opts back in via
 * [data-deck-scroll]. This region does, which is what makes the content sections
 * ONE ordinary, continuous scroll with no transition between them: a wheel or
 * swipe inside it just scrolls, and the deck only takes the gesture back — and
 * wipes to the hero — once the region is at its top edge. The hero keeps its own
 * full-screen panel, so it keeps its wipe; everything below it simply scrolls.
 *
 * It also scroll-spies the nav rail. Each child section tags itself
 * [data-nav-section]; whichever one is crossing a thin band partway down the
 * region is reported as the active nav section. The deck also sets that
 * optimistically on a nav click, so the rail highlights instantly and the spy
 * only has to keep it honest while you scroll.
 */

// A thin band ~45% down the region. Sections here are all taller than the
// viewport, so exactly one covers this line at a time — no ratio maths needed
// (an intersectionRatio threshold would be useless: a 2000px section in an 800px
// viewport can never exceed a ratio of 0.4).
const SPY_BAND = "-45% 0px -50% 0px";

export function ScrollFlow({ children }: { children: ReactNode }) {
  // Actions only: this reports the scroll, it never renders it — subscribing to
  // the state it feeds would re-render the entire flow on every tick.
  const { reportSection } = useSectionActions();
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const sections = [
      ...region.querySelectorAll<HTMLElement>("[data-nav-section]"),
    ];
    if (sections.length === 0) return;

    const crossing = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.navSection;
          if (!id) continue;
          if (e.isIntersecting) crossing.add(id);
          else crossing.delete(id);
        }
        // Document order wins when two sections straddle the band at once.
        const current = sections.find((s) =>
          crossing.has(s.dataset.navSection ?? ""),
        );
        const id = current?.dataset.navSection;
        if (id) reportSection(id);
      },
      { root: region, rootMargin: SPY_BAND, threshold: 0 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [reportSection]);

  return (
    <div
      ref={regionRef}
      data-deck-scroll
      role="region"
      tabIndex={0}
      aria-label="Treść strony — przewiń, aby czytać dalej"
      className="h-full overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint/30"
    >
      {children}
    </div>
  );
}
