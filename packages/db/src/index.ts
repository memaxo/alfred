/**
 * ALFRED Database Layer
 * Drizzle client, schemas, and repositories
 */

import { drizzle } from "drizzle-orm/node-postgres";

// TODO: [Phase 3] Configure production-ready drizzle client with pooling
export const db = drizzle(process.env.DATABASE_URL || "");

// Export all schemas
export * from "./schema/user";
export * from "./schema/rag";
export * from "./schema/graph";
export * from "./schema/assistant";
export * from "./schema/linear";
export * from "./schema/deploy";
export * from "./schema/policy";

// Export all repositories
export * as userRepo from "./repo/user";
export * as ragRepo from "./repo/rag";
export * as graphRepo from "./repo/graph";
export * as assistantRepo from "./repo/assistant";
export * as linearRepo from "./repo/linear";
export * as deployRepo from "./repo/deploy";
export * as policyRepo from "./repo/policy";
