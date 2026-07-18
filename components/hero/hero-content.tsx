import type { CSSProperties } from "react";

/**
 * HeroContent — text layer over the WebGL hero.
 *
 * A React Server Component (no client JS): the orchestrated entrance is pure CSS
 * (`.hero-rise` / `.hero-rise-blur` + @keyframes in globals.css), so it paints and
 * animates on the first frame with no hydration wait, and the copy is visible even
 * if JS never runs. Each element sets its own --rise-y (travel) and --rise-delay
 * (stagger). prefers-reduced-motion collapses the whole cascade to an instant,
 * composed frame (globals.css). It's pointer-events-none so the WebGL mask still
 * tracks through the copy; the text elements opt back in for selection.
 *
 * Composition (lg+) — a stepped display block after the eszterbial.com hero:
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │                          Tworzę strony            │ ← value line over the
 *   │  • STRONY INTERNETOWE…   internetowe, które…      │   notch after BARTOSZ
 *   │  BARTOSZ                                          │
 *   │     ZAŁĘSKI   (Z starts exactly under the R)      │
 *   └──────────────────────────────────────────────────┘
 *
 * On lg the NAME is the vertical anchor: it's the only element in normal flow, so
 * `items-center` centres it in the viewport no matter how many lines the value
 * copy wraps to. The eyebrow and value line are lifted out of flow (`lg:absolute`)
 * and pinned relative to the name's own box — eyebrow flush to its left edge, value
 * line just past where BARTOSZ ends (`left: 3.9×--hs` ≈ the name's right edge, so it
 * tracks the notch at every size without depending on the wider ZAŁĘSKI line).
 *
 * Below lg everything stacks centred: eyebrow → BARTOSZ → ZAŁĘSKI → value line →
 * contact CTA. The DOM keeps h1 first (crawlers / screen readers hear the name
 * before the tagline); the visual order is flex `order-*`. Every measure derives from --hs
 * (globals.css) so the block scales as one piece from 500×300 to 4K, portrait
 * included.
 */

// per-element travel + stagger → CSS custom props consumed by .hero-rise(-blur)
const rise = (delay: number, y: number): CSSProperties =>
  ({ "--rise-y": `${y}px`, "--rise-delay": `${delay}s` }) as CSSProperties;

export function HeroContent() {
  return (
    <div className="hero-copy pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 py-[3vh] sm:px-10 lg:flex-row lg:justify-start lg:py-0 lg:pr-16">
      {/* Mobile: eyebrow → name → value line → contact CTA stack as ONE centred
          group (order-* on the children, justify-center on the parent), so the
          button rides in flow right under the tagline and can never cover the copy.
          lg: this becomes the vertically-centred name block again, its absolute
          eyebrow / value line / CTA anchored to its own (shrink-wrapped) box;
          translate-y biases it just below centre to lower the value off the top. */}
      <div className="relative flex w-full flex-col items-center text-center lg:w-auto lg:translate-y-[8vh] lg:items-start lg:text-left">
        {/* name — both lines solid white; ZAŁĘSKI steps right via .hero-zal */}
        <h1 className="order-2 pointer-events-auto font-hero uppercase leading-[1.12] tracking-[-0.01em] text-paper drop-shadow-[0_3px_28px_rgba(11,26,28,0.55)] text-[length:var(--hs)]">
          {/* The explicit space is for machines, not eyes: both spans are
              display:block, so the text node collapses visually, but crawlers
              and AI agents extracting raw text would otherwise read the h1 as
              the single word „BartoszZałęski". */}
          <span style={rise(0.16, 36)} className="hero-rise block">
            Bartosz
          </span>{" "}
          <span style={rise(0.28, 36)} className="hero-rise hero-zal block">
            Załęski
          </span>
        </h1>

        {/* value line — wide: pinned over the notch where BARTOSZ ends, above the
            name; narrow: in flow, centred under the name */}
        <h2
          style={rise(0.46, 22)}
          className="hero-rise-blur pointer-events-auto order-3 font-geist font-medium leading-[1.38] text-paper text-balance [text-shadow:0_1px_18px_rgba(11,26,28,0.6)] mt-[calc(var(--hs)*0.42)] max-w-[34ch] text-[length:max(1rem,calc(var(--hs)*0.21))] lg:absolute lg:bottom-full lg:left-[calc(var(--hs)*3.9)] lg:mb-[calc(var(--hs)*0.15)] lg:mt-0 lg:w-[26ch] lg:max-w-none lg:text-left lg:text-[length:max(1rem,calc(var(--hs)*0.15))]"
        >
          Tworzę strony internetowe, które wyglądają tak dobrze, że od pierwszej
          sekundy{" "}
          <em className="font-accent font-semibold italic text-mint">
            podnoszą wartość Twojej marki
          </em>
          .
        </h2>

        {/* Contact CTA — replaces the old pinned sticky-note. A clean solid-amber
            pill (amber = the palette's single call-to-action token) placed directly
            BELOW the value line. Mobile: in flow, centred right under the tagline
            (order-4). lg: lifted out of flow into the open space to the RIGHT of the
            name, pinned just under the value line's baseline — the line is
            bottom-anchored (bottom-full), so that baseline is stable no matter how
            many rows it wraps to, and the tagline itself never shifts up. Sizes and
            offsets derive from --hs, so it scales with the whole block; padding is in
            em so it tracks its own font-size. href stays a plain anchor until the
            contact panel exists (matches the deck's other placeholder links). */}
        <a
          href="#kontakt"
          aria-label="Porozmawiajmy o Twojej stronie — przejdź do kontaktu"
          style={rise(0.6, 20)}
          className="hero-rise-blur group/cta pointer-events-auto order-4 mt-[calc(var(--hs)*0.18)] inline-flex w-fit items-center gap-[0.55em] whitespace-nowrap rounded-full bg-amber py-[0.7em] pl-[1.35em] pr-[1.1em] font-geist font-semibold tracking-[-0.01em] text-bg shadow-[0_10px_30px_-8px_rgba(232,146,58,0.55)] transition-[transform,background-color,box-shadow] duration-300 ease-out will-change-transform hover:-translate-y-0.5 hover:bg-amber-strong hover:shadow-[0_16px_40px_-10px_rgba(232,146,58,0.72)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:translate-y-0 motion-reduce:transition-none text-[length:max(0.82rem,calc(var(--hs)*0.092))] lg:absolute lg:left-[calc(var(--hs)*3.9)] lg:top-0 lg:order-none lg:mt-0"
        >
          Porozmawiajmy o stronie
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
        </a>

        {/* eyebrow — wide: flush to BARTOSZ's left edge, right above it */}
        <p
          style={rise(0.05, 12)}
          className="hero-rise-blur pointer-events-auto order-1 inline-flex max-w-full flex-wrap items-center justify-center gap-x-[0.45em] gap-y-1 font-mono uppercase tracking-[0.28em] text-muted mb-[calc(var(--hs)*0.16)] text-[length:max(0.6rem,calc(var(--hs)*0.088))] lg:absolute lg:bottom-full lg:left-0 lg:mb-[calc(var(--hs)*0.09)] lg:justify-start lg:text-[length:max(0.6rem,calc(var(--hs)*0.072))]"
        >
          {/* Two atomic groups so the eyebrow never breaks into a lone trailing
              word: when it can't fit on one line it always splits as
              "Strony internetowe dla" / "firm i marek". The dot stays bound to
              the first group. */}
          <span className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap">
            <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
            </span>
            Strony internetowe dla
          </span>
          <span className="whitespace-nowrap">firm i marek</span>
        </p>
      </div>
    </div>
  );
}
