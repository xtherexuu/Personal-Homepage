import { jwtVerify, SignJWT } from "jose";

/**
 * Session token primitives shared by proxy.ts (optimistic redirect) and the
 * server-side session/DAL modules (the real boundary). Deliberately NOT marked
 * `server-only`: proxy.ts is not an RSC context, and this module holds no
 * secret of its own — the signing key is read from env at call time, which
 * never exists client-side anyway.
 *
 * Stateless HS256 JWT per the Next.js authentication guide. Revocation story
 * for a single admin: short TTL + rotating SESSION_SECRET kills every session
 * at once, which is exactly the lever you want when there is one user.
 */

export const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? // __Host- pins the cookie to this origin: Secure, path=/, no Domain —
      // a subdomain or a MITM on a sibling host cannot plant a lookalike.
      "__Host-admin_session"
    : "admin_session";

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Fail closed: a missing or feeble secret means NO tokens are ever minted. */
function key(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string | null> {
  const k = key();
  if (!k) return null;
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_TTL_MS) / 1000))
    .sign(k);
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const k = key();
  if (!k) return false;
  try {
    const { payload } = await jwtVerify(token, k, {
      // Pin the algorithm — an attacker-chosen `alg` header is the classic
      // JWT downgrade; jose refuses anything but exactly this list.
      algorithms: ["HS256"],
    });
    return payload.sub === "admin";
  } catch {
    return false;
  }
}
