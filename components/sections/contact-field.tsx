import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { type ReactNode } from "react";

/**
 * The „Wiadomość" form's field chrome — label, error line, and the input skin
 * itself, kept in one module because the form does NOT use one kind of control.
 * „Temat" is a hand-built listbox on a <button> (see TopicSelect); everything
 * else is a native <input> / <textarea>. Nothing but these exact strings sells
 * them as the same control, so they live here rather than being restated in each
 * file and quietly drifting apart.
 *
 * The glass is a translucent white wash, not a palette colour: the window these
 * sit on is --surface-deep, the darkest ink on the site, and a field has to lift
 * off it without introducing a fourth green. 4% white does that, and keeps
 * working if the window's ground is ever re-tinted.
 *
 * Focus is `focus-visible`, not `focus` — clicking into a field shouldn't light a
 * ring, but tabbing to it must.
 */

export const FIELD_BASE =
  "w-full rounded-xl border border-line bg-paper/[0.04] px-4 py-3 text-[0.98rem] text-paper outline-none transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-muted/50 hover:bg-paper/[0.07] focus-visible:border-mint/60 focus-visible:bg-paper/[0.07] focus-visible:ring-2 focus-visible:ring-mint/25 motion-reduce:transition-none";

/**
 * Layered AFTER FIELD_BASE, so it has to restate every state it means to win —
 * a bare `border-danger` would be overridden by the base's own hover/focus rules,
 * which is exactly how an invalid field ends up looking valid the moment you
 * touch it.
 */
export const FIELD_INVALID =
  "border-danger/70 bg-danger/[0.06] hover:bg-danger/[0.09] focus-visible:border-danger focus-visible:bg-danger/[0.09] focus-visible:ring-danger/25";

export function Field({
  label,
  htmlFor,
  required = false,
  error,
  errorId,
  children,
}: {
  label: string;
  /** Omitted for TopicSelect — its trigger is a button, not a labelable control. */
  htmlFor?: string;
  required?: boolean;
  error?: string;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div>
      {/* The asterisk is decorative: `required` is carried to assistive tech by
          aria-required on the control itself, so announcing it twice would be
          noise. Optional fields say so in words instead — „Twój budżet" is the
          one field a visitor may skip, and it should look skippable. */}
      <label
        htmlFor={htmlFor}
        className="mb-2 flex items-baseline gap-2 font-mono text-[0.66rem] uppercase tracking-[0.22em] text-muted"
      >
        {label}
        {required ? (
          <span aria-hidden className="text-mint">
            *
          </span>
        ) : (
          <span aria-hidden className="text-[0.62rem] normal-case tracking-[0.1em] text-muted/50">
            — opcjonalne
          </span>
        )}
      </label>

      {children}

      {/* Kept out of the DOM until it applies, so aria-describedby resolves to
          nothing while the field is still valid. */}
      {error && (
        <p
          id={errorId}
          className="mt-2 flex items-center gap-1.5 text-[0.8rem] leading-snug text-danger"
        >
          <ExclamationCircleIcon aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
