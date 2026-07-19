import "server-only";

import { createTransport, type Transporter } from "nodemailer";

/**
 * The one SMTP transport in the codebase, factored out of the old contact
 * route: since the panel took over enquiry intake, the only thing that sends
 * mail is the admin's reply endpoint — but the transport rules are unchanged.
 */

export type Smtp = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

/**
 * From display name — MUST stay short and pure-ASCII `[\w ]`. Proton's
 * submission check compares MAIL FROM to the From header WITHOUT unfolding it;
 * an accent or a long name makes nodemailer MIME-encode/fold the header and
 * every send dies with `550 5.7.26 … does not match header From`.
 */
export const FROM_NAME = "Bartosz Zaleski";

/** Fail-closed config read: absent or malformed env means NO transport at all. */
export function smtpConfig(): Smtp | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(SMTP_PORT);
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host: SMTP_HOST, port, user: SMTP_USER, pass: SMTP_PASS };
}

let transporter: Transporter | null = null;

export function getTransporter(cfg: Smtp): Transporter {
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
    // Attachments arrive as Buffers we validated ourselves. Nothing in a
    // request may ever grow into "attach this path / fetch this URL".
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return transporter;
}
