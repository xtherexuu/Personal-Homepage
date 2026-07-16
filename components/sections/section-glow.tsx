"use client";

import { type CSSProperties } from "react";

/**
 * HeaderGlow — the light that falls onto a content section's header from its
 * top-left corner.
 *
 * IT IS NOT CONTAINED, ON PURPOSE. The obvious way to stop a light being sliced
 * at a section seam is to make it fade out before it gets there — but that forces
 * the light DOWN (its centre can never sit closer to the edge than its own
 * radius), and a light centred halfway down the headline rakes it from the side
 * instead of falling on its corner. So it isn't contained: it is allowed to spill
 * up ACROSS the seam onto the section above, and simply not cut there. Both
 * sections carry `bg-bg`, so the seam itself is invisible and the light reads as
 * one continuous field crossing it.
 *
 * That only works because the section does NOT clip: `Offer` deliberately has no
 * `overflow-hidden`. Which sets the constraint this layer must respect —
 *
 *   it may only overhang UPWARDS.
 *
 * A scroll container grows its scrollable area to fit descendants overhanging its
 * end edges, so a layer poking out to the RIGHT would add a horizontal scrollbar
 * and one poking out the BOTTOM would add dead space under the last section.
 * Overhang above the scroll origin is simply unreachable, so it costs nothing.
 * Hence the layer is `inset-x-0` (never wider than the section) and only its `top`
 * goes negative. Being cut at the left of the window is fine — a window edge is
 * not a seam.
 *
 * SIZE IS FIXED. --glow-r is the light's radius and the only free number: clamped
 * so it tracks the viewport gently, never derived from the header's length or the
 * section's height — a longer headline must not make a bigger light. The layer's
 * height and the gradient's centre are both computed FROM it, so changing the
 * radius needs nothing else re-checked.
 *
 * The ramp is multi-stop rather than one long fade because it approximates a
 * gaussian — what real light does, and what avoids the banding a single low-alpha
 * ramp gives over a near-black ground. It reaches zero alpha at 82% of the radius.
 */

/** The light's radius — the one number. Never derived from the content it lights. */
const GLOW_R = "clamp(17rem, 40vh, 28rem)";

/** Gaussian-ish falloff, hitting zero alpha at 82% of the radius. */
const falloff = (rgb: string) =>
  `rgba(${rgb},0.12) 0%, rgba(${rgb},0.065) 38%, rgba(${rgb},0.022) 62%, rgba(${rgb},0) 82%`;

const MINT = "61,220,151";

/**
 * The mint light on a section's „whisper + shout" header, struck from its
 * top-left corner. Shared, so „dlaczego JA" and „moja OFERTA" are lit
 * identically.
 *
 * Vertically the centre sits on the TOP OF THE WHISPER'S LETTERS — not the top of
 * its text box, which is a good bit higher: half-leading plus the gap between the
 * font's ascent and where Playfair's lowercase actually starts push the ink down
 * ~12% of the font size. Measured rather than guessed (canvas TextMetrics against
 * the live computed font), the ink top lands at ~11.5vh on lg and ~9.7vh below —
 * the split matching the headers' own pt-[9vh]/lg:pt-[10vh]. Both words agree to
 * within 3px („dlaczego" 11.3vh / „moja" 11.7vh at both 1280 and 1920), which is
 * why one value can light both.
 *
 * Horizontally it sits at 4rem — just left of the headline's own corner
 * (pl-5/sm:pl-8/lg:pl-[4vw]) — so the light arrives from beyond the corner and
 * falls across the words rather than raking them from the side.
 *
 * Since the centre is far less than a radius from the top, the layer starts well
 * above the section and the light spills onto whatever is above: the offer's onto
 * „Dlaczego ja?"'s closing space, and „Dlaczego ja?"'s own past the top of the
 * flow, where there's nothing to cut it against anyway.
 */
export function HeaderGlow() {
  return (
    <div
      aria-hidden
      style={
        {
          "--glow-r": GLOW_R,
          // centre − radius: lifts the layer above the section by most of the light
          top: "calc(var(--glow-cy) - var(--glow-r))",
          height: "calc(var(--glow-r) * 2)",
          background: `radial-gradient(circle var(--glow-r) at 4rem var(--glow-r), ${falloff(MINT)})`,
        } as CSSProperties
      }
      className="pointer-events-none absolute inset-x-0 [--glow-cy:9.7vh] lg:[--glow-cy:11.5vh]"
    />
  );
}
