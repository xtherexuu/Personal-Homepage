"use client";

/**
 * contact-intent — the thin channel behind „Porozmawiajmy o projekcie".
 *
 * A „Moja oferta" CTA wants two things from the contact block: scroll so the form
 * is in view from the TILES down (not from the „złap KONTAKT" header), and
 * pre-pick the „Temat" matching the package the visitor came in on.
 *
 * The scroll is the deck's job — it owns the one scroll region — so it lives on
 * `goContact` (section-deck), and CONTACT_ANCHOR_ID marks where it lands: the top
 * of the contact block, i.e. the tiles.
 *
 * The topic is the one value that has to cross from the offer (high on the page) to
 * the always-mounted „Wiadomość" form (far below it). A window CustomEvent keeps
 * the two decoupled — no lifted state, and nothing that re-renders a provider on a
 * value that changes once per click. The form owns the rest of its state; this only
 * nudges the one field, and only the field, so a half-typed message is never lost.
 */

/** Scroll target for `goContact` — the top of the contact block (the tiles). */
export const CONTACT_ANCHOR_ID = "kontakt-start";

const TOPIC_EVENT = "contact:pick-topic";

/** Ask the „Wiadomość" form to select `topic` (a lib/contact TopicOption value). */
export function pickContactTopic(topic: string): void {
  window.dispatchEvent(new CustomEvent(TOPIC_EVENT, { detail: topic }));
}

/** Subscribe the form to preselect requests; returns the effect's cleanup. */
export function onPickContactTopic(
  handler: (topic: string) => void,
): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(TOPIC_EVENT, listener);
  return () => window.removeEventListener(TOPIC_EVENT, listener);
}
