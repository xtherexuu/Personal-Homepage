"use client";

import Image, { type StaticImageData } from "next/image";
import { useRef, type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { ColumnLines } from "./column-lines";
import { COL_GRID } from "./deck-columns";
import { HeaderGlow } from "./section-glow";
import { useInView, useReveal } from "./use-reveal";
import { WhyBadges } from "./why-badges";

// One art-directed pair per element: BIG = portrait (md+ column), SMALL = 3:1
// landscape (mobile full-bleed banner). Static imports give next/image a blur
// placeholder + intrinsic size; the optimizer serves AVIF/WebP at q75.
import bizBig from "@/public/why/PH-czyTaOsobaRozumieMojBiznes-BIG-opt.jpg";
import bizSmall from "@/public/why/PH-czyTaOsobaRozumieMojBiznes-SMALL-opt.jpg";
import supportBig from "@/public/why/PH-czyZostaneSam-BIG-opt.jpg";
import supportSmall from "@/public/why/PH-czyZostaneSam-SMALL-opt.jpg";
import resultBig from "@/public/why/PH-finalnyEfekt-BIG-opt.jpg";
import resultSmall from "@/public/why/PH-finalnyEfekt-SMALL-opt.jpg";

/**
 * Why — the "Dlaczego ja?" section: one editorial block (after eszterbial.com).
 * The viewport is divided into equal columns by hairlines (deck-columns — the
 * same rectangles the DeckWipe bars cover), and everything snaps to that grid:
 *
 *   ┌─┬───────┬───────┬─┐
 *   │ dlaczego               │  ← Playfair italic
 *   │ JA                     │  ← Anton, hero-h1 scale (--ws, globals.css)
 *   │ │ IMAGE │ pytanie │ │
 *   │ │       │ tekst   │ │
 *   │ │ pytanie │ IMAGE │ │  ← sides alternate per row
 *   └─┴───────┴───────┴─┘
 *
 * Three rows answer the three doubts a prospective client actually has; each
 * question's "?" is set in mint — the one recurring accent.
 *
 * This is the first block of the deck's content flow (see ScrollFlow), which is
 * one ordinary scrolling region: the section no longer owns a scroller or a
 * viewport height, it's simply as tall as its content and „Moja oferta" follows
 * directly below it with no transition. The hairline layer spans the section
 * (absolute inset-0), and the scrollbar lives on the flow outside it, so the
 * lines still align with the content grid.
 *
 * Entrances replay on each visit and are gated by useReveal (in view + panel
 * active): the grid hairlines draw top → bottom as the wipe reveal finishes,
 * "dlaczego" blur-rises, JA's letters rise out of an overflow mask, rows
 * fade-rise. Delays are tuned so content emerges just as its columns are
 * unveiled (the wipe releases bars left → right). Reduced motion collapses all
 * of it via the global block in globals.css.
 */

type Item = {
  /** Question WITHOUT the trailing "?" — it's rendered as the mint accent. */
  title: string;
  body: string;
  big: StaticImageData;
  small: StaticImageData;
  alt: string;
};

const ITEMS: readonly Item[] = [
  {
    title: "Czy naprawdę zrozumiem Twój biznes",
    body: "Zanim zacznę projektować stronę, najpierw rozmawiamy o Twojej firmie, klientach i celu, który strona ma realizować. Dzięki temu nie tworzę tylko ładnej wizytówki, ale stronę, która jasno pokazuje ofertę, prowadzi użytkownika i pomaga mu wykonać właściwy krok.",
    big: bizBig,
    small: bizSmall,
    alt: "Ilustracja: właściciel firmy nocą przy laptopie, w zamyśleniu nad notatnikiem z listą „cel, klienci, przekaz, działanie” — strona planowana wokół celów biznesu.",
  },
  {
    title: "Czy po oddaniu strony zostajesz sam",
    body: "Nie urywam kontaktu po zakończeniu projektu, więc w razie problemu, pytania albo potrzeby drobnej pomocy nadal możesz się do mnie odezwać. Większe zmiany lub nowe funkcje mogą wymagać osobnej wyceny, ale sam kontakt i dalsze wsparcie pozostają proste i dostępne.",
    big: supportBig,
    small: supportSmall,
    alt: "Ilustracja: klient nocą przy laptopie z ekranem „projekt zakończony” i wątkiem wiadomości z szybką odpowiedzią oraz listą przekazania projektu — kontakt i wsparcie po oddaniu strony.",
  },
  {
    title: "Czy efekt końcowy będzie zgodny z oczekiwaniami",
    body: "Nie czekasz w niepewności do ostatniego dnia, bo pokazuję postępy i daję możliwość zgłaszania sensownych poprawek na kolejnych etapach pracy. Dzięki regularnej komunikacji finalna strona nie jest przypadkiem, tylko dopracowanym efektem wspólnych decyzji i jasno ustalonego kierunku.",
    big: resultBig,
    small: resultSmall,
    alt: "Ilustracja: klient nocą przy laptopie ogląda gotową stronę obok diagramu „projekt krok po kroku” z wersją wstępną i wersją po poprawkach — praca etapami z akceptacją kierunku.",
  },
];

// next/image `sizes` — the breakpoint that hides a variant resolves it to 1px,
// so only the visible art direction is actually downloaded (same trick as the
// hero's contact note).
const BIG_SIZES = "(min-width: 1024px) 34vw, (min-width: 768px) 50vw, 1px";
const SMALL_SIZES = "(max-width: 767px) 100vw, 1px";

// Explicit md+ rows: with alternating col-starts, grid auto-placement would
// push the left-hand cell of a swapped row onto its own track row (the sparse
// cursor never moves back). Static strings so Tailwind sees them.
const ROW_START = ["md:row-start-2", "md:row-start-3", "md:row-start-4"];

// Column placement per side (md 4-col: halves; lg 6-col: middle four tracks;
// 3xl 8-col: middle six). Edge columns stay empty — breathing room for the
// nav rail, exactly like the reference layout.
const IMG_COLS = [
  "md:col-span-2 md:col-start-1 lg:col-start-2 3xl:col-span-3 3xl:col-start-2",
  "md:col-span-2 md:col-start-3 lg:col-start-4 3xl:col-span-3 3xl:col-start-5",
];
const TEXT_COLS = [
  "md:col-span-2 md:col-start-3 lg:col-start-4 3xl:col-span-3 3xl:col-start-5",
  "md:col-span-2 md:col-start-1 lg:col-start-2 3xl:col-span-3 3xl:col-start-2",
];

// per-element travel + stagger → CSS custom props consumed by the why-* classes
const rise = (delay: number, y = 26): CSSProperties =>
  ({ "--rise-delay": `${delay}s`, "--rise-y": `${y}px` }) as CSSProperties;

export function Why() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const revealed = useReveal(sectionRef);
  // The badge pile runs a matter-js rAF loop, so it's gated on the header being
  // ON SCREEN, not merely revealed: rAF keeps firing for a section you've simply
  // scrolled past (it only auto-pauses for a hidden tab), and both sections now
  // share one scroll flow — without this the physics would keep solving while
  // the visitor is reading „Moja oferta".
  const headerInView = useInView(headerRef);

  return (
    <section
      ref={sectionRef}
      id="czemu-ja"
      data-nav-section="czemu-ja"
      data-copy-spaces
      aria-label="Dlaczego ja? — pytania, które warto zadać"
      className="why-section relative w-full bg-bg"
    >
      {/* The same mint field that lights „moja OFERTA" below. */}
      <HeaderGlow />

      {/* Hairlines on the column boundaries — shared with „Moja oferta" below, so
          the bars run unbroken down the whole flow. */}
      <ColumnLines revealed={revealed} />

      {/* ---------- Content, snapped to the same grid ---------- */}
      <div className={cn("relative grid pb-[16vh]", COL_GRID)}>
        {/* Header — „dlaczego JA”: Playfair whisper over the Anton shout,
            sized by --ws (globals.css) to match the hero h1. */}
        <header
          ref={headerRef}
          className="col-span-full pl-5 pt-[9vh] sm:pl-8 lg:pl-[4vw] lg:pt-[10vh]"
        >
          <h2 className="text-paper">
            <span
              style={rise(0.5, 22)}
              className={cn(
                "block font-accent italic lowercase leading-[1.02] tracking-[-0.01em] text-[length:calc(var(--ws)*0.46)]",
                revealed ? "why-in-blur" : "opacity-0",
              )}
            >
              dlaczego
            </span>
            {/* overflow mask — the letters rise out of it one after another.
                The per-letter spans would be read "J A", so they're hidden
                from the a11y tree and a sr-only "JA" carries the word. */}
            <span className="sr-only">JA</span>
            {/* The Anton „JA" rises out of an overflow mask; the open space to
                its right holds the interactive service-tag pile (WhyBadges).
                The row is items-stretch so the pile box is exactly as tall as
                the „JA" word, and pr-* reserves room for the nav rail / scrollbar. */}
            <span
              aria-hidden
              className="mt-[0.03em] flex items-stretch gap-4 pr-5 sm:gap-6 sm:pr-8 lg:gap-10 lg:pr-28 3xl:pr-36"
            >
              <span className="block shrink-0 overflow-hidden font-hero uppercase leading-[0.98] text-[length:var(--ws)]">
                <span className="flex">
                  <span
                    style={rise(0.58)}
                    className={cn(
                      "inline-block",
                      revealed ? "why-mask-in" : "translate-y-full",
                    )}
                  >
                    J
                  </span>
                  <span
                    style={rise(0.68)}
                    className={cn(
                      "inline-block",
                      revealed ? "why-mask-in" : "translate-y-full",
                    )}
                  >
                    A
                  </span>
                </span>
              </span>
              <span className="relative block min-w-0 flex-1 self-stretch">
                <WhyBadges active={headerInView} />
              </span>
            </span>
          </h2>
          {/* The pile is decorative (aria-hidden); expose the same terms to
              screen readers / crawlers as real text. */}
          <p className="sr-only">
            W każdej realizacji dbam o: responsywność, SEO, szybkość,
            bezpieczeństwo, UX, UI, wdrożenie oraz wsparcie po publikacji.
          </p>
        </header>

        {/* ---------- Three answers, sides alternating ---------- */}
        {ITEMS.map((item, i) => {
          const side = i % 2; // 0 = image left, 1 = image right (md+)
          return (
            // Fragment keyed by item; cells place themselves on the grid.
            <div key={item.title} className="contents">
              <div
                style={rise(0.75 + i * 0.1, 30)}
                className={cn(
                  "relative col-span-full mt-10 overflow-hidden md:mt-[7vh] md:min-h-[27rem] lg:min-h-[31rem] 3xl:min-h-[35rem]",
                  ROW_START[i],
                  IMG_COLS[side],
                  side === 1 && "lg:mt-[11vh]", // stagger the swapped row
                  revealed ? "why-in" : "opacity-0",
                )}
              >
                {/* Desktop portrait: `fill`, so its cell stretches only to the
                    copy beside it (with a pleasant md/lg min-height floor) — the
                    image tracks the amount of text, not the whole viewport. */}
                <Image
                  src={item.big}
                  alt={item.alt}
                  placeholder="blur"
                  quality={75}
                  sizes={BIG_SIZES}
                  fill
                  className="hidden object-cover md:block"
                  draggable={false}
                />
                {/* Mobile banner — cropped to a taller 9:4 box
                    (object-cover trims only the decorative side margins) so
                    it carries more presence above the copy. */}
                <Image
                  src={item.small}
                  alt={item.alt}
                  placeholder="blur"
                  quality={75}
                  sizes={SMALL_SIZES}
                  className="block aspect-[9/4] w-full object-cover md:hidden"
                  draggable={false}
                />
              </div>

              <div
                style={rise(0.85 + i * 0.1)}
                className={cn(
                  "col-span-full mt-7 self-center px-5 sm:px-8 md:mt-[7vh] md:pl-10 md:pr-6 lg:px-[3.2vw]",
                  ROW_START[i],
                  TEXT_COLS[side],
                  revealed ? "why-in" : "opacity-0",
                )}
              >
                <h3 className="text-pretty font-display font-bold leading-[1.05] tracking-[-0.015em] text-paper text-[clamp(2.15rem,1.25rem+3.1vw,3.9rem)]">
                  {item.title}
                  <span className="text-mint">?</span>
                </h3>
                {/* Justified by widening inter-word spaces only — no
                    auto-hyphenation (hyphens-auto removed on request). */}
                <p className="mt-[1.05em] max-w-[46ch] text-justify leading-relaxed text-muted text-[clamp(1.2rem,1rem+0.78vw,1.68rem)]">
                  {item.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
