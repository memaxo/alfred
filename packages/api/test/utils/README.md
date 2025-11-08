/**
 * Test Utilities Documentation
 * 
 * This file documents mock behavior and expected responses for test utilities.
 */

/**
 * MockEventSource
 * 
 * Simulates Server-Sent Events (SSE) / EventSource API for testing streaming subscriptions.
 * 
 * Behavior:
 * - Starts in CONNECTING state (readyState = 0)
 * - Transitions to OPEN state (readyState = 1) after a tick (setTimeout 0)
 * - Transitions to CLOSED state (readyState = 2) when close() is called
 * - Queues messages added while CONNECTING, emits them when OPEN
 * - Does not emit messages when CLOSED
 * 
 * Expected Usage:
 * ```ts
 * const source = new MockEventSource("/stream");
 * source.onmessage = (event) => { console.log(event.data); };
 * await new Promise(resolve => setTimeout(resolve, 10));
 * source.addMessage("test data");
 * ```
 * 
 * Lifecycle:
 * 1. Constructor: Sets readyState to CONNECTING, schedules OPEN transition
 * 2. addMessage: Queues if CONNECTING, emits immediately if OPEN, ignores if CLOSED
 * 3. close: Sets readyState to CLOSED, clears timer, prevents further transitions
 * 4. reset: Closes all instances and clears the instances array
 */

/**
 * createTestCaller
 * 
 * Creates a tRPC caller with test authentication context.
 * 
 * Behavior:
 * - Creates a real tRPC caller (not mocked)
 * - Uses test session with default or custom userId/roles/scopes
 * - Generates unique requestId per call
 * - Can be used to test real tRPC procedures with controlled auth context
 * 
 * Expected Usage:
 * ```ts
 * const caller = await createTestCaller({ userId: "test-user" });
 * const result = await caller.assistant.list({ limit: 10 });
 * ```
 * 
 * Default Values:
 * - userId: "test-user"
 * - roles: ["user"]
 * - scopes: ["assistant.read"]
 * - requestId: auto-generated UUID
 */

/**
 * createTestDb / closeTestDb / truncateTables
 * 
 * Database test utilities for isolated test environments.
 * 
 * Behavior:
 * - createTestDb: Creates real PostgreSQL connection (requires DATABASE_URL)
 * - closeTestDb: Closes connection cleanly
 * - truncateTables: Clears all test tables for isolation
 * - dbFixtures: Provides reusable test data creation helpers
 * 
 * Expected Usage:
 * ```ts
 * const testDb = await createTestDb();
 * await truncateTables(testDb.db);
 * const userId = await dbFixtures.createUser(testDb.db);
 * await closeTestDb(testDb);
 * ```
 * 
 * Tables Truncated:
 * - rag_chunks, rag_documents
 * - user_facts, user_preferences, user_profiles
 * - assistant_threads, assistant_messages
 * - policy_audit_logs
 * - eval_runs, eval_scores, eval_definitions, eval_datasets
 * - memory_nodes, memory_edges
 */

/**
 * Contract Test Fixtures
 * 
 * Recorded API responses for deterministic testing without calling real APIs.
 * 
 * Cohere Rerank Fixtures:
 * - COHERE_RERANK_RESPONSES.success: Typical rerank response with scores
 * - COHERE_RERANK_RESPONSES.empty: Empty results response
 * - COHERE_RERANK_RESPONSES.error: Error response structure
 * - COHERE_RERANK_FIXTURES: Sample query and documents
 * 
 * OpenAI Embed Fixtures:
 * - OPENAI_EMBED_RESPONSES.success: Single embedding response
 * - OPENAI_EMBED_RESPONSES.multiEmbedding: Multiple embeddings response
 * - OPENAI_EMBED_RESPONSES.error: Error response structure
 * - OPENAI_EMBED_FIXTURES: Sample text inputs
 * 
 * Expected Usage:
 * ```ts
 * global.fetch = async () => {
 *   return new Response(JSON.stringify(COHERE_RERANK_RESPONSES.success));
 * };
 * ```
 */

