/**
 * ALFRED Database Layer
 * Drizzle client, schemas, and repositories
 */

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
export * from "./metrics";

// Export repositories as namespaces
export * as assistantRepo from "./repo/assistant";
export * as clarificationRepo from "./repo/clarification";
export * as codexLearningRepo from "./repo/codex-learning";
export * as codexRunRepo from "./repo/codex-run";
export * as codexSessionRepo from "./repo/codex-session";
export * as cognitiveRepo from "./repo/cognitive";
export * as containerRepo from "./repo/container";
export * as conversationRepo from "./repo/conversation";
export * as deployRepo from "./repo/deploy";
export * as evalRepo from "./repo/eval";
export * as graphRepo from "./repo/graph";
export * as linearRepo from "./repo/linear";
export * as mcpRepo from "./repo/mcp";
export * as patternRepo from "./repo/pattern";
export * as planRepo from "./repo/plan";
export * as policyRepo from "./repo/policy";
export * as projectRepo from "./repo/project";
export * as ragRepo from "./repo/rag";
export * as trajectoryRepo from "./repo/trajectory";
export * as userRepo from "./repo/user";
export * as workflowRepo from "./repo/workflow";

// Schemas are exposed under namespaces to avoid duplicate export collisions.
export * as alertSchema from "./schema/alert";
export * as assistantSchema from "./schema/assistant";
export * as authSchema from "./schema/auth";
export * as clarificationSchema from "./schema/clarification";
export * as codexSchema from "./schema/codex";
export * from "./schema/cognitive";
export * as containerSchema from "./schema/container";
export * as conversationSchema from "./schema/conversation";
export * as deploySchema from "./schema/deploy";
export * as evalSchema from "./schema/eval";
export * as graphSchema from "./schema/graph";
export * as linearSchema from "./schema/linear";
export * as mcpSchema from "./schema/mcp";
export * as patternSchema from "./schema/pattern";
export * as planSchema from "./schema/plan";
export * as policySchema from "./schema/policy";
export * as projectSchema from "./schema/project";
export * as ragSchema from "./schema/rag";
export * as todoSchema from "./schema/todo";
export * as tokenSchema from "./schema/token";
export * as tuneSchema from "./schema/tune";
export * as userSchema from "./schema/user";
export * as workflowSchema from "./schema/workflow";
