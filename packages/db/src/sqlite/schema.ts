import type { Database } from "bun:sqlite";

const statements = [
  `CREATE TABLE IF NOT EXISTS memory_nodes (
    id TEXT PRIMARY KEY,
    resource TEXT NOT NULL,
    hash TEXT NOT NULL,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    properties TEXT,
    label_tsvector TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource, hash)
  );`,
  `ALTER TABLE memory_nodes ADD COLUMN label_tsvector TEXT;`,
  `CREATE TABLE IF NOT EXISTS memory_edges (
    id TEXT PRIMARY KEY,
    resource TEXT NOT NULL,
    hash TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource, hash)
  );`,
  `CREATE INDEX IF NOT EXISTS memory_edges_from_idx
    ON memory_edges(resource, from_id, kind);`,
  `CREATE INDEX IF NOT EXISTS memory_edges_to_idx
    ON memory_edges(resource, to_id, kind);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS memory_edges_hash_unique
    ON memory_edges(hash);`,
  `CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    input_data TEXT,
    state_data TEXT,
    webhook_url TEXT,
    webhook_secret TEXT,
    linear_session_id TEXT,
    linear_space TEXT,
    suspended_at TEXT,
    resumed_at TEXT,
    completed_at TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS workflow_events (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT,
    step_id TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS rag_documents (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT,
    author TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS rag_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    content TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    embedding BLOB,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES rag_documents(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS rag_chunks_document_id_idx
    ON rag_chunks(document_id);`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    workflow_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    parts TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS messages_conversation_idx
    ON messages(conversation_id);`,
  `CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source TEXT DEFAULT 'user',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, key)
  );`,
];

export function ensureSqliteTestSchema(db: Database): void {
  for (const stmt of statements) {
    try {
      db.exec(stmt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("duplicate column name")) {
        continue;
      }
      throw error;
    }
  }
}
