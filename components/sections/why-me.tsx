"use client";

import {
  KineticSection,
  STAGGER,
  Word,
  useReduceMotion,
  useReveal,
} from "./kinetic";
import { usePanelActive } from "./section-context";

/**
 * WhyMe — first intro panel of "Dlaczego ja?". A screen-filling kinetic setting
 * of 'Nie tworzę stron „żeby były"': NIE drops from the top, TWORZĘ flies in from
 * the right and parks its T under NIE's E, STRON comes from the left and parks its
 * T under TWORZĘ's T, then „ŻEBY and BYŁY" arrive from opposite sides and meet in
 * the centre. The quoted, dismissive half is set hollow (outlined) to read as
 * "just for show" against the solid assertion above it (see .text-outline-zeby).
 */

// Horizontal rest offsets, tuned so the T's line up (em → hold at any size).
const OFF_TWORZE = "1.05em"; // TWORZĘ's T sits under NIE's E
const OFF_STRON = "0.41em"; // STRON's T sits under TWORZĘ's T

export function WhyMe() {
  const isActive = usePanelActive();
  const reduce = useReduceMotion();
  const revealed = useReveal(isActive, reduce);

  return (
    <KineticSection id="czemu-ja" ariaLabel={'Nie tworzę stron „żeby były"'}>
      {/* feMorphology outline filters for the hollow „ŻEBY BYŁY" (radius in px, so
          a smaller one is used at the smaller mobile type size). Absolute h-0 w-0,
          so it sits in the <h2> without affecting layout. */}
      <svg aria-hidden className="absolute h-0 w-0" focusable="false">
        <defs>
          <filter id="zeby-line" x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="d" />
            <feComposite in="d" in2="SourceAlpha" operator="out" result="ring" />
            <feFlood floodColor="#e8f2ee" result="ink" />
            <feComposite in="ink" in2="ring" operator="in" />
          </filter>
          <filter id="zeby-line-sm" x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius="1.4" result="d" />
            <feComposite in="d" in2="SourceAlpha" operator="out" result="ring" />
            <feFlood floodColor="#e8f2ee" result="ink" />
            <feComposite in="ink" in2="ring" operator="in" />
          </filter>
        </defs>
      </svg>

      <Word
        dir="top"
        delay={0}
        revealed={revealed}
        reduce={reduce}
        className="self-start"
      >
        NI<span data-l="nie-e">E</span>
      </Word>
      <Word
        dir="right"
        delay={STAGGER}
        revealed={revealed}
        reduce={reduce}
        className="self-start"
        style={{ marginLeft: OFF_TWORZE }}
      >
        <span data-l="tworze-t">T</span>WORZĘ
      </Word>
      <Word
        dir="left"
        delay={STAGGER * 2}
        revealed={revealed}
        reduce={reduce}
        className="self-start"
        style={{ marginLeft: OFF_STRON }}
      >
        S<span data-l="stron-t">T</span>RON
      </Word>
      <span className="flex w-full items-baseline justify-center gap-[0.28em]">
        <Word
          dir="left"
          delay={STAGGER * 3}
          revealed={revealed}
          reduce={reduce}
          className="text-outline-zeby"
          text="„ŻEBY"
        >
          „ŻEBY
        </Word>
        <Word
          dir="right"
          delay={STAGGER * 3}
          revealed={revealed}
          reduce={reduce}
          className="text-outline-zeby"
          text={"BYŁY”"}
        >
          BYŁY&rdquo;
        </Word>
      </span>
    </KineticSection>
  );
}
