import { Database } from "bun:sqlite";
import { drizzle as drizzleSqlite, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle as drizzlePostgres, type NodePgDatabase } from "drizzle-orm/node-postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, type ClientConfig, Pool, type PoolConfig } from "pg";
import { logger } from "./utils/logger";

type PgSource = Client | Pool;
type DrizzleDatabase = NodePgDatabase | BunSQLiteDatabase;

const SQLITE_MEMORY_URL = "sqlite::memory:";

function resolveConnectionString(
  explicit?: string,
  { allowMockSqlite = false }: { allowMockSqlite?: boolean } = {}
): string {
  const value = explicit ?? process.env.DATABASE_URL;
  if (value) {
    return value;
  }

  if (allowMockSqlite && process.env.BUN_TEST === "1") {
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

function createSqliteDrizzle(connectionString: string): BunSQLiteDatabase {
  const filename = normalizeSqliteFilename(connectionString);
  const sqlite = new Database(filename, { create: true });
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

export function createDrizzleClient(source?: PgSource): DrizzleDatabase {
  const connectionString = resolveConnectionString(undefined, {
    allowMockSqlite: true,
  });

  if (isSqliteConnectionString(connectionString)) {
    return createSqliteDrizzle(connectionString);
  }

  const pg = source ?? createPgPool({ connectionString });
  return drizzlePostgres(pg);
}

export const db: DrizzleDatabase = createDrizzleClient();
