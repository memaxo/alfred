/**
 * ALFRED Database Layer
 * Drizzle client, schemas, and repositories
 */

export { db, createDrizzleClient, createPgClient, createPgPool } from "./client";

// Schemas are exposed under namespaces to avoid duplicate export collisions.
export * as userSchema from "./schema/user";
export * as ragSchema from "./schema/rag";
export * as graphSchema from "./schema/graph";
export * as assistantSchema from "./schema/assistant";
export * as linearSchema from "./schema/linear";
export * as deploySchema from "./schema/deploy";
export * as policySchema from "./schema/policy";
export * as evalSchema from "./schema/eval";
export * as workflowSchema from "./schema/workflow";

// Export repositories as namespaces
export * as userRepo from "./repo/user";
export * as ragRepo from "./repo/rag";
export * as graphRepo from "./repo/graph";
export * as assistantRepo from "./repo/assistant";
export * as linearRepo from "./repo/linear";
export * as deployRepo from "./repo/deploy";
export * as policyRepo from "./repo/policy";
export * as evalRepo from "./repo/eval";
