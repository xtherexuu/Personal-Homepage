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
import { CONTACT_ANCHOR_ID, pickContactTopic } from "./contact-intent";
import { SectionActionsContext, SectionContext } from "./section-context";

/**
 * SectionDeck — the page shell.
 *
 * The page is ONE ordinary, natively-scrolling region: the hero at the top, then
 * „Dlaczego ja?" → „Moja oferta" → „Kontakt" flowing directly below it. There is
 * no custom scroll-hijacking and no transition between sections — you just scroll.
 * The hero's WebGL mask pauses itself the moment it scrolls off-screen (its own
 * IntersectionObserver), so it stops costing anything once you've left it.
 *
 * Everything lives inside one [data-deck-scroll] region (rather than the document
 * itself) so the site keeps its custom thin scrollbar (globals.css) and its
 * overscroll containment, and so a programmatic `go` scroll is never blocked by
 * the mobile menu's body-scroll lock. The region is focusable (role/tabIndex) so
 * keyboard users can scroll it like any page.
 *
 * This component keeps only the small amount of shared state the navigation needs:
 *  - `activeSection` — which section the rail / menu highlights, kept honest by a
 *                      scroll-spy over the [data-nav-section] elements;
 *  - `menuOpen`      — the mobile menu overlay's open state;
 *  - `go(id)`        — smooth-scroll a section into view (reduced motion jumps).
 * The nav (rendered here, inside the provider) and the sections read these from
 * context.
 */

/** Where the flow opens, and the rail's highlight before the spy's first tick. */
const FIRST_SECTION = "hero";

// A thin band ~45% down the region. Every section is at least viewport-tall, so
// exactly one crosses this line at a time — no intersectionRatio maths (a tall
// section can never fill a small viewport enough to trip a ratio threshold).
const SPY_BAND = "-45% 0px -50% 0px";

export function SectionDeck({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Which section is in view — the nav rail / menu highlight. The scroll-spy below
  // keeps it honest as you scroll; go() sets it optimistically so a nav click
  // highlights at once.
  const [activeSection, setActiveSection] = useState(FIRST_SECTION);
  const regionRef = useRef<HTMLDivElement>(null);

  // Nav clicks (and the offer / hero CTAs) land here: smooth-scroll the section to
  // the top of the region. Measured off the rects rather than offsetTop, which
  // would depend on whichever ancestor happens to be positioned. Reduced motion
  // jumps instantly. Sections that aren't built yet have no element, so this
  // no-ops — the nav can list them without navigating anywhere.
  const go = useCallback((sectionId: string) => {
    const region = regionRef.current;
    const el = document.getElementById(sectionId);
    if (!region || !el) return;
    setActiveSection(sectionId);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top =
      el.getBoundingClientRect().top -
      region.getBoundingClientRect().top +
      region.scrollTop;
    region.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  }, []);

  // The „Moja oferta" CTAs land here: scroll to the contact TILES rather than the
  // section top, so the „Wiadomość" form is in view from the tiles down instead of
  // behind the „złap KONTAKT" header — then hand the form the package's „Temat".
  // Same rect maths as go(), minus a top offset: it gives the tiles breathing room
  // and, on mobile, keeps them clear of the hamburger pinned to the top-right (a
  // flush landing would drop it straight onto the last tile). The highlight is set
  // to „kontakt" (not the anchor) so the rail lights the section, not a stray id.
  const goContact = useCallback((topic?: string) => {
    const region = regionRef.current;
    const el = document.getElementById(CONTACT_ANCHOR_ID);
    if (!region || !el) return;
    setActiveSection("kontakt");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const offset = Math.max(72, region.clientHeight * 0.08);
    const top =
      el.getBoundingClientRect().top -
      region.getBoundingClientRect().top +
      region.scrollTop -
      offset;
    region.scrollTo({
      top: Math.max(0, top),
      behavior: reduce ? "auto" : "smooth",
    });
    if (topic) pickContactTopic(topic);
  }, []);

  // Scroll-spy: report whichever [data-nav-section] is crossing the mid-band.
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
        if (id) setActiveSection(id);
      },
      { root: region, rootMargin: SPY_BAND, threshold: 0 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

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

  // `actions` never changes identity (go / goContact are stable useCallbacks), so a
  // consumer that only CALLS them — Offer's contact CTAs — is completely insulated
  // from the scroll-spy re-rendering this provider on every tick.
  const actions = useMemo(() => ({ go, goContact }), [go, goContact]);

  const value = useMemo(
    () => ({ activeSection, menuOpen, setMenuOpen, go, goContact }),
    [activeSection, menuOpen, go, goContact],
  );

  return (
    <SectionActionsContext.Provider value={actions}>
      <SectionContext.Provider value={value}>
        {/* The single scroll region. data-deck-scroll gives it the site's custom
            scrollbar (globals.css) and anchors the layout's <noscript>
            linearization — without JS this fixed-height overflow box becomes
            ordinary document flow. */}
        <div
          ref={regionRef}
          data-deck-scroll
          role="region"
          tabIndex={0}
          aria-label="Treść strony — przewiń, aby czytać dalej"
          className="h-dvh w-full overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint/30"
        >
          {children}
        </div>
        <SiteNav />
      </SectionContext.Provider>
    </SectionActionsContext.Provider>
  );
}
