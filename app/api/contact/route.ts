import {
  FUTURE_CLIENT_GROUP,
  LIMITS,
  OTHER_TOPIC,
  topicGroupOf,
  topicLabel,
  type ContactRequest,
} from "@/lib/contact";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { clientIpFrom, createRateLimiter } from "@/lib/rate-limit";
import { SITE } from "@/lib/site";
import { stripControl, stripControlKeepNewlines } from "@/lib/strings";

/**
 * POST /api/contact — the intake route behind the „Wiadomość" window.
 *
 * Every enquiry becomes ONE ROW in the panel's inbox (data/admin.db) — no mail
 * leaves the server here anymore; the admin reads and answers from /admin, and
 * only the ANSWER travels over SMTP.
 *
 * The client already validates for UX; everything here re-validates for SAFETY,
 * because nothing obliges a request to have come from the form:
 *
 *   • deny-by-default input contract — unknown topics are rejected against the
 *     same TOPIC_GROUPS the menu renders from (lib/contact), lengths against the
 *     same LIMITS the inputs enforce, and every single-line value has control
 *     characters stripped so nothing line-oriented downstream (logs, mail
 *     headers in a future reply) can be smuggled into;
 *   • a per-IP sliding-window rate limit — unmetered, this endpoint would be a
 *     free way to flood the panel's inbox;
 *   • a honeypot („website") answered with a FAKE success, because a bot told
 *     it was caught is a bot that comes back smarter — trapped submissions are
 *     never stored;
 *   • fail-closed errors — the visitor gets a bare status code, the detail goes
 *     to the server log under an error id.
 */

/* ------------------------------- rate limit ------------------------------- */

const rateLimit = createRateLimiter(10 * 60_000, 3);

const clientIp = (req: Request) => clientIpFrom(req.headers);

/* ------------------------------- validation ------------------------------- */

/** Mirrors the form's check: the only real test of an address is a reply. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Enquiry = {
  firstName: string;
  lastName: string;
  email: string;
  /** Resolved server-side: the allowlisted menu label, or the „Inny" free text. */
  subject: string;
  budget: string | null;
  message: string;
  /** An arrived-filled honeypot — still a "valid" parse, but it must not land. */
  trapped: boolean;
};

/**
 * Deny by default: anything missing, over-long, control-charactered or pointing
 * at a topic the menu never offered is a `null` — one generic 400, no hints
 * about which rule tripped.
 */
function parseEnquiry(body: unknown): Enquiry | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Partial<Record<keyof ContactRequest, unknown>>;

  const field = (v: unknown, max: number) => {
    if (typeof v !== "string" || v.length > max) return null;
    return stripControl(v);
  };

  const firstName = field(b.firstName, LIMITS.firstName);
  const lastName = field(b.lastName, LIMITS.lastName);
  const email = field(b.email, LIMITS.email);
  const topic = field(b.topic, 50);
  const customTopic = field(b.customTopic, LIMITS.customTopic);
  const budget = field(b.budget, LIMITS.budget);
  const website = field(b.website, 500);

  if (
    firstName === null || lastName === null || email === null ||
    topic === null || customTopic === null || budget === null ||
    website === null || typeof b.message !== "string" ||
    b.message.length > LIMITS.message
  ) {
    return null;
  }
  const message = stripControlKeepNewlines(b.message);

  if (!firstName || !lastName || !message) return null;
  if (!EMAIL_RE.test(email)) return null;

  // The subject is DERIVED here, never accepted as free text for a menu topic:
  // an unknown topic value is a forged request, not a new kind of enquiry.
  let subject: string;
  if (topic === OTHER_TOPIC) {
    if (!customTopic) return null;
    subject = customTopic;
  } else {
    const label = topicLabel(topic);
    if (!label) return null;
    subject = label;
  }

  return {
    firstName,
    lastName,
    email,
    subject,
    budget:
      topicGroupOf(topic) === FUTURE_CLIENT_GROUP && budget ? budget : null,
    message,
    trapped: website !== "",
  };
}

/* --------------------------------- handler -------------------------------- */

const json = (ok: boolean, status: number, headers?: HeadersInit) =>
  Response.json({ ok }, { status, headers });

export async function POST(request: Request) {
  // Browsers always send Origin on cross-site POSTs: a mismatch is another
  // site's page submitting MY form on a visitor's behalf. Origin-less clients
  // (curl) pass — this is CSRF hygiene, not authentication.
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("host");
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return json(false, 403);
    }
    if (originHost !== host && origin !== SITE) return json(false, 403);
  }

  const retryMs = rateLimit(clientIp(request));
  if (retryMs > 0) {
    return json(false, 429, {
      "Retry-After": String(Math.ceil(retryMs / 1000)),
    });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json(false, 415);
  }

  // Reject on DECLARED size before buffering anything: route handlers have no
  // built-in body cap, so a huge (or header-less chunked) body would otherwise
  // be read fully into memory before the length check below could fire. The
  // form always sends a small, Content-Length'd JSON body, so a missing or
  // absurd length is not a visitor to accommodate.
  const declared = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0 || declared > 50_000) {
    return json(false, 413);
  }

  // Belt-and-braces: the actual body must also fit (a lying Content-Length).
  const raw = await request.text();
  if (raw.length > 50_000) return json(false, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(false, 400);
  }

  const enquiry = parseEnquiry(body);
  if (!enquiry) return json(false, 400);

  if (enquiry.trapped) {
    // A filled honeypot gets the same 200 a human would — see the header note.
    console.warn(`[contact] honeypot tripped (ip=${clientIp(request)})`);
    return json(true, 200);
  }

  const { firstName, lastName, email, subject, budget, message } = enquiry;

  try {
    db.insert(messages)
      .values({
        firstName,
        lastName,
        email,
        subject,
        budget,
        body: message,
        ip: clientIp(request),
        createdAt: Date.now(),
      })
      .run();
    return json(true, 200);
  } catch (err) {
    // Fail closed and anonymously: the id ties the visitor-facing failure to
    // the full server-side error without exposing storage internals to anyone.
    const errorId = crypto.randomUUID();
    console.error(`[contact:${errorId}] store failed`, err);
    return json(false, 500);
  }
}
