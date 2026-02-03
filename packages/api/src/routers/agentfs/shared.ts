import type {
  AgentFSKVEntry,
  AgentFSInterface,
} from "@alfred/agent/agentfs/types";
import type { AgentFSChange, AgentFSStreamCursor } from "@alfred/type";

import { TRPCError } from "@trpc/server";
import path from "node:path";
import { z } from "zod";

import type { AuditAction } from "../../agentfs/domain";

import { checkAgentfsAccess } from "../../services/agentfsaccess";

export function sanitizeRunId(runId: string): string {
  return runId.replaceAll(/[^a-zA-Z0-9-]/g, "-");
}

export function sanitizeCheckpointId(id: string): string {
  return id.replaceAll(/[^a-zA-Z0-9-]/g, "-");
}

export function coerceCheckpointCreatedAtSec(e: AgentFSKVEntry): number {
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

export function isSafeAgentfsDbPath(args: {
  runId: string;
  dbPath: string;
}): boolean {
  const runId = sanitizeRunId(args.runId);
  const normalized = args.dbPath.replaceAll(String.raw`\\`, "/");
  if (!normalized.startsWith(`.agentfs/${runId}/`)) {
    return false;
  }
  if (normalized.includes("..")) {
    return false;
  }
  return normalized.endsWith(".db");
}

export function validateAgentfsFilePath(filePath: string): string {
  const normalized = filePath.replaceAll(String.raw`\\`, "/");

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

export function getPreviewMaxBytes(): number {
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

export function looksBinary(buf: Buffer): boolean {
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

export type AgentfsFileSensitivity = "normal" | "sensitive";

export interface AgentfsFileClass {
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

export function classifyAgentfsFilePath(
  filePath: string
): AgentfsFileSensitivity {
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

export async function readAgentfsFileClass(
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
      sensitivity: byPath,
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

export async function readAgentfsPrefix(
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

export async function readAgentfsRange(
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

export function nextCursor(
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

export const agentfsSnapshotInputSchema = z.object({
  dbPath: z.string().min(1).max(500),
  dir: z.string().min(1).max(500).default("/workspace"),
  projectId: z.string().uuid().optional(),
  runId: z.string().min(1).max(200),
});

export const agentfsStreamInputSchema = z.object({
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

export async function loadAgentfs(args: {
  runId: string;
  dbPath: string;
}): Promise<{
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

export function getUserIdForAgentfsAccess(ctx: {
  session: unknown | null;
}): string {
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

export async function enforceAgentfsProjectAccess(args: {
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

export async function resolveSearchRunIds(args: {
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

export function toDirEntry(name: string, stat: unknown, inoFallback: number) {
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

export function redactExecutorKvEntry<T>(entry: { key: string; value: T }): {
  redacted: boolean;
  value: T | typeof EXECUTOR_KV_REDACTED_VALUE;
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
  const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
  const baseU32 = ipv4ToU32(base);
  return (u32 & mask) === (baseU32 & mask);
}

export function assertSafeExecutorHttpBaseUrl(raw: string): string {
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

export function inferAgentType(runId: string): string {
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

export function inferOperationType(
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

export function extractPath(parameters: unknown): string {
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

export function extractBytes(result: unknown): number | undefined {
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

export function extractDiff(
  parameters: unknown,
  result: unknown
): string | null {
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

export async function recordAgentfsOp(args: {
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

export interface AgentfsApplyResult {
  path: string;
  status: "success" | "error";
  message?: string;
}

export function filterChangesByPaths(
  changes: AgentFSChange[],
  paths: string[] | undefined
): AgentFSChange[] {
  if (!paths) {
    return changes;
  }
  const wanted = new Set(paths);
  const out: AgentFSChange[] = [];
  for (const change of changes) {
    if (wanted.has(change.path)) {
      out.push(change);
    }
  }
  return out;
}
