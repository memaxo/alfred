import { mock } from "bun:test";

// Provide a minimal Drizzle-like client so any accidental imports of
// @alfred/db/src/client during router tests won't try to initialize a real
// Postgres connection.
const dbStub = new Proxy(
  {},
  {
    get: () => () => ({ returning: () => [], execute: async () => ({ rows: [] }) }),
  }
);

mock.module("@alfred/db/src/client", () => ({ db: dbStub }));
mock.module("@alfred/db/client", () => ({ db: dbStub }));
mock.module("@alfred/db", () => ({ db: dbStub, userRepo: {}, deployRepo: {}, linearRepo: {}, assistantRepo: {} }));

// Provide a default DATABASE_URL to placate any leftover guards
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

// No-op policy audit logging during tests
mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: async () => undefined,
}));
