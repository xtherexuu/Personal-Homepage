"use client";

import { useRef, type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { ColumnLines } from "./column-lines";
import { CONTACT_ANCHOR_ID } from "./contact-intent";
import { ContactForm } from "./contact-form";
import { ContactTiles } from "./contact-tiles";
import { COL_GRID } from "./deck-columns";
import { HeaderGlow } from "./section-glow";
import { useReveal } from "./use-reveal";

/**
 * Contact — „złap KONTAKT": the last block of the page's scroll flow, and the
 * one the whole page has been walking toward.
 *
 * It wears „Dlaczego ja?"'s and „Moja oferta"'s furniture so the three read as one
 * page rather than three pages stapled together: the same hairline column grid
 * (ColumnLines — the bars simply keep running down), the same mint light struck
 * from the header's top-left corner (HeaderGlow), and the same header treatment
 * pinned to the same left margin — a Playfair italic whisper („złap") over an
 * Anton shout („KONTAKT"), sized by the fluid --cs unit (globals.css, sibling of
 * --os / --ws / --hs), the shout rising letter by letter out of an overflow mask.
 *
 * Below the header sit the two ways to reach me, in the order they're actually
 * worth trying. First the tiles: three doors, one tap each, no typing — and for a
 * visitor on a phone who just wants the address, that IS the contact section.
 * Then the window, for the enquiry that needs saying properly.
 *
 * Both sit on the SAME tracks the offer's pair uses at lg (the middle four of
 * six), which is what lines this section's edges up with the one above it. At 3xl
 * it narrows to the middle four of EIGHT rather than following the offer out to
 * six: the offer's cards are dense enough to earn 75vw, but a form at that width
 * is just a long walk between a label and its field. Both cells span an even
 * number of tracks, so their outer edges land on hairlines instead of floating a
 * few pixels off them. Below lg it's a single column inset by the section's own
 * margin, and the edge columns stay empty — which is also what keeps everything
 * clear of the nav rail.
 *
 * Entrances play once the section scrolls into view (useReveal): this section is
 * far below the fold of the page's one scroll flow, so it comes alive only when
 * you actually reach it — never burning its animation off-screen. Reduced motion
 * collapses all of it via the global block in globals.css.
 */

// „KONTAKT" as characters — each rises out of the mask on its own delay.
const KONTAKT = [..."KONTAKT"];

// per-element travel + stagger → CSS custom props consumed by the reveal classes
const rise = (delay: number, y = 26): CSSProperties =>
  ({ "--rise-delay": `${delay}s`, "--rise-y": `${y}px` }) as CSSProperties;

const CELL =
  "col-span-full mx-5 mt-[6vh] sm:mx-8 lg:col-span-4 lg:col-start-2 lg:mx-0 lg:mt-[7vh] 3xl:col-span-4 3xl:col-start-3";

export function Contact() {
  const sectionRef = useRef<HTMLElement>(null);
  const revealed = useReveal(sectionRef);

  return (
    <section
      ref={sectionRef}
      id="kontakt"
      data-nav-section="kontakt"
      data-copy-spaces
      aria-label="Kontakt — napisz do mnie"
      // NO overflow-hidden: the header light is meant to spill up across the seam
      // onto „Moja oferta" rather than be sliced at it (see section-glow).
      className="contact-section relative w-full bg-bg"
    >
      {/* Ambient „poświata" — the same light that strikes „dlaczego JA" and
          „moja OFERTA", spilling up over the seam onto the section above. */}
      <HeaderGlow />

      {/* The same hairlines as the two sections above — the bars keep running down. */}
      <ColumnLines revealed={revealed} />

      <div className={cn("relative grid pb-[16vh]", COL_GRID)}>
        {/* ---------- Header — „złap KONTAKT": same treatment AND same left
             margin as „dlaczego JA" / „moja OFERTA" ---------- */}
        <header className="col-span-full pl-5 pt-[9vh] pb-[4vh] sm:pl-8 lg:pl-[4vw] lg:pt-[10vh] lg:pb-[5vh]">
          {/* The h2 carries only the heading words („złap" + sr-only „Kontakt",
              with an explicit space so extractors don't read „złapKontakt");
              the animated per-letter shout lives in an aria-hidden SIBLING so
              crawlers see a clean heading instead of „złapKontaktKONTAKT". */}
          <h2 className="text-paper">
            <span
              style={rise(0.05, 22)}
              className={cn(
                "block font-accent italic lowercase leading-[1.02] tracking-[-0.01em] text-[length:calc(var(--cs)*0.5)]",
                revealed ? "why-in-blur" : "opacity-0",
              )}
            >
              złap
            </span>{" "}
            <span className="sr-only">Kontakt</span>
          </h2>
          <div
            aria-hidden
            className="mt-[0.02em] block overflow-hidden font-hero uppercase leading-[0.98] text-paper text-[length:var(--cs)]"
          >
            <span className="flex">
              {KONTAKT.map((ch, i) => (
                <span
                  key={i}
                  style={rise(0.12 + i * 0.045)}
                  className={cn(
                    "inline-block",
                    revealed ? "why-mask-in" : "translate-y-full",
                  )}
                >
                  {ch}
                </span>
              ))}
            </span>
          </div>
        </header>

        {/* ---------- Tiles, then the window — on the middle tracks ----------
             id = where „Moja oferta"'s CTAs land (goContact): the cell's border-box
             top is the tiles' top, so the form arrives in view from here, not from
             the header above. */}
        <div id={CONTACT_ANCHOR_ID} className={CELL}>
          <ContactTiles revealed={revealed} />
          <div className="mt-4 sm:mt-5">
            <ContactForm revealed={revealed} style={rise(0.5, 44)} />
          </div>
        </div>
      </div>
    </section>
  );
}
