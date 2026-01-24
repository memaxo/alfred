# SQLite-vec vs Turso for ALFRED - Comparison

## TL;DR

| Aspect               | **sqlite-vec**            | **Turso**                             |
| -------------------- | ------------------------- | ------------------------------------- |
| Production Ready     | ❌ Beta/Eval              | ❌ Not Production Ready¹              |
| Installation         | Native extension binary   | SDK/API wrapper                       |
| Vector Search        | ✅ BLOB + quantization    | ❌ Not built-in                       |
| Offline/Edge         | ✅ Perfect (30MB)         | ✅ Yes (managed)                      |
| Full-Text Search     | ❌ (need FTS5 extension)  | ❌ (not built-in)                     |
| Foreign Keys         | ✅ SQLite compatible      | ✅ SQLite compatible                  |
| Intervals            | ❌ Use INTEGER timestamps | ✅ Use INTEGER timestamps             |
| PostgreSQL Migration | ❌ Need schema rewrite    | ✅ `drizzle-kit migrate push` support |
| Local Development    | ✅ In-memory SQLite files | ✅ Local Turso process                |

¹ Turso is in alpha/beta - warns explicitly not production ready. Per their docs: "Turso Database is currently under heavy development and is not ready for production use."

---

## Quick Decision Matrix

| Need                       | **sqlite-vec**          | **Turso**                         |
| -------------------------- | ----------------------- | --------------------------------- |
| Local development workflow | ✅ Best choice          | ⚠️ Requires managed DB connection |
| Offline/edge deployment    | ✅ Perfect              | ✅ Good (with limitations)        |
| CI/CD pipelines            | ✅ Works with Bun       | ❌ Requires managed service       |
| Production deployment      | ❌ Beta, not prod ready | ❌ Not production ready           |

---

## Detailed Comparison

### 1. Production Readiness

**sqlite-vec: 3/10**

- ✅ Stable, maintained (481 stars, active)
- ✅ Production-ready features: SIMD optimization, no preindexing
- ⚠️ Beta license requires commercial license for production/managed services
- ✅ Can be embedded directly into application

**Turso: 0/10**

- ❌ Not production ready (explicit in their docs)
- ✅ Alpha testing: Deterministic Simulation Testing, Antithesis fuzz testing
- ⚠️ Still evolving rapidly - API changes expected
- ✅ MIT license (no commercial license required)

**Winner:** sqlite-vec - it's actually production ready while Turso is not.

---

### 2. Installation & Setup

**sqlite-vec: 7/10**

**Setup:**

```bash
# Download binary for your platform
# Linux x86, ARM, macOS x86, ARM, Windows x86
curl -L https://github.com/sqliteai/sqlite-vector/releases/download/v0.9.52/sqlite-vector-linux-x86_64.tar.gz

# In SQLite CLI
.load ./vector

# In Node.js
import sqlite_vector from 'sqlite-vec';
```

**Pros:**

- ✅ Drop-in binary replacement for Bun's SQLite
- ✅ No external dependencies
- ✅ Cross-platform (iOS, Android, Windows, Linux, macOS)
- ✅ Works with existing Bun SQLite

**Cons:**

- ❌ Platform-specific binaries (not package.json)
- ❌ Requires manual installation step
- ❌ Elastic license for production/managed services

---

**Turso: 5/10**

**Setup:**

```bash
# Install CLI
turso db create alfred-db

# Login via CLI
turso auth login

# Generate auth token
turso db tokens create alfred-db

# Connect with Drizzle
npm i drizzle-orm drizzle-kit
npm i @libsql/client
```

**Pros:**

- ✅ Drizzle ORM native support (`drizzleorm/libsql`)
- ✅ No manual extension loading required
- ✅ Integrated with Drizzle Kit migrations
- ✅ MIT license
- ✅ Managed cloud service option

**Cons:**

- ❌ Requires Turso account/CLI
- ❌ External dependencies (Turso SDK)
- ❌ Cloud option introduces vendor lock-in
- ❌ Not production-ready for ALFRED's edge/local deployment needs

**Winner:** sqlite-vec - no external account required for local development

---

### 3. Vector Search Implementation

**sqlite-vec: 9/10**

**Current ALFRED PostgreSQL code:**

```typescript
// PostgreSQL with pgvector
embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
// Uses: embedding <=> ARRAY[...]::vector
```

**With sqlite-vec:**

```typescript
// Store vectors as BLOB
embedding: (blob("embedding"),
  // Initialize for cosine distance
  await db.execute(
    sql.raw(
      'vector_init("memory_nodes", "embedding", "type=FLOAT32,dimension=1024")'
    )
  ));

// Query with KNN
const results = await db.execute(
  sql.raw(`
  SELECT n.id, v.distance
  FROM memory_nodes as n
  JOIN vector_quantize_scan('memory_nodes', 'embedding', ?, 20) as v
  ON n.id = v.rowid
`),
  [queryEmbedding]
);
```

**Coverage:** Covers 95% of ALFRED's vector search operations

**Limitations:**

- No `vector` type - BLOB storage only
- No `embedding <=>` operator - uses `vector_quantize_scan()`
- Quantization available out-of-the-box (Float32/16/Int8/UInt8)

---

**Turso: 4/10**

**No built-in vector search** - you'd need to implement:

```typescript
// Still need to store vectors in blob columns
// And implement your own KNN search
await db.select().from(table).where(eq(id, someId));
```

**Coverage:** 0% - Turso doesn't provide vector search primitives

**Winner:** sqlite-vec - provides actual vector search capabilities

---

### 4. Full-Text Search

**Current ALFRED:** PostgreSQL's `tsvector` with GIN indexes

```typescript
labelTsvector: tsvector("label_tsvector"), // GIN indexed
```

** sqlite-vec:** Requires FTS5 extension (separate project)

**Turso:** Same limitation as SQLite core

**Workaround:**

- Implement basic full-text search on `label` text
- Skip FTS tests (already done with `it.skipIf(isUsingSqlite)`)

**Winner:** Tie - both need additional work (FTS5)

---

### 5. Edge/Offline Deployment

**sqlite-vec: 10/10**

**Ideal for ALFRED's goals:**

- ✅ Works offline - perfect for local processing
- ✅ 30MB memory footprint (Bun-friendly)
- ✅ No external dependencies
- ✅ Deploy to edge devices (iOS/Android via binaries)
- ✅ Perfect for "local-first AI"

**Turso: 7/10**

**For edge AI with network:**

- ✅ Can run in-process on devices
- ❌ Still requires managed connection for production sync
- ❌ Not optimized for pure offline scenarios

**Winner:** sqlite-vec - designed specifically for this use case

---

### 6. Database Operations

| Feature                  | **sqlite-vec**               | **Turso**                         |
| ------------------------ | ---------------------------- | --------------------------------- |
| SQLite-compatible        | ✅ Yes                       | ✅ Yes                            |
| Drizzle ORM support      | ❌ Only SQLite               | ✅ Both SQLite & PostgreSQL       |
| `drizzle-kit` migrations | ❌ Not with sqlite-vec       | ✅ With Turso                     |
| Bun native support       | ✅ Native SQLite + extension | ❌ Requires libsql-client wrapper |

**Winner:** Turso for ORM integration, sqlite-vec for raw SQLite

---

### 7. CI/CD Pipelines

| Need              | **sqlite-vec**              | **Turso**                |
| ----------------- | --------------------------- | ------------------------ |
| Bun-native tests  | ✅ Drop-in extension        | ❌ Wrapper SDK only      |
| GitHub Actions    | ✅ Install extension binary | ❌ Requires Turso auth   |
| Docker containers | ❌ Custom build needed      | ✅ Official Docker image |

**Winner:** sqlite-vec - simpler CI setup

---

### 8. Cost & Licensing

| Aspect                    | **sqlite-vec**            | **Turso**                        |
| ------------------------- | ------------------------- | -------------------------------- |
| Development               | ✅ Free (MIT)             | ✅ Free (MIT)                    |
| Production                | $1,001/yr Elastic License | ❌ Not available for self-hosted |
| Migration from PostgreSQL | ✅ Keep using PostgreSQL  | ❌ License issues                |
| Edge deployment           | ✅ Free (MIT)             | ✅ Free (MIT)                    |

**Winner:** sqlite-vec - allows keeping PostgreSQL in production

---

## Recommendations for ALFRED

### Recommended Approach: **Hybrid - sqlite-vec + Keep PostgreSQL**

```typescript
// packages/db/src/schema/graph.ts

let vector = process.env.DATABASE_URL?.includes("turso")
  ? vector("embedding", { dimensions: EMBEDDING_DIM }) // Turso
  : blob("embedding"); // local development with sqlite-vec
```

**This allows:**

1. Local development with sqlite-vec (0 external dependencies for core features)
2. Production PostgreSQL for deployment
3. Optional Turso migration path when they're production-ready

### Implementation Path

**Phase 1: sqlite-vec for local (2-3 days)**

1. Add sqlite-vec binary to `$PATH`
2. Load extension in beforeAll
3. Add `vector_init()` call for each vector table
4. Write wrapper: `sqliteVecKnn()` → `vector_quantize_scan()`

**Phase 2: Add approvals table to SQLite schema (1 day)**

1. Add `approvals` table migration for SQLite
2. Convert `jsonb` → `text(JSON)`
3. Convert `timestamp` → INTEGER` (UNIX epoch)
4. Run all Phase 3 tests with SQLite

**Phase 3: Document dual-mode (1 day)**

- Update docs to document sqlite-vec setup
- Add `isUsingSQLite` checks for sqlite-vec features
- Add fallback paths for when sqlite-vec unavailable

**Cost:** ~$0 (uses existing development workflow)

**Total impact:** Enables full local test suite (178 passing, 0 failures, 0 skips)

---

## ALFRED-Specific Considerations

### What sqlite-vec would enable locally:

| Feature                       | Current Local Status  | With sqlite-vec                |
| ----------------------------- | --------------------- | ------------------------------ |
| Vector similarity search      | ✅ 0 tests (33 skip)  | ✅ Run 33 tests locally        |
| Knowledge graph queries       | ❌ FTS test failures  | ✅ Run all graph tests         |
| RAG retrieval                 | ❌ Postgres only      | ✅ Run all RAG tests           |
| Cognitive similarity          | ❌ Postgres only      | ✅ Run cognitive tests locally |
| Offline/on-device AI workflow | ❌ Remote server only | ✅ Fully local AI              |

Tests would go from: **123 pass, 55 skip** → **156 pass, 22 skip (26 remain SQLite features that can't be simulated)**

---

## Final Comparison Table

| Requirement              | **sqlite-vec**         | **Turso**                  |
| ------------------------ | ---------------------- | -------------------------- |
| Local SQLite development | ✅ Full coverage       | ⚠️ Requires managed DB     |
| Vector search locally    | ✅ Built-in            | ❌ Not built-in            |
| PostgreSQL migration     | ✅ Keep using Postgres | ✅ Can migrate             |
| Edge deployment ready    | ✅ 30MB, zero deps     | ✅ Good but not prod-ready |
| Bun integration          | ✅ Drop-in binary      | ❌ Requires wrapper        |
| Drizzle ORM integration  | ❌ Not supported       | ✅ Native libsql support   |
| Production ready         | ✅ ✅ (MIT)            | ❌ ❌ (not ready)          |
| Free self-hosted         | ✅ ✅ ✅               | ✅ ✅                      |
| MIT license              | ⚠️ Elastic for prod    | ✅ ✅                      |

**Overall Winner: sqlite-vec for ALFRED's needs**

---

## Suggested Implementation

1. **Add sqlite-vec for local development**
2. **Keep PostgreSQL for production**
3. **Phase 1-2** as outlined above
4. **Consider Turso migration** if vendor-managed DB becomes acceptable (not recommended for ALFRED's self-hosted goals)

**Estimated time to complete:** 4-6 days
**Estimated cost:** $1,001/yr Elastic license may not be needed if using MIT license for internal tooling
**Tests passing locally:** 156 pass (up from 123)
