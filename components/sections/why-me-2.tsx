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
 * WhyMe2 — second intro panel of "Dlaczego ja?". Same kinetic style as part 1,
 * setting the line "Tworzę strony które mają sens":
 *   TWORZĘ  flies in from the left,
 *   STRONY  from the right, its S parking under TWORZĘ's R,
 *   KTÓRE   rises from the bottom, its K under TWORZĘ's W,
 *   MAJĄ SENS is already in place and grows from tiny to full size while fading
 *   in — the mint payoff.
 */

// Horizontal rest offsets, tuned so the letters line up (em, hold at any size).
const OFF_STRONY = "2.26em"; // STRONY's S under TWORZĘ's R
const OFF_KTORE = "0.6em"; // KTÓRE's K under TWORZĘ's W

export function WhyMe2() {
  const isActive = usePanelActive();
  const reduce = useReduceMotion();
  const revealed = useReveal(isActive, reduce);

  return (
    <KineticSection id="czemu-ja-2" ariaLabel="Tworzę strony które mają sens">
      <Word dir="left" delay={0} revealed={revealed} reduce={reduce}>
        T<span data-l="t2-w">W</span>O<span data-l="t2-r">R</span>ZĘ
      </Word>
      <Word
        dir="right"
        delay={STAGGER}
        revealed={revealed}
        reduce={reduce}
        style={{ marginLeft: OFF_STRONY }}
      >
        <span data-l="t2-s">S</span>TRONY
      </Word>
      <Word
        dir="bottom"
        delay={STAGGER * 2}
        revealed={revealed}
        reduce={reduce}
        style={{ marginLeft: OFF_KTORE }}
      >
        <span data-l="t2-k">K</span>TÓRE
      </Word>
      <span className="flex w-full justify-center">
        <Word
          dir="scale"
          delay={STAGGER * 3}
          revealed={revealed}
          reduce={reduce}
          className="text-mint drop-shadow-[0_0_28px_rgba(61,220,151,0.35)]"
        >
          MAJĄ SENS
        </Word>
      </span>
    </KineticSection>
  );
}
