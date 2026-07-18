"use client";

import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { TOPIC_GROUPS, TOPIC_OPTIONS, topicLabel } from "@/lib/contact";
import { cn } from "@/lib/utils";
import { FIELD_BASE, FIELD_INVALID } from "./contact-field";

/**
 * TopicSelect — „Temat", the one field that isn't a native control.
 *
 * A <select> can't be styled into the rest of this form (the option list is drawn
 * by the OS, not the page), so this is the APG select-only combobox: a <button>
 * with role="combobox" that owns a role="listbox" popup. Focus never leaves the
 * button — the highlighted option is published via aria-activedescendant — which
 * is what keeps the whole thing one tab stop, exactly like the <select> it stands
 * in for.
 *
 * THE DECK IS THE HAZARD HERE. SectionDeck listens for Arrow / Page keys on
 * `window` and steps whole PANELS with them, and it wheel-jacks the page too. So:
 *
 *   • every key this listbox claims calls stopPropagation() as well as
 *     preventDefault() — React attaches its listeners at the root container, which
 *     is BELOW window, so stopping there is what keeps ArrowDown from picking an
 *     option and wiping the page to the hero in the same keystroke;
 *   • the popup is deliberately NOT marked [data-deck-scroll]. That attribute
 *     looks like the way to let it scroll, but it's a trap: the deck reads it as
 *     "this region owns the gesture", and the moment the popup hit its last option
 *     the deck would see a region with no room left and step the panel. Unmarked +
 *     `overscroll-contain`, the browser scrolls the popup natively and simply stops
 *     at its end.
 *
 * The menu's DATA lives in lib/contact.ts, not here: the /api/contact route
 * validates submissions against the same TOPIC_GROUPS this menu renders from, and
 * a "use client" module is off-limits to a route handler. This file is only the
 * control.
 */

/** Menu order with the groups flattened away — what the arrow keys actually walk. */
const FLAT = TOPIC_OPTIONS;

/** Must match the popup's `max-h-72`, since the flip below is measured against it. */
const POPUP_MAX_PX = 288;

export function TopicSelect({
  id,
  value,
  onChange,
  invalid = false,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (v: string) => `${uid}-opt-${v}`;

  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = topicLabel(value);

  // Measured HERE rather than in a layout effect: this runs before the popup is
  // ever rendered, so both state updates land in the same commit and it opens in
  // the right place on its first painted frame. A layout effect would also warn
  // on the server, since this component still SSRs.
  const openMenu = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) {
      const below = window.innerHeight - r.bottom;
      setDropUp(below < POPUP_MAX_PX + 24 && r.top > below);
    }
    setActive(value || FLAT[0].value);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const choose = (v: string) => {
    onChange(v);
    close();
  };

  // Pointerdown, not click: a press that starts outside should dismiss the menu
  // immediately, the way a real select does.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keyboard walking can outrun the popup's own scroll — `nearest` moves it the
  // minimum needed and leaves the page alone when the option is already visible.
  useEffect(() => {
    if (!open || !active) return;
    document
      .getElementById(`${uid}-opt-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active, uid]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    // Claim: keep the key away from BOTH the browser default and the deck's
    // window-level panel stepper (see the header note).
    const claim = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    const k = e.key;

    if (k === "Escape") {
      if (open) {
        claim();
        close();
      }
      return;
    }
    // Let focus leave — but never leave an orphaned menu open behind it.
    if (k === "Tab") {
      setOpen(false);
      return;
    }
    if (k === "ArrowDown" || k === "ArrowUp" || k === "Home" || k === "End") {
      claim();
      if (!open) {
        openMenu();
        return;
      }
      const i = Math.max(
        0,
        FLAT.findIndex((o) => o.value === active),
      );
      const next =
        k === "Home"
          ? 0
          : k === "End"
            ? FLAT.length - 1
            : Math.min(
                FLAT.length - 1,
                Math.max(0, i + (k === "ArrowDown" ? 1 : -1)),
              );
      setActive(FLAT[next].value);
      return;
    }
    if (k === "Enter" || k === " ") {
      claim(); // also stops Space/Enter re-firing this as a click
      if (!open) openMenu();
      else if (active) choose(active);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        // Only while the popup exists — it's unmounted when closed, and pointing
        // aria-controls at an id that isn't in the DOM is worse than omitting it.
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active ? optionId(active) : undefined}
        aria-required
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          FIELD_BASE,
          "flex items-center justify-between gap-3 text-left",
          invalid && FIELD_INVALID,
        )}
      >
        <span className={cn("truncate", selected ? "text-paper" : "text-muted/50")}>
          {selected ?? "Wybierz temat…"}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Temat wiadomości"
          className={cn(
            // z-30 clears the fields below it; overscroll-contain stops a flick
            // inside the menu from scrolling the page once it bottoms out.
            "absolute inset-x-0 z-30 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)]",
            dropUp ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {TOPIC_GROUPS.map((g) => (
            <div
              key={g.key}
              role="group"
              aria-labelledby={`${uid}-grp-${g.key}`}
              className="border-t border-line pt-1.5 first:border-0 first:pt-0"
            >
              <div
                id={`${uid}-grp-${g.key}`}
                role="presentation"
                className="px-3 pb-1 pt-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted/70"
              >
                {g.label}
              </div>
              {g.options.map((o) => {
                const isActive = o.value === active;
                const isSelected = o.value === value;
                return (
                  <div
                    key={o.value}
                    id={optionId(o.value)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(o.value)}
                    // Hover and keyboard drive the SAME highlight, so the menu
                    // can never show two "current" rows at once.
                    onPointerEnter={() => setActive(o.value)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[0.92rem] leading-snug transition-colors duration-100 motion-reduce:transition-none",
                      isActive ? "bg-mint/15" : "bg-transparent",
                      isSelected ? "text-mint" : "text-paper/85",
                    )}
                  >
                    <span>{o.label}</span>
                    {isSelected && (
                      <CheckIcon aria-hidden className="size-4 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
