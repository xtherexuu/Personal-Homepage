"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { SiteNav } from "@/components/nav/site-nav";
import { SectionContext } from "./section-context";

/**
 * SectionDeck — full-page deck of stacked, crossfading sections driven by a
 * CUSTOM scroll (wheel / swipe / arrow keys) instead of native scrolling. One
 * decisive gesture advances exactly one panel; everything is clamped to the
 * available panels (you can't go below the last one yet). The deck also owns the
 * mobile-menu open state so it can suspend gestures while the menu covers the
 * screen. The nav (rendered here, inside the provider) and the panels read all
 * of this from context.
 *
 * PANELS is the scroll order. Each panel belongs to a nav `section` (several
 * panels can share one — "Dlaczego ja?" spans czemu-ja + czemu-ja-2), so the rail
 * highlights by section while scrolling steps through panels. Extend as built.
 */
const PANELS: readonly { id: string; section: string }[] = [
  { id: "hero", section: "hero" },
  { id: "czemu-ja", section: "czemu-ja" },
  { id: "czemu-ja-2", section: "czemu-ja" },
];
const PANEL_IDS: readonly string[] = PANELS.map((p) => p.id);
const sectionOf = (id: string) =>
  PANELS.find((p) => p.id === id)?.section ?? id;

const TRANSITION_MS = 800; // crossfade length (keep in sync with <Panel>)
const LOCK_MS = TRANSITION_MS + 150; // ignore further gestures until settled
const WHEEL_THRESHOLD = 18; // px — ignore trackpad jitter
const TOUCH_THRESHOLD = 48; // px — minimum swipe distance

export function SectionDeck({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string>(PANEL_IDS[0]);
  const [menuOpen, setMenuOpen] = useState(false);

  const activeRef = useRef(active);
  const menuOpenRef = useRef(menuOpen);
  const lockRef = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  const transitionTo = useCallback((id: string) => {
    if (lockRef.current) return;
    if (!PANEL_IDS.includes(id) || id === activeRef.current) return;
    lockRef.current = true;
    activeRef.current = id;
    setActive(id);
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      lockRef.current = false;
    }, LOCK_MS);
  }, []);

  const step = useCallback(
    (dir: number) => {
      const idx = PANEL_IDS.indexOf(activeRef.current);
      const next = idx + dir;
      if (next < 0 || next >= PANEL_IDS.length) return; // clamp at both ends
      transitionTo(PANEL_IDS[next]);
    },
    [transitionTo],
  );

  // Nav clicks pass a SECTION id → jump to that section's first panel (no-op for
  // sections that don't exist yet).
  const go = useCallback(
    (sectionId: string) => {
      const first = PANELS.find((p) => p.section === sectionId);
      if (first) transitionTo(first.id);
    },
    [transitionTo],
  );

  // Scroll-hint button → advance one panel (no-op at the last).
  const next = useCallback(() => step(1), [step]);

  // Custom navigation: wheel, touch swipe, and arrow / page keys. Suspended while
  // the mobile menu is open (it sits above the deck).
  useEffect(() => {
    // Momentum filter: a single wheel/trackpad flick fires many events with a
    // long inertial tail. Act on the first decisive event, then ignore the rest
    // of the burst until the wheel has been quiet for a beat — so one flick moves
    // exactly one panel and inertia can't bounce it back.
    let inBurst = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      if (menuOpenRef.current) return;
      if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return;
      e.preventDefault();
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        inBurst = false;
      }, 140);
      if (inBurst) return;
      inBurst = true;
      step(e.deltaY > 0 ? 1 : -1);
    };

    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (menuOpenRef.current) return;
      const dy = (e.changedTouches[0]?.clientY ?? touchStartY) - touchStartY;
      if (Math.abs(dy) < TOUCH_THRESHOLD) return;
      step(dy < 0 ? 1 : -1); // swipe up → next
    };

    const onKey = (e: KeyboardEvent) => {
      if (menuOpenRef.current) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        step(-1);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [step]);

  useEffect(
    () => () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    },
    [],
  );

  // Copy with spaces. The display headings split words into separate block-level
  // spans, so a native copy concatenates them with no spaces (or as line breaks).
  // This must live on `document`: for a non-editable selection the `copy` event
  // fires on <body>, not the section, so a section-level handler never sees it.
  // When the selection sits inside a [data-copy-spaces] region, rewrite the
  // clipboard to single-spaced text.
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const node = sel.getRangeAt(0).commonAncestorContainer;
      const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
      if (!el?.closest("[data-copy-spaces]")) return;
      const text = sel.toString().replace(/\s+/g, " ").trim();
      if (!text) return;
      e.clipboardData?.setData("text/plain", text);
      e.preventDefault();
    };
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, []);

  return (
    <SectionContext.Provider
      value={{
        active,
        activeSection: sectionOf(active),
        go,
        next,
        menuOpen,
        setMenuOpen,
      }}
    >
      <div className="fixed inset-0 overflow-hidden">{children}</div>
      <SiteNav />
    </SectionContext.Provider>
  );
}
