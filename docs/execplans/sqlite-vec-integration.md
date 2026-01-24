# Plan: Add sqlite-vec Integration to ALFRED

## Purpose

Add sqlite-vec support to ALFRED to enable vector similarity search capabilities in local SQLite development mode, increasing test coverage from 56% to ~87%.

## Current State

**Before sqlite-vec:**

- 123 passing tests
- 55 skipped tests (51 SQLite limitations)
- 274 total integration tests across 26 files
- Critical gap: No vector search in SQLite mode blocks graph/knowledge/RAG/cognitive tests
- 33 vector-dependent tests currently skipped

**After sqlite-vec:**

- **Estimate: 156 passing tests** (+33 vector tests unblocked)
- **Estimate: 25 skipped tests** (30SQLite + 1 tsvector + 4 other gaps remain)
- **Estimate: 97% coverage** of Phase 1-4 tests

## Goals

1. Enable vector similarity search in all local tests
2. Unclock graph/knowledge/RAG/cognitive test suites
3. No external dependencies for local development workflow
4. Keep PostgreSQL for production deployment path open
5. Simple Bun integration (no complex SDKs or services)

## Non-Goals

- Don't add Turso integration (not production-ready)
- Don't remove PostgreSQL support
- Don't compromise local development speed
- Don't add infrastructure requirements (keep it portable)

## Dependencies

- `sqlite-vec` extension (native extension binary)
- Bun's built-in SQLite (v1.3+)
- Existing `@alfred/embed` quantization (reused)
- Existing `@alfred/db/libsql` client (switches driver)
- Existing test infrastructure

---

## Plan

### Phase 1: Research & Setup (Est: 2 hours)

- [**1.1**] Study sqlite-vec API documentation (KNN, distance functions)
- [**1.2**] Download and verify sqlite-vec binary for platform (macOS x86_64)
- [**1.3**] Verify Bun SQLite accepts `.load()` extension loading
- [**1.4**] Document `vec_init()` call pattern for `memoryNodes.embedding`
- [**1.5**] Document `vector_quantize_scan()` KNN query pattern

---

### Phase 2: Test Infrastructure (Est: 3 hours)

- [**2.1** Create sqlite-vec test helper functions
  - `initializeVecExtension()` - Loads extension or logs warning
  - `vecInitTable()` - `vector_init()` wrapper
  - `vecKnnQuery()` - `vector_quantize_scan()` wrapper
  - `vecCosineDistance()` - Cosine similarity wrapper
- [**2.2** Create test fixtures for vector operations
  - Mock sqlite-vec if binary not available
  - Provide fallback behavior

---

### Phase 3: Database Schema Updates (Est: 2 hours)

- [**3.1** Add `vec_init()` calls to `migrations/*.sql`
  - In `0001_memory_nodes.sql`: Add after table creation
  - `SELECT load_extension('./vector');` before insert
  - `SELECT vector_init('memory_nodes', 'embedding', 'type=FLOAT32,dimension=1024');`
- [**3.2** Update `libsql` client to test extension loading
  - Add `checkVecExtension()` function
  - Log warning if extension not available
- [**3.3** Update `memoryNodes` schema comment
  - Document vector storage approach: "BLOB for sqlite-vec compatibility"
- [**3.4** Update `db/client.ts` to handle vec_init errors gracefully
- Try-catch with fallback to blob storage

---

### Phase 4: Repository Layer Updates (Est: 4 hours)

- [**4.1** Create `libsql-vec.ts` helper module
  - `loadVecExtension()` - loads binary or logs warning
  - `initVecTable()` - generates vector_init SQL
  - `vecKnnQuery()` - generates vector_quantize_scan SQL with parameters
- [**4.2** Add to `packages/db/src/index.ts` exports
- [**4.3** Add helper to `packages/db/src/repo/graph/read.ts`
  - Add `vecKnn()` helper to existing query functions
  - Integrate sqlite-vec KNN into `findNearestConcept` for semantic search
- [**4.4** Add integration in `packages/db/src/repo/graph/scoring.ts`
  - Vector distance calculation using sqlite-vec cosine distance
  - Skip initialization if sqlite-vec not available

---

### Phase 5: Test Implementation (Estimate: 6 hours)

- [**5.1]\*\* Update existing tests with sqlite-vec helpers
  - `cognitive-state-machine.test.ts` → Add vector similarity tests
  - `knowledge-to-adapter.test.ts` → Test with real vector KNN
  - `learning-full-pipeline.test.ts` → Test knowledge vector persistence
- [**5.2** Create new vector-specific test file
  - `vector-search-integration.test.ts` - Pure vector KNN focus
  - Test pattern similar to Turso example workflow
- [**5.3** Mock sqlite-vec in tests when not available
  - Add fallback warnings to test suite hooks

---

### Phase 6: CI/CD Updates (Estimate: 2 hours)

- [**6.1]\*\* Update `.github/workflows/ci.yml`
  - Add sqlite-vec binary download step (macOS-x86_64, linux-x86_64, linux-arm64)
  - Cache extension binary in artifacts directory
- [**6.2** Update `scripts/test-bun.ts`
  - Log sqlite-vec version on test startup
  - Skip vector-specific tests if extension not loaded
- [**6.3** Update `README.md`
  - Document sqlite-vec installation for development
  - Add troubleshooting section

---

### Phase 7: Documentation (Estimate: 1 hour)

- [**7.1** Update `docs/testing/limitations-known.md`
  - Document sqlite-vec feature parity with PostgreSQL
  - Note what tests still require PostgreSQL
  - Remove or update "missing vector search in SQLite" limitation
- [**7.2** Update `docs/testing/environment-variables.md`
  - Add `SQLITE_VEC_VERSION` env var
  - Document fallback behavior when extension not loaded
- [**7.3** Update `docs/testing/obligation-workflow-testing.md`
  - Add vector persistence patterns for test assertions

---

## Implementation Details

### sqlite-vec API to Use

**Load extension:**

```typescript
import { createTestDb } from "@alfred/db/testing";

beforeAll(async () => {
  try {
    const vec = await import("sqlite_vector");
    // Initialize embedding column
  })
  catch {
    console.warn("sqlite-vec not available - vector tests will be skipped");
  }
});
```

**Store vector:**

```typescript
// 1024-dimensional Float32 vector as BLOB
const vector = new Float32Array(1024);
buffer = new Uint8Array(1024);
new DataView(buffer.buffer).setFloat32(vector);
```

**Initialize table:**

```typescript
await db.execute(
  `SELECT vector_init('memory_nodes', 'embedding', 'type=FLOAT32,dimension=${EMBEDDING_DIM}')`
);
```

**KNN Query:**

```typescript
const { knn } = await import("@alfred/knowledge");

// Pattern 1: Using helper
const similar = await knn({
  node: { id: "node-1" },
  query: queryEmbedding, // Float32Array(1024)
  topK: 20,
  tableName: "memory_nodes",
  vectorColumn: "embedding",
});

// Pattern 2: Direct SQL
const results = await db.execute(
  sql`
  SELECT n.id, v.distance
  FROM memory_nodes as n
  JOIN vector_quantize_scan('memory_nodes', 'embedding', ?, 20) as v
  ON n.id = v.rowid
`,
  [queryEmbedding]
);
```

**Cosine similarity:**

```typescript
const distance = await db.execute(
  sql`
  SELECT vcosine(embedding, query_embeddings[::text) AS similarity
  FROM vcosine(
    embedded,
    json_quote(query_embeddings::text),
    1024
  ) LIMIT 1
`,
  [embedded]
);
```

---

## File Structure

**Files to create:**

```
packages/db/
├── migrations/
│   ├── 0001_memory_nodes.sql
│   ├── 0034_graph_traversal_indexes.sql
│   └── ...existing migrations...
├── src/
│   ├── client.ts              ← Update driver loading
│   ├── index.ts                 ← Add exports
│   └── libsql-vec.ts        ← NEW Helper module
│   └── schema/
│       ├── graph.ts              ← Update vector storage
│       └── ...other schemas...
└── test/
    ├── utils/
    ├── graph-vec-helper.ts      ← NEW Test helpers
    └── ...other utils...
└── docs/
    ├── testing/
    │   ├── limitations-known.md    ← Update docs
    │   ├── environment-variables.md     ← Update docs
    │   └── obligation-workflow-testing.md
    └── execplans/
        └──sqlite-vec-integration.md ← THIS PLAN
```

---

## Risk Assessment

| Risk                            | Likelihood | Mitigation                                                |
| ------------------------------- | ---------- | --------------------------------------------------------- |
| sqlite-vec binary compatibility | Low        | Download multiple binaries, macOS x86_64 and linux-x86_64 |
| SQLite compatibility changes    | Low        | Use SQLite version checking; add version gating           |
| Bun extension loading issues    | Low        | Add early check with try/catch with fallback              |
| Performance regression unknown  | Low        | sqlite-vec designed for performance                       |
| sqlite-vec license issues       | Low        | MIT license for development, skip commercial usage        |

---

## Rollback Plan

If issues arise:

1. **Extension fails to load**: Log warning, skip vector tests, continue development
2. **Test timeouts**: Reduce `topK` parameter, tune batch sizes
3. **Build issues**: Keep using PostgreSQL for those tests

---

## Success Criteria

- ✓ All 33 vector-dependent tests pass locally without external DB
- ✓ Existing 123 non-vector tests continue to pass
- ✓ No added runtime dependencies for most workflows
- ✓ PostgreSQL tests remain unchanged in CI
- ✓ Documentation updated for sqlite-vec usage
- ✓ CI passes with sqlite-vec binary loaded

---

## Out of Scope

**Not covered:**

- Full-text search (FTS5 extension required)
- tsvector workarounds (would need FTS5)
- Turso migration (not production-ready)

---

## Notes

- This plan assumes Bun 1.3+ supports `.load()` of native SQLite extensions
- sqlite-vec doesn't have a Bun-specific package - uses native binary
- The `EMBEDDING_DIM` of 1024 from `@alfred/embed` works with sqlite-vec quantization
- `vector_quantize_scan()` returns rowid and distance (0-1 scale) matching HNSW top-K behavior
- `sqlite-vec::vec0_*` syntax works with `drizzle-orm/sqlite` driver
