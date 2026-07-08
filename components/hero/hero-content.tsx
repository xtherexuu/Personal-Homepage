import Image from "next/image";
import type { CSSProperties } from "react";

import contactLarge from "@/public/contact-large.png";
import contactSmall from "@/public/contact-small.png";

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
 * Below lg everything stacks centred: eyebrow → BARTOSZ → ZAŁĘSKI → value line.
 * The DOM keeps h1 first (crawlers / screen readers hear the name before the
 * tagline); the visual order is flex `order-*`. Every measure derives from --hs
 * (globals.css) so the block scales as one piece from 500×300 to 4K, portrait
 * included.
 */

// per-element travel + stagger → CSS custom props consumed by .hero-rise(-blur)
const rise = (delay: number, y: number): CSSProperties =>
  ({ "--rise-y": `${y}px`, "--rise-delay": `${delay}s` }) as CSSProperties;

export function HeroContent() {
  return (
    <div className="hero-copy pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 py-[3vh] sm:px-10 lg:flex-row lg:justify-start lg:py-0 lg:pr-16">
      {/* Mobile: the text column and the note below it are ONE centred group
          (justify-center on the parent) — the note rides with the copy instead
          of being pinned to the bottom, and being in flow it can never cover it.
          lg: this becomes the vertically-centred name block again, its absolute
          eyebrow / value line anchored to its own (shrink-wrapped) box;
          translate-y biases it just below centre to lower the value off the top. */}
      <div className="relative flex w-full flex-col items-center text-center lg:w-auto lg:translate-y-[8vh] lg:items-start lg:text-left">
        {/* name — both lines solid white; ZAŁĘSKI steps right via .hero-zal */}
        <h1 className="order-2 pointer-events-auto font-hero uppercase leading-[1.12] tracking-[-0.01em] text-paper drop-shadow-[0_3px_28px_rgba(11,26,28,0.55)] text-[length:var(--hs)]">
          <span style={rise(0.16, 36)} className="hero-rise block">
            Bartosz
          </span>
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

        {/* eyebrow — wide: flush to BARTOSZ's left edge, right above it */}
        <p
          style={rise(0.05, 12)}
          className="hero-rise-blur pointer-events-auto order-1 inline-flex max-w-full flex-wrap items-center justify-center gap-x-[0.45em] gap-y-1 font-mono uppercase tracking-[0.28em] text-muted mb-[calc(var(--hs)*0.16)] text-[length:max(0.6rem,calc(var(--hs)*0.088))] lg:absolute lg:bottom-full lg:left-0 lg:mb-[calc(var(--hs)*0.16)] lg:justify-start"
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

      {/* Contact CTA — a pinned sticky-note linking to the contact section.
          Mobile: flows in at the very bottom of the stack (never overlaps the
          copy); hidden on very short landscape where nothing else fits either.
          lg (`.hero-note`, globals): absolutely placed bottom-left, its right
          edge mirroring the value line's gap from the name (symmetric about the
          block). On hover/focus it grows a touch and tips counter-clockwise about
          its centre — as if nudged toward the top-left corner while pinned. The
          two art-directed PNGs (landscape / square) swap at the lg breakpoint.
          href is a plain anchor for now; wire to the deck nav once the contact
          panel exists. */}
      <a
        href="#kontakt"
        aria-label="Porozmawiajmy o Twojej stronie — przejdź do kontaktu"
        className="hero-note group pointer-events-auto z-20 mt-[3vh] w-[min(72vw,42vh,18rem)] shrink-0 rounded-3xl transition-transform duration-300 ease-out will-change-transform hover:-rotate-[4deg] hover:scale-[1.06] focus-visible:-rotate-[4deg] focus-visible:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-4 focus-visible:ring-offset-bg motion-reduce:transition-none [@media(max-height:430px)]:hidden lg:mt-0"
      >
        <Image
          src={contactSmall}
          alt=""
          sizes="(max-width: 1023px) min(72vw, 42vh, 18rem), 1px"
          className="block h-auto w-full drop-shadow-[0_10px_22px_rgba(11,26,28,0.45)] lg:hidden"
        />
        <Image
          src={contactLarge}
          alt=""
          sizes="(min-width: 1024px) clamp(8.5rem, 14vw, 19rem), 1px"
          className="hidden h-auto w-full drop-shadow-[0_14px_28px_rgba(11,26,28,0.5)] lg:block"
        />
      </a>
    </div>
  );
}
