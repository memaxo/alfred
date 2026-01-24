import { describe } from "bun:test";

import {
  isPostgresDriver,
  isSqliteDriver,
  requirePostgresDriver,
  requireSqliteDriver,
} from "./client";

type SuiteFactory = Parameters<typeof describe>[1];

export function describePostgres(name: string, factory: SuiteFactory): void {
  if (isPostgresDriver()) {
    describe(name, factory);
    return;
  }
  describe.skip(`${name} (requires Postgres)`, factory);
}

export function describeSqlite(name: string, factory: SuiteFactory): void {
  if (isSqliteDriver()) {
    describe(name, factory);
    return;
  }
  describe.skip(`${name} (requires sqlite fallback)`, factory);
}

export function skipIfSqlite(reason?: string): void {
  if (isSqliteDriver()) {
    throw new Error(
      reason ??
        "Skipped because sqlite fallback is active. Set DATABASE_URL for Postgres."
    );
  }
}

export function skipIfPostgres(reason?: string): void {
  if (isPostgresDriver()) {
    throw new Error(
      reason ?? "Skipped because Postgres is active. Unset DATABASE_URL."
    );
  }
}

export {
  requirePostgresDriver as requirePostgresTestEnv,
  requireSqliteDriver as requireSqliteTestEnv,
};
