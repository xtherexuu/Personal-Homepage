"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";

const BADGES = [
  "Responsywność",
  "Szybkość",
  "SEO",
  "Wdrożenie",
  "Wsparcie po publikacji",
];

// soft "expo out" — decisive then gently settles
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * HeroContent — text layer over the WebGL hero.
 *
 * Entrance: one orchestrated, restrained cascade (framer-motion) timed with the
 * WebGL spotlight forming behind it. Supporting copy fades up with a soft
 * blur-in; the name only translates + fades (it carries the #name-outline SVG
 * filter, and animating `filter` would wipe the outline). Reduced-motion → no
 * animation, content visible immediately.
 *
 * Sizing/pointer-events/SEO structure unchanged — see notes below.
 */
export function HeroContent() {
  const reduce = useReducedMotion();

  // translate + fade (safe for the filtered name)
  const rise = (delay: number, y = 26) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, ease: EASE, delay },
        };
  // translate + fade + soft blur-in (for non-filtered text)
  const riseBlur = (delay: number, y = 20) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y, filter: "blur(8px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.85, ease: EASE, delay },
        };

  const unit = { "--u": "clamp(10px, min(2.7vh, 3vw), 42px)" } as CSSProperties;

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
        <motion.p
          {...riseBlur(0.05, 12)}
          className="inline-flex items-center gap-2.5 font-mono uppercase tracking-[0.28em] text-muted text-[clamp(0.62rem,1.3vw,0.8rem)] mb-[calc(var(--u)*0.9)]"
        >
          <span className="relative flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
          </span>
          Strony internetowe dla firm i marek
        </motion.p>

        {/* name — the two lines rise in sequence */}
        <h1 className="font-display font-extrabold uppercase leading-[0.84] tracking-[-0.02em] text-[calc(var(--u)*4)]">
          <motion.span
            {...rise(0.16, 36)}
            className="block text-outline [filter:url(#name-outline-sm)] sm:[filter:url(#name-outline)]"
          >
            Bartosz
          </motion.span>
          <motion.span
            {...rise(0.28, 36)}
            className="block text-mint drop-shadow-[0_0_34px_rgba(61,220,151,0.28)]"
          >
            Załęski
          </motion.span>
        </h1>

        {/* value statement */}
        <motion.h2
          {...riseBlur(0.48, 24)}
          className="font-display font-semibold leading-[1.12] text-paper text-balance text-[calc(var(--u)*1.5)] mt-[calc(var(--u)*0.72)] max-w-[min(34rem,90vw)]"
        >
          Tworzę strony internetowe, które wyglądają tak dobrze, że od pierwszej
          sekundy <span className="text-mint">podnoszą wartość Twojej marki</span>.
        </motion.h2>

        {/* expansion */}
        <motion.p
          {...riseBlur(0.62, 18)}
          className="leading-relaxed text-muted text-[clamp(0.95rem,1.25vw,1.12rem)] mt-[clamp(0.8rem,calc(var(--u)*0.5),1.5rem)] max-w-[34rem] [@media(max-height:560px)]:hidden"
        >
          Łączę dopracowany design, błyskawiczne działanie i przemyślaną
          strukturę — tak, żeby Twoja strona nie była tylko ładna, ale realnie
          budowała zaufanie i zdobywała klientów.
        </motion.p>

        {/* feature badges — each pill staggers in */}
        <ul
          className="flex flex-wrap gap-2 mt-[clamp(1rem,calc(var(--u)*0.7),1.85rem)] [@media(max-height:520px)]:hidden"
          aria-label="Zakres usług"
        >
          {BADGES.map((b, i) => (
            <motion.li
              key={b}
              {...rise(0.74 + i * 0.05, 10)}
              className="rounded-full border border-line bg-surface/40 px-3 py-1.5 font-mono uppercase tracking-wide text-muted backdrop-blur-sm text-[clamp(0.6rem,1vw,0.72rem)]"
            >
              {b}
            </motion.li>
          ))}
        </ul>

        {/* CTA — amber primary + bordered secondary */}
        <motion.div
          {...rise(0.86, 16)}
          className="pointer-events-auto flex flex-col gap-3 sm:flex-row sm:items-center mt-[clamp(1.1rem,calc(var(--u)*0.85),2.1rem)]"
        >
          <a
            href="#kontakt"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-amber px-6 py-3.5 font-semibold text-bg shadow-[0_10px_34px_-8px_rgba(232,146,58,0.55)] transition duration-200 hover:-translate-y-0.5 hover:bg-amber-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-bg text-[clamp(0.95rem,1vw,1.05rem)] [@media(max-height:600px)]:py-2.5"
          >
            Porozmawiajmy o stronie
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
          <a
            href="#portfolio"
            className="group inline-flex items-center justify-center gap-1.5 rounded-full border border-paper/30 px-6 py-3.5 font-semibold text-paper transition duration-200 hover:-translate-y-0.5 hover:border-paper/60 hover:bg-paper/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg text-[clamp(0.95rem,1vw,1.05rem)] [@media(max-height:600px)]:py-2.5"
          >
            Zobacz projekty
            <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </motion.div>
      </div>
    </div>
  );
}
