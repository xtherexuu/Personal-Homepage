import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/tokens";

/**
 * Optimistic gate for /admin — verify the session cookie's signature and
 * redirect accordingly. This is UX, not the security boundary: every admin
 * page, Server Action and Route Handler re-verifies through the DAL
 * (lib/auth/dal.ts), so a request that somehow slips past the proxy still
 * authenticates or bounces. No DB, no hashing here — this runs on every
 * matched request, prefetches included.
 */

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  const atLogin = pathname === "/admin/login";
  if (!authed && !atLogin) {
    return NextResponse.redirect(new URL("/admin/login", request.nextUrl));
  }
  if (authed && atLogin) {
    return NextResponse.redirect(new URL("/admin", request.nextUrl));
  }

  // Belt-and-braces with the per-page metadata: nothing under /admin is ever
  // for a crawler, and the header covers responses metadata can't (redirects).
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
