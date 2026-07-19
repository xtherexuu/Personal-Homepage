/**
 * Runs once when the Next.js server boots, before it serves any request. We use
 * it to apply DB migrations, so the admin panel's schema is always current
 * regardless of how the server was started — this is the robust replacement for
 * relying on an npm pre-start script (which `next dev`/`next start` launched
 * directly, or from an IDE, would skip).
 */
export async function register() {
  // Node-only: better-sqlite3 is a native module and never loads on the Edge
  // runtime. Next calls register() in every environment, so guard it.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateDb } = await import("./lib/db/migrate");
    migrateDb();
  }
}
