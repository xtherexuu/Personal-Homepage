"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { SiteNav } from "@/components/nav/site-nav";
import {
  DeckWipe,
  WIPE_COVER_MS,
  WIPE_REVEAL_MS,
  type WipePhase,
} from "./deck-wipe";
import {
  SectionActionsContext,
  SectionContext,
  type SubNav,
} from "./section-context";

/**
 * SectionDeck — the page is exactly TWO panels:
 *
 *   hero    — the full-screen WebGL intro. It keeps its moment: leaving or
 *             returning to it runs the DeckWipe (bars cover the screen, the
 *             panel swaps underneath, the bars lift away).
 *   content — every content section („Dlaczego ja?", „Moja oferta", …) stacked
 *             inside ONE natively-scrolling region (see ScrollFlow). There is no
 *             transition between them — you just scroll, normally.
 *
 * So the deck's custom wheel / swipe / arrow handling only ever does one thing:
 * decide whether a gesture belongs to the content region (scroll it) or to the
 * deck (wipe between hero and content). A gesture inside a [data-deck-scroll]
 * region wins while that region can still scroll that way; only at its top edge
 * does an upward gesture wipe back to the hero.
 *
 * The deck also owns the mobile-menu open state so it can suspend gestures while
 * the menu covers the screen. The nav (rendered here, inside the provider) and
 * the panels read all of this from context.
 */
const PANELS: readonly { id: string }[] = [{ id: "hero" }, { id: "content" }];
const PANEL_IDS: readonly string[] = PANELS.map((p) => p.id);

/**
 * Which panel each nav section lives in. Sections absent from this map simply
 * aren't built yet, so navigating to them is a no-op (the nav still lists them).
 * Add „kontakt": CONTENT_PANEL when that section lands — it needs no other
 * change, it just becomes one more block in the scroll flow.
 */
const CONTENT_PANEL = "content";
const SECTION_PANEL: Readonly<Record<string, string>> = {
  hero: "hero",
  "czemu-ja": CONTENT_PANEL,
  oferta: CONTENT_PANEL,
};
/** Topmost section of the content flow — where the flow opens by default. */
const FIRST_CONTENT_SECTION = "czemu-ja";

/**
 * The deck owns vertical gestures, so an overflowing region inside a panel could
 * never scroll. A panel opts a region back in by marking it [data-deck-scroll]:
 * a wheel / swipe / arrow that starts inside such a region (and can still scroll
 * that way) belongs to the region, not the deck.
 *
 * A panel can also route an OUT-OF-FLOW area to that region by marking it
 * [data-deck-scroll-proxy] — e.g. the reveal's side image, which sits beside the
 * scrollable text column. A gesture over the proxy drives the section's
 * [data-deck-scroll] region even though the cursor isn't over it; since the
 * browser won't scroll a region the cursor isn't in, the deck scrolls it itself.
 */
// Treat the last ~1px at each edge as "at the boundary". A fully-scrolled region
// frequently rests a fraction of a pixel short of scrollHeight - clientHeight (sub-pixel
// layout / HiDPI), so a strict `scrollTop < maxTop` / `> 0` test would report "still has
// room" at rest, yield the gesture forever, and TRAP the deck (it could never step past a
// scrolled region). This symmetric tolerance steps once the region is within a pixel of
// either edge — visually indistinguishable from the true edge.
const SCROLL_EDGE = 1;

type DeckScroll = { region: HTMLElement; proxy: boolean };

// Which scroll region (if any) a gesture over `target` should drive. `proxy` is
// false when the cursor is over the region itself (browser scrolls it natively),
// true when it's over an area that proxies to the region (we scroll it manually).
function resolveScroll(target: EventTarget | null): DeckScroll | null {
  let el = target instanceof Element ? target : null;
  while (el) {
    if (el.hasAttribute("data-deck-scroll"))
      return { region: el as HTMLElement, proxy: false };
    if (el.hasAttribute("data-deck-scroll-proxy")) {
      const region = el
        .closest("section")
        ?.querySelector<HTMLElement>("[data-deck-scroll]");
      return region ? { region, proxy: true } : null;
    }
    el = el.parentElement;
  }
  return null;
}

// Whether `region` can still scroll in `dir` (+1 down / -1 up), within SCROLL_EDGE.
function regionHasRoom(region: HTMLElement, dir: number): boolean {
  const maxTop = region.scrollHeight - region.clientHeight;
  if (maxTop <= SCROLL_EDGE) return false; // nothing meaningful to scroll
  if (dir > 0) return region.scrollTop < maxTop - SCROLL_EDGE; // room below
  if (dir < 0) return region.scrollTop > SCROLL_EDGE; // room above
  return false;
}

// Wipe choreography: bars rise (cover), a short beat while the screen is fully
// dark — the panel swap lands here — then the bars lift away (reveal). Gestures
// stay locked from the first bar to a little past the last.
const WIPE_HOLD_MS = 70;
const WIPE_SWAP_MS = WIPE_COVER_MS + WIPE_HOLD_MS;
const WIPE_TOTAL_MS = WIPE_SWAP_MS + WIPE_REVEAL_MS + 120;
const REDUCE_LOCK_MS = 250; // reduced motion: instant swap, short settle
const WHEEL_THRESHOLD = 18; // px — ignore trackpad jitter
const TOUCH_THRESHOLD = 48; // px — minimum swipe distance

// When the active panel has a SubNav and the scroll region is at its edge, we
// don't step the deck on the first tick — we accumulate a little overscroll so it
// takes a short "few small hops" push to walk to the next internal part. Each
// event contributes at most OVERSCROLL_CAP (so one huge delta can't jump on its
// own), and OVERSCROLL_STEP total triggers one advance. A brief cooldown after an
// advance lets the region reset to the top before more momentum can act.
const OVERSCROLL_CAP = 120;
const OVERSCROLL_STEP = 150;
const OVERSCROLL_COOLDOWN_MS = 380;

/**
 * Scroll the content flow so `sectionId` sits at the top of the region. Called
 * either instantly (mid-wipe, while the bars cover the screen) or smoothly (a
 * nav click made while the flow is already on screen — an ordinary scroll, which
 * is the whole point of the content panel). The content panel owns exactly one
 * [data-deck-scroll] region, so a query is enough to find it — the same contract
 * resolveScroll() already relies on. Measured off the rects rather than
 * offsetTop, which would depend on whichever ancestor happens to be positioned.
 */
function scrollFlowTo(sectionId: string | null, smooth: boolean) {
  const region = document.querySelector<HTMLElement>("[data-deck-scroll]");
  if (!region) return;
  const el = sectionId ? document.getElementById(sectionId) : null;
  const top = el
    ? el.getBoundingClientRect().top -
      region.getBoundingClientRect().top +
      region.scrollTop
    : 0;
  region.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
}

export function SectionDeck({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string>(PANEL_IDS[0]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wipe, setWipe] = useState<WipePhase>(null);
  // Which content section the flow is currently showing — the nav rail's
  // highlight while the content panel is up. ScrollFlow's spy keeps it honest as
  // you scroll; go() sets it optimistically so a nav click highlights at once.
  const [scrolledSection, setScrolledSection] = useState(FIRST_CONTENT_SECTION);

  const activeRef = useRef(active);
  const menuOpenRef = useRef(menuOpen);
  const lockRef = useRef(false);
  const wipeSwapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wipeEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active panel's internal step navigation (e.g. the reveal's parts) + the
  // boundary-overscroll accumulator that drives it.
  const subNavRef = useRef<SubNav | null>(null);
  const overscrollRef = useRef(0);
  const overscrollDirRef = useRef(0);
  const overscrollCoolRef = useRef(false);
  const overscrollCoolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registerSubNav = useCallback((nav: SubNav | null) => {
    subNavRef.current = nav;
    overscrollRef.current = 0;
    overscrollDirRef.current = 0;
  }, []);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  /**
   * Wipe to a panel. `target` is the content section to land on — applied while
   * the bars fully cover the screen, so the flow is already in the right place
   * when it's unveiled (no visible jump). Omit it to open the flow at the top.
   */
  const transitionTo = useCallback((id: string, target?: string) => {
    if (lockRef.current) return;
    if (!PANEL_IDS.includes(id) || id === activeRef.current) return;
    lockRef.current = true;

    // Land the content flow on its target. Runs while the screen is covered, so
    // the scroll is instant; the DOM region exists regardless of the panel's
    // visibility (inactive panels are only `visibility:hidden`, still laid out).
    const land = () => {
      if (id !== CONTENT_PANEL) return;
      const section = target ?? FIRST_CONTENT_SECTION;
      scrollFlowTo(section === FIRST_CONTENT_SECTION ? null : section, false);
      setScrolledSection(section);
    };
    // A panel change invalidates any in-progress sub-nav overscroll / cooldown, so
    // residue from the old panel can't swallow or misfire the first gesture on the
    // next one (or on this panel when it's revisited).
    overscrollRef.current = 0;
    overscrollDirRef.current = 0;
    overscrollCoolRef.current = false;
    if (overscrollCoolTimer.current) clearTimeout(overscrollCoolTimer.current);
    if (wipeSwapTimer.current) clearTimeout(wipeSwapTimer.current);
    if (wipeEndTimer.current) clearTimeout(wipeEndTimer.current);

    // Reduced motion: no wipe — swap instantly, release after a short settle.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      activeRef.current = id;
      setActive(id);
      land();
      wipeEndTimer.current = setTimeout(() => {
        lockRef.current = false;
      }, REDUCE_LOCK_MS);
      return;
    }

    // Wipe: cover the screen, swap the panel while it's fully dark, reveal.
    // The outgoing panel stays active (its exit state untouched) until the
    // swap, so nothing visibly changes before it's hidden behind the bars.
    setWipe("cover");
    wipeSwapTimer.current = setTimeout(() => {
      activeRef.current = id;
      setActive(id);
      land();
      setWipe("reveal");
    }, WIPE_SWAP_MS);
    wipeEndTimer.current = setTimeout(() => {
      setWipe(null);
      lockRef.current = false;
    }, WIPE_TOTAL_MS);
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

  // Nav clicks pass a SECTION id. If it lives in the panel we're already on, it's
  // just a scroll (smooth — no wipe, since the flow is already on screen);
  // otherwise wipe to its panel and land on it. Sections that aren't built yet
  // aren't in SECTION_PANEL, so they no-op.
  const go = useCallback(
    (sectionId: string) => {
      const panel = SECTION_PANEL[sectionId];
      if (!panel) return;
      if (panel === activeRef.current) {
        if (panel === CONTENT_PANEL) {
          setScrolledSection(sectionId);
          scrollFlowTo(sectionId === FIRST_CONTENT_SECTION ? null : sectionId, true);
        }
        return;
      }
      transitionTo(panel, sectionId);
    },
    [transitionTo],
  );

  // ScrollFlow's spy reports whichever content section is crossing its band.
  const reportSection = useCallback((sectionId: string) => {
    setScrolledSection(sectionId);
  }, []);

  // Scroll-hint button → advance one panel (no-op at the last).
  const next = useCallback(() => step(1), [step]);

  // Custom navigation: wheel, touch swipe, and arrow / page keys. Suspended while
  // the mobile menu is open (it sits above the deck).
  useEffect(() => {
    // Proxy areas (e.g. the reveal's side image) can't be scrolled natively by the
    // browser, so we drive their region ourselves — animated, to match the smooth
    // native wheel scroll you get over the text column, instead of jumping by whole
    // deltas. Reduced-motion collapses it to an instant jump.
    const reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
    const proxyScroll = (region: HTMLElement, top: number) =>
      region.scrollBy({ top, behavior: reduceMQ.matches ? "auto" : "smooth" });

    // Momentum filter: a single wheel/trackpad flick fires many events with a
    // long inertial tail. Act on the first decisive event, then ignore the rest
    // of the burst until the wheel has been quiet for a beat — so one flick moves
    // exactly one panel and inertia can't bounce it back.
    let inBurst = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      if (menuOpenRef.current) return;
      // A wipe transition is in flight: swallow the whole wheel burst so its
      // momentum tail can't scroll the incoming panel or over-advance its SubNav.
      // Scrolling resumes the moment the animation has settled (lock releases).
      if (lockRef.current) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return;
      // Just advanced a part — swallow the momentum tail while the copy settles to
      // the top of the new part (its scrollTo(0) lands within this window), so the
      // tail neither scrolls the fresh copy nor advances again.
      if (overscrollCoolRef.current && subNavRef.current) {
        e.preventDefault();
        return;
      }
      const dir = e.deltaY > 0 ? 1 : -1;
      // A scrollable region inside the active panel gets first claim on the wheel —
      // whether the cursor is over it directly or over an area that proxies to it
      // (the reveal's side image). With room to scroll, consume the wheel; for a
      // proxy we scroll the region ourselves, since the cursor isn't inside it.
      const scroll = resolveScroll(e.target);
      if (scroll && regionHasRoom(scroll.region, dir)) {
        overscrollRef.current = 0; // back inside content — drop any boundary buildup
        if (scroll.proxy) {
          e.preventDefault();
          proxyScroll(scroll.region, e.deltaY);
        }
        return;
      }
      // At a boundary: if the active panel has an internal step in this direction,
      // consume the wheel and accumulate a little overscroll, advancing a PART once
      // it builds up — instead of stepping the whole deck on the first tick.
      const sub = subNavRef.current;
      if (sub && sub.canAdvance(dir)) {
        e.preventDefault();
        if (dir !== overscrollDirRef.current) {
          overscrollDirRef.current = dir;
          overscrollRef.current = 0;
        }
        overscrollRef.current += Math.min(Math.abs(e.deltaY), OVERSCROLL_CAP);
        if (overscrollRef.current >= OVERSCROLL_STEP) {
          overscrollRef.current = 0;
          overscrollCoolRef.current = true;
          if (overscrollCoolTimer.current) clearTimeout(overscrollCoolTimer.current);
          overscrollCoolTimer.current = setTimeout(() => {
            overscrollCoolRef.current = false;
          }, OVERSCROLL_COOLDOWN_MS);
          sub.advance(dir);
        }
        return;
      }
      // Otherwise step the whole deck (momentum-filtered to one panel per flick).
      e.preventDefault();
      overscrollRef.current = 0;
      overscrollDirRef.current = 0;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        inBurst = false;
      }, 140);
      if (inBurst) return;
      inBurst = true;
      step(dir);
    };

    let touchStartY = 0;
    let touchStartTarget: EventTarget | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
      touchStartTarget = e.target;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (menuOpenRef.current) return;
      // Ignore swipes while a wipe transition is settling — same reason as the
      // wheel guard above: a stray swipe mustn't over-advance the incoming panel.
      if (lockRef.current) return;
      const dy = (e.changedTouches[0]?.clientY ?? touchStartY) - touchStartY;
      if (Math.abs(dy) < TOUCH_THRESHOLD) return;
      const dir = dy < 0 ? 1 : -1; // swipe up → next
      // If the swipe belongs to an inner scroll region, don't step the deck. Over
      // the region itself the browser already scrolled it (passive move); over an
      // area that proxies to it (the side image) we apply the swipe ourselves.
      const scroll = resolveScroll(touchStartTarget);
      if (scroll && regionHasRoom(scroll.region, dir)) {
        if (scroll.proxy) proxyScroll(scroll.region, -dy);
        return;
      }
      // At a boundary, a decisive swipe advances the active panel's internal part
      // if it has one; otherwise it steps the deck.
      const sub = subNavRef.current;
      if (sub && sub.canAdvance(dir)) {
        sub.advance(dir);
        return;
      }
      step(dir);
    };

    const onKey = (e: KeyboardEvent) => {
      if (menuOpenRef.current) return;
      const dir =
        e.key === "ArrowDown" || e.key === "PageDown"
          ? 1
          : e.key === "ArrowUp" || e.key === "PageUp"
            ? -1
            : 0;
      if (!dir) return;
      // Mid-transition: swallow the nav key so a held/repeated arrow can't
      // over-advance the incoming panel before its animation settles.
      if (lockRef.current) {
        e.preventDefault();
        return;
      }
      // Let a focused scrollable region page through its own content first.
      const scroll = resolveScroll(document.activeElement);
      if (scroll && regionHasRoom(scroll.region, dir)) return;
      e.preventDefault();
      // At a boundary, advance the active panel's internal part if it has one.
      const sub = subNavRef.current;
      if (sub && sub.canAdvance(dir)) {
        sub.advance(dir);
        return;
      }
      step(dir);
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
      if (wipeSwapTimer.current) clearTimeout(wipeSwapTimer.current);
      if (wipeEndTimer.current) clearTimeout(wipeEndTimer.current);
      if (overscrollCoolTimer.current) clearTimeout(overscrollCoolTimer.current);
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

  // The hero is its own panel; the content panel spans several nav sections, so
  // there the highlight follows the scroll, not the panel.
  const activeSection = active === CONTENT_PANEL ? scrolledSection : active;

  // Both values are memoised on purpose. This provider re-renders on every wipe
  // phase and every scroll-spy tick, and an inline object literal would hand each
  // consumer a fresh identity every time — re-rendering them all even when nothing
  // they read changed.
  //
  // `actions` never changes identity (every member is a stable useCallback), so
  // consumers that only CALL things — Offer's contact CTA, ScrollFlow's spy — are
  // completely insulated from scrolling. That asymmetry mattered: Why never
  // subscribes at all, so it was already immune, while Offer subscribed for `go`
  // alone and re-rendered its whole card subtree mid-scroll. Same section the
  // user reported as janky.
  const actions = useMemo(
    () => ({ go, next, setMenuOpen, registerSubNav, reportSection }),
    [go, next, setMenuOpen, registerSubNav, reportSection],
  );

  const value = useMemo(
    () => ({ active, activeSection, menuOpen, ...actions }),
    [active, activeSection, menuOpen, actions],
  );

  return (
    <SectionActionsContext.Provider value={actions}>
      <SectionContext.Provider value={value}>
        <div className="fixed inset-0 overflow-hidden">{children}</div>
        <DeckWipe phase={wipe} />
        <SiteNav />
      </SectionContext.Provider>
    </SectionActionsContext.Provider>
  );
}
