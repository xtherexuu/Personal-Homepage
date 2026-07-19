import "server-only";

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

/**
 * One SQLite handle per process, stashed on globalThis so dev-mode HMR reuses
 * it instead of piling up open file descriptors. The file lives in ./data
 * (gitignored) OUTSIDE .next, so a rebuild never touches the inbox.
 *
 * Migrations DO NOT run here — they're applied once at server startup by
 * instrumentation.ts (`register()`), which Next awaits before serving any
 * request, so the schema is current no matter how the server was launched.
 * Running them in the request path would also race across worker processes on
 * a fresh DB. This module only OPENS the (already-migrated) database.
 *
 * Opening is LAZY, behind a Proxy: `next build` never executes admin queries
 * (the admin routes are force-dynamic, not prerendered), so the DB file is only
 * ever touched at request time in a running server — never during the build.
 */

type Db = ReturnType<typeof create>;

function create(): ReturnType<typeof drizzle<typeof schema>> {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(path.join(dir, "admin.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema });
}

const g = globalThis as unknown as { __adminDb?: Db };

function getDb(): Db {
  return (g.__adminDb ??= create());
}

/** Query it like the drizzle instance; the real handle opens on first access. */
export const db = new Proxy({} as Db, {
  get(_t, prop) {
    return Reflect.get(getDb(), prop, getDb());
  },
}) as Db;
