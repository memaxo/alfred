import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client, type ClientConfig, Pool, type PoolConfig } from "pg";
import { logger } from "./utils/logger";

type PgSource = Client | Pool;

function resolveConnectionString(explicit?: string): string {
  const value = explicit ?? process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      "DATABASE_URL is required to initialize the Postgres client."
    );
  }

  return value;
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
  const pg = source ?? createPgPool();
  return drizzle(pg);
}

export const db = createDrizzleClient();
