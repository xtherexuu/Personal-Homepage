#!/usr/bin/env node
/**
 * Apply pending DB migrations ONCE, before the server starts.
 *
 *   npm run db:migrate      (standalone)
 *   npm run start / dev     (chained in front of next)
 *
 * Migrations must NOT run in the request path: `next start` spawns several
 * worker processes, and a per-process lazy migrate lets the first burst of
 * concurrent requests race on a fresh DB — two workers both try the same
 * `CREATE TABLE` and one dies with "table already exists". Running here, in a
 * single process before any worker boots, serializes it correctly. drizzle's
 * migrator is idempotent (it records applied migrations), so re-runs are no-ops.
 */
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const dir = path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true });

const sqlite = new Database(path.join(dir, "admin.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

try {
  migrate(drizzle(sqlite), {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  console.log("[db:migrate] schema is up to date");
} finally {
  sqlite.close();
}
