import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";

import {
  MAX_TOTAL_BYTES,
  validateAttachments,
} from "@/lib/attachments";
import { hasAdminSession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { messages, replies } from "@/lib/db/schema";
import { renderEmailFromDoc } from "@/lib/email-html";
import { FROM_NAME, getTransporter, smtpConfig } from "@/lib/mailer";
import { clientIpFrom, createRateLimiter } from "@/lib/rate-limit";
import { SITE } from "@/lib/site";
import { stripControl } from "@/lib/strings";

/**
 * POST /api/admin/reply — the ONLY thing on this site that still sends mail.
 *
 * A Route Handler rather than a Server Action because of the attachments:
 * Server Actions cap bodies at 1 MB by default, and multipart streaming is
 * exactly what Route Handlers are documented for. That choice costs us the
 * automatic Origin check Server Actions get, so this handler does its own —
 * plus the DAL session check, because the proxy is a convenience, not a wall.
 *
 * The recipient is NOT a request field: replies go to the address stored with
 * the message being answered. That address ultimately came from a public
 * contact submission, so it is not trustworthy in itself — but keeping it out
 * of the request means a valid session can only mail people who already wrote
 * in, and the rate limit below bounds how fast even that can happen, so a
 * misused session can't turn this into a high-volume relay from the Proton
 * domain. The client sends the editor's JSON document; HTML is regenerated,
 * sanitized and inlined server-side (lib/email-html.ts), attachments are
 * validated by magic bytes (lib/attachments.ts).
 */

const err = (status: number) => Response.json({ ok: false }, { status });

// Even one authenticated admin shouldn't be able to fire off mail unbounded —
// a stuck UI or a misused session would torch the sending domain's reputation.
const replyLimit = createRateLimiter(5 * 60_000, 20);

export async function POST(request: Request) {
  // DAL check first — 401 JSON, not a redirect, because the caller is fetch().
  if (!(await hasAdminSession())) return err(401);

  if (replyLimit(clientIpFrom(request.headers)) > 0) {
    console.warn("[admin:reply] rate limited");
    return err(429);
  }

  // Strict CSRF: this endpoint is only ever called by the panel's own JS, and
  // browsers ALWAYS attach Origin to fetch POSTs — no Origin, no service.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return err(403);
  try {
    if (new URL(origin).host !== host && origin !== SITE) return err(403);
  } catch {
    return err(403);
  }

  // Bounce oversized bodies by DECLARED length before buffering anything. A
  // missing/zero/non-finite length (Number(null) === 0, or chunked encoding)
  // is rejected too: the panel's fetch always sends a Content-Length'd body,
  // so a header-less request is not something to read into memory on faith.
  const declared = Number(request.headers.get("content-length"));
  if (
    !Number.isFinite(declared) ||
    declared <= 0 ||
    declared > MAX_TOTAL_BYTES + 2_000_000
  ) {
    return err(413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err(400);
  }

  const idRaw = form.get("messageId");
  const id = typeof idRaw === "string" ? Number(idRaw) : NaN;
  if (!Number.isInteger(id) || id < 1) return err(400);

  const msg = db.select().from(messages).where(eq(messages.id, id)).get();
  if (!msg) return err(404);

  const subjectRaw = form.get("subject");
  const subject =
    typeof subjectRaw === "string"
      ? stripControl(subjectRaw).slice(0, 180)
      : "";
  if (!subject) return err(400);

  const docRaw = form.get("doc");
  if (typeof docRaw !== "string" || docRaw.length > 200_000) return err(400);
  const rendered = renderEmailFromDoc(docRaw);
  if (!rendered) return err(400);

  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File);
  const atts = await validateAttachments(files);
  if (!atts.ok) return err(atts.status);

  const cfg = smtpConfig();
  if (!cfg) {
    console.error(
      "[admin:reply] SMTP env missing/invalid — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (see .env.example)",
    );
    return err(500);
  }

  // Two distinct failure domains. A SEND failure is a real failure the admin
  // must retry. A failure AFTER the mail has left (storing the thread row,
  // marking read, revalidating) must NOT read as a send failure — that would
  // invite a resend and the recipient would get the reply twice. So the send
  // stands alone, and everything after it swallows its own errors and still
  // reports success, because the mail is already gone.
  let info: Awaited<ReturnType<ReturnType<typeof getTransporter>["sendMail"]>>;
  try {
    info = await getTransporter(cfg).sendMail({
      // From MUST be the authenticated Proton address, and the display name
      // MUST stay short pure-ASCII (see lib/mailer.ts) or Proton 550s.
      from: { name: FROM_NAME, address: cfg.user },
      // The DB row decides the recipient — never the request.
      to: msg.email,
      subject,
      html: rendered.html,
      text: rendered.text,
      attachments: atts.list,
    });
  } catch (sendErr) {
    // Fail closed and anonymously: the id ties the panel-facing failure to the
    // full server-side error without exposing SMTP internals in the response.
    const errorId = crypto.randomUUID();
    console.error(`[admin:reply:${errorId}] send failed`, sendErr);
    return err(500);
  }

  try {
    db.insert(replies)
      .values({
        messageId: id,
        subject,
        html: rendered.bodyHtml,
        text: rendered.text,
        attachments: JSON.stringify(atts.meta),
        smtpMessageId: info.messageId ?? null,
        sentAt: Date.now(),
      })
      .run();
    if (!msg.readAt) {
      db.update(messages)
        .set({ readAt: Date.now() })
        .where(eq(messages.id, id))
        .run();
    }
    revalidatePath("/admin");
    revalidatePath(`/admin/messages/${id}`);
  } catch (storeErr) {
    // The mail is out; log the bookkeeping miss but do not tell the admin the
    // send failed. The thread just won't show this reply until next intake.
    const errorId = crypto.randomUUID();
    console.error(
      `[admin:reply:${errorId}] sent ${info.messageId} but bookkeeping failed`,
      storeErr,
    );
  }

  console.log(`[admin:reply] sent ${info.messageId} for message ${id}`);
  return Response.json({ ok: true });
}
