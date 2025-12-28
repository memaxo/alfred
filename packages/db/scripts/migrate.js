#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * ALFRED Database Migration Runner
 * Applies SQL migrations in order and records them in _migrations.
 */
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "../src/migrations");
async function loadMigrations() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries
    .filter((file) => file.endsWith(".sql"))
    .map((file) => {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!(match?.[1] && match[2])) {
        throw new Error(`Invalid migration filename: ${file}`);
      }
      return {
        file,
        number: Number.parseInt(match[1], 10),
        name: match[2],
        path: join(MIGRATIONS_DIR, file),
      };
    })
    .sort((a, b) => a.number - b.number);
}
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      number INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
async function fetchAppliedMigrations(client) {
  const result = await client.query(
    "SELECT number FROM _migrations ORDER BY number ASC"
  );
  return new Set(result.rows.map((row) => Number(row.number)));
}
async function applyMigration(client, migration) {
  const sql = await Bun.file(migration.path).text();
  if (!sql.trim()) {
    console.log(`⊘ Skipping empty migration ${migration.file}`);
    return;
  }
  console.log(`→ Applying ${migration.file}`);
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      "INSERT INTO _migrations (number, name) VALUES ($1, $2)",
      [migration.number, migration.name]
    );
    await client.query("COMMIT");
    console.log(`✓ Applied ${migration.file}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`✗ Failed ${migration.file}`);
    throw error;
  }
}
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Configure it in packages/db/.env or the environment."
    );
  }
  const migrations = await loadMigrations();
  if (!migrations.length) {
    console.log("No migrations found. Nothing to do.");
    return;
  }
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await fetchAppliedMigrations(client);
    for (const migration of migrations) {
      if (applied.has(migration.number)) {
        console.log(`⊘ Skipping already applied migration ${migration.file}`);
        continue;
      }
      await applyMigration(client, migration);
    }
  } finally {
    await client.end();
  }
  console.log("Done.");
}
if (import.meta.main) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
