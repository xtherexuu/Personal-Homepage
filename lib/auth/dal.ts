import "server-only";

import { cache } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, verifySessionToken } from "./tokens";

/**
 * The Data Access Layer check — the ACTUAL security boundary, per the Next.js
 * data-security guide. proxy.ts only redirects optimistically; every admin
 * page, Server Action and Route Handler calls one of these itself, so a proxy
 * bypass (the CVE-2025-29927 class of bug) still hits a locked door.
 */

/** Memoized per render pass — many callers, one cookie verification. */
export const hasAdminSession = cache(async (): Promise<boolean> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
});

/** For pages and Server Actions: no session ⇒ straight to the login screen. */
export async function requireAdmin(): Promise<void> {
  if (!(await hasAdminSession())) redirect("/admin/login");
}
