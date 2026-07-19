import "server-only";

import { cookies } from "next/headers";

import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "./tokens";

/** Mint a session and set the cookie. False = server misconfigured (no secret). */
export async function createSession(): Promise<boolean> {
  const token = await createSessionToken();
  if (!token) return false;

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Dev runs over plain http (localhost and the LAN preview IP); production
    // must be https, where the __Host- prefix additionally enforces this flag.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + SESSION_TTL_MS),
  });
  return true;
}

export async function destroySession(): Promise<void> {
  // A bare delete() emits Set-Cookie WITHOUT Secure. Browsers reject a
  // `__Host-`-prefixed cookie that lacks Secure — deletions included — so the
  // clear would be silently discarded and the session would survive its full
  // TTL in production. Overwrite with an already-expired cookie carrying the
  // same load-bearing attributes instead of relying on delete().
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
