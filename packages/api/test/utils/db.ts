import { Client } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

type TestDb = {
  client: Client;
  db: NodePgDatabase;
};

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

export async function closeTestDb(testDb: TestDb): Promise<void> {
  await testDb.client.end();
}
