import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { EMBEDDING_DIM } from "@alfred/embed";
import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
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

describeFn("ragRepo", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "ragRepo tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    ({ ragRepo } = mod);
    ({ db } = mod);
  });

  beforeEach(async () => {
    await resetRagTables();
  });

  it("stores documents and returns them in descending order", async () => {
    await ragRepo.createDocument("source-a", "Doc A", "Author A");
    const second = await ragRepo.createDocument(
      "source-b",
      "Doc B",
      "Author B"
    );

    const documents = await ragRepo.listDocuments(10, 0);
    expect(documents.length).toBe(2);
    expect(documents[0]?.id).toBe(second.id);
  });

  it("adds chunks, retrieves them in order, and searches by embedding", async () => {
    const document = await ragRepo.createDocument("source-c", "Doc C");

    const [chunkA, chunkB] = await ragRepo.addChunks(document.id, [
      { content: "First chunk", order: 0, embedding: makeVector(0.4) },
      { content: "Second chunk", order: 1, embedding: makeVector(-0.4) },
    ]);

    expect(chunkA.content).toBe("First chunk");
    expect(chunkB.content).toBe("Second chunk");

    const ordered = await ragRepo.getChunks(document.id);
    expect(ordered.map((chunk) => chunk.content)).toEqual([
      "First chunk",
      "Second chunk",
    ]);

    const results = await ragRepo.searchChunks(makeVector(0.4), 5, 0.1);
    expect(results.length).toBe(1);
    expect(results[0]?.content).toBe("First chunk");
  });

  it("deletes documents and cascades to chunks", async () => {
    const doc = await ragRepo.createDocument("source-d", "Doc D");
    await ragRepo.addChunks(doc.id, [
      { content: "Chunk", embedding: makeVector(0.2) },
    ]);

    const removed = await ragRepo.deleteDocument(doc.id);
    expect(removed).toBe(1);

    const chunks = await ragRepo.getChunks(doc.id);
    expect(chunks.length).toBe(0);
  });
});
