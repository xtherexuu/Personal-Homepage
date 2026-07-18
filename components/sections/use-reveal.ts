"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * useReveal — the entrance gate for a section: true once it has scrolled into
 * view. The page is one ordinary scroll (see SectionDeck), so a plain in-view
 * check is all it takes — each section comes alive as you reach it. One-shot: the
 * observer disconnects on the first reveal, so an entrance plays once and stays
 * played (scrolling back up and down doesn't re-trigger it).
 *
 * Two-stage detection, deliberately:
 *   1. a synchronous getBoundingClientRect check when the effect runs — covers
 *      whatever is already on screen at mount (the hero and anything above the
 *      fold). This path needs no observer callback at all, so a section can never
 *      be stranded invisible if the observer misfires;
 *   2. only if that misses, an IntersectionObserver for the scroll that brings the
 *      section into view later.
 *
 * Both stages use the same trigger line (IN_VIEW), kept in one constant so they
 * can't drift apart.
 */

/** Reveal once the section's top has risen past this fraction of the viewport. */
const IN_VIEW = 0.85;
const ROOT_MARGIN = `0px 0px -${Math.round((1 - IN_VIEW) * 100)}% 0px`;

/**
 * useInView — is this element on screen RIGHT NOW?
 *
 * The sibling of useReveal, and deliberately not the same thing: this one TOGGLES
 * back to false when the element scrolls away. useReveal is one-shot because an
 * entrance should play once and stay played; but anything that costs real work
 * every frame — the badge pile's matter-js rAF loop — must be able to STOP once
 * it's off screen. rAF only auto-pauses for a hidden tab, not for a section you've
 * scrolled past, so without this the physics would keep solving and writing
 * transforms while the visitor reads a completely different section.
 *
 * `marginPx` keeps it true a little beyond the viewport edges, so work isn't torn
 * down and rebuilt when the boundary is hovered around.
 */
export function useInView(
  ref: RefObject<HTMLElement | null>,
  marginPx = 220,
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Same synchronous first look as useReveal — start whatever this gates
    // immediately if it's already on screen, without waiting on a callback.
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    setInView(r.top < vh + marginPx && r.bottom > -marginPx);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setInView(e.isIntersecting);
      },
      { rootMargin: `${marginPx}px 0px ${marginPx}px 0px`, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, marginPx]);

  return inView;
}

export function useReveal(ref: RefObject<HTMLElement | null>): boolean {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScreen = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return r.top < vh * IN_VIEW && r.bottom > 0;
    };

    if (onScreen()) {
      setRevealed(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { rootMargin: ROOT_MARGIN, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  return revealed;
}
