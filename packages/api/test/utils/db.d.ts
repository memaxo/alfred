import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";
type TestDb = {
  client: Client;
  db: NodePgDatabase;
};
/**
 * Creates an isolated test database connection.
 * Reusable across packages for consistent test setup.
 */
export declare function createTestDb(): Promise<TestDb>;
/**
 * Closes test database connection.
 */
export declare function closeTestDb(testDb: TestDb): Promise<void>;
/**
 * Truncates all tables in the test database for isolation.
 * Use in beforeEach/afterEach to reset state between tests.
 */
export declare function truncateTables(db: NodePgDatabase): Promise<void>;
/**
 * Test database fixtures for consistent test data
 */
export declare const dbFixtures: {
  /**
   * Creates a test user profile
   */
  createUser(db: NodePgDatabase, userId?: string): Promise<string>;
  /**
   * Creates a test RAG document with chunks
   */
  createRagDocument(
    db: NodePgDatabase,
    source?: string,
    content?: string
  ): Promise<string>;
  /**
   * Creates a test assistant thread
   */
  createThread(
    db: NodePgDatabase,
    userId?: string,
    agent?: string
  ): Promise<string>;
};
