import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";

const BADGES = [
  "Responsywność",
  "Szybkość",
  "SEO",
  "Wdrożenie",
  "Wsparcie po publikacji",
];

/**
 * HeroContent — text layer over the WebGL hero.
 *
 * A React Server Component (no client JS): the orchestrated entrance is pure CSS
 * (`.hero-rise` / `.hero-rise-blur` + @keyframes in globals.css), so it paints and
 * animates on the first frame with no hydration wait, and the copy is visible even
 * if JS never runs. Each element sets its own --rise-y (travel) and --rise-delay
 * (stagger). The name animates transform + opacity only, so its #name-outline SVG
 * filter survives; supporting copy gets a soft blur-in. prefers-reduced-motion
 * collapses the whole cascade to an instant, composed frame (globals.css).
 *
 * Rendered server-side and passed into the client <Hero> as children, so neither
 * this markup nor the lucide icons ship in the client bundle. It's pointer-events
 * -none so the WebGL mask still tracks through the copy; only the CTAs opt back in.
 */

// per-element travel + stagger → CSS custom props consumed by .hero-rise(-blur)
const rise = (delay: number, y: number): CSSProperties =>
  ({ "--rise-y": `${y}px`, "--rise-delay": `${delay}s` }) as CSSProperties;

export function HeroContent() {
  const unit = { "--u": "clamp(10px, min(2.7vh, 3vw), 42px)" } as CSSProperties;

  // CTA sizing tracks --u so the buttons keep their visual weight on tall / large
  // screens (≈1440p+) instead of shrinking against the --u-scaled copy around them.
  // The clamp FLOORS reproduce today's phone / 1080p size (24px px-pad, 14px py-pad,
  // ~1.05rem text, 16px icons); the --u middle term only overtakes those floors once
  // --u grows past ~29px (i.e. taller viewports — the axis the rest of the hero scales
  // on), and the ceilings cap the growth on very large displays. The max-height guard
  // still trims the vertical padding on short landscape screens.
  const ctaSize =
    "px-[clamp(1.5rem,calc(var(--u)*0.82),2.1rem)] " +
    "py-[clamp(0.875rem,calc(var(--u)*0.48),1.25rem)] " +
    "text-[clamp(0.95rem,calc(var(--u)*0.58),1.45rem)] " +
    "[@media(max-height:600px)]:py-2.5";
  const ctaIcon = "size-[clamp(1rem,calc(var(--u)*0.55),1.4rem)]";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center">
      {/* clean silhouette-outline filters for the first name (thin on mobile) */}
      <svg aria-hidden className="absolute h-0 w-0" focusable="false">
        <defs>
          <filter
            id="name-outline"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feMorphology in="SourceAlpha" operator="dilate" radius="2.2" result="dilated" />
            <feComposite in="dilated" in2="SourceAlpha" operator="out" result="ring" />
            <feFlood floodColor="#e8f2ee" result="ink" />
            <feComposite in="ink" in2="ring" operator="in" />
          </filter>
          <filter
            id="name-outline-sm"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feMorphology in="SourceAlpha" operator="dilate" radius="1.15" result="dilated" />
            <feComposite in="dilated" in2="SourceAlpha" operator="out" result="ring" />
            <feFlood floodColor="#e8f2ee" result="ink" />
            <feComposite in="ink" in2="ring" operator="in" />
          </filter>
        </defs>
      </svg>

      <div
        style={unit}
        className="flex w-full flex-col items-start px-6 sm:px-10 lg:px-20 2xl:pl-32"
      >
        {/* eyebrow */}
        <p
          style={rise(0.05, 12)}
          className="hero-rise-blur pointer-events-auto inline-flex max-w-full flex-wrap items-center gap-x-[0.45em] gap-y-1 font-mono uppercase tracking-[0.28em] text-muted text-[clamp(0.62rem,1.3vw,0.8rem)] mb-[calc(var(--u)*0.9)]"
        >
          {/* Two atomic groups so the eyebrow never breaks into a lone trailing
              word: when it can't fit on one line it always splits as
              "Strony internetowe dla" / "firm i marek" — regardless of where the
              hamburger sits. The dot stays bound to the first group. */}
          <span className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap">
            <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
            </span>
            Strony internetowe dla
          </span>
          <span className="whitespace-nowrap">firm i marek</span>
        </p>

        {/* name — the two lines rise in sequence */}
        <h1 className="pointer-events-auto font-display font-extrabold uppercase leading-[0.84] tracking-[-0.02em] text-[calc(var(--u)*4)]">
          <span
            style={rise(0.16, 36)}
            data-text="Bartosz"
            className="hero-rise block text-outline"
          >
            Bartosz
          </span>
          <span
            style={rise(0.28, 36)}
            className="hero-rise block text-mint drop-shadow-[0_0_34px_rgba(61,220,151,0.28)]"
          >
            Załęski
          </span>
        </h1>

        {/* value statement — on mobile, text-balance keeps the short measure tidy.
            From lg up we switch to a greedy text-pretty fill inside a wider column:
            the name „BARTOSZ" runs ~18×--u wide, so a ~20×--u measure lets the long
            lines spill just past the name's right edge (the look the design calls
            for) rather than wrapping shy of it. Because --u itself is capped at 42px,
            the column is naturally bounded; the 34rem floor covers short-height lg
            screens where --u is height-driven small. The expansion <p> below shares
            this measure so the justified body lines up to the same right boundary. */}
        <h2
          style={rise(0.48, 24)}
          className="hero-rise-blur pointer-events-auto font-display font-semibold leading-[1.12] text-paper text-balance lg:text-pretty text-[calc(var(--u)*1.5)] mt-[calc(var(--u)*0.72)] max-w-[min(34rem,90vw)] lg:max-w-[max(34rem,calc(var(--u)*20))]"
        >
          Tworzę strony internetowe, które wyglądają tak dobrze, że od pierwszej
          sekundy <span className="text-mint">podnoszą wartość Twojej marki</span>.
        </h2>

        {/* expansion */}
        <p
          style={rise(0.62, 18)}
          className="hero-rise-blur pointer-events-auto leading-relaxed text-muted text-[clamp(0.95rem,1.25vw,1.12rem)] mt-[clamp(0.8rem,calc(var(--u)*0.5),1.5rem)] max-w-[34rem] lg:max-w-[max(34rem,calc(var(--u)*20))] sm:hyphens-auto sm:text-justify [@media(max-height:560px)]:hidden"
        >
          Łączę dopracowany design, błyskawiczne działanie i przemyślaną
          strukturę — tak, żeby Twoja strona nie była tylko ładna, ale realnie
          budowała zaufanie i zdobywała klientów.
        </p>

        {/* feature badges — each pill staggers in */}
        <ul
          className="flex flex-wrap gap-2 mt-[clamp(1rem,calc(var(--u)*0.7),1.85rem)] select-none [@media(max-height:520px)]:hidden"
          aria-label="Zakres usług"
        >
          {BADGES.map((b, i) => (
            <li
              key={b}
              style={rise(0.74 + i * 0.05, 10)}
              className="hero-rise rounded-full border border-line bg-surface/40 px-3 py-1.5 font-mono uppercase tracking-wide text-muted backdrop-blur-sm text-[clamp(0.6rem,1vw,0.72rem)]"
            >
              {b}
            </li>
          ))}
        </ul>

        {/* CTA — amber primary + bordered secondary */}
        <div
          style={rise(0.86, 16)}
          className="hero-rise pointer-events-auto flex flex-col gap-3 select-none sm:flex-row sm:items-center mt-[clamp(1.1rem,calc(var(--u)*0.85),2.1rem)]"
        >
          <a
            href="#kontakt"
            className={`group inline-flex items-center justify-center gap-2 rounded-full bg-amber font-semibold text-bg shadow-[0_10px_34px_-8px_rgba(232,146,58,0.55)] transition duration-200 hover:-translate-y-0.5 hover:bg-amber-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${ctaSize}`}
          >
            Porozmawiajmy o stronie
            <ArrowRight className={`${ctaIcon} transition-transform duration-200 group-hover:translate-x-0.5`} />
          </a>
          <a
            href="#portfolio"
            className={`group inline-flex items-center justify-center gap-1.5 rounded-full border border-paper/30 font-semibold text-paper transition duration-200 hover:-translate-y-0.5 hover:border-paper/60 hover:bg-paper/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${ctaSize}`}
          >
            Zobacz projekty
            <ArrowUpRight className={`${ctaIcon} transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5`} />
          </a>
        </div>
      </div>
    </div>
  );
}
