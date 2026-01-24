/// <reference types="bun-types" />

import { logger } from "@alfred/logger";
import { Database } from "bun:sqlite";
import {
  drizzle as drizzlePostgres,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, type ClientConfig, Pool, type PoolConfig } from "pg";

import { ensureSqliteTestSchema } from "./sqlite/schema";

type PgSource = Client | Pool;

export type DbDriver = "postgres" | "sqlite";
export let dbDriver: DbDriver = "postgres";

interface RetryOptions {
  enabled?: boolean;
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  sleep?: (ms: number) => Promise<void>;
}

const SQLITE_MEMORY_URL = "sqlite::memory:";
const require = createRequire(import.meta.url);
// oxlint-disable noExplicitAny: Drizzle dynamic load
const drizzleSqlite: (...args: any[]) => any =
  // oxlint-disable noExplicitAny: Drizzle dynamic load
  (require("drizzle-orm/bun-sqlite") as { drizzle: (...args: any[]) => any })
    .drizzle;

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
            .replaceAll(/gen_random_uuid\(\)/g, "lower(hex(randomblob(16)))")
            .replaceAll(/\bnow\(\)/gi, "CURRENT_TIMESTAMP")
        : source;
    // oxlint-disable noExplicitAny: Internal Bun-SQLite binding
    return originalPrepare(normalized as string, ...(params as any[]));
  }) as typeof sqlite.prepare;
  ensureSqliteTestSchema(sqlite);
  return drizzleSqlite(sqlite);
}

const AUTH_ERROR_PATTERNS = ["password", "authentication", "permission denied"];

function isAuthError(error: Error): boolean {
  const message = error.message?.toLowerCase() ?? "";
  return AUTH_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function connectWithRetry(
  client: Client,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {}
): Promise<void> {
  const maxRetries = Math.max(1, options.maxRetries ?? 5);
  let delay = options.initialDelay ?? 100;
  const maxDelay = options.maxDelay ?? 5000;
  const sleep = options.sleep ?? wait;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await client.connect();
      return;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error ?? ""));

      if (isAuthError(lastError)) {
        throw lastError;
      }

      if (attempt === maxRetries - 1) {
        break;
      }

      logger.warn("db_connection_retry", {
        attempt: attempt + 1,
        delay,
        error: lastError.message,
        maxRetries,
      });

      await sleep(delay);
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw lastError ?? new Error("Connection failed after retries");
}

export function createPgClient(
  connectionString?: string,
  config: ClientConfig & { retry?: RetryOptions } = {}
): Client {
  const { retry, ...clientConfig } = config;

  const client = new Client({
    connectionString: resolveConnectionString(connectionString),
    ...clientConfig,
  });

  const envRetryFlag = process.env.DB_RETRY_ENABLED?.toLowerCase();
  let defaultRetryEnabled = process.env.NODE_ENV === "production";
  if (envRetryFlag === "true") {
    defaultRetryEnabled = true;
  } else if (envRetryFlag === "false") {
    defaultRetryEnabled = false;
  }

  const shouldRetry = retry?.enabled ?? defaultRetryEnabled;

  if (shouldRetry) {
    const maxRetries = retry?.maxRetries ?? 5;
    connectWithRetry(client, {
      initialDelay: retry?.initialDelay ?? 100,
      maxDelay: retry?.maxDelay ?? 5000,
      maxRetries,
      sleep: retry?.sleep,
    }).catch((error) => {
      logger.error("db_client_connection_failed_after_retries", {
        error: error instanceof Error ? error.message : String(error),
        maxRetries,
      });
    });
  } else {
    client.connect().catch((error) => {
      logger.error("db_client_connection_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

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

let defaultPool: Pool | null = null;

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
  if (!source && pg instanceof Pool) {
    defaultPool = pg;
  }
  return drizzlePostgres(pg);
}

export const db: NodePgDatabase = createDrizzleClient();

/**
 * Shuts down the default database pool if it exists.
 * Useful for tests to ensure the process exits promptly.
 */
export async function shutdownDb(): Promise<void> {
  if (defaultPool) {
    await defaultPool.end();
    defaultPool = null;
  }
}
