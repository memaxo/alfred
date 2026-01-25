interface Stmt {
  get?: (...args: unknown[]) => unknown | Promise<unknown>;
  all?: (...args: unknown[]) => unknown | Promise<unknown>;
}

export interface AgentfsDb {
  prepare: (sql: string) => Stmt;
}

export interface AgentfsRunStats {
  toolCalls: number;
  checkpoints: number;
  files: number;
  bytes: number;
}

export interface AgentfsBlameCandidate {
  id: number;
  name: string;
  startedAt: number;
  completedAt: number;
  score: number;
}

export interface AgentfsFileMeta {
  path: string;
  size: number;
  mtime: number;
}

export interface AgentfsFileDiff {
  path: string;
  type: "added" | "removed" | "modified";
  left: AgentfsFileMeta | null;
  right: AgentfsFileMeta | null;
}

export interface AgentfsKvDiff {
  key: string;
  type: "added" | "removed" | "modified";
  left: string | null;
  right: string | null;
}

export interface AgentfsRunCompare {
  file: {
    added: number;
    removed: number;
    modified: number;
    diffs: AgentfsFileDiff[];
  };
  kv: {
    added: number;
    removed: number;
    modified: number;
    diffs: AgentfsKvDiff[];
  };
}

interface ToolCallLike {
  id?: unknown;
  name?: unknown;
  started_at?: unknown;
  completed_at?: unknown;
}

function coerceNum(raw: unknown): number {
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "bigint") {
    return Number(raw);
  }
  if (typeof raw === "string") {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

async function scalar(db: AgentfsDb, sql: string): Promise<number> {
  const stmt = db.prepare(sql);
  const row = (await stmt.get?.()) as Record<string, unknown> | null;
  if (!row) {
    return 0;
  }
  const v = row.count ?? row.c ?? row.sum ?? row.s ?? Object.values(row)[0];
  return coerceNum(v);
}

async function allRows(db: AgentfsDb, sql: string): Promise<unknown[]> {
  const stmt = db.prepare(sql);
  const res = await stmt.all?.();
  return Array.isArray(res) ? res : [];
}

function isRegularFile(mode: number): boolean {
  return (mode & 61_440) === 32_768;
}

export async function listAgentfsFiles(
  db: AgentfsDb
): Promise<AgentfsFileMeta[]> {
  const rows = await allRows(
    db,
    "WITH RECURSIVE tree(ino, path) AS (\n" +
      "  SELECT 1 as ino, '/' as path\n" +
      "  UNION ALL\n" +
      "  SELECT d.ino, CASE WHEN tree.path='/' THEN '/'||d.name ELSE tree.path||'/'||d.name END\n" +
      "  FROM fs_dentry d JOIN tree ON d.parent_ino = tree.ino\n" +
      ")\n" +
      "SELECT tree.path as path, i.mode as mode, i.size as size, i.mtime as mtime\n" +
      "FROM tree JOIN fs_inode i ON i.ino = tree.ino\n" +
      "WHERE tree.path != '/'"
  );

  const out: AgentfsFileMeta[] = [];
  for (const r of rows) {
    const rec = r as Record<string, unknown>;
    const path = typeof rec.path === "string" ? rec.path : "";
    const mode = coerceNum(rec.mode);
    const size = coerceNum(rec.size);
    const mtime = coerceNum(rec.mtime);
    if (!path || !isRegularFile(mode)) {
      continue;
    }
    out.push({ mtime, path, size });
  }
  return out;
}

export async function listAgentfsKv(
  db: AgentfsDb
): Promise<{ key: string; value: string }[]> {
  const rows = await allRows(db, "SELECT key, value FROM kv_store");
  const out: { key: string; value: string }[] = [];
  for (const r of rows) {
    const rec = r as Record<string, unknown>;
    const key = typeof rec.key === "string" ? rec.key : "";
    const value = typeof rec.value === "string" ? rec.value : "";
    if (!key) {
      continue;
    }
    out.push({ key, value });
  }
  return out;
}

export function compareAgentfsRuns(args: {
  leftFiles: AgentfsFileMeta[];
  rightFiles: AgentfsFileMeta[];
  leftKv: { key: string; value: string }[];
  rightKv: { key: string; value: string }[];
  limit?: number;
}): AgentfsRunCompare {
  const limit = Math.max(1, Math.min(5000, args.limit ?? 500));

  const leftMap = new Map<string, AgentfsFileMeta>();
  for (const f of args.leftFiles) {
    leftMap.set(f.path, f);
  }
  const rightMap = new Map<string, AgentfsFileMeta>();
  for (const f of args.rightFiles) {
    rightMap.set(f.path, f);
  }

  const allPaths = new Set<string>([...leftMap.keys(), ...rightMap.keys()]);
  const fileDiffs: AgentfsFileDiff[] = [];
  let fileAdded = 0;
  let fileRemoved = 0;
  let fileModified = 0;

  for (const p of [...allPaths].sort()) {
    const l = leftMap.get(p) ?? null;
    const r = rightMap.get(p) ?? null;
    if (!l && r) {
      fileAdded++;
      fileDiffs.push({ left: null, path: p, right: r, type: "added" });
      continue;
    }
    if (l && !r) {
      fileRemoved++;
      fileDiffs.push({ left: l, path: p, right: null, type: "removed" });
      continue;
    }
    if (l && r && (l.size !== r.size || l.mtime !== r.mtime)) {
      fileModified++;
      fileDiffs.push({ left: l, path: p, right: r, type: "modified" });
    }
  }

  const leftKvMap = new Map<string, string>();
  for (const e of args.leftKv) {
    leftKvMap.set(e.key, e.value);
  }
  const rightKvMap = new Map<string, string>();
  for (const e of args.rightKv) {
    rightKvMap.set(e.key, e.value);
  }

  const allKeys = new Set<string>([...leftKvMap.keys(), ...rightKvMap.keys()]);
  const kvDiffs: AgentfsKvDiff[] = [];
  let kvAdded = 0;
  let kvRemoved = 0;
  let kvModified = 0;

  for (const k of [...allKeys].sort()) {
    const l = leftKvMap.get(k) ?? null;
    const r = rightKvMap.get(k) ?? null;
    if (!l && r) {
      kvAdded++;
      kvDiffs.push({ key: k, left: null, right: r, type: "added" });
      continue;
    }
    if (l && !r) {
      kvRemoved++;
      kvDiffs.push({ key: k, left: l, right: null, type: "removed" });
      continue;
    }
    if (l && r && l !== r) {
      kvModified++;
      kvDiffs.push({ key: k, left: l, right: r, type: "modified" });
    }
  }

  return {
    file: {
      added: fileAdded,
      diffs: fileDiffs.slice(0, limit),
      modified: fileModified,
      removed: fileRemoved,
    },
    kv: {
      added: kvAdded,
      diffs: kvDiffs.slice(0, limit),
      modified: kvModified,
      removed: kvRemoved,
    },
  };
}

export async function readAgentfsRunStats(
  db: AgentfsDb
): Promise<AgentfsRunStats> {
  const toolCalls = await scalar(
    db,
    "SELECT COUNT(*) as count FROM tool_calls"
  );
  const checkpoints = await scalar(
    db,
    "SELECT COUNT(*) as count FROM kv_store WHERE key LIKE 'checkpoint:%'"
  );

  // mode & 0o170000 == 0o100000 (regular files)
  const files = await scalar(
    db,
    "SELECT COUNT(*) as count FROM fs_inode WHERE (mode & 61440) = 32768"
  );
  const bytes = await scalar(
    db,
    "SELECT COALESCE(SUM(size), 0) as sum FROM fs_inode WHERE (mode & 61440) = 32768"
  );

  return {
    bytes,
    checkpoints,
    files,
    toolCalls,
  };
}

function coerceToolCall(raw: unknown): ToolCallLike | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return raw as ToolCallLike;
}

export function rankAgentfsBlameCandidates(args: {
  toolCalls: unknown[];
  fileMtimeSec: number;
  limit?: number;
}): AgentfsBlameCandidate[] {
  const limit = Math.max(1, Math.min(20, args.limit ?? 5));
  const mtime = args.fileMtimeSec;

  const parsed: {
    id: number;
    name: string;
    startedAt: number;
    completedAt: number;
  }[] = [];
  for (const raw of args.toolCalls) {
    const c = coerceToolCall(raw);
    if (!c) {
      continue;
    }
    const id = coerceNum(c.id);
    const name = typeof c.name === "string" ? c.name : "";
    const startedAt = coerceNum(c.started_at);
    const completedAt = coerceNum(c.completed_at) || startedAt;
    if (!id || !name || !startedAt) {
      continue;
    }
    parsed.push({ completedAt, id, name, startedAt });
  }

  const scored = parsed.map((c) => {
    const inWindow = c.startedAt <= mtime && mtime <= c.completedAt;
    if (inWindow) {
      return { ...c, score: 1 };
    }
    const dist = Math.min(
      Math.abs(mtime - c.startedAt),
      Math.abs(mtime - c.completedAt)
    );
    const score = 1 / (1 + dist);
    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
