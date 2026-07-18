import { createTransport, type Transporter } from "nodemailer";

import {
  FUTURE_CLIENT_GROUP,
  LIMITS,
  OTHER_TOPIC,
  topicGroupOf,
  topicLabel,
  type ContactRequest,
} from "@/lib/contact";
import { CONTACT, SITE } from "@/lib/site";

/**
 * POST /api/contact — the delivery route behind the „Wiadomość" window.
 *
 * Every enquiry becomes ONE e-mail INTO my own inbox (CONTACT_INBOX), sent FROM
 * my own authenticated address (SMTP_USER) — Proton refuses spoofed senders, and
 * the visitor's address belongs in Reply-To anyway, so answering an enquiry is
 * just pressing "Reply".
 *
 * The client already validates for UX; everything here re-validates for SAFETY,
 * because nothing obliges a request to have come from the form:
 *
 *   • deny-by-default input contract — unknown topics are rejected against the
 *     same TOPIC_GROUPS the menu renders from (lib/contact), lengths against the
 *     same LIMITS the inputs enforce, and every header-bound value has control
 *     characters stripped so nothing can smuggle a CRLF into Subject/Reply-To;
 *   • a per-IP sliding-window rate limit — this endpoint commands a real mailbox,
 *     and unmetered it would be a free spam cannon pointed at me;
 *   • a honeypot („website") answered with a FAKE success, because a bot told
 *     it was caught is a bot that comes back smarter;
 *   • fail-closed errors — the visitor gets a bare status code, the detail goes
 *     to the server log under an error id. SMTP hostnames and stack traces are
 *     nobody's business.
 *
 * The e-mail itself is text/plain, on purpose: whatever a visitor types renders
 * as inert text in the mail client, never as markup.
 */

/* ------------------------------- rate limit ------------------------------- */

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 3;

/**
 * Per-IP submit timestamps. In-memory is honest at this scale: one warm server
 * (or one serverless instance) remembers its own window, and losing the map on a
 * cold start merely lets someone send a fourth enquiry early. The map is bounded
 * so a botnet can't turn the limiter itself into the memory leak.
 */
const hits = new Map<string, number[]>();

/** Milliseconds until the caller may try again, or 0 when allowed. */
function rateLimit(ip: string, now: number): number {
  const windowStart = now - WINDOW_MS;

  if (hits.size > 2_000) {
    // Flood pressure: drop stale buckets first, and if the pressure is real
    // traffic, reset outright — bounded memory beats perfect fairness here.
    for (const [k, v] of hits) if (!v.some((t) => t > windowStart)) hits.delete(k);
    if (hits.size > 2_000) hits.clear();
  }

  const recent = (hits.get(ip) ?? []).filter((t) => t > windowStart);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return recent[0] + WINDOW_MS - now;
  }
  recent.push(now);
  hits.set(ip, recent);
  return 0;
}

/**
 * First X-Forwarded-For hop. Behind a real proxy (Vercel, nginx) that's the
 * client; exposed directly to the internet the header is client-supplied fiction
 * — an accepted trade-off for a limiter that only guards a contact form.
 */
const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/* ------------------------------- validation ------------------------------- */

/** Mirrors the form's check: the only real test of an address is a reply. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Single-line fields: no C0/DEL control characters, ever — CRLF included. */
const stripControl = (s: string) =>
  s.replace(/[\u0000-\u001f\u007f]/g, " ").trim();

/** The message keeps its line breaks (and tabs); every other control char goes. */
const stripControlKeepNewlines = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ")
    .trim();

type Enquiry = {
  firstName: string;
  lastName: string;
  email: string;
  /** Resolved server-side: the allowlisted menu label, or the „Inny" free text. */
  subject: string;
  budget: string | null;
  message: string;
  /** An arrived-filled honeypot — still a "valid" parse, but it must not send. */
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

/* --------------------------------- mailer --------------------------------- */

type Smtp = {
  host: string;
  port: number;
  user: string;
  pass: string;
  inbox: string;
};

/** Fail-closed config read: absent or malformed env means NO transport at all. */
function smtpConfig(): Smtp | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_INBOX } =
    process.env;
  const port = Number(SMTP_PORT);
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return {
    host: SMTP_HOST,
    port,
    user: SMTP_USER,
    pass: SMTP_PASS,
    // Enquiries land in my own mailbox; by default the same address they're
    // sent from, which is also the one the „Kontakt" tiles advertise.
    inbox: CONTACT_INBOX || CONTACT.email,
  };
}

let transporter: Transporter | null = null;

function getTransporter(cfg: Smtp): Transporter {
  transporter ??= createTransport({
    host: cfg.host,
    port: cfg.port,
    // 465 is implicit TLS; 587 (Proton) is STARTTLS — and requireTLS makes the
    // upgrade mandatory, so credentials never cross the wire in plaintext even
    // if a middlebox strips the server's STARTTLS advertisement.
    secure: cfg.port === 465,
    requireTLS: true,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { minVersion: "TLSv1.2" },
    // A stuck SMTP conversation must not hold the request open forever.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    // This route sends exactly one shape of message. Nothing in a request may
    // ever grow into "attach this file / fetch this URL".
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return transporter;
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

  const retryMs = rateLimit(clientIp(request), Date.now());
  if (retryMs > 0) {
    return json(false, 429, {
      "Retry-After": String(Math.ceil(retryMs / 1000)),
    });
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json(false, 415);
  }

  // Read as text first so an oversized body is bounced by LENGTH, not parsed.
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

  const cfg = smtpConfig();
  if (!cfg) {
    console.error(
      "[contact] SMTP env missing/invalid — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (see .env.example)",
    );
    return json(false, 500);
  }

  const { firstName, lastName, email, subject, budget, message } = enquiry;
  const fullName = `${firstName} ${lastName}`;

  try {
    const info = await getTransporter(cfg).sendMail({
      // From MUST be the authenticated Proton address or the relay refuses it;
      // the visitor lives in Reply-To, so "Odpowiedz" goes straight to them.
      //
      // The display name is SHORT and pure ASCII word-characters on purpose, and
      // that is load-bearing. Proton's submission check compares MAIL FROM to the
      // From header WITHOUT unfolding it. Any accent or dash makes nodemailer
      // MIME-encode the name, and a longer name overruns ~76 chars — either way
      // `<address>` folds onto a continuation line, Proton reads the phrase left
      // on line one as the address, and every send dies with
      // `550 5.7.26 … does not match header From`. Keep it bare, keep it short.
      from: { name: "Formularz kontaktowy", address: cfg.user },
      to: cfg.inbox,
      replyTo: { name: fullName, address: email },
      subject: `Formularz: ${subject} — ${fullName}`.slice(0, 180),
      text: [
        `Nowa wiadomość z formularza na ${SITE}`,
        "",
        `Od:       ${fullName} <${email}>`,
        `Temat:    ${subject}`,
        ...(budget ? [`Budżet:   ${budget}`] : []),
        `Adres IP: ${clientIp(request)}`,
        "",
        "—".repeat(30),
        "",
        message,
      ].join("\n"),
    });
    console.log(`[contact] sent ${info.messageId}`);
    return json(true, 200);
  } catch (err) {
    // Fail closed and anonymously: the id ties the visitor-facing failure to
    // the full server-side error without exposing SMTP internals to anyone.
    const errorId = crypto.randomUUID();
    console.error(`[contact:${errorId}] send failed`, err);
    return json(false, 500);
  }
}
