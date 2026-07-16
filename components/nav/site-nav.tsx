"use client";

import {
  type ComponentType,
  type MouseEvent,
  type SVGProps,
  useEffect,
  useRef,
} from "react";
import {
  EnvelopeIcon,
  HomeIcon,
  SparklesIcon,
  TagIcon,
} from "@heroicons/react/24/solid";

import { MenuToggle } from "@/components/ui/menu-toggle";
import { useSection } from "@/components/sections/section-context";
import { cn } from "@/lib/utils";

/**
 * SiteNav — section navigation for the single-page deck.
 *
 * Desktop (lg+): a fixed vertical rail of icon buttons pinned to the right edge
 * and vertically centred (after sarthakmishra.com). A single solid --mint tile sits
 * behind the ACTIVE icon and glides to it as the section changes; the active icon
 * goes white on the mint, the rest stay near-white with a dark halo so they read
 * over the hero photo. Hovering / focusing an icon reveals
 * its Polish label in a pill to the LEFT (the rail hugs the right edge, so labels
 * open into the screen). The tile's offset is a deterministic inline transform
 * (active index × --pitch), so SSR and first paint agree — no hydration jump.
 *
 * Mobile (<lg): the rail collapses to a hamburger in the top-right corner (the
 * MenuToggle, which morphs into a close arrow on open). Opening it covers the
 * whole viewport with a blurred dark overlay listing the sections in large
 * display type, staggered in.
 *
 * Active state and navigation come from the <SectionDeck> via context — clicking
 * a section runs the deck's wipe transition to it (no native scrolling). Sections
 * that aren't built yet are listed but simply don't navigate.
 */

type Section = {
  id: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const SECTIONS: Section[] = [
  { id: "hero", label: "Główna", icon: HomeIcon },
  { id: "czemu-ja", label: "Dlaczego ja?", icon: SparklesIcon },
  { id: "oferta", label: "Oferta", icon: TagIcon },
  { id: "kontakt", label: "Kontakt", icon: EnvelopeIcon },
];

// Soft expo easing — the same curve the hero entrance uses, so the rail and
// overlay share the site's motion vocabulary.
const EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

export function SiteNav() {
  const {
    activeSection,
    go: goToSection,
    menuOpen: open,
    setMenuOpen: setOpen,
  } = useSection();

  // Single source of truth for the rail: the active section's slot index drives
  // the sliding tile's offset, the aria-current flag, and the active icon colour,
  // so they can never point at different icons. Clamped ≥ 0 as a safety net (the
  // active section is always one of SECTIONS, so this is really always 0..6).
  const activeIndex = Math.max(
    0,
    SECTIONS.findIndex((s) => s.id === activeSection),
  );

  const toggleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const prevOpen = useRef(false);

  // While the overlay is open: lock body scroll and close on Escape.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  // Drop the overlay if the viewport grows past the desktop breakpoint (the rail
  // takes over there).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    onChange(); // reconcile current state, not only future breakpoint flips
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setOpen]);

  // Move focus into the overlay when it opens and back to the toggle when it
  // closes — only on real transitions, so StrictMode's double-invoked mount effect
  // can't steal focus on first paint.
  useEffect(() => {
    const was = prevOpen.current;
    prevOpen.current = open;
    if (open && !was) {
      // Defer past the overlay's visibility transition — focusing on the same
      // tick the element unhides is a no-op, so wait one timer turn.
      const t = setTimeout(
        () => menuRef.current?.querySelector<HTMLElement>("a")?.focus(),
        0,
      );
      return () => clearTimeout(t);
    }
    // Only restore focus to the toggle when it's actually visible — on a
    // breakpoint-driven close (now at lg) it's display:none and .focus() would
    // silently drop focus to <body>; leave focus where it is instead.
    if (!open && was && toggleRef.current?.offsetParent != null) {
      toggleRef.current.focus();
    }
  }, [open]);

  // Keep Tab within the open overlay (toggle + the section links).
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (!open || e.key !== "Tab") return;
    const focusables: HTMLElement[] = [];
    if (toggleRef.current) focusables.push(toggleRef.current);
    menuRef.current
      ?.querySelectorAll<HTMLElement>("a[href]")
      .forEach((el) => focusables.push(el));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const activeEl = document.activeElement as HTMLElement | null;
    if (e.shiftKey && activeEl === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && activeEl === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Wipe the deck to a section, then close the overlay. The links keep an
  // href (SEO / right-click), but navigation is JS-driven so prevent the default.
  const go = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    goToSection(id);
    setOpen(false);
  };

  return (
    <>
      {/* ---------- Desktop rail — icon buttons + sliding mint tile ---------- */}
      <nav
        aria-label="Sekcje strony"
        className="group/rail fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 isolate select-none flex-col items-center gap-0 [--pitch:3.25rem] lg:flex xl:right-5 2xl:right-6 3xl:right-10 3xl:[--pitch:3.75rem]"
      >
        {/* Grey backing panel — fades in behind the icons whenever the rail is
            hovered (after sarthakmishra.com). Sits below the tile + icons and
            spills a little past them (-inset-2) for breathing room. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-2 -z-10 rounded-3xl bg-surface/80 opacity-0 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] ring-1 ring-line backdrop-blur-md transition-opacity duration-300 group-hover/rail:opacity-100 motion-reduce:transition-none"
        />
        {/* Sliding accent tile — parked behind the active icon, glides between
            slots. Decorative (aria-hidden); its offset is a deterministic inline
            transform so it lands correctly on the very first paint. */}
        <span
          aria-hidden
          style={{ transform: `translateY(calc(var(--pitch) * ${activeIndex}))` }}
          className="pointer-events-none absolute left-0 top-0 z-0 h-[var(--pitch)] w-[var(--pitch)] rounded-2xl bg-mint shadow-[0_0_22px_-4px_rgba(61,220,151,0.6)] transition-transform duration-500 ease-[cubic-bezier(0.34,1.55,0.64,1)] motion-reduce:transition-none"
        />
        {SECTIONS.map((s) => {
          const isActive = activeSection === s.id;
          const Icon = s.icon;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={go(s.id)}
              aria-label={s.label}
              aria-current={isActive ? "true" : undefined}
              className="group relative z-10 flex h-[var(--pitch)] w-[var(--pitch)] items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <Icon
                aria-hidden
                className={cn(
                  "size-6 transition-colors duration-300 group-hover:[animation:nav-icon-wiggle_0.5s_ease-in-out] 3xl:size-7",
                  isActive
                    ? "text-white"
                    : "text-paper/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] group-hover:text-paper group-focus-visible:text-paper",
                )}
              />
              {/* Label pill — revealed to the LEFT on hover / keyboard focus.
                  Purely decorative (aria-hidden): the accessible name already
                  lives on the link's aria-label, so screen-reader and keyboard
                  users get it regardless of this visual hint. */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-md border border-line bg-surface/90 px-2.5 py-1 text-xs font-medium text-paper opacity-0 shadow-lg backdrop-blur-sm transition duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none",
                )}
              >
                {s.label}
              </span>
            </a>
          );
        })}
      </nav>

      {/* ---------- Mobile hamburger (top-right) ---------- */}
      {/* right-5 keeps the button clear of the section's custom scrollbar (the
          scroll region runs full-width on mobile, so its bar sits at this edge). */}
      <div className="fixed right-5 top-4 z-[70] lg:hidden">
        <div
          ref={toggleRef}
          role="button"
          tabIndex={0}
          aria-label={open ? "Zamknij menu" : "Otwórz menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(!open);
            } else {
              onMenuKeyDown(e);
            }
          }}
          className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-line bg-surface/40 text-paper backdrop-blur-md transition-colors duration-200 hover:bg-surface/70 hover:text-mint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <MenuToggle
            open={open}
            onOpenChange={setOpen}
            strokeWidth={2.25}
            className="size-5"
          />
        </div>
      </div>

      {/* ---------- Mobile full-screen overlay ---------- */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu nawigacji"
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-[60] select-none transition-[opacity,visibility] duration-500 lg:hidden",
          EASE,
          open ? "visible opacity-100" : "pointer-events-none invisible opacity-0",
        )}
      >
        <div className="absolute inset-0 bg-[#0b1a1c]/95 backdrop-blur-2xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 55% at 85% 15%, rgba(61,220,151,0.12), transparent 70%)",
          }}
        />

        {/* brand wordmark — balances the close button and frames the menu */}
        <span className="absolute left-8 top-6 font-mono text-[0.62rem] uppercase tracking-[0.28em] text-muted/70 sm:left-12">
          Bartosz Załęski
        </span>

        <nav
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
          className="relative flex h-full flex-col overflow-y-auto"
        >
          <ul className="m-auto flex w-full flex-col gap-1 px-8 py-24 sm:px-12">
            {SECTIONS.map((s, i) => {
              const isActive = activeSection === s.id;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={go(s.id)}
                    aria-current={isActive ? "true" : undefined}
                    style={{ transitionDelay: open ? `${i * 55 + 90}ms` : "0ms" }}
                    className={cn(
                      "group flex w-fit items-baseline gap-4 rounded-md py-1.5 pr-2 outline-none transition-[transform,opacity] duration-500 focus-visible:ring-2 focus-visible:ring-mint/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg sm:gap-6",
                      EASE,
                      open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                    )}
                  >
                    <span
                      className={cn(
                        "font-mono text-xs tabular-nums transition-colors duration-300",
                        isActive ? "text-mint" : "text-muted/50",
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "font-display font-semibold leading-[1.04] tracking-[-0.01em] text-[clamp(1.85rem,9vw,3.6rem)] transition-[color,transform] duration-300 group-hover:translate-x-1.5 group-focus-visible:translate-x-1.5",
                        isActive
                          ? "text-mint drop-shadow-[0_0_24px_rgba(61,220,151,0.35)]"
                          : "text-paper group-hover:text-mint group-focus-visible:text-mint",
                      )}
                    >
                      {s.label}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}
