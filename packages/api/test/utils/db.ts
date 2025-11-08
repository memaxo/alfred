import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";

type TestDb = {
  client: Client;
  db: NodePgDatabase;
};

/**
 * Creates an isolated test database connection.
 * Reusable across packages for consistent test setup.
 */
export async function createTestDb(): Promise<TestDb> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set for tests");
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  const db = drizzle(client);
  return { client, db };
}

/**
 * Closes test database connection.
 */
export async function closeTestDb(testDb: TestDb): Promise<void> {
  await testDb.client.end();
}

/**
 * Truncates all tables in the test database for isolation.
 * Use in beforeEach/afterEach to reset state between tests.
 */
export async function truncateTables(db: NodePgDatabase): Promise<void> {
  const tables = [
    "rag_chunks",
    "rag_documents",
    "user_facts",
    "user_preferences",
    "user_profiles",
    "assistant_threads",
    "assistant_messages",
    "policy_audit_logs",
    "eval_runs",
    "eval_scores",
    "eval_definitions",
    "eval_datasets",
    "memory_nodes",
    "memory_edges",
  ];

  await db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(", ")} CASCADE`));
}

/**
 * Test database fixtures for consistent test data
 */
export const dbFixtures = {
  /**
   * Creates a test user profile
   */
  async createUser(db: NodePgDatabase, userId = "test-user") {
    await db.execute(sql`
      INSERT INTO user_profiles (id, email, name)
      VALUES (${userId}, ${`${userId}@test.com`}, ${`Test User ${userId}`})
      ON CONFLICT (id) DO NOTHING
    `);
    return userId;
  },

  /**
   * Creates a test RAG document with chunks
   */
  async createRagDocument(
    db: NodePgDatabase,
    source = "test-source",
    content = "Test content"
  ) {
    const docResult = await db.execute(sql`
      INSERT INTO rag_documents (source, title)
      VALUES (${source}, ${`Doc ${source}`})
      RETURNING id
    `);
    const docId = docResult.rows[0]?.id as string;

    if (!docId) {
      throw new Error("Failed to create test document");
    }

    await db.execute(sql`
      INSERT INTO rag_chunks (document_id, content, order_index, embedding)
      VALUES (
        ${docId},
        ${content},
        0,
        ${JSON.stringify(Array.from({ length: 1536 }, (_, i) => (i === 0 ? 0.5 : 0)))}
      )
    `);

    return docId;
  },

  /**
   * Creates a test assistant thread
   */
  async createThread(
    db: NodePgDatabase,
    userId = "test-user",
    agent = "assistant"
  ) {
    const threadResult = await db.execute(sql`
      INSERT INTO assistant_threads (user_id, agent)
      VALUES (${userId}, ${agent})
      RETURNING id
    `);
    return threadResult.rows[0]?.id as string;
  },
};
