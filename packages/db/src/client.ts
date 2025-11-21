/// <reference types="bun-types" />

import { Database } from "bun:sqlite";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@alfred/logger";
import {
  drizzle as drizzlePostgres,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { Client, type ClientConfig, Pool, type PoolConfig } from "pg";
import { ensureSqliteTestSchema } from "./sqlite/schema";

type PgSource = Client | Pool;

export type DbDriver = "postgres" | "sqlite";
export let dbDriver: DbDriver = "postgres";

const SQLITE_MEMORY_URL = "sqlite::memory:";
const require = createRequire(import.meta.url);
const drizzleSqlite: (...args: any[]) => any = (
  require("drizzle-orm/bun-sqlite") as { drizzle: (...args: any[]) => any }
).drizzle;

export function getDbDriver(): DbDriver {
  return dbDriver;
}

export function isPostgresDriver(): boolean {
  return dbDriver === "postgres";
}

export function isSqliteDriver(): boolean {
  return dbDriver === "sqlite";
}

export function requirePostgresDriver(context?: string): void {
  if (!isPostgresDriver()) {
    throw new Error(
      context ??
        "This test requires Postgres. Set DATABASE_URL to a Postgres connection string."
    );
  }
}

export function requireSqliteDriver(context?: string): void {
  if (!isSqliteDriver()) {
    throw new Error(
      context ??
        "This test requires the sqlite fallback. Unset DATABASE_URL to run under sqlite."
    );
  }
}

function resolveConnectionString(
  explicit?: string,
  { allowMockSqlite = false }: { allowMockSqlite?: boolean } = {}
): string {
  const value = explicit ?? process.env.DATABASE_URL;
  if (value) {
    return value;
  }

  const inBunTest =
    process.env.BUN_TEST === "1" ||
    process.env.NODE_ENV === "test" ||
    process.env.BUN_ENVIRONMENT === "test";

  if (allowMockSqlite && inBunTest) {
    logger.debug("db_sqlite_fallback_enabled", {
      reason: "DATABASE_URL missing during bun test run",
    });
    return SQLITE_MEMORY_URL;
  }

  throw new Error(
    "DATABASE_URL is required to initialize the Postgres client."
  );
}

function isSqliteConnectionString(value: string): boolean {
  return (
    value === ":memory:" ||
    value === SQLITE_MEMORY_URL ||
    value.startsWith("sqlite:") ||
    value.startsWith("file:")
  );
}

function normalizeSqliteFilename(value: string): string {
  if (value === ":memory:" || value === SQLITE_MEMORY_URL) {
    return ":memory:";
  }

  if (value.startsWith("sqlite://")) {
    const normalized = value.slice("sqlite://".length);
    return normalized.length === 0 ? ":memory:" : normalized;
  }

  if (value.startsWith("sqlite:")) {
    const normalized = value.slice("sqlite:".length);
    return normalized.length === 0 ? ":memory:" : normalized;
  }

  if (value.startsWith("file://")) {
    try {
      return fileURLToPath(value);
    } catch {
      return value.slice("file://".length);
    }
  }

  if (value.startsWith("file:")) {
    const relativePath = value.slice("file:".length);
    return relativePath.length === 0 ? ":memory:" : path.resolve(relativePath);
  }

  return value;
}

function createSqliteDrizzle(connectionString: string) {
  const filename = normalizeSqliteFilename(connectionString);
  const sqlite = new Database(filename, { create: true });
  const originalPrepare = sqlite.prepare.bind(sqlite);
  sqlite.prepare = ((source: string, ...params: unknown[]) => {
    const normalized =
      typeof source === "string"
        ? source
            .replace(/gen_random_uuid\(\)/g, "lower(hex(randomblob(16)))")
            .replace(/\bnow\(\)/gi, "CURRENT_TIMESTAMP")
        : source;
    return originalPrepare(normalized as string, ...(params as any[]));
  }) as typeof sqlite.prepare;
  ensureSqliteTestSchema(sqlite);
  return drizzleSqlite(sqlite);
}

export function createPgClient(
  connectionString?: string,
  config: ClientConfig = {}
): Client {
  const client = new Client({
    connectionString: resolveConnectionString(connectionString),
    ...config,
  });

  // TODO: production bootstrap should perform a retry/backoff strategy.
  client.connect().catch((error) => {
    logger.error("db_client_connection_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return client;
}

export function createPgPool(
  options: PoolConfig & { connectionString?: string } = {}
): Pool {
  const { connectionString, ...rest } = options;
  return new Pool({
    connectionString: resolveConnectionString(connectionString),
    min: rest.min ?? 0,
    max: rest.max ?? 10,
    idleTimeoutMillis: rest.idleTimeoutMillis ?? 30_000,
    ...rest,
  });
}

export function createDrizzleClient(source?: PgSource): NodePgDatabase {
  const connectionString = resolveConnectionString(undefined, {
    allowMockSqlite: true,
  });

  if (isSqliteConnectionString(connectionString)) {
    dbDriver = "sqlite";
    return createSqliteDrizzle(connectionString) as unknown as NodePgDatabase;
  }

  dbDriver = "postgres";
  const pg = source ?? createPgPool({ connectionString });
  return drizzlePostgres(pg);
}

export const db: NodePgDatabase = createDrizzleClient();
