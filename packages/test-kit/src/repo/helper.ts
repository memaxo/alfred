import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { assertBudget } from "../performance/budget";

function isSqliteUrl(value: string | undefined): boolean {
  if (!value) {
    return true;
  }
  return (
    value === ":memory:" ||
    value === "sqlite::memory:" ||
    value.startsWith("sqlite:") ||
    value.startsWith("file:")
  );
}

export type IsolatedDb = {
  driver: "postgres" | "sqlite";
  db: NodePgDatabase;
  close: () => Promise<void>;
};

/**
 * Assert a DB query stays within a performance budget.
 *
 * Returns the underlying function result for ergonomic use in tests.
 */
export async function assertQueryBudget<T>(
  fn: () => Promise<T>,
  budgetMs: number
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  assertBudget("db-query", durationMs, budgetMs);
  return result;
}

/**
 * Creates an isolated database handle for tests.
 *
 * - Postgres: creates a dedicated `pg.Client` connection and Drizzle wrapper.
 * - Sqlite (fallback): creates a fresh in-memory Drizzle client via `@alfred/db`.
 */
export async function createIsolatedDb(): Promise<IsolatedDb> {
  const url = process.env.DATABASE_URL;
  if (isSqliteUrl(url)) {
    const mod = await import("@alfred/db");
    const db = mod.createDrizzleClient();
    return {
      driver: "sqlite",
      db,
      close: async () => {},
    };
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  const db = drizzle(client);
  return {
    driver: "postgres",
    db,
    close: async () => {
      await client.end();
    },
  };
}

/**
 * Reset the provided tables for a clean slate between tests.
 *
 * For Postgres this uses TRUNCATE (fast, with CASCADE).
 * For sqlite this uses DELETE (best-effort; intended for local/unit tests).
 */
export async function resetTables(
  db: NodePgDatabase,
  tables: string[]
): Promise<void> {
  if (tables.length === 0) {
    return;
  }

  const driver = isSqliteUrl(process.env.DATABASE_URL) ? "sqlite" : "postgres";
  if (driver === "postgres") {
    await db.execute(
      sql.raw(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`)
    );
    return;
  }

  for (const table of tables) {
    await db.execute(sql.raw(`DELETE FROM ${table}`));
  }
}

