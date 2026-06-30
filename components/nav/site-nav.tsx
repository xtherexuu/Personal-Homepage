"use client";

import { useEffect, useRef, type MouseEvent } from "react";

import { MenuToggle } from "@/components/ui/menu-toggle";
import { useSection } from "@/components/sections/section-context";
import { cn } from "@/lib/utils";

/**
 * SiteNav — section navigation for the single-page deck.
 *
 * Desktop (lg+): a fixed vertical rail pinned to the right edge and vertically
 * centred. Each section is a label stacked above a bar; the active section gets a
 * thicker bar that elongates leftward with a mint glow and a larger mint label,
 * while the rest stay tiny and muted.
 *
 * Mobile (<lg): the rail collapses to a hamburger in the top-right corner (the
 * MenuToggle, which morphs into a close arrow on open). Opening it covers the
 * whole viewport with a blurred dark overlay listing the sections in large
 * display type, staggered in.
 *
 * Active state and navigation come from the <SectionDeck> via context — clicking
 * a section crossfades the deck to it (no native scrolling). Sections that aren't
 * built yet are listed but simply don't navigate.
 */

type Section = { id: string; label: string };

const SECTIONS: Section[] = [
  { id: "hero", label: "Główna" },
  { id: "czemu-ja", label: "Dlaczego ja?" },
  { id: "portfolio", label: "Projekty" },
  { id: "oferta", label: "Oferta" },
  { id: "proces", label: "Proces współpracy" },
  { id: "faq", label: "FAQ" },
  { id: "kontakt", label: "Kontakt" },
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

  // Crossfade the deck to a section, then close the overlay. The links keep an
  // href (SEO / right-click), but navigation is JS-driven so prevent the default.
  const go = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    goToSection(id);
    setOpen(false);
  };

  return (
    <>
      {/* ---------- Desktop rail ---------- */}
      <nav
        aria-label="Sekcje strony"
        className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 select-none flex-col items-end gap-5 pr-5 lg:flex 2xl:gap-6 2xl:pr-8"
      >
        {SECTIONS.map((s) => {
          const isActive = activeSection === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={go(s.id)}
              aria-current={isActive ? "true" : undefined}
              className="group flex flex-col items-end gap-1.5 rounded-sm py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-mint/60 focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
            >
              <span
                className={cn(
                  "whitespace-nowrap text-right font-mono uppercase [text-shadow:0_1px_2px_rgba(11,26,28,0.95),0_0_10px_rgba(11,26,28,0.85)] transition-all duration-500",
                  EASE,
                  isActive
                    ? "text-[0.84rem] tracking-[0.2em] text-mint drop-shadow-[0_0_14px_rgba(61,220,151,0.45)]"
                    : "text-[0.6rem] tracking-[0.18em] text-muted/65 group-hover:text-muted",
                )}
              >
                {s.label}
              </span>
              <span
                className={cn(
                  "rounded-full transition-all duration-500",
                  EASE,
                  isActive
                    ? "h-[3px] w-14 bg-mint shadow-[0_0_16px_-1px_rgba(61,220,151,0.75)]"
                    : "h-[2px] w-6 bg-muted/40 group-hover:w-9 group-hover:bg-muted/70",
                )}
              />
            </a>
          );
        })}
      </nav>

      {/* ---------- Mobile hamburger (top-right) ---------- */}
      <div className="fixed right-4 top-4 z-[70] lg:hidden">
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
