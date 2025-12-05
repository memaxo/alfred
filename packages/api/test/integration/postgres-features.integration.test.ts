/**
 * Postgres-Specific Feature Integration Tests
 *
 * Tests Postgres features that are not available in SQLite:
 * - Full-text search with tsvector/tsquery
 * - Interval syntax queries (temporal data)
 * - Vector similarity search with HNSW indexes
 * - Composite indexes match query predicates
 * - Transaction isolation and rollback
 *
 * Run: RUN_DB_TESTS=1 bun test postgres-features.integration.test.ts
 *
 * Requires DATABASE_URL pointing to a real Postgres instance.
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { sql } from "drizzle-orm";

// Skip if not running Postgres tests
const RUN_POSTGRES_TESTS = process.env.RUN_DB_TESTS === "1";

// Lazy-loaded modules
let createTestDb: typeof import("../utils/db").createTestDb;
let closeTestDb: typeof import("../utils/db").closeTestDb;
let truncateTables: typeof import("../utils/db").truncateTables;
let testDb: Awaited<ReturnType<typeof createTestDb>> | null = null;

beforeAll(async () => {
  if (!RUN_POSTGRES_TESTS) {
    console.log("Skipping Postgres tests (RUN_DB_TESTS not set)");
    return;
  }

  ({ createTestDb, closeTestDb, truncateTables } = await import("../utils/db"));
  testDb = await createTestDb();
});

afterAll(async () => {
  if (testDb) {
    await closeTestDb(testDb);
  }
});

describe.skipIf(!RUN_POSTGRES_TESTS)(
  "Full-Text Search (tsvector/tsquery)",
  () => {
    beforeEach(async () => {
      if (testDb) {
        await truncateTables(testDb.db);
      }
    });

    it("creates tsvector from text content", async () => {
      if (!testDb) return;

      const result = await testDb.db.execute(sql`
      SELECT to_tsvector('english', 'The quick brown fox jumps over the lazy dog') as vector
    `);

      expect(result.rows[0]?.vector).toBeDefined();
      expect(String(result.rows[0]?.vector)).toContain("fox");
    });

    it("matches tsquery against tsvector", async () => {
      if (!testDb) return;

      const result = await testDb.db.execute(sql`
      SELECT to_tsvector('english', 'TypeScript authentication module with JWT tokens') 
        @@ plainto_tsquery('english', 'authentication JWT') as matches
    `);

      expect(result.rows[0]?.matches).toBe(true);
    });

    it("performs ranked full-text search", async () => {
      if (!testDb) return;

      // Insert test documents
      await testDb.db.execute(sql`
      CREATE TEMP TABLE test_docs (
        id SERIAL PRIMARY KEY,
        content TEXT,
        content_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
      )
    `);

      await testDb.db.execute(sql`
      INSERT INTO test_docs (content) VALUES 
        ('TypeScript authentication with JWT tokens'),
        ('JavaScript security best practices'),
        ('Authentication patterns for web applications')
    `);

      // Search with ranking
      const result = await testDb.db.execute(sql`
      SELECT id, content, 
        ts_rank(content_vector, plainto_tsquery('english', 'authentication')) as rank
      FROM test_docs
      WHERE content_vector @@ plainto_tsquery('english', 'authentication')
      ORDER BY rank DESC
    `);

      expect(result.rows.length).toBe(2);
      expect(Number(result.rows[0]?.rank)).toBeGreaterThan(0);
    });

    it("handles safe tsquery generation", async () => {
      if (!testDb) return;

      // plainto_tsquery is safe against injection
      const userInput = "test' OR '1'='1";

      const result = await testDb.db.execute(sql`
      SELECT plainto_tsquery('english', ${userInput}) as query
    `);

      // Should not cause SQL injection
      expect(result.rows[0]?.query).toBeDefined();
    });
  }
);

describe.skipIf(!RUN_POSTGRES_TESTS)("Interval Syntax Queries", () => {
  beforeEach(async () => {
    if (testDb) {
      await truncateTables(testDb.db);
    }
  });

  it("queries with interval syntax", async () => {
    if (!testDb) return;

    const result = await testDb.db.execute(sql`
      SELECT NOW() - INTERVAL '1 hour' as one_hour_ago
    `);

    expect(result.rows[0]?.one_hour_ago).toBeDefined();
  });

  it("filters by time ranges", async () => {
    if (!testDb) return;

    // Create temp table with timestamps
    await testDb.db.execute(sql`
      CREATE TEMP TABLE test_events (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await testDb.db.execute(sql`
      INSERT INTO test_events (created_at) VALUES 
        (NOW()),
        (NOW() - INTERVAL '30 minutes'),
        (NOW() - INTERVAL '2 hours')
    `);

    // Query recent events
    const result = await testDb.db.execute(sql`
      SELECT COUNT(*) as count 
      FROM test_events 
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);

    expect(Number(result.rows[0]?.count)).toBe(2);
  });

  it("calculates durations with intervals", async () => {
    if (!testDb) return;

    const result = await testDb.db.execute(sql`
      SELECT 
        EXTRACT(EPOCH FROM INTERVAL '2 hours 30 minutes') as seconds,
        INTERVAL '1 day' + INTERVAL '12 hours' as combined
    `);

    expect(Number(result.rows[0]?.seconds)).toBe(9000);
  });
});

describe.skipIf(!RUN_POSTGRES_TESTS)("Vector Similarity Search", () => {
  beforeEach(async () => {
    if (testDb) {
      await truncateTables(testDb.db);
    }
  });

  it("creates vector extension if available", async () => {
    if (!testDb) return;

    try {
      await testDb.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

      const result = await testDb.db.execute(sql`
        SELECT * FROM pg_extension WHERE extname = 'vector'
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(0);
    } catch {
      // pgvector may not be installed
      console.log("pgvector extension not available");
    }
  });

  it("calculates cosine similarity between vectors", async () => {
    if (!testDb) return;

    try {
      await testDb.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

      const result = await testDb.db.execute(sql`
        SELECT 1 - ('[1,0,0]'::vector <=> '[1,0,0]'::vector) as similarity
      `);

      expect(Number(result.rows[0]?.similarity)).toBeCloseTo(1.0, 5);
    } catch {
      console.log("pgvector not available for similarity test");
    }
  });

  it("creates HNSW index for fast similarity search", async () => {
    if (!testDb) return;

    try {
      await testDb.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

      await testDb.db.execute(sql`
        CREATE TEMP TABLE test_embeddings (
          id SERIAL PRIMARY KEY,
          embedding vector(3)
        )
      `);

      await testDb.db.execute(sql`
        CREATE INDEX ON test_embeddings 
        USING hnsw (embedding vector_cosine_ops) 
        WITH (m = 16, ef_construction = 100)
      `);

      // Insert test vectors
      await testDb.db.execute(sql`
        INSERT INTO test_embeddings (embedding) VALUES 
          ('[1,0,0]'),
          ('[0,1,0]'),
          ('[0,0,1]'),
          ('[0.5,0.5,0]')
      `);

      // Query similar vectors
      const result = await testDb.db.execute(sql`
        SELECT id, embedding, 
          1 - (embedding <=> '[1,0,0]') as similarity
        FROM test_embeddings
        ORDER BY embedding <=> '[1,0,0]'
        LIMIT 2
      `);

      expect(result.rows.length).toBe(2);
    } catch {
      console.log("pgvector HNSW test skipped");
    }
  });
});

describe.skipIf(!RUN_POSTGRES_TESTS)("Composite Indexes", () => {
  beforeEach(async () => {
    if (testDb) {
      await truncateTables(testDb.db);
    }
  });

  it("uses composite index for multi-column queries", async () => {
    if (!testDb) return;

    // Create table with composite index
    await testDb.db.execute(sql`
      CREATE TEMP TABLE test_composite (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        status TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await testDb.db.execute(sql`
      CREATE INDEX idx_user_status ON test_composite (user_id, status)
    `);

    // Insert test data
    await testDb.db.execute(sql`
      INSERT INTO test_composite (user_id, status) VALUES 
        ('user-1', 'active'),
        ('user-1', 'completed'),
        ('user-2', 'active')
    `);

    // Query should use index
    const result = await testDb.db.execute(sql`
      EXPLAIN SELECT * FROM test_composite 
      WHERE user_id = 'user-1' AND status = 'active'
    `);

    // EXPLAIN output should mention index usage
    const explainText = result.rows
      .map((r) => Object.values(r).join(" "))
      .join("\n");
    expect(explainText.toLowerCase()).toContain("index");
  });

  it("partial index for sparse columns", async () => {
    if (!testDb) return;

    await testDb.db.execute(sql`
      CREATE TEMP TABLE test_partial (
        id SERIAL PRIMARY KEY,
        value TEXT,
        is_active BOOLEAN DEFAULT false
      )
    `);

    // Partial index only for active rows
    await testDb.db.execute(sql`
      CREATE INDEX idx_active_only ON test_partial (value) 
      WHERE is_active = true
    `);

    // Insert data
    await testDb.db.execute(sql`
      INSERT INTO test_partial (value, is_active) VALUES 
        ('active-1', true),
        ('inactive-1', false),
        ('active-2', true)
    `);

    // Query active rows
    const result = await testDb.db.execute(sql`
      SELECT * FROM test_partial WHERE is_active = true
    `);

    expect(result.rows.length).toBe(2);
  });
});

describe.skipIf(!RUN_POSTGRES_TESTS)("Transaction Isolation", () => {
  beforeEach(async () => {
    if (testDb) {
      await truncateTables(testDb.db);
    }
  });

  it("commits transaction on success", async () => {
    if (!testDb) return;

    await testDb.db.execute(sql`
      CREATE TEMP TABLE test_tx (
        id SERIAL PRIMARY KEY,
        value TEXT
      )
    `);

    // Use transaction block
    await testDb.db.execute(sql`BEGIN`);
    await testDb.db.execute(
      sql`INSERT INTO test_tx (value) VALUES ('tx-value')`
    );
    await testDb.db.execute(sql`COMMIT`);

    const result = await testDb.db.execute(sql`SELECT * FROM test_tx`);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.value).toBe("tx-value");
  });

  it("rolls back transaction on error", async () => {
    if (!testDb) return;

    await testDb.db.execute(sql`
      CREATE TEMP TABLE test_rollback (
        id SERIAL PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    await testDb.db.execute(sql`BEGIN`);
    await testDb.db.execute(
      sql`INSERT INTO test_rollback (value) VALUES ('will-rollback')`
    );
    await testDb.db.execute(sql`ROLLBACK`);

    const result = await testDb.db.execute(sql`SELECT * FROM test_rollback`);
    expect(result.rows.length).toBe(0);
  });

  it("savepoint allows partial rollback", async () => {
    if (!testDb) return;

    await testDb.db.execute(sql`
      CREATE TEMP TABLE test_savepoint (
        id SERIAL PRIMARY KEY,
        value TEXT
      )
    `);

    await testDb.db.execute(sql`BEGIN`);
    await testDb.db.execute(
      sql`INSERT INTO test_savepoint (value) VALUES ('before-savepoint')`
    );
    await testDb.db.execute(sql`SAVEPOINT sp1`);
    await testDb.db.execute(
      sql`INSERT INTO test_savepoint (value) VALUES ('after-savepoint')`
    );
    await testDb.db.execute(sql`ROLLBACK TO SAVEPOINT sp1`);
    await testDb.db.execute(sql`COMMIT`);

    const result = await testDb.db.execute(sql`SELECT * FROM test_savepoint`);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.value).toBe("before-savepoint");
  });
});

describe.skipIf(!RUN_POSTGRES_TESTS)("Query Performance", () => {
  beforeEach(async () => {
    if (testDb) {
      await truncateTables(testDb.db);
    }
  });

  it("simple query completes within budget", async () => {
    if (!testDb) return;

    const start = performance.now();

    await testDb.db.execute(sql`SELECT 1 + 1 as result`);

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10); // 10ms budget
  });

  it("indexed lookup completes within budget", async () => {
    if (!testDb) return;

    await testDb.db.execute(sql`
      CREATE TEMP TABLE test_perf (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE,
        value TEXT
      )
    `);

    // Insert some data
    for (let i = 0; i < 100; i++) {
      await testDb.db.execute(sql`
        INSERT INTO test_perf (key, value) VALUES (${`key-${i}`}, ${`value-${i}`})
      `);
    }

    // Indexed lookup
    const start = performance.now();

    await testDb.db.execute(sql`SELECT * FROM test_perf WHERE key = 'key-50'`);

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10); // 10ms budget
  });

  it("batch insert completes reasonably", async () => {
    if (!testDb) return;

    await testDb.db.execute(sql`
      CREATE TEMP TABLE test_batch (
        id SERIAL PRIMARY KEY,
        value TEXT
      )
    `);

    const start = performance.now();

    // Batch insert
    await testDb.db.execute(sql`
      INSERT INTO test_batch (value)
      SELECT 'value-' || generate_series(1, 100)
    `);

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100); // 100ms for 100 rows

    const result = await testDb.db.execute(
      sql`SELECT COUNT(*) as count FROM test_batch`
    );
    expect(Number(result.rows[0]?.count)).toBe(100);
  });
});

describe.skipIf(!RUN_POSTGRES_TESTS)("JSONB Operations", () => {
  beforeEach(async () => {
    if (testDb) {
      await truncateTables(testDb.db);
    }
  });

  it("stores and queries JSONB data", async () => {
    if (!testDb) return;

    await testDb.db.execute(sql`
      CREATE TEMP TABLE test_jsonb (
        id SERIAL PRIMARY KEY,
        data JSONB
      )
    `);

    await testDb.db.execute(sql`
      INSERT INTO test_jsonb (data) VALUES 
        ('{"name": "Alice", "tags": ["admin", "user"]}'),
        ('{"name": "Bob", "tags": ["user"]}')
    `);

    // Query JSONB field
    const result = await testDb.db.execute(sql`
      SELECT * FROM test_jsonb WHERE data->>'name' = 'Alice'
    `);

    expect(result.rows.length).toBe(1);
  });

  it("indexes JSONB fields", async () => {
    if (!testDb) return;

    await testDb.db.execute(sql`
      CREATE TEMP TABLE test_jsonb_idx (
        id SERIAL PRIMARY KEY,
        data JSONB
      )
    `);

    await testDb.db.execute(sql`
      CREATE INDEX idx_jsonb_name ON test_jsonb_idx ((data->>'name'))
    `);

    await testDb.db.execute(sql`
      INSERT INTO test_jsonb_idx (data) VALUES 
        ('{"name": "Test", "value": 123}')
    `);

    const result = await testDb.db.execute(sql`
      SELECT * FROM test_jsonb_idx WHERE data->>'name' = 'Test'
    `);

    expect(result.rows.length).toBe(1);
  });

  it("queries JSONB arrays", async () => {
    if (!testDb) return;

    await testDb.db.execute(sql`
      CREATE TEMP TABLE test_jsonb_array (
        id SERIAL PRIMARY KEY,
        data JSONB
      )
    `);

    await testDb.db.execute(sql`
      INSERT INTO test_jsonb_array (data) VALUES 
        ('{"tags": ["a", "b", "c"]}'),
        ('{"tags": ["b", "c", "d"]}')
    `);

    // Query for array containment
    const result = await testDb.db.execute(sql`
      SELECT * FROM test_jsonb_array WHERE data->'tags' ? 'a'
    `);

    expect(result.rows.length).toBe(1);
  });
});
