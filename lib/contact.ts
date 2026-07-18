/**
 * Contact-form domain data, shared by the CLIENT (TopicSelect, ContactForm) and
 * the SERVER (app/api/contact). It lives here, directive-free, precisely so the
 * API route can validate against the same source of truth the menu renders from —
 * a topic the menu never offered is rejected server-side, not trusted because the
 * request happened to spell a plausible label. Keep this file free of React and
 * of "use client": the route handler imports it.
 */

export type TopicOption = { value: string; label: string };
export type TopicGroup = {
  key: string;
  label: string;
  options: readonly TopicOption[];
};

/** Group whose topics mean „I want to buy" → the form reveals „Twój budżet". */
export const FUTURE_CLIENT_GROUP = "przyszli";
/** The escape hatch → the form reveals a required free-text „Twój temat". */
export const OTHER_TOPIC = "inny";

/**
 * The two package topics, named so the „Moja oferta" CTAs and this menu render
 * from the SAME values — a „Porozmawiajmy o projekcie" click preselects one of
 * these, and sharing the constant is what stops the button and the option list
 * from ever drifting apart. Both sit in FUTURE_CLIENT_GROUP, so either also
 * reveals „Twój budżet".
 */
export const TOPIC_WIZYTOWKA = "wizytowka";
export const TOPIC_APLIKACJA = "aplikacja";

/**
 * The menu is grouped the way the enquiries actually divide — someone who wants to
 * buy, someone who already bought, and everyone else — because that split is what
 * drives the form: a „Przyszli klienci" topic reveals „Twój budżet", and „Inny"
 * reveals a free-text subject.
 */
export const TOPIC_GROUPS: readonly TopicGroup[] = [
  {
    key: FUTURE_CLIENT_GROUP,
    label: "Przyszli klienci",
    options: [
      { value: TOPIC_WIZYTOWKA, label: "Jestem zainteresowany Stroną Wizytówką" },
      {
        value: TOPIC_APLIKACJA,
        label: "Jestem zainteresowany Aplikacją Internetową",
      },
      {
        value: "niezdecydowany",
        label: "Chcę stronę, ale jeszcze nie wiem jaką.",
      },
    ],
  },
  {
    key: "byli",
    label: "Byli klienci",
    options: [
      { value: "reklamacja", label: "Reklamacja" },
      { value: "edycja", label: "Chcę zedytować/odświeżyć stronę" },
      { value: "problem", label: "Problem ze stroną" },
    ],
  },
  {
    key: "inne",
    label: "Inne",
    options: [{ value: OTHER_TOPIC, label: "Inny" }],
  },
];

/** Menu order with the groups flattened away — what the arrow keys actually walk. */
export const TOPIC_OPTIONS = TOPIC_GROUPS.flatMap((g) => g.options);

export const topicLabel = (value: string): string | null =>
  TOPIC_OPTIONS.find((o) => o.value === value)?.label ?? null;

export const topicGroupOf = (value: string): string | null =>
  TOPIC_GROUPS.find((g) => g.options.some((o) => o.value === value))?.key ?? null;

/**
 * Per-field length caps — the ONE set of numbers behind both the inputs'
 * `maxLength` and the server's validation. The server REJECTS anything longer
 * rather than truncating: the form can't produce it, so an over-long value is a
 * bot or a tampered request, not a visitor to be helped along.
 */
export const LIMITS = {
  firstName: 100,
  lastName: 100,
  email: 254,
  customTopic: 150,
  budget: 100,
  message: 5000,
} as const;

/**
 * What the form actually POSTs to /api/contact — the RAW field values, not a
 * pre-resolved subject. The server re-derives the subject (menu label or custom
 * text) itself; a client-composed subject would be free text where an allowlist
 * check belongs.
 *
 * `website` is the honeypot. The visible form never shows it, so it must arrive
 * empty; spam bots that fill every field out themselves.
 */
export type ContactRequest = {
  firstName: string;
  lastName: string;
  email: string;
  topic: string;
  customTopic: string;
  budget: string;
  message: string;
  website: string;
};
