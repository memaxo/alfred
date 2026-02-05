// AgentFS Search Service
// Cross-run content search respecting sensitivity classification

import { Database, type SQLQueryBindings } from "bun:sqlite";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type {
  FileSearchResult,
  KvSearchResult,
  ToolCallSearchResult,
} from "../agentfs/domain";

// Search performance limits
const SEARCH_MAX_BYTES_PER_FILE = 1 * 1024 * 1024; // 1 MiB
const SEARCH_MAX_FILES_PER_RUN = 200;
const SEARCH_DEFAULT_LIMIT = 100;
const SEARCH_MAX_LIMIT = 1000;

function getAgentfsDir(rootAbs?: string): string {
  return rootAbs
    ? path.join(rootAbs, ".agentfs")
    : path.join(process.cwd(), ".agentfs");
}

// Known sensitive file patterns
const SENSITIVE_PATTERNS = [
  /\.env$/i,
  /\.env\./i,
  /\.ssh\//i,
  /\.aws\//i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.p12$/i,
  /\.pfx$/i,
];

function isSensitivePath(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(lowerPath));
}

export interface SearchFilters {
  projectId?: string;
  runIds?: string[];
  agentType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sensitivity?: "normal" | "sensitive" | "all";
  limit?: number;
  rootAbs?: string;
}

interface RunInfo {
  runId: string;
  runDir: string;
  dbPath: string;
  mtimeMs: number;
  projectId?: string;
}

async function collectRuns(filters: SearchFilters): Promise<RunInfo[]> {
  const agentfsDir = getAgentfsDir(filters.rootAbs);
  const runs: RunInfo[] = [];

  if (!existsSync(agentfsDir)) {
    return runs;
  }

  const entries = await readdir(agentfsDir, { withFileTypes: true });
  const runIdSet = filters.runIds ? new Set(filters.runIds) : null;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === "cas" || entry.name === "quarantine") {
      continue;
    }

    const runId = entry.name;

    if (runIdSet && !runIdSet.has(runId)) {
      continue;
    }

    // Apply agent type filter
    if (filters.agentType && !runId.includes(filters.agentType)) {
      continue;
    }

    const runDir = path.join(agentfsDir, runId);
    const dbPath = path.join(runDir, "agentfs.db");

    if (!existsSync(dbPath)) {
      continue;
    }

    // Get mtime for date filtering
    let mtimeMs = Date.now();
    try {
      const s = await stat(runDir);
      ({ mtimeMs } = s);
    } catch {
      // Use current time
    }

    // Apply date filters
    if (filters.dateFrom && mtimeMs < filters.dateFrom.getTime()) {
      continue;
    }
    if (filters.dateTo && mtimeMs > filters.dateTo.getTime()) {
      continue;
    }

    // Check project filter
    let projectId: string | undefined;
    if (filters.projectId) {
      const projectFile = path.join(runDir, ".project");
      try {
        if (existsSync(projectFile)) {
          const pid = await Bun.file(projectFile).text();
          if (pid.trim() !== filters.projectId) {
            continue;
          }
          projectId = pid.trim();
        } else {
          // No project file, skip if filtering by project
          continue;
        }
      } catch {
        continue;
      }
    }

    runs.push({ runId, runDir, dbPath, mtimeMs, projectId });
  }

  return runs;
}

function shouldIncludeFile(
  filePath: string,
  sensitivity: SearchFilters["sensitivity"]
): boolean {
  const isSensitive = isSensitivePath(filePath);

  switch (sensitivity) {
    case "normal": {
      return !isSensitive;
    }
    case "sensitive": {
      return isSensitive;
    }
    case "all":
    default: {
      return true;
    }
  }
}

export async function searchFiles(
  pattern: string,
  filters: SearchFilters = {}
): Promise<FileSearchResult[]> {
  const results: FileSearchResult[] = [];
  const limit = Math.min(
    filters.limit ?? SEARCH_DEFAULT_LIMIT,
    SEARCH_MAX_LIMIT
  );

  const runs = await collectRuns(filters);

  for (const run of runs) {
    if (results.length >= limit) {
      break;
    }

    try {
      const db = new Database(run.dbPath, { readonly: true });
      try {
        // Get all files from fs_dentry/fs_inode
        const filesStmt = db.prepare(
          `SELECT d.name as path, i.size, i.ino 
           FROM fs_dentry d 
           JOIN fs_inode i ON d.ino = i.ino 
           WHERE i.size > 0 AND i.size <= ?
           LIMIT ?`
        );
        const files = filesStmt.all(
          SEARCH_MAX_BYTES_PER_FILE,
          SEARCH_MAX_FILES_PER_RUN
        ) as { path: string; size: number; ino: number }[];

        for (const file of files) {
          if (results.length >= limit) {
            break;
          }

          // Check sensitivity filter
          if (!shouldIncludeFile(file.path, filters.sensitivity)) {
            continue;
          }

          // Read file content from fs_data
          const dataStmt = db.prepare(
            `SELECT data FROM fs_data WHERE ino = ? ORDER BY chunk_index ASC`
          );
          const chunks = dataStmt.all(file.ino) as { data: Buffer }[];

          if (chunks.length === 0) {
            continue;
          }

          // Concatenate chunks
          const content = Buffer.concat(chunks.map((c) => c.data)).toString(
            "utf8"
          );

          // Search for pattern (case-insensitive)
          const patternLower = pattern.toLowerCase();
          const contentLower = content.toLowerCase();

          if (!contentLower.includes(patternLower)) {
            continue;
          }

          // Find match locations
          const matchList: {
            line: number;
            column: number;
            context: string;
          }[] = [];
          const lines = content.split("\n");

          for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            if (line === undefined) {
              continue;
            }
            const lineLower = line.toLowerCase();
            let col = lineLower.indexOf(patternLower);

            while (col !== -1) {
              // Get context (some chars before and after)
              const contextStart = Math.max(0, col - 20);
              const contextEnd = Math.min(
                line.length,
                col + pattern.length + 20
              );
              const context = line.slice(contextStart, contextEnd);

              matchList.push({
                line: lineNum + 1,
                column: col + 1,
                context: context.trim(),
              });

              // Find next occurrence
              col = lineLower.indexOf(patternLower, col + 1);

              // Limit matches per file
              if (matchList.length >= 10) {
                break;
              }
            }

            if (matchList.length >= 10) {
              break;
            }
          }

          if (matchList.length > 0) {
            results.push({
              runId: run.runId,
              filePath: file.path,
              matches: matchList,
            });
          }
        }
      } finally {
        db.close();
      }
    } catch {}
  }

  return results;
}

export async function searchKv(
  keyPattern: string,
  filters: SearchFilters = {},
  valuePattern?: string
): Promise<KvSearchResult[]> {
  const results: KvSearchResult[] = [];
  const limit = Math.min(
    filters.limit ?? SEARCH_DEFAULT_LIMIT,
    SEARCH_MAX_LIMIT
  );

  const runs = await collectRuns(filters);

  // Convert keyPattern to SQL LIKE pattern
  const likePattern = keyPattern.replaceAll("*", "%").replaceAll("?", "_");
  const likeValuePattern = valuePattern
    ? valuePattern.replaceAll("*", "%").replaceAll("?", "_")
    : null;

  for (const run of runs) {
    if (results.length >= limit) {
      break;
    }

    try {
      const db = new Database(run.dbPath, { readonly: true });
      try {
        const whereParts = ["key LIKE ?"];
        const args: SQLQueryBindings[] = [likePattern];
        if (likeValuePattern) {
          whereParts.push("value LIKE ?");
          args.push(likeValuePattern);
        }
        args.push(limit - results.length);

        const stmt = db.prepare(
          `SELECT key, value, updated_at FROM kv_store WHERE ${whereParts.join(
            " AND "
          )} LIMIT ?`
        );
        const entries = stmt.all(...args) as {
          key: string;
          value: string;
          updated_at: number;
        }[];

        for (const entry of entries) {
          if (entry.key.startsWith("executor:")) {
            results.push({
              runId: run.runId,
              key: entry.key,
              value: "[redacted]",
              updatedAt: new Date(entry.updated_at * 1000),
            });
            if (results.length >= limit) {
              break;
            }
            continue;
          }

          let parsedValue: unknown;
          try {
            parsedValue = JSON.parse(entry.value);
          } catch {
            parsedValue = entry.value;
          }

          results.push({
            runId: run.runId,
            key: entry.key,
            value: parsedValue,
            updatedAt: new Date(entry.updated_at * 1000),
          });

          if (results.length >= limit) {
            break;
          }
        }
      } finally {
        db.close();
      }
    } catch {}
  }

  return results;
}

export async function searchToolCalls(
  namePattern: string,
  filters: SearchFilters = {},
  paramsPattern?: string
): Promise<ToolCallSearchResult[]> {
  const results: ToolCallSearchResult[] = [];
  const limit = Math.min(
    filters.limit ?? SEARCH_DEFAULT_LIMIT,
    SEARCH_MAX_LIMIT
  );

  const runs = await collectRuns(filters);

  // Convert namePattern to SQL LIKE pattern
  const likePattern = namePattern.replaceAll("*", "%").replaceAll("?", "_");
  const likeParamsPattern = paramsPattern
    ? paramsPattern.replaceAll("*", "%").replaceAll("?", "_")
    : null;

  for (const run of runs) {
    if (results.length >= limit) {
      break;
    }

    try {
      const db = new Database(run.dbPath, { readonly: true });
      try {
        const whereParts = ["name LIKE ?"];
        const args: SQLQueryBindings[] = [likePattern];
        if (likeParamsPattern) {
          whereParts.push("parameters LIKE ?");
          args.push(likeParamsPattern);
        }
        args.push(limit - results.length);

        const stmt = db.prepare(
          `SELECT id, name, parameters, result, started_at
           FROM tool_calls
           WHERE ${whereParts.join(" AND ")}
           ORDER BY started_at DESC
           LIMIT ?`
        );
        const calls = stmt.all(...args) as {
          id: number;
          name: string;
          parameters: string;
          result: string;
          started_at: number;
        }[];

        for (const call of calls) {
          let parsedParams: unknown;
          let parsedResult: unknown;

          try {
            parsedParams = JSON.parse(call.parameters);
          } catch {
            parsedParams = call.parameters;
          }

          try {
            parsedResult = JSON.parse(call.result);
          } catch {
            parsedResult = call.result;
          }

          results.push({
            runId: run.runId,
            toolCall: {
              id: String(call.id),
              name: call.name,
              parameters: parsedParams,
              result: parsedResult,
              timestamp: new Date(call.started_at * 1000),
            },
          });

          if (results.length >= limit) {
            break;
          }
        }
      } finally {
        db.close();
      }
    } catch {}
  }

  return results;
}
