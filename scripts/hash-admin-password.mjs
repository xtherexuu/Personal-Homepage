#!/usr/bin/env node
/**
 * Rotate the admin password: prompts for a new one, prints the env line.
 *
 *   npm run admin:hash
 *
 * The hash is argon2id at OWASP's recommended cost (m=19456 KiB, t=2, p=1),
 * wrapped in base64 because Next's .env loader expands `$VAR` references and
 * would mangle a raw `$argon2id$…` string. Paste the printed line into
 * .env.local (replacing the old ADMIN_PASSWORD_HASH) and restart the server —
 * restarting also rotates nothing else: sessions stay valid until they expire
 * or SESSION_SECRET changes.
 */
import { createInterface } from "node:readline/promises";

import { hash } from "@node-rs/argon2";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Nowe hasło admina (min. 12 znaków): ");
rl.close();

if (password.length < 12) {
  console.error("Za krótkie — ASVS wymaga co najmniej 12 znaków.");
  process.exit(1);
}

const h = await hash(password, {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

console.log("\nWklej do .env.local:\n");
console.log(`ADMIN_PASSWORD_HASH=${Buffer.from(h, "utf8").toString("base64")}`);
