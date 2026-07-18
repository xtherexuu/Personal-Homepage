import { type SVGProps } from "react";

/**
 * The contact tiles' icon set — all six glyphs the tile row shows, drawn here
 * rather than imported, because the row has to look like ONE set and no library
 * gives us that.
 *
 * Two things forced it. No installed library ships the brand marks at all:
 * @heroicons carries none by policy, and lucide-react — which is in package.json —
 * dropped Instagram and Facebook at v1. And mixing the rest in from @heroicons is
 * what made the row look wrong in the first place: its `24/outline` set is drawn at
 * stroke 1.5, so an imported envelope sat visibly thinner than the 2px brand marks
 * either side of it. Everything is therefore drawn to one spec — lucide's geometry,
 * a 24×24 box, round caps and joins — and the weight is set HERE, in one place.
 *
 * WEIGHT IS NOT UNIFORM, ON PURPOSE. Dense glyphs (the brand marks, the envelope,
 * the clipboard) sit at 2. The sparse ones — the arrow, which is two strokes, and
 * the tick, which is one — are drawn at 2.5, because an equal stroke on a glyph
 * with a third of the ink reads lighter than its neighbours. That's optical
 * compensation, not a mismatch: the arrow and tick only ever appear IN PLACE of a
 * brand mark, so they have to hold the same visual weight in the same hole.
 *
 * All six take `className` for sizing / colour like any heroicon, and all six are
 * decorative — the tiles carry their own accessible names, so they're aria-hidden
 * at the call site rather than titled here.
 */

/** Dense glyphs — enough ink that 2 reads as the row's weight. */
const SOLID = 2;
/** Sparse glyphs — 2 would read thin beside SOLID, so they carry a little more. */
const SPARSE = 2.5;

const base = (strokeWidth: number): SVGProps<SVGSVGElement> => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(SOLID)} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(SOLID)} {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(SOLID)} {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

/**
 * Two overlapping sheets — the copy idiom everyone already knows, and the reason
 * this isn't @heroicons' ClipboardDocument: that one draws a clipboard, a clasp
 * AND ruled lines inside a 24px box, which at tile size collapses into a grey
 * smudge. This is two rectangles.
 */
export function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(SOLID)} {...props}>
      <rect x="8" y="8" width="14" height="14" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function ArrowUpRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(SPARSE)} {...props}>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(SPARSE)} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
