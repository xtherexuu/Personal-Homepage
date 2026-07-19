import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { verify } from "@node-rs/argon2";

/**
 * The single admin account. Credentials live in env — ADMIN_USER plus
 * ADMIN_PASSWORD_HASH, an argon2id hash wrapped in base64 because Next's .env
 * loader expands `$VAR` references and would silently mangle a raw
 * `$argon2id$…` string. There is no user table and no registration surface:
 * nothing here can CREATE an account, only compare against the one in env.
 */

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest();

/**
 * A real argon2id hash of a random throwaway string. When config is missing or
 * the username is wrong we verify the password against THIS, so every failed
 * login burns the same work — response time never says which field was wrong.
 */
const DECOY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$isbpVieV8CzAyhFT1c9akA$E8SYM61yIG+uaLF8B4uzuIf9HIHgEDTYwifIkb8cjXQ";

/** Fail closed: absent or malformed env means NOBODY can log in. */
function adminCreds(): { user: string; hash: string } | null {
  const user = process.env.ADMIN_USER;
  const b64 = process.env.ADMIN_PASSWORD_HASH;
  if (!user || !b64) return null;
  const hash = Buffer.from(b64, "base64").toString("utf8");
  if (!hash.startsWith("$argon2")) return null;
  return { user, hash };
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const creds = adminCreds();

  // sha256 both sides first: timingSafeEqual demands equal-length inputs, and
  // hashing gets us there without leaking the real username's length.
  const userOk = creds
    ? timingSafeEqual(sha256(username), sha256(creds.user))
    : false;

  let passOk = false;
  try {
    passOk = await verify(creds?.hash ?? DECOY_HASH, password);
  } catch {
    passOk = false;
  }

  return creds !== null && userOk && passOk;
}
