import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

/**
 * Apply pending migrations on a dedicated connection, then close it. Called
 * once at server startup from instrumentation.ts (and standalone by
 * scripts/migrate.mjs). Because Next awaits `register()` before serving the
 * first request, the runtime `db` connection always opens an ALREADY-migrated
 * file — no matter how the server was launched (npm script, `next dev`
 * directly, an IDE run config, a process manager). Idempotent: drizzle records
 * applied migrations, so re-runs are no-ops.
 */
export function migrateDb(): void {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(path.join(dir, "admin.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  try {
    migrate(drizzle(sqlite), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  } finally {
    sqlite.close();
  }
}
