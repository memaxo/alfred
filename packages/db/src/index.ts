/**
 * ALFRED Database Layer
 * Drizzle client, schemas, and repositories
 */

export * from "./metrics";
export {
  createDrizzleClient,
  createPgClient,
  createPgPool,
  db,
  dbDriver,
  getDbDriver,
  isPostgresDriver,
  isSqliteDriver,
  requirePostgresDriver,
  requireSqliteDriver,
  shutdownDb,
} from "./client";
export * as assistantRepo from "./repo/assistant";
export * as codexRunRepo from "./repo/codex-run";
export * as codexLearningRepo from "./repo/codex-learning";
export * as codexSessionRepo from "./repo/codex-session";
export * as cognitiveRepo from "./repo/cognitive";
export * as conversationRepo from "./repo/conversation";
export * as deployRepo from "./repo/deploy";
export * as evalRepo from "./repo/eval";
export * as graphRepo from "./repo/graph";
export * as linearRepo from "./repo/linear";
export * as policyRepo from "./repo/policy";
export * as planRepo from "./repo/plan";
export * as projectRepo from "./repo/project";
export * as ragRepo from "./repo/rag";
// Export repositories as namespaces
export * as clarificationRepo from "./repo/clarification";
export * as patternRepo from "./repo/pattern";
export * as userRepo from "./repo/user";
export * as workflowRepo from "./repo/workflow";
export * as assistantSchema from "./schema/assistant";
export * as codexSchema from "./schema/codex";
export * from "./schema/cognitive";
export * as conversationSchema from "./schema/conversation";
export * as deploySchema from "./schema/deploy";
export * as evalSchema from "./schema/eval";
export * as graphSchema from "./schema/graph";
export * as linearSchema from "./schema/linear";
export * as policySchema from "./schema/policy";
export * as planSchema from "./schema/plan";
export * as projectSchema from "./schema/project";
export * as ragSchema from "./schema/rag";
export * as clarificationSchema from "./schema/clarification";
export * as patternSchema from "./schema/pattern";
// Schemas are exposed under namespaces to avoid duplicate export collisions.
export * as userSchema from "./schema/user";
export * as workflowSchema from "./schema/workflow";
