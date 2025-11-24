import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { EMBEDDING_DIM } from "@alfred/embed";
import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { sql } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

let ragRepo: typeof import("@alfred/db").ragRepo;
let db: typeof import("@alfred/db").db;

async function resetRagTables() {
  if (!db) {
    return;
  }
  await db.execute(
    sql`TRUNCATE rag_chunks, rag_documents RESTART IDENTITY CASCADE`
  );
}

function makeVector(seed: number) {
  return Array.from({ length: EMBEDDING_DIM }, (_, index) =>
    index === 0 ? seed : 0
  );
}

describeFn("searchChunks with efSearch", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "RAG hybrid tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    ragRepo = mod.ragRepo;
    db = mod.db;
  });

  beforeEach(async () => {
    await resetRagTables();
  });

  it("sets LOCAL ef_search correctly", async () => {
    const document = await ragRepo.createDocument("source", "Doc");
    await ragRepo.addChunks(document.id, [
      { content: "Chunk", embedding: makeVector(0.5) },
    ]);

    await expect(
      ragRepo.searchChunks(makeVector(0.5), 5, 0.1, undefined, 120)
    ).resolves.toBeInstanceOf(Array);
  });
});
