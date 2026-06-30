"use client";

import { ChevronDown } from "lucide-react";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { useSection } from "./section-context";

/**
 * Shared building blocks for the kinetic-typography panels of the "Dlaczego ja?"
 * section. Each word is choreographed in once its panel becomes active (after the
 * deck's crossfade settles): a fast, LINEAR "bullet" slide from an edge, or — for
 * a word that stays put — a grow-from-tiny + fade-in. A scroll hint sits at the
 * bottom of every panel; KineticSection reserves room for it and vertically
 * centres the headline in what's left, so nothing overlaps.
 */

export const REVEAL_DELAY = 600; // let the crossfade settle before the type-in
export const DUR = 260; // per-word duration — fast, bullet-like
export const STAGGER = 200; // delay between words; they fire one after another
export const EASE = "linear"; // a bullet flies at constant speed — no deceleration

export type Dir = "top" | "bottom" | "left" | "right" | "scale";

// Off-screen start per direction. Verticals use vh tuned to clear the edge while
// still streaking visibly; horizontals fly a full viewport; "scale" grows in place.
const HIDDEN: Record<Dir, string> = {
  top: "translateY(-40vh)",
  bottom: "translateY(65vh)", // fully below the viewport (slot is ~46% down)
  left: "translateX(-100vw)",
  right: "translateX(100vw)",
  scale: "scale(0.18)",
};

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReduce = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** prefers-reduced-motion as an external store — SSR-safe, no setState-in-effect. */
export const useReduceMotion = (): boolean =>
  useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false,
  );

/** Reveal the words once the panel is active (after the crossfade); reset on
 *  leave so re-entering replays. setState runs only from the timer callback. */
export function useReveal(isActive: boolean, reduce: boolean): boolean {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(
      () => setRevealed(isActive),
      isActive && !reduce ? REVEAL_DELAY : 0,
    );
    return () => clearTimeout(t);
  }, [isActive, reduce]);
  return revealed;
}

export function Word({
  dir,
  delay,
  revealed,
  reduce,
  className,
  style,
  text,
  children,
}: {
  dir: Dir;
  delay: number;
  revealed: boolean;
  reduce: boolean;
  className?: string;
  style?: CSSProperties;
  text?: string; // data-text for the outlined (::before) variant
  children: ReactNode;
}) {
  const shown = revealed || reduce;
  const isScale = dir === "scale";
  return (
    <span
      data-text={text}
      className={cn("inline-block", className)}
      style={{
        transform: shown ? "none" : HIDDEN[dir],
        opacity: isScale && !shown ? 0 : 1,
        transformOrigin: isScale ? "center" : undefined,
        transitionProperty: isScale ? "transform, opacity" : "transform",
        transitionDuration: reduce ? "0ms" : `${DUR}ms`,
        transitionTimingFunction: EASE,
        transitionDelay: revealed && !reduce ? `${delay}ms` : "0ms",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Animated "scroll down" cue pinned to the bottom of a panel — also a button
 *  that advances the deck to the next panel. */
export function ScrollHint({ label = "Przewiń" }: { label?: string }) {
  const { next } = useSection();
  return (
    <button
      type="button"
      onClick={next}
      aria-label="Przejdź do następnej sekcji"
      className="group flex shrink-0 cursor-pointer flex-col items-center gap-2 rounded-lg px-4 pb-7 pt-2 text-muted outline-none transition-colors duration-200 hover:text-mint focus-visible:text-mint focus-visible:ring-2 focus-visible:ring-mint/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:pb-9"
    >
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.34em]">
        {label}
      </span>
      <span className="animate-scroll-bob flex flex-col items-center -space-y-[0.7rem]">
        <ChevronDown className="size-6" strokeWidth={1.5} aria-hidden />
        <ChevronDown className="size-6 opacity-45" strokeWidth={1.5} aria-hidden />
      </span>
    </button>
  );
}

/**
 * Shared layout for a kinetic panel: the headline is vertically centred in the
 * space above a bottom-pinned ScrollHint (so the two never overlap), with the
 * display size capped by both viewport height and width so all lines fit.
 */
export function KineticSection({
  id,
  ariaLabel,
  hintLabel,
  children,
}: {
  id: string;
  ariaLabel: string;
  hintLabel?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-copy-spaces
      className="relative flex h-full w-full flex-col overflow-hidden bg-surface"
    >
      <div className="flex flex-1 items-center">
        <h2
          aria-label={ariaLabel}
          className="flex w-full flex-col items-start gap-[0.12em] px-6 font-display font-extrabold uppercase leading-[0.85] tracking-[-0.02em] text-paper text-[min(20vh,14vw)] sm:px-10 lg:px-20 2xl:px-32"
        >
          {children}
        </h2>
      </div>
      <ScrollHint label={hintLabel} />
    </section>
  );
}
