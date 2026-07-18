"use client";

import {
  ArrowPathIcon,
  CheckIcon,
  ExclamationCircleIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  FUTURE_CLIENT_GROUP,
  LIMITS,
  OTHER_TOPIC,
  topicGroupOf,
  type ContactRequest,
} from "@/lib/contact";
import { CONTACT } from "@/lib/site";
import { cn } from "@/lib/utils";
import { onPickContactTopic } from "./contact-intent";
import { Field, FIELD_BASE, FIELD_INVALID } from "./contact-field";
import { TopicSelect } from "./topic-select";

/**
 * ContactForm — the „Wiadomość" window: a macOS app frame (traffic lights, a
 * centred title, a hairline under the bar) wrapped around the enquiry form.
 *
 * The frame is a joke the visitor is in on — this IS a message being composed, so
 * it's drawn as the thing you'd compose it in. The lights are aria-hidden and do
 * nothing: they're chrome, and a fake close button that closed something would be
 * worse than one that doesn't.
 *
 * THE WINDOW MUST NOT CLIP. There's no `overflow-hidden` here and that isn't an
 * oversight — „Temat" opens a popup that has to be able to leave the frame. The
 * title bar therefore rounds its own top corners (outer radius minus the 1px
 * border) instead of being cropped by the parent, which is what an overflow rule
 * would otherwise be there to do.
 *
 * The form shapes itself around the one answer that matters. „Temat" is not just a
 * field, it's the fork: a „Przyszli klienci" topic means someone is buying, so the
 * optional „Twój budżet" appears; „Inny" means the menu failed them, so a required
 * free-text subject appears instead. Both ride in <Reveal>, which is also why they
 * can't simply be conditionally rendered — see its own note.
 *
 * Validation is DERIVED, never stored: `errors` is recomputed from `values` on
 * every render once the form has been submitted once. Keeping an errors state in
 * sync with a values state is the classic way to end up showing an error for text
 * the visitor has already fixed, and there's nothing here worth that risk — the
 * whole check is six string tests. Nothing is validated before the first submit,
 * so the form doesn't shout at someone who is merely mid-way through typing their
 * e-mail.
 */

type Values = {
  firstName: string;
  lastName: string;
  email: string;
  topic: string;
  customTopic: string;
  budget: string;
  message: string;
};

type FieldName = keyof Values;
type Errors = Partial<Record<FieldName, string>>;

const EMPTY: Values = {
  firstName: "",
  lastName: "",
  email: "",
  topic: "",
  customTopic: "",
  budget: "",
  message: "",
};

/** Stable identity, so an un-submitted form isn't handed a new object each render. */
const NO_ERRORS: Errors = Object.freeze({});

/** Focus order for "jump to the first thing that's wrong" — the visual order. */
const ORDER: readonly FieldName[] = [
  "firstName",
  "lastName",
  "email",
  "topic",
  "customTopic",
  "message",
];

/**
 * Deliberately permissive: something@something.something. Every stricter regex in
 * circulation rejects addresses that genuinely receive mail, and the only real
 * test of an address is whether the reply arrives — which no regex can run.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(v: Values): Errors {
  const e: Errors = {};
  if (!v.firstName.trim()) e.firstName = "Podaj imię.";
  if (!v.lastName.trim()) e.lastName = "Podaj nazwisko.";
  if (!v.email.trim()) e.email = "Podaj adres e-mail.";
  else if (!EMAIL_RE.test(v.email.trim()))
    e.email = "Ten adres e-mail wygląda na niepoprawny.";
  if (!v.topic) e.topic = "Wybierz temat wiadomości.";
  // Only when it's on screen — see Reveal. A stale „Inny" subject left behind by a
  // changed mind must never block the form.
  if (v.topic === OTHER_TOPIC && !v.customTopic.trim())
    e.customTopic = "Wpisz temat swojej wiadomości.";
  if (!v.message.trim()) e.message = "Napisz wiadomość.";
  return e;
}

/**
 * The wire format is the RAW values (plus the honeypot), not a resolved subject —
 * /api/contact re-derives the subject from lib/contact's topic data itself, so the
 * server validates against an allowlist instead of trusting client-composed text.
 */
function toRequest(v: Values, website: string): ContactRequest {
  return {
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    email: v.email.trim(),
    topic: v.topic,
    customTopic: v.topic === OTHER_TOPIC ? v.customTopic.trim() : "",
    budget:
      topicGroupOf(v.topic) === FUTURE_CLIENT_GROUP ? v.budget.trim() : "",
    message: v.message.trim(),
    website,
  };
}

type SendResult = { ok: true } | { ok: false; message: string };

const GENERIC_ERROR = `Coś poszło nie tak przy wysyłaniu. Spróbuj ponownie albo napisz bezpośrednio na ${CONTACT.email}.`;
const RATE_LIMITED = `Sporo wiadomości w krótkim czasie — odczekaj chwilę i spróbuj ponownie, albo napisz bezpośrednio na ${CONTACT.email}.`;

/**
 * Delivery = POST /api/contact (route handler + SMTP). The route answers with a
 * bare status: 2xx means "accepted and handed to the mailbox", 429 means the
 * per-IP limiter said no, anything else is not the visitor's problem to decode —
 * the panel below already points at the address that always works.
 *
 * This function never throws: a network failure is a SendResult like any other,
 * so the UI always has something to SAY. Never return `{ ok: true }` from
 * something that didn't send — the success panel is a promise that I'll reply.
 */
async function sendMessage(payload: ContactRequest): Promise<SendResult> {
  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    return {
      ok: false,
      message: res.status === 429 ? RATE_LIMITED : GENERIC_ERROR,
    };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

type Status = "idle" | "sending" | "sent" | "error";

/**
 * Reveal — the wrapper the two conditional fields ride in.
 *
 * grid-template-rows 0fr → 1fr is the only way to animate to a height nobody has
 * measured, and it needs an `overflow-hidden` child to crop the collapsing row.
 * That crop is the catch: a full-width clipper around a full-width input slices
 * the focus RING off its own field. Hence -mx-2 / px-2 — the clipper is pushed 8px
 * wider on each side while its padding puts the field back exactly where the rest
 * of the form's fields sit, so the ring has somewhere to land.
 *
 * `inert` is the other half. A collapsed field is still in the DOM: without it the
 * form quietly offers „Twój budżet" to a keyboard or screen-reader user who never
 * picked a topic that has one — visible only to the people least able to work out
 * why it's there.
 */
function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div
      inert={!show}
      className={cn(
        "-mx-2 grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
        show ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="overflow-hidden px-2">
        <div className="pb-1 pt-5">{children}</div>
      </div>
    </div>
  );
}

const TRAFFIC_LIGHTS = ["bg-[#ff5f57]", "bg-[#febc2e]", "bg-[#28c840]"];

const CTA =
  "group/cta inline-flex w-full cursor-pointer items-center justify-center gap-[0.55em] rounded-full bg-amber px-[1.4em] py-[0.85em] text-center font-geist font-semibold tracking-[-0.01em] text-bg shadow-[0_12px_34px_-10px_rgba(232,146,58,0.6)] transition-[translate,background-color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:bg-amber-strong hover:shadow-[0_18px_44px_-12px_rgba(232,146,58,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:translate-y-0 disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none sm:w-auto text-[clamp(0.98rem,0.94rem+0.2vw,1.1rem)]";

export function ContactForm({ style, revealed }: { style?: CSSProperties; revealed: boolean }) {
  const uid = useId();
  const fid = (k: FieldName) => `${uid}-${k}`;
  const eid = (k: FieldName) => `${uid}-${k}-error`;

  const [values, setValues] = useState<Values>(EMPTY);
  // Honeypot — deliberately OUTSIDE `values`: it must never enter validate() or
  // ORDER, because no human can see the field, let alone fix an "error" in it.
  const [website, setWebsite] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [sendError, setSendError] = useState<string | null>(null);

  // A „Moja oferta" CTA scrolled the visitor here for a specific package — set
  // that „Temat" and nothing else, so whatever they'd already typed is untouched.
  // Only the topic changes hands; the deck does the scrolling (see contact-intent).
  useEffect(
    () => onPickContactTopic((topic) => setValues((p) => ({ ...p, topic }))),
    [],
  );

  const errors = submitted ? validate(values) : NO_ERRORS;
  const isOther = values.topic === OTHER_TOPIC;
  const isFuture = topicGroupOf(values.topic) === FUTURE_CLIENT_GROUP;

  const set =
    (k: FieldName) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((p) => ({ ...p, [k]: e.target.value }));

  const reset = () => {
    setValues(EMPTY);
    setWebsite("");
    setSubmitted(false);
    setSendError(null);
    setStatus("idle");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    const errs = validate(values);
    const firstBad = ORDER.find((k) => errs[k]);
    if (firstBad) {
      // Deferred, because the error text — and the aria-describedby pointing at
      // it — only exist once THIS render commits; focusing synchronously would
      // announce the field without ever saying what's wrong with it. Submit is a
      // discrete event, so React has flushed by the time a macrotask runs.
      //
      // A timeout rather than rAF on purpose: rAF is paused entirely while the
      // document is hidden, which would strand focus if the tab is switched
      // between the click and the callback. Nothing here needs a painted frame.
      setTimeout(() => document.getElementById(fid(firstBad))?.focus(), 0);
      return;
    }

    setStatus("sending");
    setSendError(null);
    try {
      const res = await sendMessage(toRequest(values, website));
      if (res.ok) {
        setStatus("sent");
        return;
      }
      setSendError(res.message);
      setStatus("error");
    } catch {
      setSendError(GENERIC_ERROR);
      setStatus("error");
    }
  };

  const describedBy = (k: FieldName) => (errors[k] ? eid(k) : undefined);

  return (
    <div
      style={style}
      className={cn(
        // NO overflow-hidden — see the note at the top of this file.
        "rounded-2xl border border-line bg-surface-deep shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)]",
        revealed ? "why-in" : "opacity-0",
      )}
    >
      {/* ---------- Title bar ---------- */}
      <div className="relative flex items-center rounded-t-[calc(1rem-1px)] border-b border-line bg-paper/[0.03] px-4 py-3.5">
        <span aria-hidden className="flex items-center gap-2">
          {TRAFFIC_LIGHTS.map((c) => (
            <span
              key={c}
              className={cn("size-3 rounded-full ring-1 ring-inset ring-black/25", c)}
            />
          ))}
        </span>
        {/* Centred on the BAR, the way a real title is — not on the space left
            over beside the lights, which would read as slightly off-centre. */}
        <span className="pointer-events-none absolute inset-x-0 text-center font-geist text-[0.82rem] font-medium text-paper/70">
          Wiadomość
        </span>
      </div>

      {status === "sent" ? (
        <div
          role="status"
          className="flex flex-col items-center gap-4 px-6 py-16 text-center"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-mint/15 ring-1 ring-inset ring-mint/30">
            <CheckIcon aria-hidden className="size-7 text-mint" />
          </span>
          <h3 className="font-display text-2xl font-bold tracking-[-0.02em] text-paper">
            Wiadomość wysłana
          </h3>
          <p className="max-w-[44ch] leading-relaxed text-muted">
            Dziękuję! Odezwę się najszybciej, jak to możliwe.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 cursor-pointer rounded-full border border-line px-5 py-2.5 font-geist text-[0.9rem] font-medium text-paper/80 transition-colors duration-200 hover:border-mint/50 hover:text-mint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/50 motion-reduce:transition-none"
          >
            Napisz kolejną wiadomość
          </button>
        </div>
      ) : (
        // noValidate is mandatory, not hygiene: `type="email"` is a native
        // constraint, so without it the browser fires its own bubble on submit and
        // the form never reaches the validation above.
        <form noValidate onSubmit={onSubmit} className="p-5 sm:p-7">
          {/* Honeypot. Not display:none — some bots skip fields they can tell are
              hidden, so it's parked off-screen instead. aria-hidden + tabIndex -1
              keep it out of every human path (screen readers, keyboard), and the
              name "website" is bait: this form has no real website field, and
              browser autofill has no address-profile mapping for it either, so
              only a bot filling every input ever writes here. The server answers
              a filled honeypot with a fake 200 — never tell a bot it was caught. */}
          <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
            <label htmlFor={`${uid}-website`}>Nie wypełniaj tego pola</label>
            <input
              id={`${uid}-website`}
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Imię" htmlFor={fid("firstName")} required error={errors.firstName} errorId={eid("firstName")}>
              <input
                id={fid("firstName")}
                name="firstName"
                type="text"
                maxLength={LIMITS.firstName}
                autoComplete="given-name"
                placeholder="Jan"
                aria-required
                aria-invalid={errors.firstName ? true : undefined}
                aria-describedby={describedBy("firstName")}
                value={values.firstName}
                onChange={set("firstName")}
                className={cn(FIELD_BASE, errors.firstName && FIELD_INVALID)}
              />
            </Field>

            <Field label="Nazwisko" htmlFor={fid("lastName")} required error={errors.lastName} errorId={eid("lastName")}>
              <input
                id={fid("lastName")}
                name="lastName"
                type="text"
                maxLength={LIMITS.lastName}
                autoComplete="family-name"
                placeholder="Kowalski"
                aria-required
                aria-invalid={errors.lastName ? true : undefined}
                aria-describedby={describedBy("lastName")}
                value={values.lastName}
                onChange={set("lastName")}
                className={cn(FIELD_BASE, errors.lastName && FIELD_INVALID)}
              />
            </Field>
          </div>

          <div className="mt-5">
            <Field label="Twój e-mail" htmlFor={fid("email")} required error={errors.email} errorId={eid("email")}>
              <input
                id={fid("email")}
                name="email"
                type="email"
                maxLength={LIMITS.email}
                inputMode="email"
                autoComplete="email"
                placeholder="jan@twojafirma.pl"
                aria-required
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={describedBy("email")}
                value={values.email}
                onChange={set("email")}
                className={cn(FIELD_BASE, errors.email && FIELD_INVALID)}
              />
            </Field>
          </div>

          <div className="mt-5">
            {/* No htmlFor: the trigger is a <button>, which a <label> can't name. */}
            <Field label="Temat" required error={errors.topic} errorId={eid("topic")}>
              <TopicSelect
                id={fid("topic")}
                value={values.topic}
                onChange={(v) => setValues((p) => ({ ...p, topic: v }))}
                invalid={Boolean(errors.topic)}
                describedBy={describedBy("topic")}
              />
            </Field>
          </div>

          <Reveal show={isOther}>
            <Field label="Twój temat" htmlFor={fid("customTopic")} required error={errors.customTopic} errorId={eid("customTopic")}>
              <input
                id={fid("customTopic")}
                name="customTopic"
                type="text"
                maxLength={LIMITS.customTopic}
                placeholder="O czym chcesz porozmawiać?"
                aria-required
                aria-invalid={errors.customTopic ? true : undefined}
                aria-describedby={describedBy("customTopic")}
                value={values.customTopic}
                onChange={set("customTopic")}
                className={cn(FIELD_BASE, errors.customTopic && FIELD_INVALID)}
              />
            </Field>
          </Reveal>

          <Reveal show={isFuture}>
            <Field label="Twój budżet" htmlFor={fid("budget")} errorId={eid("budget")}>
              <input
                id={fid("budget")}
                name="budget"
                type="text"
                maxLength={LIMITS.budget}
                placeholder="np. 3000–5000 zł"
                value={values.budget}
                onChange={set("budget")}
                className={FIELD_BASE}
              />
            </Field>
          </Reveal>

          <div className="mt-5">
            <Field label="Wiadomość" htmlFor={fid("message")} required error={errors.message} errorId={eid("message")}>
              <textarea
                id={fid("message")}
                name="message"
                rows={6}
                maxLength={LIMITS.message}
                placeholder="Napisz, czego potrzebujesz — im więcej szczegółów, tym trafniej odpowiem."
                aria-required
                aria-invalid={errors.message ? true : undefined}
                aria-describedby={describedBy("message")}
                value={values.message}
                onChange={set("message")}
                className={cn(FIELD_BASE, "min-h-36 resize-y leading-relaxed", errors.message && FIELD_INVALID)}
              />
            </Field>
          </div>

          {status === "error" && sendError && (
            <p
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/[0.07] p-4 text-[0.9rem] leading-relaxed text-paper/90"
            >
              <ExclamationCircleIcon aria-hidden className="mt-px size-5 shrink-0 text-danger" />
              {sendError}
            </p>
          )}

          <div className="mt-7 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-muted/70">
              <span className="text-mint">*</span> pola obowiązkowe
            </p>
            <button type="submit" disabled={status === "sending"} className={CTA}>
              {status === "sending" ? (
                <>
                  Wysyłanie…
                  <ArrowPathIcon aria-hidden className="size-[1.05em] shrink-0 animate-spin" />
                </>
              ) : (
                <>
                  Wyślij wiadomość
                  <PaperAirplaneIcon
                    aria-hidden
                    className="size-[1.05em] shrink-0 transition-transform duration-300 ease-out group-hover/cta:translate-x-1 motion-reduce:transition-none"
                  />
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
