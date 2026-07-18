"use client";

import { CheckIcon, MinusIcon } from "@heroicons/react/24/solid";
import { useRef, type CSSProperties, type MouseEvent } from "react";

import { TOPIC_APLIKACJA, TOPIC_WIZYTOWKA } from "@/lib/contact";
import { cn } from "@/lib/utils";
import { ColumnLines } from "./column-lines";
import { COL_GRID } from "./deck-columns";
import { useSectionActions } from "./section-context";
import { HeaderGlow } from "./section-glow";
import { useReveal } from "./use-reveal";

/**
 * Offer — the "Moja oferta" section: the two packages I sell, shown as a pair of
 * modern glass cards on the deck's dark field.
 *
 * It shares „Dlaczego ja?"'s furniture so the two read as one page: the same
 * hairline column grid (ColumnLines — the bars simply keep running down), and
 * the same header treatment, pinned to the same left margin — a Playfair italic
 * whisper („moja") over an Anton shout („OFERTA"), sized by the fluid --os unit
 * (globals.css, sibling of --ws / --hs), the shout rising letter by letter out of
 * an overflow mask. Below it sit two tiers — and the pair, not a number badge, is
 * the section's signature: the second literally contains the first, so it's drawn
 * as the warmer, brighter card of the two.
 *
 * The pair is laid on the SAME tracks the why section's imagery uses (lg: the
 * middle four of six; 3xl: the middle six of eight). Because that cell spans an
 * even number of columns, its midpoint IS a hairline — so the two cards' outer
 * edges sit flush on the bars either side, and the gutter between them lands
 * exactly on the bar down the middle. Below lg they stack, inset by the section's
 * own margin, and the edge columns stay empty — which is also what keeps the
 * cards clear of the nav rail, exactly as in Why.
 *
 * PERFORMANCE — this section shares one scroll region with Why, so anything that
 * costs per frame is paid while the visitor scrolls. Everything here is therefore
 * painted, never filtered: the ambient glow and the in-card tint are radial
 * gradients (a filter: blur() on a half-viewport box, or a backdrop-filter on the
 * cards, has to be re-rasterised every scrolled frame — that was measurably the
 * jank), the card halo is a box-shadow, and the glass is OPAQUE, which also stops
 * the hairline behind a card showing through as a seam. Nothing here declares
 * will-change: the hover only fades a box-shadow in, which is not worth a
 * permanent compositor layer.
 *
 *   • „Strona wizytówka" — the informational site (mint, the foundation tier),
 *   • „Aplikacja internetowa" — the app build (amber, the fuller tier), whose
 *     first line is „wszystko z pakietu Strona wizytówka".
 *
 * Each card is a bordered glass panel that rests unlit and lights a soft
 * coloured glow on hover, lists what's included (mint checks) and — for the
 * first — what isn't (muted minuses), then closes with the recommendation and an
 * amber contact CTA (amber = the palette's single call-to-action, the same pill as
 * the hero's). The two footers sink to the card base (mt-auto), so the buttons
 * line up however unevenly the lists run.
 *
 * Entrances play once the section scrolls into view, reusing the shared reveal
 * primitives (.why-in / .why-in-blur / .why-mask-in in globals.css): „moja"
 * blur-rises, „OFERTA" unmasks letter by letter, then the two cards rise in, left
 * then right. useReveal gates them per section — this one sits below the fold of
 * the page's one scroll flow, so it comes alive when you scroll to it, and the
 * delays are tuned tight for that. Reduced motion collapses it all via the global
 * block in globals.css.
 *
 * The section owns no scroller of its own: it's simply the block below „Dlaczego
 * ja?" in the page's one scroll flow (see SectionDeck), reached by ordinary
 * scrolling with no transition between the two.
 */

type Pkg = {
  /** Mono eyebrow naming what the tier fundamentally is (not a bare number). */
  eyebrow: string;
  name: string;
  /**
   * The „Temat" this tier's CTA preselects in the contact form — a lib/contact
   * TopicOption value, imported so it can't drift from the menu it has to match.
   */
  topic: string;
  tagline: string;
  includes: readonly string[];
  /** Only the foundation tier spells out what it deliberately leaves out. */
  excludes?: readonly string[];
  bestFor: string;
  /** The fuller tier — warmer accent, brighter glow, a small flag. */
  featured?: boolean;
};

const PACKAGES: readonly Pkg[] = [
  {
    eyebrow: "Strona informacyjna",
    name: "Strona wizytówka",
    topic: TOPIC_WIZYTOWKA,
    tagline:
      "Profesjonalna strona, która dobrze prezentuje Twoją markę i jasno pokazuje klientom, dlaczego warto wybrać właśnie Ciebie.",
    includes: [
      "Profesjonalną obecność Twojej marki w internecie",
      "Przemyślany i czytelny przekaz strony",
      "Indywidualny, nowoczesny projekt graficzny",
      "Szybkie ładowanie i optymalizację wydajności",
      "Pełną responsywność na telefonach, tabletach i komputerach",
      "Zaawansowaną optymalizację pod wyszukiwarki SEO",
      "Nielimitowaną liczbę sekcji w obrębie strony",
      "Czytelną strukturę zachęcającą użytkowników do kontaktu",
      "Podstawowe zabezpieczenia i przygotowanie do publikacji",
    ],
    excludes: [
      "Panelu do łatwej samodzielnej edycji treści",
      "Bloga, aktualności ani systemu publikowania wpisów",
      "Kont użytkowników, logowania i rozbudowanych baz danych",
      "Formularzy obsługiwanych przez dedykowany system backendowy",
      "Rezerwacji, płatności, sklepu internetowego ani innych zaawansowanych funkcji",
    ],
    bestFor:
      "Najlepszy wybór dla firm, specjalistów i marek, które potrzebują skutecznej strony informacyjnej bez rozbudowanego systemu.",
  },
  {
    eyebrow: "Aplikacja z funkcjami",
    name: "Aplikacja internetowa",
    topic: TOPIC_APLIKACJA,
    tagline:
      "Rozbudowana strona z indywidualnymi funkcjami, która nie tylko prezentuje Twoją ofertę, ale również pomaga obsługiwać klientów i rozwijać biznes.",
    includes: [
      "Wszystko, co znajduje się w pakiecie „Strona wizytówka”",
      "Panel do łatwej i samodzielnej edycji treści",
      "Możliwość prowadzenia bloga, aktualności lub bazy wiedzy",
      "Formularze kontaktowe i formularze dopasowane do Twoich potrzeb",
      "Obsługę zapytań i danych przesyłanych przez użytkowników",
      "Prosty sklep internetowy lub system sprzedaży biletów",
      "Prosty system rezerwacji usług, terminów, miejsc lub obiektów",
      "Integrację płatności internetowych",
      "Bazę danych dopasowaną do działania aplikacji",
      "Możliwość dalszej rozbudowy o dodatkowe funkcje",
    ],
    bestFor:
      "Najlepszy wybór, gdy strona ma aktywnie wspierać Twój biznes, automatyzować procesy i umożliwiać klientom wykonywanie konkretnych działań online.",
    featured: true,
  },
];

// „OFERTA" as characters — each rises out of the mask on its own delay.
const OFERTA = [..."OFERTA"];

// The glow that used to be sampled THROUGH the glass with a backdrop-filter,
// painted into it instead — the card stays opaque and costs nothing per frame.
// Boxed to the top 45% for the same reason: the ramp hits zero at 0.62 × 70% =
// 43.4% of the card, so the rest was evaluating a shader to draw nothing. The
// radii are restated against the shorter box (155.6% × 45% = the original 70%),
// which keeps the render identical.
const TINT = {
  mint: "radial-gradient(120% 155.6% at 50% 0%, rgba(61,220,151,0.07), rgba(61,220,151,0) 62%)",
  amber:
    "radial-gradient(120% 155.6% at 50% 0%, rgba(232,146,58,0.09), rgba(232,146,58,0) 62%)",
};

// The two cards' cell: middle tracks of the grid, so their outer edges land on
// hairlines and the gutter between them falls on the bar down the middle. That
// only works while the cell spans an EVEN number of tracks — its midpoint is then
// a track boundary, i.e. a hairline — so widen or narrow it in twos.
//
// 3xl takes SIX of the eight tracks, so the cards are genuinely wide there —
// which only works because their lists split into two columns at that width (see
// LIST). Wide cards were unreadable while everything was stacked in one column
// (~78 characters a line) and made the section enormously tall; two columns cut
// the measure back to ~35 characters and roughly halve the height, so the width
// becomes an asset instead of a problem.
//
// The gutter is set from the CARDS, not from the cell: since the cell is fixed to
// whole tracks, every pixel of gutter comes straight off the two cards (2:1).
// Widening it is therefore never free — it narrows the cards, and narrow cards
// make the section TALLER (see LIST). It buys the gutter anyway, because the two
// cards touching reads worse than the section being 2% longer.
//
// It's in vw, not a fixed px step, and that's the actual fix rather than a bigger
// number: the cell is a fixed FRACTION of the viewport (4/6 of it at lg, 6/8 at
// 3xl), so a px gutter drifts against the cards it's separating — gap-14 was 18%
// of a card at 1024 but only 14% at 1280, and gap-24 likewise 14% at 1920. Three
// passes of nudging the px value (8 → 12 → 14/24) all came back „za mały odstęp"
// because the number was never the problem. In vw the ratio holds still: ~24% of a
// card across the whole range, which is what makes the channel read.
//
// The floor matters — below ~7vw the gutter stops clearing the cards' OWN inner
// padding (p-8/p-10) by enough to separate them, which is what made the pair read
// as one block: a channel between two boxes has to beat the channel inside them.
const PAIR_CELL =
  "col-span-full mx-5 mt-[6vh] grid gap-6 sm:mx-8 lg:col-span-4 lg:col-start-2 lg:mx-0 lg:mt-[7vh] lg:grid-cols-2 lg:gap-[7vw] 3xl:col-span-6 3xl:col-start-2 3xl:gap-[9vw]";

// The lists carry essentially all of a card's height, so they're what goes to two
// columns once there's width to spare — the header, the recommendation and the CTA
// stay full-bleed, reading as the card's frame around them. CSS multi-column (not
// a grid) so the items simply FLOW: the balance holds whatever the item count is,
// which matters because the tiers have 9, 10 and 5 of them. break-inside-avoid
// keeps a wrapped item from being split down the middle of the two columns.
const LIST = "mt-4 columns-1 gap-x-10 3xl:columns-2";
const LIST_ITEM = "mb-3.5 flex break-inside-avoid items-start gap-3";

// per-element travel + stagger → CSS custom props consumed by the reveal classes
const rise = (delay: number, y = 26): CSSProperties =>
  ({ "--rise-delay": `${delay}s`, "--rise-y": `${y}px` }) as CSSProperties;

// The hero contact-pill's arrow — slides right on hover (group/cta).
function CtaArrow() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="size-[1.05em] shrink-0 transition-transform duration-300 ease-out group-hover/cta:translate-x-1 motion-reduce:transition-none"
    >
      <path
        d="M4 10h11M11 5.5l4.5 4.5-4.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Offer() {
  const sectionRef = useRef<HTMLElement>(null);
  const revealed = useReveal(sectionRef);
  // Actions only — subscribing to the full section context would re-render this
  // whole subtree (two cards, 24 list items and their icons) every time the
  // scroll-spy reports a new section, i.e. right as you scroll in here.
  const { goContact } = useSectionActions();

  // CTA → the „Wiadomość" form: scroll so the tiles sit at the top (form in view,
  // not the „złap KONTAKT" header) and preselect this tier's „Temat". Curried by
  // topic so each card carries its own. The href stays for SEO / right-click / no-JS.
  const toContact = (topic: string) => (e: MouseEvent) => {
    e.preventDefault();
    goContact(topic);
  };

  return (
    <section
      ref={sectionRef}
      id="oferta"
      data-nav-section="oferta"
      data-copy-spaces
      aria-label="Moja oferta — pakiety"
      // NO overflow-hidden: the header light is meant to spill up across the seam
      // onto „Dlaczego ja?" rather than be sliced at it (see section-glow). The
      // glow layers are inset-x-0 and only overhang upwards, so nothing here can
      // grow the flow's scrollable area.
      className="offer-section relative w-full bg-bg"
    >
      {/* Ambient „poświata" — the same light that strikes „dlaczego JA". It spills
          up over the seam onto the section above instead of being cut at it. */}
      <HeaderGlow />

      {/* The same hairlines as „Dlaczego ja?" — the bars keep running down. */}
      <ColumnLines revealed={revealed} />

      <div className={cn("relative grid pb-[16vh]", COL_GRID)}>
        {/* ---------- Header — „moja OFERTA": same treatment AND same left
             margin as Why's „dlaczego JA" ---------- */}
        <header className="col-span-full pl-5 pt-[9vh] pb-[4vh] sm:pl-8 lg:pl-[4vw] lg:pt-[10vh] lg:pb-[5vh]">
          {/* The h2 carries only the heading words („moja" + sr-only „Oferta",
              with an explicit space so extractors don't read „mojaOferta");
              the animated per-letter shout lives in an aria-hidden SIBLING so
              crawlers see a clean heading instead of „mojaOfertaOFERTA". */}
          <h2 className="text-paper">
            <span
              style={rise(0.05, 22)}
              className={cn(
                "block font-accent italic lowercase leading-[1.02] tracking-[-0.01em] text-[length:calc(var(--os)*0.5)]",
                revealed ? "why-in-blur" : "opacity-0",
              )}
            >
              moja
            </span>{" "}
            <span className="sr-only">Oferta</span>
          </h2>
          <div
            aria-hidden
            className="mt-[0.02em] block overflow-hidden font-hero uppercase leading-[0.98] text-paper text-[length:var(--os)]"
          >
            <span className="flex">
              {OFERTA.map((ch, i) => (
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

        {/* ---------- Two package tiers, on the middle tracks ---------- */}
        <div className={PAIR_CELL}>
          {PACKAGES.map((pkg, i) => (
            <article
              key={pkg.name}
              style={rise(0.2 + i * 0.12, 44)}
              className={cn(
                // p-[2px] + a FLAT background = a 2px border that reads the same
                // all the way round. It used to be a gradient fading to --line at
                // the bottom, which left the lower half of each card looking
                // unlit. Whatever this padding is, the inner radius has to be
                // 1.85rem MINUS it, or the glass corners don't sit concentric.
                //
                // Hover only LIGHTS the card — it doesn't move, so it can't nudge
                // the pointer off itself or fight the entrance transform. The
                // halo is a box-shadow (a blurred rounded rect the compositor is
                // happy with) rather than a blurred element behind the card, and
                // it's declared at rest at its FULL hover geometry with a zero
                // alpha: at rest that paints nothing, and on hover only the colour
                // interpolates, so the glow fades up in place instead of growing
                // out of the card's edge the way `none` → shadow would.
                "group relative flex flex-col rounded-[1.85rem] p-[2px] transition-shadow duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                pkg.featured
                  ? "bg-amber/55 shadow-[0_0_90px_-10px_rgba(232,146,58,0)] hover:shadow-[0_0_90px_-10px_rgba(232,146,58,0.6)]"
                  : "bg-mint/45 shadow-[0_0_80px_-12px_rgba(61,220,151,0)] hover:shadow-[0_0_80px_-12px_rgba(61,220,151,0.45)]",
                revealed ? "why-in" : "opacity-0",
              )}
            >
              {/* Opaque glass: the hairline running behind this card would
                  otherwise show through as a seam. The fuller tier sinks BELOW
                  the page's own --bg while the foundation sits above it, so the
                  two tiers read as different depths rather than just different
                  accents. */}
              <div
                className={cn(
                  "relative flex flex-1 flex-col overflow-hidden rounded-[calc(1.85rem-2px)]",
                  pkg.featured ? "bg-surface-deep" : "bg-surface",
                )}
              >
                {/* The glow, painted into the glass instead of sampled through
                    it with a backdrop-filter. */}
                <div
                  aria-hidden
                  style={{ background: pkg.featured ? TINT.amber : TINT.mint }}
                  className="pointer-events-none absolute inset-x-0 top-0 h-[45%]"
                />
                {/* Sheen catching the top edge of the glass. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-paper/[0.07] to-transparent"
                />

                <div className="relative flex flex-1 flex-col p-7 sm:p-9 lg:p-8 xl:p-10">
                  {/* eyebrow + fuller-tier flag */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-muted">
                      {pkg.eyebrow}
                    </span>
                    {pkg.featured && (
                      <span className="shrink-0 rounded-full border border-amber/40 bg-amber/10 px-3 py-1 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-amber">
                        Pełen zakres
                      </span>
                    )}
                  </div>

                  <h3 className="mt-5 font-display font-bold leading-[1.02] tracking-[-0.02em] text-paper text-[clamp(1.9rem,1.3rem+2vw,2.85rem)]">
                    {pkg.name}
                  </h3>

                  <p className="mt-4 max-w-[44ch] text-pretty leading-relaxed text-muted text-[clamp(1rem,0.95rem+0.28vw,1.18rem)]">
                    {pkg.tagline}
                  </p>

                  <div className="mt-7 h-px w-full bg-line" />

                  {/* includes */}
                  <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-mint">
                    W pakiecie otrzymujesz
                  </p>
                  <ul className={LIST}>
                    {pkg.includes.map((item) => (
                      <li key={item} className={LIST_ITEM}>
                        <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-mint/15 ring-1 ring-inset ring-mint/25">
                          <CheckIcon className="size-3 text-mint" />
                        </span>
                        <span className="leading-snug text-paper/90 text-[clamp(0.95rem,0.9rem+0.2vw,1.05rem)]">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* excludes (foundation tier only) */}
                  {pkg.excludes && (
                    <>
                      <p className="mt-7 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted/70">
                        Ten pakiet nie obejmuje
                      </p>
                      <ul className={LIST}>
                        {pkg.excludes.map((item) => (
                          <li
                            key={item}
                            className={cn(LIST_ITEM, "text-muted/70")}
                          >
                            <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted/10 ring-1 ring-inset ring-line">
                              <MinusIcon className="size-3" />
                            </span>
                            <span className="leading-snug text-[clamp(0.95rem,0.9rem+0.2vw,1.05rem)]">
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {/* recommendation + CTA — sink to the card base so the two
                      cards' buttons line up regardless of list length. */}
                  <div className="mt-auto pt-8">
                    <div className="rounded-2xl border border-line bg-bg/40 p-5">
                      <p className="text-pretty font-medium leading-relaxed text-paper/90 text-[clamp(0.95rem,0.9rem+0.2vw,1.08rem)]">
                        {pkg.bestFor}
                      </p>
                    </div>

                    <a
                      href="#kontakt"
                      onClick={toContact(pkg.topic)}
                      aria-label={`${pkg.name} — porozmawiajmy o Twoim projekcie`}
                      // No whitespace-nowrap here, unlike the hero's pill: the
                      // hero needs it because it shrink-wraps inside an absolutely
                      // positioned box, but this one is w-full in normal flow, and
                      // a grid item can't shrink below its content's min-content
                      // width — so an unwrappable label made the whole card
                      // 326px wide and broke the page below ~370px.
                      className="group/cta mt-6 inline-flex w-full items-center justify-center gap-[0.55em] rounded-full bg-amber px-[1.1em] py-[0.85em] text-center font-geist font-semibold tracking-[-0.01em] text-bg shadow-[0_12px_34px_-10px_rgba(232,146,58,0.6)] transition-[translate,background-color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:bg-amber-strong hover:shadow-[0_18px_44px_-12px_rgba(232,146,58,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:translate-y-0 motion-reduce:transition-none sm:px-[1.4em] text-[clamp(0.98rem,0.94rem+0.2vw,1.1rem)]"
                    >
                      Porozmawiajmy o projekcie
                      <CtaArrow />
                    </a>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
