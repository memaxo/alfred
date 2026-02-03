import type {
  AgentFSKVEntry,
  AgentFSInterface,
  AgentFSToolCall,
} from "@alfred/agent/agentfs/types";

import {
  type AgentFSChange,
  type AgentFSStreamCursor,
  type AgentFSStreamEvent,
  READ_SCOPES,
  WRITE_SCOPES,
  executorConfigPublicSchema,
  executorConfigWriteSchema,
  executorHealthSchema,
  executorKindSchema,
  executorStatusSchema,
} from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import type { AuditAction } from "../agentfs/domain";

import { requirePolicy } from "../gate";
import { requireScopes } from "../middleware/scopes";
import {
  compareAgentfsRuns,
  listAgentfsFiles,
  listAgentfsKv,
  rankAgentfsBlameCandidates,
  readAgentfsRunStats,
} from "../services/agentfs";
import { checkAgentfsAccess } from "../services/agentfsaccess";
import { authedProcedure, router } from "../trpc";

function sanitizeRunId(runId: string): string {
  return runId.replaceAll(/[^a-zA-Z0-9-]/g, "-");
}

function sanitizeCheckpointId(id: string): string {
  return id.replaceAll(/[^a-zA-Z0-9-]/g, "-");
}

function coerceCheckpointCreatedAtSec(e: AgentFSKVEntry): number {
  if (typeof e.created_at === "number" && Number.isFinite(e.created_at)) {
    return e.created_at;
  }
  const v =
    e.value && typeof e.value === "object"
      ? (e.value as Record<string, unknown>)
      : null;
  const createdAt = v && typeof v.createdAt === "number" ? v.createdAt : null;
  const createdAtSec =
    v && typeof v.createdAtSec === "number" ? v.createdAtSec : null;

  if (typeof createdAtSec === "number" && Number.isFinite(createdAtSec)) {
    return createdAtSec;
  }
  if (typeof createdAt === "number" && Number.isFinite(createdAt)) {
    return createdAt > 10_000_000_000
      ? Math.floor(createdAt / 1000)
      : createdAt;
  }
  return 0;
}

function isSafeAgentfsDbPath(args: { runId: string; dbPath: string }): boolean {
  const runId = sanitizeRunId(args.runId);
  const normalized = args.dbPath.replaceAll("\\", "/");
  if (!normalized.startsWith(`.agentfs/${runId}/`)) {
    return false;
  }
  if (normalized.includes("..")) {
    return false;
  }
  return normalized.endsWith(".db");
}

function validateAgentfsFilePath(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/");

  if (normalized.includes("\u0000")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "agentfs_file_path_invalid",
    });
  }

  if (!normalized.startsWith("/")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "agentfs_file_path_invalid",
    });
  }

  const norm = path.posix.normalize(normalized);
  const parts = norm.split("/").filter(Boolean);
  if (parts.some((p) => p === "..")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "agentfs_file_path_invalid",
    });
  }

  return norm;
}

function getPreviewMaxBytes(): number {
  const raw = process.env.ALFRED_AGENTFS_PREVIEW_MAX_BYTES;
  if (!raw) {
    return 1024 * 1024;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return 1024 * 1024;
  }
  return n;
}

function looksBinary(buf: Buffer): boolean {
  if (buf.length === 0) {
    return false;
  }

  let suspicious = 0;
  for (const b of buf) {
    if (b === 0) {
      return true;
    }
    const isAllowed = b === 9 || b === 10 || b === 13;
    if (!isAllowed && b < 32) {
      suspicious += 1;
    }
  }

  return suspicious / buf.length > 0.3;
}

type AgentfsFileSensitivity = "normal" | "sensitive";

interface AgentfsFileClass {
  sensitivity: AgentfsFileSensitivity;
  source: "cache" | "path" | "content" | "unknown";
  at: number;
}

export interface WorkspaceListItem {
  id: string;
  runId: string;
  dbPath: string;
  agentType: string;
  status: string;
  createdAt: string;
  operationCount: number;
  checkpointCount: number;
  pinned: boolean;
  retentionDays: number | null;
  projectId: string | null;
}

function classifyAgentfsFilePath(filePath: string): AgentfsFileSensitivity {
  const lower = filePath.toLowerCase();
  if (
    lower.endsWith("/.env") ||
    lower.includes("/.env.") ||
    lower.includes("/.ssh/") ||
    lower.includes("/.aws/") ||
    lower.endsWith(".pem") ||
    lower.endsWith(".key")
  ) {
    return "sensitive";
  }
  return "normal";
}

function looksSensitiveText(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes("begin private key")) {
    return true;
  }
  if (lower.includes("aws_secret_access_key")) {
    return true;
  }
  return lower.includes("password=");
}

async function readAgentfsFileClass(
  fsdb: AgentFSInterface,
  filePath: string
): Promise<AgentfsFileClass> {
  const at = Math.floor(Date.now() / 1000);
  const key = `classify:${filePath}`;

  try {
    const cached = await fsdb.kv.get<AgentfsFileClass>(key);
    if (
      cached &&
      (cached.sensitivity === "normal" || cached.sensitivity === "sensitive")
    ) {
      return { ...cached, source: "cache" };
    }
  } catch {
    // ignore
  }

  const byPath = classifyAgentfsFilePath(filePath);
  if (byPath === "sensitive") {
    const res: AgentfsFileClass = {
      at,
      sensitivity: "sensitive",
      source: "path",
    };
    try {
      await fsdb.kv.set(key, res);
    } catch {
      // ignore
    }
    return res;
  }

  try {
    const { buf } = await readAgentfsRange(fsdb, filePath, 0, 8192);
    if (!looksBinary(buf) && looksSensitiveText(buf.toString("utf8"))) {
      const res: AgentfsFileClass = {
        at,
        sensitivity: "sensitive",
        source: "content",
      };
      try {
        await fsdb.kv.set(key, res);
      } catch {
        // ignore
      }
      return res;
    }
  } catch {
    // ignore
  }

  const res: AgentfsFileClass = {
    at,
    sensitivity: "normal",
    source: "unknown",
  };
  try {
    await fsdb.kv.set(key, res);
  } catch {
    // ignore
  }
  return res;
}

async function readAgentfsPrefix(
  fsdb: { getDatabase: () => unknown },
  filePath: string,
  maxBytes: number
): Promise<{ buf: Buffer; sizeBytes: number }> {
  const { buf, sizeBytes } = await readAgentfsRange(
    fsdb,
    filePath,
    0,
    maxBytes
  );
  return { buf, sizeBytes };
}

async function readAgentfsRange(
  fsdb: { getDatabase: () => unknown },
  filePath: string,
  offsetBytes: number,
  maxBytes: number
): Promise<{ buf: Buffer; sizeBytes: number }> {
  const db = fsdb.getDatabase() as {
    prepare?: (sql: string) => {
      get?: (...args: unknown[]) => Promise<Record<string, unknown> | null>;
      all?: (...args: unknown[]) => Promise<Record<string, unknown>[]>;
    };
  };

  if (!db || typeof db.prepare !== "function") {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "agentfs_db_unavailable",
    });
  }

  const parts = filePath.split("/").filter(Boolean);

  // agentfs-sdk root inode is always 1.
  let ino = 1;
  const dentryStmt = db.prepare(
    "SELECT ino FROM fs_dentry WHERE parent_ino = ? AND name = ?"
  );

  for (const name of parts) {
    const row = await dentryStmt.get?.(ino, name);
    const next = row?.ino;
    const nextIno =
      typeof next === "number"
        ? next
        : typeof next === "bigint"
          ? Number(next)
          : typeof next === "string"
            ? Number.parseInt(next, 10)
            : Number.NaN;

    if (!Number.isFinite(nextIno) || nextIno <= 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "agentfs_file_not_found",
      });
    }
    ino = nextIno;
  }

  const inodeStmt = db.prepare("SELECT size FROM fs_inode WHERE ino = ?");
  const inode = await inodeStmt.get?.(ino);
  const sizeRaw = inode?.size;
  const sizeBytes =
    typeof sizeRaw === "number"
      ? sizeRaw
      : typeof sizeRaw === "bigint"
        ? Number(sizeRaw)
        : typeof sizeRaw === "string"
          ? Number.parseInt(sizeRaw, 10)
          : Number.NaN;

  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "agentfs_file_not_found",
    });
  }

  const configStmt = db.prepare(
    "SELECT value FROM fs_config WHERE key = 'chunk_size'"
  );
  const cfg = await configStmt.get?.();
  const cfgVal = cfg?.value;
  const chunkSize =
    typeof cfgVal === "string" ? Number.parseInt(cfgVal, 10) : 4096;
  const effectiveChunkSize =
    Number.isFinite(chunkSize) && chunkSize > 0 ? chunkSize : 4096;

  const start = Math.max(0, Math.min(sizeBytes, Math.floor(offsetBytes)));
  const wantBytes = Math.min(sizeBytes - start, Math.max(0, maxBytes));
  if (wantBytes <= 0) {
    return { buf: Buffer.alloc(0), sizeBytes };
  }

  const startChunk = Math.floor(start / effectiveChunkSize);
  const endChunk = Math.floor((start + wantBytes - 1) / effectiveChunkSize);
  const dataStmt = db.prepare(
    "SELECT chunk_index, data FROM fs_data WHERE ino = ? AND chunk_index BETWEEN ? AND ? ORDER BY chunk_index ASC"
  );
  const rows = (await dataStmt.all?.(ino, startChunk, endChunk)) ?? [];

  const bufs: Buffer[] = [];
  for (const r of rows) {
    const { data } = r;
    if (!data) {
      continue;
    }
    if (Buffer.isBuffer(data)) {
      bufs.push(data);
      continue;
    }
    if (data instanceof Uint8Array) {
      bufs.push(Buffer.from(data));
      continue;
    }
  }

  const combined = bufs.length === 0 ? Buffer.alloc(0) : Buffer.concat(bufs);
  const sliceStart = start - startChunk * effectiveChunkSize;
  return {
    buf: combined.subarray(sliceStart, sliceStart + wantBytes),
    sizeBytes,
  };
}

function nextCursor(
  prev: AgentFSStreamCursor,
  updates: { toolCallId?: number; toolCallSince?: number; kvUpdatedAt?: number }
): AgentFSStreamCursor {
  return {
    kvUpdatedAt:
      typeof updates.kvUpdatedAt === "number"
        ? Math.max(prev.kvUpdatedAt ?? 0, updates.kvUpdatedAt)
        : prev.kvUpdatedAt,
    toolCallId:
      typeof updates.toolCallId === "number"
        ? Math.max(prev.toolCallId ?? 0, updates.toolCallId)
        : prev.toolCallId,
    toolCallSince:
      typeof updates.toolCallSince === "number"
        ? Math.max(prev.toolCallSince ?? 0, updates.toolCallSince)
        : prev.toolCallSince,
  };
}

const agentfsSnapshotInputSchema = z.object({
  dbPath: z.string().min(1).max(500),
  dir: z.string().min(1).max(500).default("/workspace"),
  projectId: z.string().uuid().optional(),
  runId: z.string().min(1).max(200),
});

const agentfsStreamInputSchema = z.object({
  cursor: z
    .object({
      toolCallId: z.number().int().min(0).optional(),
      toolCallSince: z.number().int().min(0).optional(),
      kvUpdatedAt: z.number().int().min(0).optional(),
    })
    .optional(),
  dbPath: z.string().min(1).max(500),
  dir: z.string().min(1).max(500).default("/workspace"),
  pollMs: z.number().int().min(200).max(5000).optional(),
  projectId: z.string().uuid().optional(),
  runId: z.string().min(1).max(200),
});

async function loadAgentfs(args: { runId: string; dbPath: string }): Promise<{
  fsdb: AgentFSInterface;
  baseDir: string | null;
}> {
  const { AlfredAgentFS } = await import("@alfred/agent/agentfs/index");
  const id = `tui-${sanitizeRunId(args.runId)}`.slice(0, 64);

  // First open without base to read KV
  const fsdb = await AlfredAgentFS.open({ id, path: args.dbPath }, args.runId);

  try {
    const baseDir = await fsdb.kv.get<string>("baseDir");
    if (baseDir) {
      // Re-open with baseDir for proper overlay semantics if supported by SDK
      await fsdb.close();
      const reopened = await AlfredAgentFS.open(
        { base: baseDir, id, path: args.dbPath },
        args.runId
      );
      return { baseDir, fsdb: reopened };
    }
    return { baseDir: null, fsdb };
  } catch {
    return { baseDir: null, fsdb };
  }
}

function getUserIdForAgentfsAccess(ctx: { session: unknown | null }): string {
  const session = ctx.session as { user?: unknown } | null;
  const user = session?.user as { id?: unknown } | null;
  const userId = user && typeof user.id === "string" ? user.id : null;
  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "session_required",
    });
  }
  return userId;
}

async function enforceAgentfsProjectAccess(args: {
  ctx: { session: unknown | null };
  runId: string;
  dbPath: string;
  baseDir: string | null;
  projectId?: string | null;
}) {
  const userId = getUserIdForAgentfsAccess(args.ctx);
  const res = await checkAgentfsAccess({
    baseDir: args.baseDir,
    requestedProjectId: args.projectId ?? null,
    runId: args.runId,
    userId,
  });

  if (!res.allow) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        res.reason === "run_not_owned"
          ? "agentfs_run_forbidden"
          : "agentfs_project_mismatch",
    });
  }

  return res;
}

async function resolveSearchRunIds(args: {
  ctx: { session: unknown | null };
  projectId?: string | null;
  runIds?: readonly string[];
}): Promise<string[] | undefined> {
  const userId = getUserIdForAgentfsAccess(args.ctx);

  if (args.runIds && args.runIds.length > 0) {
    for (const runId of args.runIds) {
      const access = await checkAgentfsAccess({
        baseDir: null,
        requestedProjectId: args.projectId ?? null,
        runId,
        userId,
      });
      if (!access.allow) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            access.reason === "run_not_owned"
              ? "agentfs_run_forbidden"
              : "agentfs_project_mismatch",
        });
      }
    }
    return [...args.runIds];
  }

  if (!args.projectId) {
    return undefined;
  }

  try {
    const { workflowRepo } = await import("@alfred/db");
    if (typeof workflowRepo.listRuns !== "function") {
      return undefined;
    }

    const limit = 1000;
    let offset = 0;
    const out: string[] = [];

    while (true) {
      const page = await workflowRepo.listRuns({
        userId,
        projectId: args.projectId,
        limit,
        offset,
      });
      if (!Array.isArray(page) || page.length === 0) {
        break;
      }
      for (const row of page) {
        const { id } = row as { id?: unknown };
        if (typeof id === "string") {
          out.push(id);
        }
      }
      if (page.length < limit) {
        break;
      }
      offset += limit;
      if (offset >= 10_000) {
        break;
      }
    }

    return out.length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

interface StatShape {
  ino?: unknown;
  size?: unknown;
  mtime?: unknown;
  isDirectory?: unknown;
}

function toDirEntry(name: string, stat: unknown, inoFallback: number) {
  const s = stat as StatShape;
  const ino = typeof s.ino === "number" ? s.ino : inoFallback;
  const size = typeof s.size === "number" ? s.size : undefined;
  const mtime = typeof s.mtime === "number" ? s.mtime : undefined;
  const isDirectory =
    typeof s.isDirectory === "function"
      ? Boolean((s.isDirectory as () => boolean)())
      : false;

  return {
    ino,
    isDirectory,
    mtime,
    name,
    size,
  };
}

const EXECUTOR_KV_PREFIX = "executor:";
const EXECUTOR_KV_REDACTED_VALUE = "[redacted]" as const;

function isExecutorKvKey(key: string): boolean {
  return key.startsWith(EXECUTOR_KV_PREFIX);
}

function maybeRedactKvEntryValue<T>(entry: { key: string; value: T }): {
  value: T | typeof EXECUTOR_KV_REDACTED_VALUE;
  redacted: boolean;
} {
  if (isExecutorKvKey(entry.key)) {
    return { redacted: true, value: EXECUTOR_KV_REDACTED_VALUE };
  }
  return { redacted: false, value: entry.value };
}

function isIpv4Literal(hostname: string): boolean {
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) {
    return false;
  }
  for (const seg of m.slice(1)) {
    const n = Number(seg);
    if (!Number.isFinite(n) || n < 0 || n > 255) {
      return false;
    }
  }
  return true;
}

function ipv4ToU32(hostname: string): number {
  const parts = hostname.split(".").map((p) => Number(p));
  return (
    (((parts[0] ?? 0) << 24) |
      ((parts[1] ?? 0) << 16) |
      ((parts[2] ?? 0) << 8) |
      (parts[3] ?? 0)) >>>
    0
  );
}

function inCidr(u32: number, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  const baseU32 = ipv4ToU32(base);
  return (u32 & mask) === (baseU32 & mask);
}

function assertSafeExecutorHttpBaseUrl(raw: string): string {
  const override = process.env.ALFRED_EXECUTOR_HTTP_ALLOW_HOSTNAMES === "1";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "executor_http_baseurl_invalid",
    });
  }

  if (!(url.protocol === "http:" || url.protocol === "https:")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "executor_http_baseurl_protocol_invalid",
    });
  }

  if (url.username || url.password) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "executor_http_baseurl_userinfo_forbidden",
    });
  }

  const hostname = url.hostname.trim().toLowerCase();
  if (!hostname) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "executor_http_baseurl_invalid",
    });
  }

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return url.toString().replace(/\/$/, "");
  }

  if (isIpv4Literal(hostname)) {
    const u32 = ipv4ToU32(hostname);
    const isLoopback = inCidr(u32, "127.0.0.0", 8);
    const isPriv10 = inCidr(u32, "10.0.0.0", 8);
    const isPriv172 = inCidr(u32, "172.16.0.0", 12);
    const isPriv192 = inCidr(u32, "192.168.0.0", 16);
    if (isLoopback || isPriv10 || isPriv172 || isPriv192) {
      return url.toString().replace(/\/$/, "");
    }
  }

  const isIpv6Literal = hostname.includes(":");
  if (isIpv6Literal) {
    const h = hostname;
    const isLoopback = h === "::1";
    const isUla = h.startsWith("fd") || h.startsWith("fc");
    if (isLoopback || isUla) {
      return url.toString().replace(/\/$/, "");
    }
  }

  if (override) {
    return url.toString().replace(/\/$/, "");
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "executor_http_baseurl_unsafe",
  });
}

export const agentfsRouter = router({
  // ─────────────────────────────────────────────────────────────────────────
  // Workspace Management Procedures
  // ─────────────────────────────────────────────────────────────────────────

  applyChanges: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    ) // Explicit scope for applying to host
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        paths: z.array(z.string()).optional(), // Optional: apply only specific files
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        if (!baseDir) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_base_dir_missing",
          });
        }

        const changes = await fsdb.diff();
        const filtered = input.paths
          ? changes.filter((c: AgentFSChange) => input.paths?.includes(c.path))
          : changes;

        const { writeFile, unlink, mkdir } = await import("node:fs/promises");
        const results: {
          path: string;
          status: "success" | "error";
          message?: string;
        }[] = [];

        for (const change of filtered) {
          const hostPath = path.resolve(
            baseDir,
            change.path.replace(/^\//, "")
          );

          // Safety check: ensure hostPath is within baseDir
          if (!hostPath.startsWith(path.resolve(baseDir))) {
            results.push({
              path: change.path,
              status: "error",
              message: "outside_base",
            });
            continue;
          }

          try {
            if (change.type === "deleted") {
              await unlink(hostPath);
            } else {
              const content = await fsdb.fs.readFile(change.path);
              await mkdir(path.dirname(hostPath), { recursive: true });
              await writeFile(hostPath, content);
            }
            results.push({ path: change.path, status: "success" });
          } catch (error) {
            results.push({
              path: change.path,
              status: "error",
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return { results };
      } finally {
        await fsdb.close();
      }
    }),

  checkpointsList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const normalizedDbPath = input.dbPath.replaceAll("\\", "/");
        const absDbPath = path.resolve(process.cwd(), normalizedDbPath);
        const absRunDir = path.dirname(absDbPath);
        const base = path.posix.basename(normalizedDbPath);
        const prefix = `${base}.checkpoint-`;

        const merged = new Map<
          string,
          { id: string; name: string; createdAt: string; data?: unknown }
        >();

        try {
          const files = await readdir(absRunDir);
          for (const f of files) {
            if (!f.startsWith(prefix)) {
              continue;
            }
            const id = sanitizeCheckpointId(f.slice(prefix.length));
            if (!id) {
              continue;
            }
            let createdAt = new Date(0).toISOString();
            try {
              const st = await stat(path.join(absRunDir, f));
              createdAt = st.mtime.toISOString();
            } catch {
              // ignore
            }
            merged.set(id, { id, name: id, createdAt });
          }
        } catch {
          // ignore
        }

        const kvRaw = await fsdb.kv.list();
        for (const e of kvRaw) {
          if (!e.key.startsWith("checkpoint:")) {
            continue;
          }
          const id = sanitizeCheckpointId(e.key.replace("checkpoint:", ""));
          if (!id) {
            continue;
          }
          const createdAtSec = coerceCheckpointCreatedAtSec(e);
          const createdAt = createdAtSec
            ? new Date(createdAtSec * 1000).toISOString()
            : (merged.get(id)?.createdAt ?? new Date(0).toISOString());
          const label =
            e.value &&
            typeof e.value === "object" &&
            typeof (e.value as Record<string, unknown>).label === "string"
              ? ((e.value as Record<string, unknown>).label as string)
              : id;
          merged.set(id, {
            id,
            name: label,
            createdAt,
            data: e.value,
          });
        }

        return {
          checkpoints: [...merged.values()].sort((a, b) =>
            a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
          ),
        };
      } finally {
        await fsdb.close();
      }
    }),

  clearRetention: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(z.object({ runId: z.string().min(1).max(200) }))
    .mutation(async ({ input }) => {
      const runId = sanitizeRunId(input.runId);
      if (!runId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_run_id_invalid",
        });
      }

      const runDir = path.resolve(process.cwd(), ".agentfs", runId);
      const p = path.join(runDir, ".retention");
      try {
        await unlink(p);
      } catch {
        // ignore
      }
      return { ok: true };
    }),

  cloneCheckpoint: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        checkpointId: z.string().min(1).max(200),
        targetRunId: z.string().min(1).max(200).optional(),
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (
          !isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_path_invalid",
          });
        }

        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir: null,
          projectId: input.projectId,
        });

        const checkpointId = sanitizeCheckpointId(input.checkpointId);
        if (!checkpointId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_checkpoint_id_invalid",
          });
        }

        const srcDbPath = input.dbPath.replaceAll("\\", "/");
        const srcAbsDbPath = path.resolve(process.cwd(), srcDbPath);
        const srcSnapshotAbs = `${srcAbsDbPath}.checkpoint-${checkpointId}`;

        const srcSt = await stat(srcSnapshotAbs).catch(() => null);
        if (!srcSt?.isFile()) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "agentfs_checkpoint_not_found",
          });
        }

        const base = path.posix.basename(srcDbPath);
        const targetRunId = sanitizeRunId(
          input.targetRunId ? input.targetRunId : randomUUID().slice(0, 12)
        );
        if (!targetRunId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_run_id_invalid",
          });
        }

        await mkdir(path.resolve(process.cwd(), ".agentfs"), {
          recursive: true,
        });

        const dstDir = `.agentfs/${targetRunId}`;
        const dstAbsDir = path.resolve(process.cwd(), dstDir);
        try {
          await mkdir(dstAbsDir, { recursive: false });
        } catch (error) {
          const code = (error as { code?: string } | null)?.code;
          if (code === "EEXIST") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "agentfs_run_exists",
            });
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "agentfs_clone_failed",
          });
        }

        const dstDbPath = `${dstDir}/${base}`;
        const dstAbsDbPath = path.resolve(process.cwd(), dstDbPath);

        await copyFile(srcSnapshotAbs, dstAbsDbPath);

        for (const suffix of ["-wal", "-shm"]) {
          const src = `${srcSnapshotAbs}${suffix}`;
          const dst = `${dstAbsDbPath}${suffix}`;
          try {
            await stat(src);
            await copyFile(src, dst);
          } catch {
            // ignore
          }
        }

        const result = { runId: targetRunId, dbPath: dstDbPath };
        await recordAgentfsOp({
          ctx,
          action: "checkpoint_restore",
          success: true,
          projectId: input.projectId ?? null,
          runId: input.runId,
          extra: { targetRunId },
        });
        return result;
      } catch (error) {
        await recordAgentfsOp({
          ctx,
          action: "checkpoint_restore",
          success: false,
          projectId: input.projectId ?? null,
          runId: input.runId,
          extra: {
            error: error instanceof Error ? error.message : String(error ?? ""),
            targetRunId: input.targetRunId ?? null,
          },
        });
        throw error;
      }
    }),

  cloneRun: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const source = (rec.source ?? {}) as Record<string, unknown>;
        const runId =
          typeof source.runId === "string" ? source.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        source: z.object({
          runId: z.string().min(1).max(200),
          dbPath: z.string().min(1).max(500),
        }),
        targetRunId: z.string().min(1).max(200).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (!isSafeAgentfsDbPath(input.source)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_path_invalid",
          });
        }

        const srcDbPath = input.source.dbPath.replaceAll("\\", "/");
        const srcAbsDbPath = path.resolve(process.cwd(), srcDbPath);
        const base = path.posix.basename(srcDbPath);

        const targetRunId = sanitizeRunId(
          input.targetRunId ? input.targetRunId : randomUUID().slice(0, 12)
        );
        if (!targetRunId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_run_id_invalid",
          });
        }

        const dstDir = `.agentfs/${targetRunId}`;
        const dstAbsDir = path.resolve(process.cwd(), dstDir);

        await mkdir(path.resolve(process.cwd(), ".agentfs"), {
          recursive: true,
        });

        try {
          await mkdir(dstAbsDir, { recursive: false });
        } catch (error) {
          const code = (error as { code?: string } | null)?.code;
          if (code === "EEXIST") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "agentfs_run_exists",
            });
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "agentfs_clone_failed",
          });
        }

        const dstDbPath = `${dstDir}/${base}`;
        const dstAbsDbPath = path.resolve(process.cwd(), dstDbPath);

        await copyFile(srcAbsDbPath, dstAbsDbPath);

        for (const suffix of ["-wal", "-shm"]) {
          const src = `${srcAbsDbPath}${suffix}`;
          const dst = `${dstAbsDbPath}${suffix}`;
          try {
            await stat(src);
            await copyFile(src, dst);
          } catch {
            // ignore
          }
        }

        const result = { runId: targetRunId, dbPath: dstDbPath };
        await recordAgentfsOp({
          ctx,
          action: "run_clone",
          success: true,
          runId: input.source.runId,
          extra: { targetRunId },
        });
        return result;
      } catch (error) {
        await recordAgentfsOp({
          ctx,
          action: "run_clone",
          success: false,
          runId: input.source.runId,
          extra: {
            error: error instanceof Error ? error.message : String(error ?? ""),
            targetRunId: input.targetRunId ?? null,
          },
        });
        throw error;
      }
    }),

  compareRuns: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const left = (rec.left ?? {}) as Record<string, unknown>;
        const runId =
          typeof left.runId === "string" && left.runId.length > 0
            ? left.runId
            : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const right = (rec.right ?? {}) as Record<string, unknown>;
        const runId =
          typeof right.runId === "string" && right.runId.length > 0
            ? right.runId
            : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        left: z.object({
          runId: z.string().min(1).max(200),
          dbPath: z.string().min(1).max(500),
        }),
        right: z.object({
          runId: z.string().min(1).max(200),
          dbPath: z.string().min(1).max(500),
        }),
        limit: z.number().int().min(1).max(5000).default(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath(input.left)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }
      if (!isSafeAgentfsDbPath(input.right)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const leftLoaded = await loadAgentfs(input.left);
      const rightLoaded = await loadAgentfs(input.right);
      const leftFsdb = leftLoaded.fsdb;
      const rightFsdb = rightLoaded.fsdb;

      try {
        const leftAccess = await enforceAgentfsProjectAccess({
          ctx,
          runId: input.left.runId,
          dbPath: input.left.dbPath,
          baseDir: leftLoaded.baseDir,
          projectId: input.projectId,
        });
        const rightAccess = await enforceAgentfsProjectAccess({
          ctx,
          runId: input.right.runId,
          dbPath: input.right.dbPath,
          baseDir: rightLoaded.baseDir,
          projectId: input.projectId,
        });

        if (
          leftAccess.projectId &&
          rightAccess.projectId &&
          leftAccess.projectId !== rightAccess.projectId
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "agentfs_project_mismatch",
          });
        }

        const leftDb = leftFsdb.getDatabase() as unknown;
        const rightDb = rightFsdb.getDatabase() as unknown;
        const hasPrepare = (db: unknown) =>
          typeof (db as { prepare?: unknown } | null)?.prepare === "function";

        if (!hasPrepare(leftDb) || !hasPrepare(rightDb)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "agentfs_db_unavailable",
          });
        }

        const leftFiles = await listAgentfsFiles(
          leftDb as { prepare: (sql: string) => { all?: () => unknown } }
        );
        const rightFiles = await listAgentfsFiles(
          rightDb as { prepare: (sql: string) => { all?: () => unknown } }
        );
        const leftKv = await listAgentfsKv(
          leftDb as { prepare: (sql: string) => { all?: () => unknown } }
        );
        const rightKv = await listAgentfsKv(
          rightDb as { prepare: (sql: string) => { all?: () => unknown } }
        );

        return compareAgentfsRuns({
          leftFiles,
          rightFiles,
          leftKv,
          rightKv,
          limit: input.limit,
        });
      } finally {
        await Promise.all([leftFsdb.close(), rightFsdb.close()]);
      }
    }),

  diff: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const changes = await fsdb.diff();
        return { changes };
      } finally {
        await fsdb.close();
      }
    }),

  fileAudit: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        const filePath =
          typeof rec.filePath === "string" ? rec.filePath : "unknown";
        return {
          kind: "agentfs_file",
          id: `${runId}:${filePath}`,
        };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        filePath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const filePath = validateAgentfsFilePath(input.filePath);

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        // Get all tool calls and filter for those affecting the specified file
        const toolCallsRaw = await fsdb.tools.getRecent(0, 1000);
        const changes = toolCallsRaw
          .filter((c: AgentFSToolCall) => {
            const callPath = extractPath(c.parameters);
            return callPath.includes(filePath);
          })
          .map((c: AgentFSToolCall) => ({
            id: String(c.id),
            type: inferOperationType(c.name),
            timestamp: new Date(c.started_at * 1000).toISOString(),
            diff: extractDiff(c.parameters, c.result),
          }));

        return { changes };
      } finally {
        await fsdb.close();
      }
    }),

  fileBlame: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        const filePath =
          typeof rec.filePath === "string" ? rec.filePath : "unknown";
        return {
          kind: "agentfs_file",
          id: `${runId}:${filePath}`,
        };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        filePath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const filePath = validateAgentfsFilePath(input.filePath);

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const st = await fsdb.fs.stat(filePath).catch(() => null);
        if (!st || typeof st.mtime !== "number") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "agentfs_file_not_found",
          });
        }

        const toolCallsRaw = await fsdb.tools.getRecent(0, 1000);
        const candidates = rankAgentfsBlameCandidates({
          toolCalls: toolCallsRaw,
          fileMtimeSec: st.mtime,
          limit: 5,
        });

        return {
          mtimeSec: st.mtime,
          candidates,
        };
      } finally {
        await fsdb.close();
      }
    }),

  fileClass: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy(
        "agentfs.read",
        (raw) => {
          const rec = (raw ?? {}) as Record<string, unknown>;
          const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
          const filePath =
            typeof rec.filePath === "string" ? rec.filePath : "unknown";
          return {
            kind: "agentfs_file",
            id: `${runId}:${filePath}`,
          };
        },
        (raw) => {
          const rec = (raw ?? {}) as Record<string, unknown>;
          const filePath = typeof rec.filePath === "string" ? rec.filePath : "";
          return { sensitivity: classifyAgentfsFilePath(filePath) };
        }
      )
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        filePath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const filePath = validateAgentfsFilePath(input.filePath);

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const st = await fsdb.fs.stat(filePath).catch(() => null);
        if (!st || typeof st.isDirectory !== "function" || st.isDirectory()) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "agentfs_file_not_found",
          });
        }

        const cls = await readAgentfsFileClass(fsdb, filePath);
        return {
          filePath,
          ...cls,
        };
      } finally {
        await fsdb.close();
      }
    }),

  fileContent: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy(
        "agentfs.read",
        (raw) => {
          const rec = (raw ?? {}) as Record<string, unknown>;
          const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
          const filePath =
            typeof rec.filePath === "string" ? rec.filePath : "unknown";
          return {
            kind: "agentfs_file",
            id: `${runId}:${filePath}`,
          };
        },
        (raw) => {
          const rec = (raw ?? {}) as Record<string, unknown>;
          const filePath = typeof rec.filePath === "string" ? rec.filePath : "";
          return { sensitivity: classifyAgentfsFilePath(filePath) };
        }
      )
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        filePath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const filePath = validateAgentfsFilePath(input.filePath);

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const cls = await readAgentfsFileClass(fsdb, filePath);
        if (cls.sensitivity === "sensitive") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "agentfs_sensitive_file",
          });
        }

        const maxBytes = getPreviewMaxBytes();
        const { buf, sizeBytes } = await readAgentfsPrefix(
          fsdb,
          filePath,
          maxBytes
        );

        const truncated = sizeBytes > maxBytes;

        const isBinary = looksBinary(buf);
        const encoding = isBinary ? ("base64" as const) : ("utf8" as const);
        const content = isBinary
          ? buf.toString("base64")
          : buf.toString("utf8");

        return {
          encoding,
          content,
          isBinary,
          sizeBytes,
          truncated,
        };
      } finally {
        await fsdb.close();
      }
    }),

  fileSlice: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy(
        "agentfs.read",
        (raw) => {
          const rec = (raw ?? {}) as Record<string, unknown>;
          const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
          const filePath =
            typeof rec.filePath === "string" ? rec.filePath : "unknown";
          return {
            kind: "agentfs_file",
            id: `${runId}:${filePath}`,
          };
        },
        (raw) => {
          const rec = (raw ?? {}) as Record<string, unknown>;
          const filePath = typeof rec.filePath === "string" ? rec.filePath : "";
          return { sensitivity: classifyAgentfsFilePath(filePath) };
        }
      )
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        filePath: z.string().min(1).max(500),
        offsetBytes: z.number().int().min(0).default(0),
        maxBytes: z
          .number()
          .int()
          .min(1)
          .max(1024 * 1024)
          .default(200_000),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const filePath = validateAgentfsFilePath(input.filePath);

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const cls = await readAgentfsFileClass(fsdb, filePath);
        if (cls.sensitivity === "sensitive") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "agentfs_sensitive_file",
          });
        }

        const { buf, sizeBytes } = await readAgentfsRange(
          fsdb,
          filePath,
          input.offsetBytes,
          input.maxBytes
        );

        const isBinary = looksBinary(buf);
        const encoding = isBinary ? ("base64" as const) : ("utf8" as const);
        const content = isBinary
          ? buf.toString("base64")
          : buf.toString("utf8");
        const truncated = input.offsetBytes + buf.length < sizeBytes;

        return {
          encoding,
          content,
          isBinary,
          sizeBytes,
          offsetBytes: input.offsetBytes,
          returnedBytes: buf.length,
          truncated,
        };
      } finally {
        await fsdb.close();
      }
    }),

  kvList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const kvRaw = await fsdb.kv.list();
        const entries = kvRaw.map((e: AgentFSKVEntry) => {
          const redacted = maybeRedactKvEntryValue({
            key: e.key,
            value: e.value,
          });
          return {
            key: e.key,
            value: redacted.value,
            type: redacted.redacted ? "redacted" : typeof e.value,
            createdAt: new Date((e.created_at ?? 0) * 1000).toISOString(),
            updatedAt: new Date((e.updated_at ?? 0) * 1000).toISOString(),
          };
        });

        return { entries };
      } finally {
        await fsdb.close();
      }
    }),

  executorConfigGet: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        kind: executorKindSchema,
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const key = `executor:${input.kind}:config`;
        const raw = await fsdb.kv.get<unknown>(key);
        const parsed = raw ? executorConfigPublicSchema.safeParse(raw) : null;
        return {
          exists: Boolean(raw),
          config: parsed?.success ? parsed.data : null,
          valid: parsed ? parsed.success : false,
        };
      } finally {
        await fsdb.close();
      }
    }),

  executorConfigSet: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        config: executorConfigWriteSchema,
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const kind = input.config.kind;
        const keyConfig = `executor:${kind}:config`;
        const keySecrets = `executor:${kind}:secrets`;

        let nextSecrets: unknown | undefined;
        let passwordSet = false;

        if (kind === "opencode") {
          const cfg = input.config as Extract<
            z.infer<typeof executorConfigWriteSchema>,
            { kind: "opencode" }
          >;

          if (cfg.transport === "http") {
            const baseUrl = cfg.http?.baseUrl;
            if (baseUrl) {
              assertSafeExecutorHttpBaseUrl(baseUrl);
            }
          }

          const prevSecrets = await fsdb.kv.get<unknown>(keySecrets);
          const prevHttp =
            prevSecrets && typeof prevSecrets === "object"
              ? (prevSecrets as Record<string, unknown>).http
              : undefined;
          const prevPassword =
            prevHttp && typeof prevHttp === "object"
              ? (prevHttp as Record<string, unknown>).password
              : undefined;

          const nextPassword = cfg.http?.password;
          const password =
            typeof nextPassword === "string"
              ? nextPassword
              : typeof prevPassword === "string"
                ? prevPassword
                : undefined;
          passwordSet = typeof password === "string" && password.length > 0;

          if (password) {
            nextSecrets = {
              http: { password },
              kind,
              v: cfg.v,
            };
            await fsdb.kv.set(keySecrets, nextSecrets);
          }

          const publicCfg = {
            acp: cfg.acp,
            defaultExecProfile: cfg.defaultExecProfile,
            http: cfg.http
              ? {
                  baseUrl: cfg.http.baseUrl,
                  passwordSet,
                  username: cfg.http.username,
                }
              : undefined,
            kind,
            transport: cfg.transport,
            v: cfg.v,
          };

          const parsedPublic = executorConfigPublicSchema.safeParse(publicCfg);
          if (!parsedPublic.success) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "executor_config_invalid",
            });
          }

          await fsdb.kv.set(keyConfig, parsedPublic.data);
          return {
            config: parsedPublic.data,
            exists: true,
          };
        }

        if (kind === "codex") {
          await fsdb.kv.set(keyConfig, input.config);
          return { config: input.config, exists: true };
        }

        await fsdb.kv.set(keyConfig, input.config);
        return { config: input.config, exists: true };
      } finally {
        await fsdb.close();
      }
    }),

  executorStatus: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        kind: executorKindSchema,
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const expectedName = `alfred-agentfs-${sanitizeRunId(input.runId)}`;
        const expectedCw = "/workspace";

        const keyConfig = `executor:${input.kind}:config`;
        const raw = await fsdb.kv.get<unknown>(keyConfig);
        const parsed = raw ? executorConfigPublicSchema.safeParse(raw) : null;
        const issues = parsed?.success
          ? undefined
          : parsed
            ? parsed.error.issues.map((i) => i.message)
            : undefined;

        const supports = (() => {
          if (input.kind === "droid") {
            return {
              execProfiles: ["default"] as const,
              transports: undefined,
            };
          }
          if (input.kind === "codex") {
            return {
              execProfiles: ["default", "server"] as const,
              transports: undefined,
            };
          }
          return {
            execProfiles: ["default", "server"] as const,
            transports: ["acp", "http"] as const,
          };
        })();

        const res = {
          config: {
            exists: Boolean(raw),
            issues,
            valid: parsed ? parsed.success : false,
          },
          containerContext: {
            expectedCw,
            expectedName,
            present: input.kind !== "droid",
          },
          kind: input.kind,
          supports,
        };

        return executorStatusSchema.parse(res);
      } finally {
        await fsdb.close();
      }
    }),

  executorHealth: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        kind: executorKindSchema,
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const checkedAt = new Date().toISOString();
        const keyConfig = `executor:${input.kind}:config`;
        const rawCfg = await fsdb.kv.get<unknown>(keyConfig);
        const parsedCfg = rawCfg
          ? executorConfigPublicSchema.safeParse(rawCfg)
          : null;
        if (!parsedCfg?.success) {
          return executorHealthSchema.parse({
            checkedAt,
            details: rawCfg
              ? "executor_config_invalid"
              : "executor_config_missing",
            kind: input.kind,
            ok: false,
          });
        }

        if (input.kind !== "opencode") {
          return executorHealthSchema.parse({
            checkedAt,
            details: "executor_health_unsupported",
            kind: input.kind,
            ok: false,
          });
        }

        const cfg = parsedCfg.data as Extract<
          z.infer<typeof executorConfigPublicSchema>,
          { kind: "opencode" }
        >;

        if (cfg.transport !== "http") {
          return executorHealthSchema.parse({
            checkedAt,
            details: "opencode_health_acp_unsupported",
            kind: input.kind,
            ok: false,
          });
        }

        const baseUrl = cfg.http?.baseUrl;
        if (!baseUrl) {
          return executorHealthSchema.parse({
            checkedAt,
            details: "opencode_http_baseurl_required",
            kind: input.kind,
            ok: false,
          });
        }

        const safeBaseUrl = assertSafeExecutorHttpBaseUrl(baseUrl);

        const keySecrets = `executor:${input.kind}:secrets`;
        const rawSecrets = await fsdb.kv.get<unknown>(keySecrets);
        const secretsHttp =
          rawSecrets && typeof rawSecrets === "object"
            ? (rawSecrets as Record<string, unknown>).http
            : undefined;
        const password =
          secretsHttp && typeof secretsHttp === "object"
            ? (secretsHttp as Record<string, unknown>).password
            : undefined;

        const username = cfg.http?.username;
        const passwordSet = cfg.http?.passwordSet === true;
        if (
          passwordSet &&
          !(typeof username === "string" && username.length > 0)
        ) {
          return executorHealthSchema.parse({
            checkedAt,
            details: "opencode_http_username_required",
            kind: input.kind,
            ok: false,
          });
        }
        if (
          passwordSet &&
          !(typeof password === "string" && password.length > 0)
        ) {
          return executorHealthSchema.parse({
            checkedAt,
            details: "opencode_http_password_missing",
            kind: input.kind,
            ok: false,
          });
        }

        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 2000);
        try {
          const headers = new Headers();
          if (passwordSet && username && typeof password === "string") {
            const token = Buffer.from(
              `${username}:${password}`,
              "utf8"
            ).toString("base64");
            headers.set("authorization", `Basic ${token}`);
          }

          const res = await fetch(`${safeBaseUrl}/path`, {
            headers,
            method: "GET",
            signal: ac.signal,
          });

          if (!res.ok) {
            return executorHealthSchema.parse({
              checkedAt,
              details: `opencode_http_unhealthy:${res.status}`,
              kind: input.kind,
              ok: false,
            });
          }

          return executorHealthSchema.parse({
            checkedAt,
            kind: input.kind,
            ok: true,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return executorHealthSchema.parse({
            checkedAt,
            details: `opencode_http_unhealthy:${msg}`,
            kind: input.kind,
            ok: false,
          });
        } finally {
          clearTimeout(t);
        }
      } finally {
        await fsdb.close();
      }
    }),

  operationsList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(500).default(100),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const toolCallsRaw = await fsdb.tools.getRecent(0, input.limit);
        const operations = toolCallsRaw.map((c: AgentFSToolCall) => ({
          id: String(c.id),
          type: inferOperationType(c.name),
          name: c.name,
          path: extractPath(c.parameters),
          timestamp: new Date(c.started_at * 1000).toISOString(),
          duration: c.duration_ms ?? 0,
          bytesAffected: extractBytes(c.result),
          error: c.error ?? null,
        }));

        return { operations };
      } finally {
        await fsdb.close();
      }
    }),

  pinRun: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(z.object({ runId: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const runId = sanitizeRunId(input.runId);
        if (!runId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_run_id_invalid",
          });
        }

        const runDir = path.resolve(process.cwd(), ".agentfs", runId);
        const keep = path.join(runDir, ".keep");
        await mkdir(runDir, { recursive: true });
        await writeFile(keep, new Date().toISOString(), "utf8");

        await recordAgentfsOp({
          ctx,
          action: "pin_set",
          success: true,
          runId: input.runId,
        });
        return { ok: true };
      } catch (error) {
        await recordAgentfsOp({
          ctx,
          action: "pin_set",
          success: false,
          runId: input.runId,
          extra: {
            error: error instanceof Error ? error.message : String(error ?? ""),
          },
        });
        throw error;
      }
    }),

  runStats: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return {
          kind: "agentfs_file",
          id: `${runId}:/`,
        };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const db = fsdb.getDatabase() as unknown;
        const hasPrepare =
          typeof (db as { prepare?: unknown } | null)?.prepare === "function";
        if (!hasPrepare) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "agentfs_db_unavailable",
          });
        }

        const stats = await readAgentfsRunStats(
          db as { prepare: (sql: string) => { get?: () => unknown } }
        );

        return {
          toolCalls: stats.toolCalls,
          checkpoints: stats.checkpoints,
          files: stats.files,
          bytes: stats.bytes,
        };
      } finally {
        await fsdb.close();
      }
    }),

  setRetention: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        days: z.number().int().min(1).max(3650),
      })
    )
    .mutation(async ({ input }) => {
      const runId = sanitizeRunId(input.runId);
      if (!runId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_run_id_invalid",
        });
      }

      const runDir = path.resolve(process.cwd(), ".agentfs", runId);
      await mkdir(runDir, { recursive: true });
      const p = path.join(runDir, ".retention");
      await writeFile(p, String(input.days), "utf8");
      return { ok: true, retentionDays: input.days };
    }),

  snapshot: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        const dir = typeof rec.dir === "string" ? rec.dir : "/";
        return { kind: "agentfs_file", id: `${runId}:${dir}` };
      })
    )
    .input(agentfsSnapshotInputSchema)
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const dir = validateAgentfsFilePath(input.dir);

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const names = await fsdb.fs.readdir(dir);
        const entries = await Promise.all(
          names.map(async (name: string, i: number) => {
            const full = path.posix.join(dir, name);
            const st = await fsdb.fs.stat(full).catch(() => null);
            return toDirEntry(name, st, i + 1);
          })
        );

        const toolCallsRaw = await fsdb.tools.getRecent(0, 200);
        const toolCalls = toolCallsRaw.map((c: AgentFSToolCall) => ({
          id: c.id,
          name: c.name,
          startedAt: c.started_at,
          completedAt: c.completed_at,
          durationMs: c.duration_ms,
          error: c.error ?? null,
          parameters: c.parameters,
          result: c.result,
        }));

        const kvRaw = await fsdb.kv.list();
        const kvStore = kvRaw.map((e: AgentFSKVEntry) => {
          const redacted = maybeRedactKvEntryValue({
            key: e.key,
            value: e.value,
          });
          return {
            key: e.key,
            value: redacted.value,
            createdAt: e.created_at,
            updatedAt: e.updated_at,
          };
        });

        const maxToolCallId =
          toolCallsRaw.length > 0
            ? Math.max(...toolCallsRaw.map((t: AgentFSToolCall) => t.id))
            : 0;
        const maxToolCallSince =
          toolCallsRaw.length > 0
            ? Math.max(
                ...toolCallsRaw.map((t: AgentFSToolCall) => t.completed_at)
              )
            : 0;
        const maxKvUpdatedAt = kvStore
          .map((e: { updatedAt?: number }) => e.updatedAt ?? 0)
          .reduce((a: number, b: number) => Math.max(a, b), 0);

        const cursor: AgentFSStreamCursor = {
          toolCallId: maxToolCallId,
          toolCallSince: maxToolCallSince,
          kvUpdatedAt: maxKvUpdatedAt,
        };

        return {
          runId: input.runId,
          dbPath: input.dbPath,
          entries,
          toolCalls,
          kvStore,
          cursor,
        };
      } finally {
        await fsdb.close();
      }
    }),

  stream: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        const dir = typeof rec.dir === "string" ? rec.dir : "/";
        return { kind: "agentfs_file", id: `${runId}:${dir}` };
      })
    )
    .input(agentfsStreamInputSchema)
    .subscription(({ input, ctx }) => {
      let { dir } = input;
      try {
        dir = validateAgentfsFilePath(input.dir);
      } catch (error) {
        return observable<AgentFSStreamEvent>((emit) => {
          emit.error(error as TRPCError);
          return () => {};
        });
      }

      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        return observable<AgentFSStreamEvent>((emit) => {
          emit.error(
            new TRPCError({
              code: "BAD_REQUEST",
              message: "agentfs_path_invalid",
            })
          );
          return () => {};
        });
      }

      return observable<AgentFSStreamEvent>((emit) => {
        let cancelled = false;
        let cursor: AgentFSStreamCursor = input.cursor ?? {};
        let interval: ReturnType<typeof setInterval> | null = null;
        let loaded: Awaited<ReturnType<typeof loadAgentfs>> | null = null;
        let lastDbMtimeMs: number | null = null;
        let lastDiffSig: string | null = null;
        let eventCount = 0;

        const maxEvents = (() => {
          const raw = process.env.ALFRED_AGENTFS_MAX_EVENTS;
          if (!raw) {
            return 10_000;
          }
          const n = Number.parseInt(raw, 10);
          return Number.isFinite(n) && n > 0 ? n : 10_000;
        })();

        const finish = (reason: "closed" | "complete") => {
          cancelled = true;
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          void (async () => {
            if (loaded) {
              try {
                await loaded.fsdb.close();
              } catch {
                // ignore
              } finally {
                loaded = null;
              }
            }
          })();
          if (reason === "complete") {
            emit.next({
              type: "done",
              ts: Math.floor(Date.now() / 1000),
              reason,
            });
            emit.complete();
          }
        };

        const poll = async () => {
          if (cancelled) {
            return;
          }
          try {
            try {
              const absDbPath = path.resolve(process.cwd(), input.dbPath);
              const st = await stat(absDbPath);
              if (lastDbMtimeMs !== null && st.mtimeMs === lastDbMtimeMs) {
                return;
              }
              lastDbMtimeMs = st.mtimeMs;
            } catch {
              // If the db path isn't a real local file (or doesn't exist yet),
              // fall back to polling via the SDK without the mtime optimization.
            }

            if (!loaded) {
              loaded = await loadAgentfs({
                runId: input.runId,
                dbPath: input.dbPath,
              });

              await enforceAgentfsProjectAccess({
                ctx,
                runId: input.runId,
                dbPath: input.dbPath,
                baseDir: loaded.baseDir,
                projectId: input.projectId,
              });
            }

            const currentLoaded = loaded;
            if (!currentLoaded) {
              return;
            }

            const currentFsdb = currentLoaded.fsdb;

            const names = await currentFsdb.fs.readdir(dir);
            const entries = await Promise.all(
              names.map(async (name: string, i: number) => {
                const full = path.posix.join(dir, name);
                const st = await currentFsdb.fs.stat(full).catch(() => null);
                return toDirEntry(name, st, i + 1);
              })
            );

            const toolCallsRaw = await currentFsdb.tools.getRecent(
              cursor.toolCallSince ?? 0,
              200
            );
            const toolCalls = toolCallsRaw
              .filter((c: AgentFSToolCall) => c.id > (cursor.toolCallId ?? 0))
              .map((c: AgentFSToolCall) => ({
                id: c.id,
                name: c.name,
                startedAt: c.started_at,
                completedAt: c.completed_at,
                durationMs: c.duration_ms,
                error: c.error ?? null,
                parameters: c.parameters,
                result: c.result,
              }));

            const kvRaw = await currentFsdb.kv.list();
            const kvStore = kvRaw.map((e: AgentFSKVEntry) => {
              const redacted = maybeRedactKvEntryValue({
                key: e.key,
                value: e.value,
              });
              return {
                key: e.key,
                value: redacted.value,
                createdAt: e.created_at,
                updatedAt: e.updated_at,
              };
            });

            const diffRaw = await currentFsdb.diff().catch(() => []);
            const changes = [...diffRaw].sort(
              (a: AgentFSChange, b: AgentFSChange) =>
                a.path.localeCompare(b.path)
            );
            const diffSig = JSON.stringify(
              changes.map((c) => ({
                path: c.path,
                type: c.type,
                size: c.size ?? 0,
                mtime: c.mtime ?? 0,
              }))
            );
            const diffChanged = lastDiffSig !== diffSig;
            if (diffChanged) {
              lastDiffSig = diffSig;
            }

            const maxToolCallId =
              toolCallsRaw.length > 0
                ? Math.max(...toolCallsRaw.map((t: AgentFSToolCall) => t.id))
                : 0;
            const maxToolCallSince =
              toolCallsRaw.length > 0
                ? Math.max(
                    ...toolCallsRaw.map((t: AgentFSToolCall) => t.completed_at)
                  )
                : 0;
            const maxKvUpdatedAt = kvStore
              .map((e: { updatedAt?: number }) => e.updatedAt ?? 0)
              .reduce((a: number, b: number) => Math.max(a, b), 0);

            const prevKvUpdatedAt = cursor.kvUpdatedAt ?? 0;
            cursor = nextCursor(cursor, {
              toolCallId: maxToolCallId,
              toolCallSince: maxToolCallSince,
              kvUpdatedAt: maxKvUpdatedAt,
            });

            emit.next({
              type: "data",
              ts: Math.floor(Date.now() / 1000),
              runId: input.runId,
              dbPath: input.dbPath,
              cursor,
              entries,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              kvStore: maxKvUpdatedAt > prevKvUpdatedAt ? kvStore : undefined,
              changes: diffChanged ? changes : undefined,
            });

            eventCount++;
            if (eventCount >= maxEvents) {
              finish("complete");
            }
          } catch {
            emit.next({
              type: "error",
              ts: Math.floor(Date.now() / 1000),
              code: "agentfs_stream_failed",
              message: "agentfs_stream_failed",
              retryable: true,
            });
          }
        };

        void poll();
        interval = setInterval(() => {
          void poll();
        }, input.pollMs ?? 500);
        interval.unref?.();

        return () => {
          if (!cancelled) {
            finish("closed");
          }
        };
      });
    }),

  timeline: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200),
        dbPath: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(1000).default(500),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!isSafeAgentfsDbPath({ runId: input.runId, dbPath: input.dbPath })) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "agentfs_path_invalid",
        });
      }

      const { fsdb, baseDir } = await loadAgentfs({
        runId: input.runId,
        dbPath: input.dbPath,
      });

      try {
        await enforceAgentfsProjectAccess({
          ctx,
          runId: input.runId,
          dbPath: input.dbPath,
          baseDir,
          projectId: input.projectId,
        });

        const toolCallsRaw = await fsdb.tools.getRecent(0, input.limit);
        const events = toolCallsRaw.map((c: AgentFSToolCall) => ({
          id: String(c.id),
          type: "tool" as const,
          name: c.name,
          timestamp: new Date(c.started_at * 1000).toISOString(),
          duration: c.duration_ms,
          data: {
            parameters: c.parameters,
            result: c.result,
            error: c.error,
          },
        }));

        return { events };
      } finally {
        await fsdb.close();
      }
    }),

  unpinRun: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const runId = typeof rec.runId === "string" ? rec.runId : "unknown";
        return { kind: "agentfs_file", id: `${runId}:/` };
      })
    )
    .input(z.object({ runId: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const runId = sanitizeRunId(input.runId);
        if (!runId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "agentfs_run_id_invalid",
          });
        }

        const runDir = path.resolve(process.cwd(), ".agentfs", runId);
        const keep = path.join(runDir, ".keep");
        try {
          await unlink(keep);
        } catch {
          // ignore
        }

        await recordAgentfsOp({
          ctx,
          action: "pin_clear",
          success: true,
          runId: input.runId,
        });
        return { ok: true };
      } catch (error) {
        await recordAgentfsOp({
          ctx,
          action: "pin_clear",
          success: false,
          runId: input.runId,
          extra: {
            error: error instanceof Error ? error.message : String(error ?? ""),
          },
        });
        throw error;
      }
    }),

  workspacesList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .query(async ({ ctx }) => {
      try {
        const agentfsDir = path.join(process.cwd(), ".agentfs");
        const userId = getUserIdForAgentfsAccess({ session: ctx.session });

        // Check if .agentfs directory exists
        let dirExists = false;
        try {
          const stats = statSync(agentfsDir);
          dirExists = stats.isDirectory();
        } catch {
          dirExists = false;
        }

        if (!dirExists) {
          return { workspaces: [] };
        }

        // List subdirectories (each is a run)
        const entries = readdirSync(agentfsDir, { withFileTypes: true });
        const workspaces: WorkspaceListItem[] = [];

        for (const e of entries) {
          if (!e.isDirectory()) {
            continue;
          }
          if (e.name === "quarantine" || e.name === "cas") {
            continue;
          }

          const runPath = path.join(agentfsDir, e.name);
          const dbPath = `.agentfs/${e.name}/agentfs.db`;
          const keepPath = path.join(runPath, ".keep");
          const pinned = existsSync(keepPath);

          const retentionPath = path.join(runPath, ".retention");
          let retentionDays: number | null = null;
          try {
            if (existsSync(retentionPath)) {
              const raw = readFileSync(retentionPath, "utf8").trim();
              const n = Number.parseInt(raw, 10);
              if (Number.isFinite(n) && n > 0) {
                retentionDays = n;
              }
            }
          } catch {
            retentionDays = null;
          }

          let dbExists = false;
          let mtime: Date | undefined;
          try {
            const dbStats = statSync(path.join(runPath, "agentfs.db"));
            dbExists = dbStats.isFile();
            ({ mtime } = dbStats);
          } catch {
            dbExists = false;
          }
          if (!dbExists) {
            continue;
          }

          let projectId: string | null = null;
          try {
            const projectHint = path.join(runPath, ".project");
            if (existsSync(projectHint)) {
              const access = await checkAgentfsAccess({
                userId,
                runId: e.name,
                baseDir: null,
                requestedProjectId: null,
              });
              if (!access.allow && access.reason === "run_not_owned") {
                continue;
              }
              ({ projectId } = access);
            } else {
              const loaded = await loadAgentfs({ runId: e.name, dbPath });
              try {
                const access = await checkAgentfsAccess({
                  userId,
                  runId: e.name,
                  baseDir: loaded.baseDir,
                  requestedProjectId: null,
                });
                if (!access.allow && access.reason === "run_not_owned") {
                  continue;
                }
                ({ projectId } = access);
              } finally {
                await loaded.fsdb.close();
              }
            }
          } catch {
            projectId = null;
          }

          const isRecent =
            mtime && Date.now() - mtime.getTime() < 5 * 60 * 1000;

          workspaces.push({
            id: e.name,
            runId: e.name,
            dbPath,
            agentType: inferAgentType(e.name),
            status: isRecent ? "active" : "completed",
            createdAt: mtime?.toISOString() ?? new Date().toISOString(),
            operationCount: 0,
            checkpointCount: 0,
            pinned,
            retentionDays,
            projectId,
          });
        }

        return { workspaces };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list workspaces: ${(error as Error).message}`,
        });
      }
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Quarantine Management Procedures
  // ─────────────────────────────────────────────────────────────────────────

  quarantineList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "quarantine:/",
      }))
    )
    .input(
      z.object({
        cursor: z.string().min(1).max(500).optional(),
        limit: z.number().int().min(1).max(1000).default(100),
        type: z.enum(["run", "cas"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const { listQuarantine } = await import("../services/agentfs-quarantine");
      const result = await listQuarantine({
        cursor: input.cursor,
        limit: input.limit,
        type: input.type,
      });
      return { items: result.entries, nextCursor: result.nextCursor };
    }),

  quarantineInspect: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const id = typeof rec.id === "string" ? rec.id : "unknown";
        return { kind: "agentfs_file", id: `quarantine:${id}` };
      })
    )
    .input(z.object({ id: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const { inspectQuarantineItem } =
        await import("../services/agentfs-quarantine");
      const item = await inspectQuarantineItem(input.id);
      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quarantine item not found",
        });
      }
      return item;
    }),

  quarantineRestore: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const id = typeof rec.id === "string" ? rec.id : "unknown";
        return { kind: "agentfs_file", id: `quarantine:${id}` };
      })
    )
    .input(z.object({ id: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const { inspectQuarantineItem, restoreQuarantineItem } =
        await import("../services/agentfs-quarantine");

      const item = await inspectQuarantineItem(input.id).catch(() => null);

      const resource =
        item?.type === "run"
          ? { kind: "agentfs_quarantine", id: `run:${item.id}` }
          : item?.type === "cas"
            ? { kind: "agentfs_quarantine", id: `cas:${item.id}` }
            : { kind: "agentfs_quarantine", id: input.id };
      const runId = item?.type === "run" ? item.id : undefined;
      const sha = item?.type === "cas" ? item.id : undefined;

      const result = await restoreQuarantineItem(input.id);
      if (!result.success) {
        await recordAgentfsOp({
          ctx,
          action: "quarantine_restore",
          success: false,
          runId,
          sha,
          resource,
          extra: { error: result.error ?? "agentfs_quarantine_restore_failed" },
        });

        if (result.error === "agentfs_quarantine_not_found") {
          throw new TRPCError({ code: "NOT_FOUND", message: "not_found" });
        }
        if (result.error === "agentfs_quarantine_pinned") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "pinned",
          });
        }
        if (result.error === "agentfs_quarantine_target_exists") {
          throw new TRPCError({ code: "CONFLICT", message: "target_exists" });
        }
        if (
          result.error === "agentfs_quarantine_invalid_target" ||
          result.error === "agentfs_quarantine_no_target" ||
          result.error === "agentfs_quarantine_corrupt_metadata"
        ) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to restore quarantine item",
        });
      }

      await recordAgentfsOp({
        ctx,
        action: "quarantine_restore",
        success: true,
        runId,
        sha,
        resource,
        extra: { newPath: result.newPath },
      });
      return result;
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Storage Metrics Procedures
  // ─────────────────────────────────────────────────────────────────────────

  metricsStorage: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "metrics:/",
      }))
    )
    .input(z.object({ projectId: z.string().uuid().optional() }))
    .query(async ({ input }) => {
      const { calculateStorageMetrics } =
        await import("../services/agentfs-metrics");
      return calculateStorageMetrics({ projectId: input.projectId });
    }),

  metricsCas: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "metrics:cas",
      }))
    )
    .query(async () => {
      const { getCasMetrics } = await import("../services/agentfs-metrics");
      return getCasMetrics();
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Batch Operations Procedures
  // ─────────────────────────────────────────────────────────────────────────

  batchDelete: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "batch:/",
      }))
    )
    .input(
      z.object({
        runIds: z.array(z.string().min(1)).min(1).max(1000),
        dryRun: z.boolean().default(false),
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = getUserIdForAgentfsAccess(ctx);

      // Validate access to each run
      const accessibleRunIds: string[] = [];
      const failed: { id: string; success: boolean; error: string }[] = [];

      for (const runId of input.runIds) {
        const access = await checkAgentfsAccess({
          userId,
          runId,
          requestedProjectId: input.projectId ?? null,
        });

        if (!access.allow) {
          failed.push({
            id: runId,
            success: false,
            error:
              access.reason === "run_not_owned"
                ? "agentfs_run_forbidden"
                : "agentfs_project_mismatch",
          });
        } else {
          accessibleRunIds.push(runId);
        }
      }

      const { batchDelete } = await import("../services/agentfs-batch");
      const result = await batchDelete(accessibleRunIds, {
        dryRun: input.dryRun,
      });

      // Merge access failures with operation failures
      const merged = {
        ...result,
        failed: [...failed, ...result.failed],
      };
      await recordAgentfsOp({
        ctx,
        action: "batch_delete",
        success: merged.failed.length === 0,
        projectId: input.projectId ?? null,
        resource: { kind: "agentfs_batch", id: "delete" },
        extra: {
          dryRun: input.dryRun,
          requested: input.runIds.length,
          accessible: accessibleRunIds.length,
          deleted: merged.deleted.length,
          skippedPinned: merged.skippedPinned.length,
          failed: merged.failed.length,
          bytesFreed: merged.bytesFreed,
        },
      });
      return merged;
    }),

  batchPin: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "batch:/",
      }))
    )
    .input(
      z.object({
        runIds: z.array(z.string().min(1)).min(1).max(1000),
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = getUserIdForAgentfsAccess(ctx);

      // Validate access to each run
      const accessibleRunIds: string[] = [];
      const failed: { id: string; success: boolean; error: string }[] = [];

      for (const runId of input.runIds) {
        const access = await checkAgentfsAccess({
          userId,
          runId,
          requestedProjectId: input.projectId ?? null,
        });

        if (!access.allow) {
          failed.push({
            id: runId,
            success: false,
            error:
              access.reason === "run_not_owned"
                ? "agentfs_run_forbidden"
                : "agentfs_project_mismatch",
          });
        } else {
          accessibleRunIds.push(runId);
        }
      }

      const { batchPin } = await import("../services/agentfs-batch");
      const result = await batchPin(accessibleRunIds);

      const merged = {
        ...result,
        failed: [...failed, ...result.failed],
      };
      await recordAgentfsOp({
        ctx,
        action: "batch_pin",
        success: merged.failed.length === 0,
        projectId: input.projectId ?? null,
        resource: { kind: "agentfs_batch", id: "pin" },
        extra: {
          requested: input.runIds.length,
          accessible: accessibleRunIds.length,
          pinned: merged.pinned.length,
          alreadyPinned: merged.alreadyPinned.length,
          failed: merged.failed.length,
        },
      });
      return merged;
    }),

  batchUnpin: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "batch:/",
      }))
    )
    .input(
      z.object({
        runIds: z.array(z.string().min(1)).min(1).max(1000),
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = getUserIdForAgentfsAccess(ctx);

      // Validate access to each run
      const accessibleRunIds: string[] = [];
      const failed: { id: string; success: boolean; error: string }[] = [];

      for (const runId of input.runIds) {
        const access = await checkAgentfsAccess({
          userId,
          runId,
          requestedProjectId: input.projectId ?? null,
        });

        if (!access.allow) {
          failed.push({
            id: runId,
            success: false,
            error:
              access.reason === "run_not_owned"
                ? "agentfs_run_forbidden"
                : "agentfs_project_mismatch",
          });
        } else {
          accessibleRunIds.push(runId);
        }
      }

      const { batchUnpin } = await import("../services/agentfs-batch");
      const result = await batchUnpin(accessibleRunIds);

      const merged = {
        ...result,
        failed: [...failed, ...result.failed],
      };
      await recordAgentfsOp({
        ctx,
        action: "batch_unpin",
        success: merged.failed.length === 0,
        projectId: input.projectId ?? null,
        resource: { kind: "agentfs_batch", id: "unpin" },
        extra: {
          requested: input.runIds.length,
          accessible: accessibleRunIds.length,
          unpinned: merged.unpinned.length,
          notPinned: merged.notPinned.length,
          failed: merged.failed.length,
        },
      });
      return merged;
    }),

  batchExport: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "batch:/",
      }))
    )
    .input(
      z.object({
        runIds: z.array(z.string().min(1)).min(1).max(100),
        store: z.boolean().default(true),
        projectId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = getUserIdForAgentfsAccess(ctx);

      // Validate access to each run and collect projectIds
      const accessibleRunIds: string[] = [];
      const projectIdMap = new Map<string, string | null>();
      const failed: { id: string; success: boolean; error?: string }[] = [];

      for (const runId of input.runIds) {
        const access = await checkAgentfsAccess({
          userId,
          runId,
          requestedProjectId: input.projectId ?? null,
        });

        if (!access.allow) {
          failed.push({
            id: runId,
            success: false,
            error:
              access.reason === "run_not_owned"
                ? "agentfs_run_forbidden"
                : "agentfs_project_mismatch",
          });
        } else {
          accessibleRunIds.push(runId);
          projectIdMap.set(runId, access.projectId);
        }
      }

      // Export runs one by one to preserve project scoping
      const { batchExport } = await import("../services/agentfs-batch");
      const archives: { runId: string; sha: string }[] = [];
      const exportFailed: { id: string; success: boolean; error?: string }[] =
        [];

      for (const runId of accessibleRunIds) {
        try {
          const result = await batchExport([runId], {
            store: input.store,
            projectId: projectIdMap.get(runId),
          });
          archives.push(...result.archives);
          exportFailed.push(...result.failed);
        } catch {
          exportFailed.push({
            id: runId,
            success: false,
            error: "agentfs_batch_export_failed",
          });
        }
      }

      const merged = {
        archives,
        failed: [...failed, ...exportFailed],
      };
      await recordAgentfsOp({
        ctx,
        action: "batch_export",
        success: merged.failed.length === 0,
        projectId: input.projectId ?? null,
        resource: { kind: "agentfs_batch", id: "export" },
        extra: {
          store: input.store,
          requested: input.runIds.length,
          accessible: accessibleRunIds.length,
          archives: merged.archives.length,
          failed: merged.failed.length,
        },
      });
      return merged;
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Advanced Search Procedures
  // ─────────────────────────────────────────────────────────────────────────

  searchFiles: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "search:/",
      }))
    )
    .input(
      z.object({
        pattern: z.string().min(1).max(500),
        runIds: z.array(z.string().min(1).max(200)).min(1).max(1000).optional(),
        projectId: z.string().uuid().optional(),
        agentType: z.string().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        sensitivity: z.enum(["normal", "sensitive", "all"]).default("normal"),
        limit: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { searchFiles } = await import("../services/agentfs-search");
      const runIds = await resolveSearchRunIds({
        ctx,
        projectId: input.projectId ?? null,
        runIds: input.runIds,
      });
      return searchFiles(input.pattern, {
        runIds,
        projectId: runIds ? undefined : input.projectId,
        agentType: input.agentType,
        dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
        dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        sensitivity: input.sensitivity,
        limit: input.limit,
      });
    }),

  searchKv: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "search:/",
      }))
    )
    .input(
      z.object({
        keyPattern: z.string().min(1).max(500),
        valuePattern: z.string().min(1).max(500).optional(),
        runIds: z.array(z.string().min(1).max(200)).min(1).max(1000).optional(),
        projectId: z.string().uuid().optional(),
        agentType: z.string().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { searchKv } = await import("../services/agentfs-search");
      const runIds = await resolveSearchRunIds({
        ctx,
        projectId: input.projectId ?? null,
        runIds: input.runIds,
      });
      return searchKv(
        input.keyPattern,
        {
          runIds,
          projectId: runIds ? undefined : input.projectId,
          agentType: input.agentType,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
          limit: input.limit,
        },
        input.valuePattern
      );
    }),

  searchToolCalls: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "search:/",
      }))
    )
    .input(
      z.object({
        namePattern: z.string().min(1).max(500),
        paramsPattern: z.string().min(1).max(500).optional(),
        runIds: z.array(z.string().min(1).max(200)).min(1).max(1000).optional(),
        projectId: z.string().uuid().optional(),
        agentType: z.string().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const { searchToolCalls } = await import("../services/agentfs-search");
      const runIds = await resolveSearchRunIds({
        ctx,
        projectId: input.projectId ?? null,
        runIds: input.runIds,
      });
      return searchToolCalls(
        input.namePattern,
        {
          runIds,
          projectId: runIds ? undefined : input.projectId,
          agentType: input.agentType,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
          limit: input.limit,
        },
        input.paramsPattern
      );
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Retention Policy Procedures
  // ─────────────────────────────────────────────────────────────────────────

  retentionPreview: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "retention:/",
      }))
    )
    .input(
      z.object({
        retentionDays: z.number().int().min(1).max(3650).optional(),
        casRetentionDays: z.number().int().min(1).max(3650).optional(),
        maxBytes: z.number().int().min(0).optional(),
        casMaxBytes: z.number().int().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      const { generateRetentionPreview } =
        await import("../services/agentfs-retention");
      return generateRetentionPreview({
        retentionDays: input.retentionDays,
        casRetentionDays: input.casRetentionDays,
        maxBytes: input.maxBytes,
        casMaxBytes: input.casMaxBytes,
      });
    }),

  retentionSimulate: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "retention:/",
      }))
    )
    .input(
      z.object({
        retentionDays: z.number().int().min(1).max(3650).optional(),
        casRetentionDays: z.number().int().min(1).max(3650).optional(),
        maxBytes: z.number().int().min(0).optional(),
        casMaxBytes: z.number().int().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      const { simulateCleanup } = await import("../services/agentfs-retention");
      return simulateCleanup({
        retentionDays: input.retentionDays,
        casRetentionDays: input.casRetentionDays,
        maxBytes: input.maxBytes,
        casMaxBytes: input.casMaxBytes,
      });
    }),

  retentionViolations: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "retention:/",
      }))
    )
    .query(async () => {
      const { getPolicyViolations } =
        await import("../services/agentfs-retention");
      return getPolicyViolations();
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // CAS Management Procedures
  // ─────────────────────────────────────────────────────────────────────────

  casList: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "cas:/",
      }))
    )
    .input(
      z.object({
        cursor: z.string().min(1).max(500).optional(),
        projectId: z.string().uuid().optional(),
        runId: z.string().min(1).max(200).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input }) => {
      const { listCasArchives } = await import("../services/agentfs-cas");
      return listCasArchives({
        cursor: input.cursor,
        projectId: input.projectId,
        runId: input.runId,
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
        limit: input.limit,
      });
    }),

  casMetadata: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const sha = typeof rec.sha === "string" ? rec.sha : "unknown";
        return { kind: "agentfs_file", id: `cas:${sha}` };
      })
    )
    .input(z.object({ sha: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const { getCasMetadata } = await import("../services/agentfs-cas");
      const archive = await getCasMetadata(input.sha);
      if (!archive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "CAS archive not found",
        });
      }
      return archive;
    }),

  casDelete: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", (raw) => {
        const rec = (raw ?? {}) as Record<string, unknown>;
        const sha = typeof rec.sha === "string" ? rec.sha : "unknown";
        return { kind: "agentfs_file", id: `cas:${sha}` };
      })
    )
    .input(z.object({ sha: z.string().min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const { deleteCasArchive } = await import("../services/agentfs-cas");
      const result = await deleteCasArchive(input.sha);
      if (!result.success) {
        await recordAgentfsOp({
          ctx,
          action: "cas_delete",
          success: false,
          sha: input.sha,
          resource: { kind: "agentfs_cas", id: input.sha },
          extra: { error: result.error ?? "agentfs_cas_delete_failed" },
        });

        if (result.error === "agentfs_cas_archive_not_found") {
          throw new TRPCError({ code: "NOT_FOUND", message: "not_found" });
        }
        if (result.error === "agentfs_cas_archive_pinned") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "pinned",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to delete CAS archive",
        });
      }

      await recordAgentfsOp({
        ctx,
        action: "cas_delete",
        success: true,
        sha: input.sha,
        resource: { kind: "agentfs_cas", id: input.sha },
      });
      return result;
    }),

  casStats: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "cas:/",
      }))
    )
    .query(async () => {
      const { getCasStorageStats } = await import("../services/agentfs-cas");
      return getCasStorageStats();
    }),

  casCleanup: authedProcedure
    .use(
      requireScopes({
        required: [READ_SCOPES.AGENTFS, WRITE_SCOPES.AGENTFS],
      })
    )
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "cas:/",
      }))
    )
    .mutation(async ({ ctx }) => {
      try {
        const { cleanupOrphanedCas } = await import("../services/agentfs-cas");
        const result = await cleanupOrphanedCas();
        await recordAgentfsOp({
          ctx,
          action: "cas_cleanup",
          success: true,
          resource: { kind: "agentfs_cas", id: "/" },
          extra: result,
        });
        return result;
      } catch (error) {
        await recordAgentfsOp({
          ctx,
          action: "cas_cleanup",
          success: false,
          resource: { kind: "agentfs_cas", id: "/" },
          extra: {
            error: error instanceof Error ? error.message : String(error ?? ""),
          },
        });
        throw error;
      }
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Access Audit Procedures
  // ─────────────────────────────────────────────────────────────────────────

  auditLog: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "audit:/",
      }))
    )
    .input(
      z.object({
        runId: z.string().min(1).max(200).optional(),
        userId: z.string().min(1).max(200).optional(),
        action: z.string().min(1).max(100).optional(),
        resource: z.string().min(1).max(500).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        successOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = getUserIdForAgentfsAccess({ session: ctx.session });
      const { queryAuditLog } = await import("../services/agentfs-audit");
      return queryAuditLog({
        runId: input.runId,
        userId,
        action: input.action,
        resource: input.resource,
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
        successOnly: input.successOnly,
        limit: input.limit,
      });
    }),

  auditRecent: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "audit:/",
      }))
    )
    .input(z.object({ limit: z.number().int().min(1).max(1000).default(50) }))
    .query(async ({ input, ctx }) => {
      const { getRecentActivity } = await import("../services/agentfs-audit");
      const userId = getUserIdForAgentfsAccess({ session: ctx.session });
      const entries = await getRecentActivity(userId, input.limit);
      return { entries };
    }),

  auditStats: authedProcedure
    .use(requireScopes({ required: READ_SCOPES.AGENTFS }))
    .use(
      requirePolicy("agentfs.read", () => ({
        kind: "agentfs_file",
        id: "audit:/",
      }))
    )
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { getAccessStats } = await import("../services/agentfs-audit");
      const userId = getUserIdForAgentfsAccess({ session: ctx.session });
      return getAccessStats(userId, new Date(input.from), new Date(input.to));
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function inferAgentType(runId: string): string {
  if (runId.includes("codex")) {
    return "codex";
  }
  if (runId.includes("droid")) {
    return "droid";
  }
  if (runId.includes("claude")) {
    return "claude";
  }
  if (runId.includes("roo")) {
    return "roo";
  }
  return "agent";
}

function inferOperationType(
  toolName: string
): "read" | "write" | "delete" | "mkdir" {
  const lower = toolName.toLowerCase();
  if (
    lower.includes("read") ||
    lower.includes("get") ||
    lower.includes("list")
  ) {
    return "read";
  }
  if (
    lower.includes("write") ||
    lower.includes("create") ||
    lower.includes("save")
  ) {
    return "write";
  }
  if (lower.includes("delete") || lower.includes("remove")) {
    return "delete";
  }
  if (lower.includes("mkdir") || lower.includes("directory")) {
    return "mkdir";
  }
  return "read";
}

function extractPath(parameters: unknown): string {
  if (!parameters || typeof parameters !== "object") {
    return "";
  }
  const params = parameters as Record<string, unknown>;
  if (typeof params.path === "string") {
    return params.path;
  }
  if (typeof params.file === "string") {
    return params.file;
  }
  if (typeof params.filePath === "string") {
    return params.filePath;
  }
  return "";
}

function extractBytes(result: unknown): number | undefined {
  if (!result || typeof result !== "object") {
    return;
  }
  const res = result as Record<string, unknown>;
  if (typeof res.bytes === "number") {
    return res.bytes;
  }
  if (typeof res.size === "number") {
    return res.size;
  }
  if (typeof res.content === "string") {
    return res.content.length;
  }
  return;
}

function extractDiff(parameters: unknown, result: unknown): string | null {
  if (!parameters || typeof parameters !== "object") {
    return null;
  }
  const params = parameters as Record<string, unknown>;
  if (typeof params.content === "string") {
    return params.content.slice(0, 500);
  }
  if (result && typeof result === "object") {
    const res = result as Record<string, unknown>;
    if (typeof res.content === "string") {
      return res.content.slice(0, 500);
    }
  }
  return null;
}

async function recordAgentfsOp(args: {
  ctx: { session: unknown | null };
  action: AuditAction;
  success: boolean;
  projectId?: string | null;
  runId?: string;
  sha?: string;
  resource?: { kind: string; id?: string };
  extra?: Record<string, unknown>;
}): Promise<void> {
  try {
    const {
      action,
      ctx,
      extra,
      projectId,
      resource: resourceOverride,
      runId,
      sha,
      success,
    } = args;
    const userId = getUserIdForAgentfsAccess(ctx);
    const { recordAudit } = await import("@alfred/agent/utils/audit");
    let resource = resourceOverride;
    if (!resource) {
      if (sha) {
        resource = { kind: "agentfs_cas", id: sha };
      } else if (runId) {
        resource = { kind: "agentfs_run", id: runId };
      } else {
        resource = { kind: "agentfs" };
      }
    }

    await recordAudit({
      userId,
      projectId: projectId ?? null,
      action: `agentfs.op.${action}`,
      resource,
      decision: success ? "allow" : "deny",
      context: {
        success,
        runId,
        sha,
        ...(extra ?? {}),
      },
    });
  } catch {
    // Audit must never affect operation flow.
  }
}
