"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type SVGProps,
} from "react";

import { CONTACT } from "@/lib/site";
import { cn } from "@/lib/utils";
import {
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  FacebookIcon,
  InstagramIcon,
  MailIcon,
} from "./contact-icons";

/**
 * ContactTiles — the three ways to reach me, sat above the „Wiadomość" window:
 * Instagram, e-mail, Facebook, left to right.
 *
 * All three are the same object at rest — near-black glass inside a 1.5px
 * gradient rim — and the hover is what tells them apart: the glass simply gets out
 * of the way and the tile becomes the gradient it was already wearing. That's why
 * the rim and the fill are ONE painted layer on the outer element rather than two:
 * the face is inset by 1.5px and merely turns transparent, so there's no second
 * gradient to line up and no seam where the two would meet. Anything else drifts
 * the moment a radius or a rim width changes.
 *
 * The icon is the affordance. Instagram and Facebook swap to an arrow leaving
 * toward the top-right — the universal "this navigates away" — while the e-mail
 * tile swaps to a clipboard, because it doesn't navigate: it copies the address
 * and reports back. The two behaviours are also two ELEMENTS, an <a> and a
 * <button>: a link that doesn't link would break middle-click, "open in new tab"
 * and the status bar, and a button that navigates is a link wearing a costume.
 *
 * The e-mail tile's ink goes dark rather than white on hover — mint at full
 * strength is far too bright to carry white text, which is the same reason the
 * site's amber CTA sets `text-bg`.
 *
 * PERFORMANCE — the tiles cost nothing per frame, like everything else in this
 * shared scroll flow: the halo is a box-shadow, declared at rest at its full hover
 * geometry with a ZERO-ALPHA colour, so only the alpha interpolates and it fades in
 * place instead of growing out of the tile's edge (which is what `none` → shadow
 * would do). No blur, no filter, nothing to re-rasterise while you scroll.
 */

type Tile = {
  key: string;
  /** Accessible name — the visible face is icon-only. */
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  gradient: string;
  /** Hover halo. */
  glow: string;
  /** Same RGB, zero alpha — the rest state, so the halo can fade in place. */
  glowOff: string;
  /** Ink once the gradient is up. A LITERAL class: Tailwind scans source text. */
  ink: string;
};

const INSTAGRAM: Tile = {
  key: "instagram",
  name: "Instagram",
  icon: InstagramIcon,
  gradient:
    "linear-gradient(135deg, #ff6a3d 0%, #f9354f 38%, #e1306c 68%, #c13584 100%)",
  glow: "rgba(225,48,108,0.55)",
  glowOff: "rgba(225,48,108,0)",
  ink: "group-hover:text-white",
};

const MAIL: Tile = {
  key: "mail",
  name: "E-mail",
  icon: MailIcon,
  // The palette's own mint, pushed to a gradient — the middle tile is the one
  // that isn't a foreign brand, so it wears the site's colour, not a borrowed one.
  gradient: "linear-gradient(135deg, #6ef5bd 0%, #3ddc97 45%, #1c9670 100%)",
  glow: "rgba(61,220,151,0.5)",
  glowOff: "rgba(61,220,151,0)",
  ink: "group-hover:text-bg",
};

const FACEBOOK: Tile = {
  key: "facebook",
  name: "Facebook",
  icon: FacebookIcon,
  // Three stops, ending on a deep blue rather than a near-navy — the far corner of
  // a 135deg ramp is the tile's bottom-right, and this one used to bottom out at
  // #0d1b4b, whose luminance (27) is nowhere near the corner the other two tiles
  // land on (IG 88, mail 121). Beside them it read as a dead, sooty corner rather
  // than a colour. #2a4bb8 (76) sits in family and still says „granatowy".
  // Any restyle here should be checked against those three numbers, not by eye.
  gradient: "linear-gradient(135deg, #5aa9ff 0%, #1877f2 45%, #2a4bb8 100%)",
  glow: "rgba(24,119,242,0.55)",
  glowOff: "rgba(24,119,242,0)",
  ink: "group-hover:text-white",
};

// p-[1.5px] IS the rim, so the face's radius has to be the outer radius minus it,
// or the corners stop being concentric.
const SHELL =
  "group relative block h-[4.75rem] rounded-2xl p-[1.5px] transition-shadow duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none sm:h-[5.5rem]";
const FACE =
  "relative flex h-full w-full items-center justify-center gap-2 rounded-[calc(1rem-1.5px)] transition-colors duration-300 motion-reduce:transition-none";
/**
 * The rest face, and the whole trick: `group-hover:bg-transparent` is what lets
 * the shell's gradient through, so the tile becomes the colour it was only
 * wearing as a rim. It sits beside `bg-surface-deep` rather than replacing it
 * because `cn` is a plain joiner with NO tailwind-merge (lib/utils) — nothing here
 * resolves conflicts, and it doesn't need to: a `group-hover:` variant already
 * outranks the bare utility on specificity, so the two coexist by design.
 */
const FACE_REST =
  "bg-surface-deep text-paper/75 group-hover:bg-transparent";
const GLOW_ON = "shadow-[0_16px_44px_-14px_var(--tile-glow)]";
const GLOW_OFF =
  "shadow-[0_16px_44px_-14px_var(--tile-glow-off)] hover:shadow-[0_16px_44px_-14px_var(--tile-glow)]";

/**
 * The rest icon leaves toward the top-right as the hover icon arrives from the
 * bottom-left, so the swap reads as one object handing over to the next.
 *
 * The transition names `translate` and `scale` rather than `transform`, and that
 * is load-bearing: Tailwind v4 compiles those utilities to the individual CSS
 * properties of the same name, so an arbitrary `transition-[opacity,transform]`
 * here would animate precisely nothing. (Bare `transition-transform` is safe — v4
 * expands it to all four — but it can't carry opacity along.)
 */
const SWAP_OUT =
  "col-start-1 row-start-1 size-full transition-[opacity,translate,scale] duration-300 ease-out group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:scale-90 group-hover:opacity-0 motion-reduce:transition-none";
const SWAP_IN =
  "col-start-1 row-start-1 size-full -translate-x-1 translate-y-1 scale-90 opacity-0 transition-[opacity,translate,scale] duration-300 ease-out group-hover:translate-x-0 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 motion-reduce:transition-none";

function IconSwap({
  Rest,
  Hover,
}: {
  Rest: ComponentType<SVGProps<SVGSVGElement>>;
  Hover: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  return (
    <span className="relative grid size-6 place-items-center sm:size-7">
      <Rest aria-hidden className={SWAP_OUT} />
      <Hover aria-hidden className={SWAP_IN} />
    </span>
  );
}

/** Per-tile entrance travel + stagger → the props the .why-in class reads. */
const rise = (delay: number, y = 30): CSSProperties =>
  ({ "--rise-delay": `${delay}s`, "--rise-y": `${y}px` }) as CSSProperties;

const shellStyle = (t: Tile, delay: number): CSSProperties => ({
  background: t.gradient,
  ...({
    "--tile-glow": t.glow,
    "--tile-glow-off": t.glowOff,
  } as CSSProperties),
  ...rise(delay),
});

/**
 * Clipboard with a fallback, because navigator.clipboard is simply UNDEFINED
 * outside a secure context — and previewing this site from a phone on the LAN
 * (http://192.168.x.x, cf. allowedDevOrigins in next.config) is exactly that.
 * Without the fallback the tile would look broken in one of the places it's most
 * likely to be tried.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused, or the document wasn't focused — try the legacy path before
    // giving up on the visitor.
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

const COPIED_MS = 2200;

function LinkTile({
  tile,
  href,
  delay,
  revealed,
}: {
  tile: Tile;
  href: string;
  delay: number;
  revealed: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${tile.name} — otwiera się w nowej karcie`}
      style={shellStyle(tile, delay)}
      className={cn(SHELL, GLOW_OFF, revealed ? "why-in" : "opacity-0")}
    >
      <span className={cn(FACE, FACE_REST, tile.ink)}>
        <IconSwap Rest={tile.icon} Hover={ArrowUpRightIcon} />
      </span>
    </a>
  );
}

function MailTile({ delay, revealed }: { delay: number; revealed: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onClick = async () => {
    if (!(await copyText(CONTACT.email))) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        // The address rides on the accessible name AND the tooltip, so it stays
        // reachable even in the one case copyText() can't recover from.
        title={CONTACT.email}
        aria-label={`Skopiuj adres e-mail: ${CONTACT.email}`}
        style={shellStyle(MAIL, delay)}
        className={cn(
          SHELL,
          "cursor-pointer",
          copied ? GLOW_ON : GLOW_OFF,
          revealed ? "why-in" : "opacity-0",
        )}
      >
        {/* Copied WINS over hover: it holds the gradient up on its own rather
            than borrowing the hover's, so the confirmation survives the pointer
            leaving — and on touch, where there is no hover at all, that's the
            only reason the state is ever seen. */}
        <span
          className={cn(
            FACE,
            copied ? "bg-transparent text-bg" : cn(FACE_REST, MAIL.ink),
          )}
        >
          {copied ? (
            <>
              <CheckIcon aria-hidden className="size-5 shrink-0 sm:size-6" />
              <span className="font-geist text-[0.78rem] font-semibold tracking-[-0.01em]">
                Skopiowano!
              </span>
            </>
          ) : (
            <IconSwap Rest={MAIL.icon} Hover={CopyIcon} />
          )}
        </span>
      </button>
      {/* The confirmation is a colour change and a word swapped inside a button's
          own label — neither of which a screen reader announces by itself. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Skopiowano adres e-mail" : ""}
      </span>
    </>
  );
}

export function ContactTiles({ revealed }: { revealed: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      <LinkTile
        tile={INSTAGRAM}
        href={CONTACT.instagram}
        delay={0.22}
        revealed={revealed}
      />
      <MailTile delay={0.3} revealed={revealed} />
      <LinkTile
        tile={FACEBOOK}
        href={CONTACT.facebook}
        delay={0.38}
        revealed={revealed}
      />
    </div>
  );
}
