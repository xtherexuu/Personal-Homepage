"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { verifyCredentials } from "@/lib/auth/credentials";
import { createSession } from "@/lib/auth/session";
import { clientIpFrom, createRateLimiter } from "@/lib/rate-limit";

/**
 * The login action. Server Actions arrive POST-only with Next's built-in
 * Origin/Host check, so CSRF is covered upstream; what this file owes the
 * panel is brute-force resistance (per-IP window + a slow, jittered failure
 * path) and a single generic error that never says WHICH field was wrong.
 */

/**
 * 8 attempts per 15 minutes per IP. Counting attempts (not just failures)
 * also caps how much argon2 work an attacker can demand of the server.
 */
const limiter = createRateLimiter(15 * 60_000, 8);

export type LoginState = { error: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const ip = clientIpFrom(await headers());

  if (limiter(ip) > 0) {
    console.warn(`[admin:login] rate limited (ip=${ip})`);
    return { error: "Zbyt wiele prób logowania. Spróbuj ponownie za kwadrans." };
  }

  const username = formData.get("username");
  const password = formData.get("password");
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username ||
    !password ||
    username.length > 200 ||
    password.length > 200
  ) {
    return { error: "Nieprawidłowy login lub hasło." };
  }

  const ok = await verifyCredentials(username, password);
  if (!ok) {
    console.warn(`[admin:login] failed attempt (ip=${ip})`);
    // A slow, jittered no: rate limiting does the real throttling, this just
    // denies a clean timing signal and makes scripted guessing tedious.
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
    return { error: "Nieprawidłowy login lub hasło." };
  }

  if (!(await createSession())) {
    console.error(
      "[admin:login] SESSION_SECRET missing or too short — cannot mint sessions",
    );
    return { error: "Błąd konfiguracji serwera. Sprawdź logi." };
  }

  console.log(`[admin:login] session created (ip=${ip})`);
  redirect("/admin");
}
