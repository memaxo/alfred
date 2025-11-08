import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describe : describe.skip;

let ragRepo: typeof import("@alfred/db").ragRepo;
let db: typeof import("@alfred/db").db;

beforeAll(async () => {
  if (!SHOULD_RUN) {
    return;
  }
  const mod = await import("@alfred/db");
  ragRepo = mod.ragRepo;
  db = mod.db;
});

async function resetRagTables() {
  if (!SHOULD_RUN) return;
  await db.execute(
    sql`TRUNCATE rag_chunks, rag_documents RESTART IDENTITY CASCADE`
  );
}

function makeVector(seed: number) {
  return Array.from({ length: 1536 }, (_, index) => (index === 0 ? seed : 0));
}

beforeEach(async () => {
  await resetRagTables();
});

describeFn("searchChunks with efSearch", () => {
  it("sets LOCAL ef_search correctly", async () => {
    await ragRepo.createDocument("source", "Doc");
    await ragRepo.addChunks("1", [
      { content: "Chunk", embedding: makeVector(0.5) },
    ]);

    await expect(
      ragRepo.searchChunks(makeVector(0.5), 5, 0.1, { efSearch: 120 })
    ).resolves.toBeInstanceOf(Array);
  });
});
