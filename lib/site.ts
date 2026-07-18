// Canonical site origin — single source of truth for metadata, robots, sitemap
// and JSON-LD. Change here when the domain or a staging host changes.
export const SITE = "https://bartoszzaleski.com" as const;

/**
 * Where the contact section points. One source of truth: the „Kontakt" tiles read
 * it, and anything else that needs to reach me (a future footer, JSON-LD's
 * `sameAs` / `email`) should read it too rather than restating a handle.
 *
 * `email` is what the middle tile copies to the clipboard — it is not wired to a
 * mailbox by this repo, so it has to be an address that actually receives mail.
 */
export const CONTACT = {
  email: "contact@bartoszzaleski.com",
  instagram: "https://www.instagram.com/xtherexuu/",
  facebook: "https://www.facebook.com/profile.php?id=61592054667370",
} as const;
