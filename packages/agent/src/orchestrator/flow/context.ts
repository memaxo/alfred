import "bun";
import type { EnrichedEntry, PersistedIndex } from "@alfred/codeprint/types";
import type {
  ContextBundle,
  ContextFileSlice,
  SearchReceipt,
  SearchReceiptItem,
} from "@alfred/type";

import { randomUUID } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { ToolWriter } from "../tool/shared/context.js";

import { ingestCodeFiles } from "../../utils/rag-ingest.js";
import { toolCodex } from "../tool/codex/index";
import { toolDroid } from "../tool/droid";
import { toolWeb } from "../tool/web";
import { createTokenEstimator } from "../util/token";

type Writer = ToolWriter;

const DEFAULT_EXTS = [".ts", ".tsx", ".js", ".jsx", ".json", ".md"];
const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".turbo",
  ".tsbuild",
  ".factory",
];
const DEFAULT_TOPK = 25;
const DEFAULT_SLICE_MAX_LINES = 400;
const DEFAULT_MAX_TOKENS = Number(
  process.env.ORCH_CONTEXT_MAX_TOKENS ?? "24000"
);
const CONTEXT_CACHE_TTL_MS = 5 * 60_000;
const CODEPRINT_INDEX_TTL_MS = 5 * 60_000;
const WEB_SUMMARY_LIMIT = 180;

const QUERY_ALIASES: Record<string, readonly string[]> = {
  application: ["app"],
  authentication: ["auth"],
  authorization: ["auth", "authz"],
  config: ["configuration"],
  configuration: ["config"],
  database: ["db"],
  dependencies: ["dep", "deps"],
  dependency: ["dep", "deps"],
  environment: ["env"],
  embedding: ["embed"],
  embeddings: ["embed"],
  javascript: ["js"],
  jwt: ["auth", "jwks"],
  package: ["pkg"],
  packages: ["pkg"],
  planner: ["plan"],
  planning: ["plan"],
  repository: ["repo"],
  typescript: ["ts"],
};

const contextCache = new Map<
  string,
  {
    expires: number;
    receipt: SearchReceipt;
  }
>();

const codeprintIndexCache = new Map<
  string,
  { expires: number; index: Map<string, EnrichedEntry> }
>();

const codeprintRefCache = new Map<
  string,
  {
    expires: number;
    refs: Map<string, { path: string; line: number; kind: string }[]>;
  }
>();

async function loadCodeprintIndexFromDisk(
  workspace: string
): Promise<Map<string, EnrichedEntry> | null> {
  try {
    const data = await Bun.file(`${workspace}/.codeprint.json`).json();

    if (data && typeof data === "object" && "entries" in data) {
      const persisted = data as PersistedIndex;
      if (persisted?.meta?.version === 2) {
        return new Map(persisted.entries as [string, EnrichedEntry][]);
      }
    }

    if (Array.isArray(data)) {
      return new Map(data as [string, EnrichedEntry][]);
    }

    return null;
  } catch {
    return null;
  }
}

async function getOrLoadCodeprintIndex(
  workspace: string
): Promise<Map<string, EnrichedEntry> | null> {
  const cached = codeprintIndexCache.get(workspace);
  if (cached && cached.expires > Date.now()) {
    return cached.index;
  }

  const index = await loadCodeprintIndexFromDisk(workspace);
  if (!index) {
    return null;
  }

  codeprintIndexCache.set(workspace, {
    expires: Date.now() + CODEPRINT_INDEX_TTL_MS,
    index,
  });
  return index;
}

function getOrBuildRefIndex(
  workspace: string,
  index: Map<string, EnrichedEntry>
): Map<string, { path: string; line: number; kind: string }[]> {
  const cached = codeprintRefCache.get(workspace);
  if (cached && cached.expires > Date.now()) {
    return cached.refs;
  }

  const refs = new Map<
    string,
    { path: string; line: number; kind: string }[]
  >();
  for (const [p, entry] of index) {
    for (const ref of entry.references) {
      const key = ref.name.toLowerCase();
      let list = refs.get(key);
      if (!list) {
        list = [];
        refs.set(key, list);
      }
      list.push({ path: p, line: ref.line, kind: ref.kind });
    }
  }

  for (const list of refs.values()) {
    list.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  }

  codeprintRefCache.set(workspace, {
    expires: Date.now() + CODEPRINT_INDEX_TTL_MS,
    refs,
  });
  return refs;
}

function extractQueryTerms(requirement: string): Set<string> {
  const tokens = requirement
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length >= 3 && t.length <= 40);

  const expanded = new Set(tokens);
  for (const t of tokens) {
    const alts = QUERY_ALIASES[t];
    if (alts) {
      for (const alt of alts) {
        expanded.add(alt);
      }
    }

    if (t.length >= 8) {
      expanded.add(t.slice(0, 4));
    }
  }

  return expanded;
}

function tokenizeIdentifier(value: string): string[] {
  const out: string[] = [];
  const lower = value.toLowerCase();
  if (lower.length > 0) {
    out.push(lower);
  }
  const split = value
    .replaceAll(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length >= 3 && t.length <= 40);
  for (const t of split) {
    out.push(t);
  }
  return out;
}

interface Anchor {
  line: number;
  weight: number;
}

function collectAnchorNames(
  entry: EnrichedEntry,
  terms: Set<string>
): string[] {
  const names: string[] = [];

  for (const sym of entry.symbols) {
    const tokens = tokenizeIdentifier(sym.name);
    const hit = tokens.some((t) => terms.has(t));
    if (hit) {
      names.push(sym.name.toLowerCase());
    }
  }

  for (const ref of entry.references) {
    const tokens = tokenizeIdentifier(ref.name);
    const hit = tokens.some((t) => terms.has(t));
    if (hit) {
      names.push(ref.name.toLowerCase());
    }
  }

  return [...new Set(names)];
}

function collectAnchors(entry: EnrichedEntry, terms: Set<string>): Anchor[] {
  const anchors: Anchor[] = [];

  for (const sym of entry.symbols) {
    const tokens = tokenizeIdentifier(sym.name);
    const hit = tokens.some((t) => terms.has(t));
    if (!hit) {
      continue;
    }
    const base = sym.exported ? 4 : 3;
    anchors.push({ line: sym.line, weight: base });
  }

  for (const ref of entry.references) {
    const tokens = tokenizeIdentifier(ref.name);
    const hit = tokens.some((t) => terms.has(t));
    if (!hit) {
      continue;
    }
    anchors.push({ line: ref.line, weight: 2 });
  }

  return anchors;
}

interface Window {
  startLine: number;
  endLine: number;
  weight: number;
}

function mergeWindows(windows: Window[]): Window[] {
  if (windows.length <= 1) {
    return windows;
  }

  const sorted = [...windows].sort(
    (a, b) => a.startLine - b.startLine || a.endLine - b.endLine
  );
  const merged: Window[] = [];
  for (const w of sorted) {
    const last = merged.at(-1);
    if (!last || w.startLine > last.endLine + 3) {
      merged.push({ ...w });
      continue;
    }
    last.endLine = Math.max(last.endLine, w.endLine);
    last.weight += w.weight;
  }
  merged.sort((a, b) => b.weight - a.weight || a.startLine - b.startLine);
  return merged;
}

function buildWindows(
  anchors: Anchor[],
  totalLines: number,
  radius: number
): Window[] {
  const windows: Window[] = [];
  for (const a of anchors) {
    const line = Math.max(1, Math.min(totalLines, a.line));
    const startLine = Math.max(1, line - radius);
    const endLine = Math.min(totalLines, line + radius);
    windows.push({ startLine, endLine, weight: a.weight });
  }
  windows.sort((a, b) => a.startLine - b.startLine || b.weight - a.weight);

  const merged: Window[] = [];
  for (const win of windows) {
    const last = merged.at(-1);
    if (!last || win.startLine > last.endLine + 3) {
      merged.push({ ...win });
      continue;
    }
    last.endLine = Math.max(last.endLine, win.endLine);
    last.weight += win.weight;
  }

  merged.sort((a, b) => b.weight - a.weight || a.startLine - b.startLine);
  return merged;
}

function shrinkWindowToBudget(args: {
  lines: string[];
  startLine: number;
  endLine: number;
  budgetTokens: number;
  estimator: ReturnType<typeof createTokenEstimator>;
}): {
  startLine: number;
  endLine: number;
  content: string;
  tokens: number;
} | null {
  const { lines, estimator } = args;
  const totalLines = lines.length;
  let startLine = Math.max(1, Math.min(totalLines, args.startLine));
  let endLine = Math.max(startLine, Math.min(totalLines, args.endLine));

  let sliceLines = lines.slice(startLine - 1, endLine);
  let content = sliceLines.join("\n");
  let tokens = estimator.estimate(content);

  while (tokens > args.budgetTokens && sliceLines.length > 20) {
    const len = sliceLines.length;
    const nextLen = Math.max(20, Math.floor(len * 0.75));
    const mid = Math.floor((startLine + endLine) / 2);

    startLine = Math.max(1, mid - Math.floor(nextLen / 2));
    endLine = Math.min(totalLines, startLine + nextLen - 1);
    startLine = Math.max(1, endLine - nextLen + 1);

    sliceLines = lines.slice(startLine - 1, endLine);
    content = sliceLines.join("\n");
    tokens = estimator.estimate(content);
  }

  if (tokens > args.budgetTokens) {
    return null;
  }

  return { startLine, endLine, content, tokens };
}

function buildCacheKey(
  requirement: string,
  cw: string,
  exts: Set<string>,
  ignore: Set<string>,
  topK: number
) {
  return JSON.stringify({
    requirement,
    cw,
    exts: [...exts].sort(),
    ignore: [...ignore].sort(),
    topK,
  });
}

function cloneReceipt(receipt: SearchReceipt): SearchReceipt {
  return {
    ...receipt,
    created: receipt.created ? new Date(receipt.created) : new Date(),
    code: receipt.code.map((item) => ({ ...item })),
    web: receipt.web ? receipt.web.map((item) => ({ ...item })) : undefined,
  };
}

function normalizeExts(exts?: string[]) {
  const list = exts && exts.length > 0 ? exts : DEFAULT_EXTS;
  return new Set(list.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`)));
}

function normalizeIgnore(ignore?: string[]) {
  if (!ignore || ignore.length === 0) {
    return new Set(DEFAULT_IGNORE);
  }
  return new Set(ignore);
}

function within(base: string, target: string) {
  const relative = path.relative(base, target);
  return (
    relative === "" || !(relative.startsWith("..") || path.isAbsolute(relative))
  );
}

function serializeReceipt(receipt: SearchReceipt) {
  return {
    ...receipt,
    created: receipt.created.toISOString(),
  };
}

type SerializedReceipt = ReturnType<typeof serializeReceipt>;

async function emitCacheHandoffEvent(
  writer: Writer,
  receipts: SerializedReceipt
) {
  await writer?.write?.({
    type: "data-cache-handoff",
    receipts,
  });
}

function serializeBundle(bundle: ContextBundle) {
  return {
    ...bundle,
  };
}

function compressSnippet(value: string | undefined, limit = WEB_SUMMARY_LIMIT) {
  if (!value) {
    return;
  }
  const compact = value.replaceAll(/\s+/g, " ").trim();
  if (compact.length === 0) {
    return;
  }
  if (compact.length <= limit) {
    return compact;
  }
  return `${compact.slice(0, limit - 3).trimEnd()}...`;
}

function buildDroidPrompt(requirement: string, topK: number) {
  return `You are analysing a repository to prepare context for the requirement: "${requirement}".
Return STRICT JSON with shape {"files": [{"path": string, "score": number (0-1), "reason": string, "bytes"?: number}]}.
Prioritise the most relevant ${topK} files, focusing on source code and docs.
Do not include commentary, markdown, or explanation outside of JSON.`;
}

function parseDroidOutput(raw: string): SearchReceiptItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.files)) {
      return [];
    }
    const items: SearchReceiptItem[] = [];
    for (const entry of parsed.files) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const pathValue = typeof entry.path === "string" ? entry.path : undefined;
      if (!pathValue) {
        continue;
      }
      const score = Number(entry.score);
      items.push({
        id: `code:${pathValue}`,
        kind: "code",
        path: pathValue,
        score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0.5,
        reason: typeof entry.reason === "string" ? entry.reason : undefined,
        bytes: typeof entry.bytes === "number" ? entry.bytes : undefined,
      });
    }
    return items;
  } catch {
    return [];
  }
}

async function fallbackScan(
  requirement: string,
  cw: string,
  exts: Set<string>,
  ignore: Set<string>,
  topK: number
): Promise<SearchReceiptItem[]> {
  const keywords = [
    ...new Set(
      requirement
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .filter((token) => token.length >= 3)
    ),
  ];

  const queue: string[] = [cw];
  const collected: SearchReceiptItem[] = [];

  while (queue.length > 0 && collected.length < topK * 4) {
    const current = queue.pop();
    if (!current) {
      continue;
    }
    let entries: string[];
    try {
      entries = await readdir(current);
    } catch {
      continue;
    }
    for (const entryName of entries) {
      if (
        entryName.startsWith(".") &&
        !exts.has(`.${entryName}`) &&
        ignore.has(entryName)
      ) {
        continue;
      }
      if (ignore.has(entryName)) {
        continue;
      }
      const resolved = path.join(current, entryName);
      if (!within(cw, resolved)) {
        continue;
      }
      let entryStats: Awaited<ReturnType<typeof stat>>;
      try {
        entryStats = await stat(resolved);
      } catch {
        continue;
      }
      if (entryStats.isDirectory()) {
        queue.push(resolved);
        continue;
      }
      const ext = path.extname(entryName).toLowerCase();
      if (exts.size > 0 && !exts.has(ext)) {
        continue;
      }
      const relPath = path.relative(cw, resolved) || entryName;
      const lowerPath = relPath.toLowerCase();
      let score = 0;
      for (const keyword of keywords) {
        if (lowerPath.includes(keyword)) {
          score += 1;
        }
      }
      score = keywords.length > 0 ? Math.min(1, score / keywords.length) : 0.1;
      const reason =
        score > 0
          ? `Matches keywords: ${keywords.filter((k) => lowerPath.includes(k)).join(", ")}`
          : "Potentially relevant source file.";
      collected.push({
        id: `code:${relPath}`,
        kind: "code",
        path: relPath,
        score,
        reason,
        bytes: entryStats.size,
      });
    }
  }

  collected.sort(
    (a, b) => b.score - a.score || (a.path ?? "").localeCompare(b.path ?? "")
  );
  return collected.slice(0, topK);
}

function summariseReceipt(items: SearchReceiptItem[]) {
  if (items.length === 0) {
    return "No files identified.";
  }
  return `Top ${Math.min(5, items.length)} files: ${items
    .slice(0, 5)
    .map((item) => item.path ?? item.id)
    .join(", ")}`;
}

type ExecutorName = "codex" | "droid";

function resolveExecutor(preferred?: ExecutorName): ExecutorName {
  if (preferred === "codex" || preferred === "droid") {
    return preferred;
  }
  const envExecutor = (process.env.ORCH_EXECUTOR ?? "").trim().toLowerCase();
  return envExecutor === "codex" ? "codex" : "droid";
}

function fallbackEnabled() {
  return process.env.ORCH_EXECUTOR_FALLBACK === "1";
}

interface ContextContainer {
  containerName: string;
  containerCw: string;
  cleanup?: () => Promise<void>;
}

function resolveContainerCw(args: {
  workspaceRoot: string;
  workingDirectory: string;
  baseCw: string;
}): string {
  const rel = path.relative(args.workspaceRoot, args.workingDirectory);
  const relPosix = rel.split(path.sep).join(path.posix.sep);
  if (relPosix && !relPosix.startsWith("..") && relPosix !== ".") {
    return path.posix.join(args.baseCw, relPosix);
  }
  return args.baseCw;
}

async function ensureContextContainer(args: {
  cw: string;
  authz?: string;
  containerName?: string;
  containerCw?: string;
}): Promise<ContextContainer> {
  if (args.containerName && args.containerCw) {
    return {
      containerName: args.containerName,
      containerCw: args.containerCw,
    };
  }
  const { AgentFSWorkspace } = await import("../../environment/agentfs.js");
  const workspaceRoot = path.resolve(process.cwd());
  const resolvedCw = path.resolve(args.cw);
  const rel = path.relative(workspaceRoot, resolvedCw);
  const repoRoot =
    rel && !rel.startsWith("..") && rel !== "." ? workspaceRoot : resolvedCw;
  const runId = `context-${randomUUID()}`;
  const workspace = new AgentFSWorkspace("context", runId, repoRoot, {
    authz: args.authz,
  });
  await workspace.initialize();
  const containerCw = resolveContainerCw({
    workspaceRoot: repoRoot,
    workingDirectory: resolvedCw,
    baseCw: workspace.containerCw,
  });
  return {
    containerName: workspace.containerName,
    containerCw,
    cleanup: () => workspace.cleanup(),
  };
}

export async function gatherCodeContext({
  requirement,
  cw,
  exts,
  ignore,
  topK,
  writer,
  authz,
  executor,
  profile,
  userId,
  containerName,
  containerCw,
}: {
  requirement: string;
  cw: string;
  exts?: string[];
  ignore?: string[];
  topK?: number;
  writer?: Writer;
  authz: string | undefined;
  executor?: ExecutorName;
  profile?: string;
  userId?: string;
  containerName?: string;
  containerCw?: string;
}): Promise<SearchReceipt> {
  const resolvedCw = path.resolve(cw);
  const extSet = normalizeExts(exts);
  const ignoreSet = normalizeIgnore(ignore);
  const limit = topK ?? DEFAULT_TOPK;
  const disableLlm = process.env.ORCH_CONTEXT_NO_LLM === "1";
  const codeprintEnabled =
    process.env.ORCH_CONTEXT_CODEPRINT === "0"
      ? false
      : process.env.CODEPRINT_ENABLED !== "0";
  const cacheKey = buildCacheKey(
    requirement,
    resolvedCw,
    extSet,
    ignoreSet,
    limit
  );

  const cached = contextCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    const cachedReceipt = cloneReceipt(cached.receipt);
    const serializedReceipts = serializeReceipt(cachedReceipt);
    await emitCacheHandoffEvent(writer, serializedReceipts);
    await writer?.write?.({
      type: "context",
      phase: "cache",
      receipts: serializedReceipts,
    });
    return cachedReceipt;
  }

  const preferredExecutor = resolveExecutor(executor);
  const allowFallback = fallbackEnabled();
  const prompt = buildDroidPrompt(requirement, limit);

  let items: SearchReceiptItem[] = [];

  if (codeprintEnabled) {
    try {
      const { findRelevantFiles } = await import("@alfred/codeprint");
      const results = await findRelevantFiles(resolvedCw, requirement, limit);
      items = results
        .filter((result) => {
          const ext = path.extname(result.path).toLowerCase();
          if (extSet.size > 0 && ext.length > 0 && !extSet.has(ext)) {
            return false;
          }
          const segments = result.path.split(/[\\/]+/u);
          return !segments.some((seg) => ignoreSet.has(seg));
        })
        .map((result) => ({
          id: `code:${result.path}`,
          kind: "code",
          path: result.path,
          score: Math.max(0, Math.min(1, result.score)),
          reason: `codeprint:${result.method}`,
        }));

      const minScoreRaw = Number(
        process.env.ORCH_CONTEXT_CODEPRINT_MIN_SCORE ?? "0.18"
      );
      const minGapRaw = Number(
        process.env.ORCH_CONTEXT_CODEPRINT_MIN_GAP ?? "0.03"
      );
      const minScore =
        Number.isFinite(minScoreRaw) && minScoreRaw > 0 ? minScoreRaw : 0.18;
      const minGap =
        Number.isFinite(minGapRaw) && minGapRaw > 0 ? minGapRaw : 0.03;

      if (items.length > 0) {
        const topScore = items[0]?.score ?? 0;
        const k = Math.min(items.length - 1, Math.min(limit - 1, 4));
        const kScore = items[k]?.score ?? topScore;
        const gap = topScore - kScore;

        const lowConfidence =
          topScore < minScore || (items.length >= 2 && k >= 1 && gap < minGap);

        if (lowConfidence) {
          await writer?.write?.({
            type: "notice",
            message: "codeprint_low_confidence_fallback",
            topScore,
            gap,
          });
          items = [];
        }
      }
    } catch {
      items = [];
    }
  }

  let contextContainer: ContextContainer | null = null;
  const getContextContainer = async () => {
    if (contextContainer) {
      return contextContainer;
    }
    contextContainer = await ensureContextContainer({
      cw: resolvedCw,
      authz,
      containerName,
      containerCw,
    });
    return contextContainer;
  };

  try {
    if (!disableLlm && preferredExecutor === "codex") {
      try {
        const ctxContainer = await getContextContainer();
        const result = await toolCodex.execute({
          input: {
            action: "exec",
            prompt,
            out: "json",
            auto: "read",
            cw: resolvedCw,
            authz,
            profile,
            containerName: ctxContainer.containerName,
            containerCw: ctxContainer.containerCw,
            userId,
          },
          writer,
        });
        items = parseDroidOutput(result.result);
      } catch (error) {
        await writer?.write?.({
          type: "notice",
          message: "codex_context_error",
          error: error instanceof Error ? error.message : String(error),
        });

        if (allowFallback) {
          await writer?.write?.({
            type: "notice",
            message: "codex_fallback_droid",
          });
          try {
            const ctxContainer = await getContextContainer();
            const fallbackResult = await toolDroid.execute({
              input: {
                prompt,
                out: "json",
                auto: "read",
                cw: resolvedCw,
                authz,
                containerName: ctxContainer.containerName,
                containerCw: ctxContainer.containerCw,
              },
              writer,
            });
            items = parseDroidOutput(fallbackResult.result);
          } catch {
            items = [];
          }
        }
      }
    }

    if (!disableLlm && items.length === 0 && preferredExecutor !== "codex") {
      try {
        const ctxContainer = await getContextContainer();
        const result = await toolDroid.execute({
          input: {
            prompt,
            out: "json",
            auto: "read",
            cw: resolvedCw,
            authz,
            containerName: ctxContainer.containerName,
            containerCw: ctxContainer.containerCw,
          },
          writer,
        });
        items = parseDroidOutput(result.result);
      } catch {
        items = [];
      }
    }
  } finally {
    const cleanup = (contextContainer as ContextContainer | null)?.cleanup;
    if (cleanup) {
      await cleanup();
    }
  }

  if (items.length === 0) {
    items = await fallbackScan(
      requirement,
      resolvedCw,
      extSet,
      ignoreSet,
      limit
    );
  }

  const receipt: SearchReceipt = {
    code: items.slice(0, limit),
    created: new Date(),
    summary: summariseReceipt(items),
  };

  contextCache.set(cacheKey, {
    expires: Date.now() + CONTEXT_CACHE_TTL_MS,
    receipt: cloneReceipt(receipt),
  });

  const serializedReceipts = serializeReceipt(receipt);
  await emitCacheHandoffEvent(writer, serializedReceipts);
  await writer?.write({
    type: "context",
    phase: "scan",
    receipts: serializedReceipts,
  });

  return receipt;
}

export async function gatherWebContext({
  requirement,
  topK,
  writer,
  authz,
}: {
  requirement: string;
  topK?: number;
  writer?: Writer;
  authz: string | undefined;
}): Promise<SearchReceipt> {
  const limit = Math.max(1, Math.min(topK ?? 4, 5));
  let results: SearchReceiptItem[] = [];
  let providerUsed: "exa" | "ddg" | "serpapi" | "tavily" | undefined;

  const envProvider = (process.env.ORCH_WEB_PROVIDER ?? "")
    .trim()
    .toLowerCase();
  const hasExa = Boolean(
    process.env.EXA_API_KEY && process.env.EXA_API_KEY.trim().length > 0
  );
  const provider: "exa" | "ddg" | "serpapi" | "tavily" = (() => {
    if (
      envProvider === "serpapi" ||
      envProvider === "tavily" ||
      envProvider === "ddg"
    ) {
      return envProvider;
    }
    if (envProvider === "exa") {
      return hasExa ? "exa" : "ddg";
    }
    return hasExa ? "exa" : "ddg";
  })();

  try {
    const output = await toolWeb.execute({
      input: {
        action: "search",
        q: requirement,
        topK: limit,
        authz,
        provider,
        exa:
          provider === "exa"
            ? {
                livecrawl: "fallback",
                text: false,
                highlights: {
                  numSentences: 1,
                  highlightsPerUrl: 1,
                  query: requirement.slice(0, 280),
                },
                summary: { query: "Key findings" },
              }
            : undefined,
      },
    });
    providerUsed = output.provider ?? provider;
    results = (output.results ?? []).map((entry, index) => {
      const snippet = compressSnippet(entry.snippet);
      const scoreRaw =
        typeof entry.score === "number" ? entry.score : 1 / (index + 1);
      const score = Math.max(0, Math.min(1, scoreRaw));
      return {
        id: entry.url ?? `web:${index}`,
        kind: "web",
        url: entry.url,
        title: entry.title,
        score,
        reason: snippet ?? entry.title ?? entry.url,
        snippet,
        publishedDate: (entry as { publishedDate?: string }).publishedDate,
        image: (entry as { image?: string }).image,
        favicon: (entry as { favicon?: string }).favicon,
      };
    });
  } catch (error) {
    await writer?.write({
      type: "context",
      phase: "web",
      message: error instanceof Error ? error.message : "web_search_failed",
    });
    return {
      code: [],
      web: [],
      created: new Date(),
      summary:
        provider === "exa"
          ? "Web search failed — falling back from Exa to DuckDuckGo"
          : "Web search failed",
    };
  }

  const topResult = results[0];
  const providerLabel =
    providerUsed === "exa"
      ? "Exa"
      : providerUsed === "serpapi"
        ? "SerpAPI"
        : providerUsed === "tavily"
          ? "Tavily"
          : "DuckDuckGo";
  const receipt: SearchReceipt = {
    code: [],
    web: results,
    created: new Date(),
    summary: topResult
      ? `${providerLabel} → ${topResult.title ?? topResult.url}${
          topResult.snippet ? ` — ${compressSnippet(topResult.snippet)}` : ""
        }`
      : `${providerLabel} → No web results`,
  };

  await writer?.write({
    type: "context",
    phase: "web",
    receipts: serializeReceipt(receipt),
  });

  return receipt;
}

async function readFileSlice(fullPath: string) {
  try {
    const content = await Bun.file(fullPath).text();
    return content;
  } catch {
    return null;
  }
}

function buildBundleLinks(receipt: SearchReceipt) {
  if (!receipt.web || receipt.web.length === 0) {
    return;
  }
  return receipt.web.slice(0, 5).map((link) => ({
    url: link.url ?? link.id,
    title: link.title,
    score: link.score,
  }));
}

export async function buildContextBundle({
  cw,
  receipts,
  requirement,
  maxTokens,
  sliceMaxLines,
  exts,
  writer,
}: {
  cw: string;
  receipts: SearchReceipt;
  requirement?: string;
  maxTokens: number;
  sliceMaxLines?: number;
  exts?: string[];
  writer?: Writer;
}): Promise<ContextBundle> {
  const resolvedCw = path.resolve(cw);
  const limit =
    Number.isFinite(maxTokens) && maxTokens > 0
      ? maxTokens
      : DEFAULT_MAX_TOKENS;
  const maxLines = sliceMaxLines ?? DEFAULT_SLICE_MAX_LINES;
  const extSet = normalizeExts(exts);
  const estimator = createTokenEstimator();

  const terms = requirement ? extractQueryTerms(requirement) : null;
  const edgeFollow = process.env.ORCH_CONTEXT_EDGE_FOLLOW === "1";
  const includeHeader = process.env.ORCH_CONTEXT_INCLUDE_HEADER !== "0";
  const codeprintIndex = terms
    ? await getOrLoadCodeprintIndex(resolvedCw)
    : null;
  const refIndex =
    edgeFollow && codeprintIndex
      ? getOrBuildRefIndex(resolvedCw, codeprintIndex)
      : null;

  let budget = limit;
  const files: ContextFileSlice[] = [];

  const seen = new Set<string>();
  const pushSlice = (slice: ContextFileSlice) => {
    const key = `${slice.path}:${slice.startLine}-${slice.endLine}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    files.push(slice);
  };

  const sorted = [...(receipts.code ?? [])].sort((a, b) => b.score - a.score);

  const rankByPath = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]?.path;
    if (p) {
      rankByPath.set(p, i);
    }
  }

  for (const item of sorted) {
    if (budget <= 0) {
      break;
    }
    const relativePath = item.path ?? item.id.replace(/^code:/, "");
    if (!relativePath) {
      continue;
    }
    const fullPath = path.resolve(resolvedCw, relativePath);
    if (!within(resolvedCw, fullPath)) {
      continue;
    }
    const ext = path.extname(fullPath).toLowerCase();
    if (extSet.size > 0 && !extSet.has(ext)) {
      continue;
    }
    const content = await readFileSlice(fullPath);
    if (content === null || content.length === 0) {
      continue;
    }

    const lines = content.split(/\r?\n/u);
    const totalLines = lines.length;
    const entry = codeprintIndex?.get(relativePath);
    const anchors = entry && terms ? collectAnchors(entry, terms) : [];

    const anchorNames =
      entry && terms && edgeFollow ? collectAnchorNames(entry, terms) : [];

    let windows: Window[] =
      anchors.length > 0
        ? buildWindows(anchors, totalLines, 40)
        : [
            {
              startLine: 1,
              endLine: Math.min(totalLines, maxLines),
              weight: 0,
            },
          ];

    if (includeHeader && anchors.length > 0) {
      const first = windows[0];
      if (first && first.startLine > 80) {
        windows = mergeWindows([
          ...windows,
          { startLine: 1, endLine: Math.min(30, totalLines), weight: 2 },
        ]);
      }
    }

    windows = mergeWindows(windows);

    let remainingLines = maxLines;
    for (const win of windows) {
      if (budget <= 0 || remainingLines <= 0) {
        break;
      }

      const cappedStart = win.startLine;
      const cappedEnd = Math.min(
        win.endLine,
        win.startLine + remainingLines - 1
      );
      const slice = shrinkWindowToBudget({
        lines,
        startLine: cappedStart,
        endLine: cappedEnd,
        budgetTokens: budget,
        estimator,
      });

      if (!slice) {
        continue;
      }

      pushSlice({
        path: relativePath,
        startLine: slice.startLine,
        endLine: slice.endLine,
        tokens: slice.tokens,
        content: slice.content,
      });
      budget -= slice.tokens;
      remainingLines -= slice.endLine - slice.startLine + 1;
    }

    if (budget > 0 && refIndex && anchorNames.length > 0) {
      const callerCandidates: { path: string; line: number; rank: number }[] =
        [];
      for (const name of anchorNames) {
        const refs = refIndex.get(name);
        if (!refs) {
          continue;
        }
        for (const r of refs) {
          if (r.path === relativePath) {
            continue;
          }
          const rank = rankByPath.get(r.path) ?? Number.POSITIVE_INFINITY;
          callerCandidates.push({ path: r.path, line: r.line, rank });
        }
      }

      callerCandidates.sort(
        (a, b) =>
          a.rank - b.rank || a.path.localeCompare(b.path) || a.line - b.line
      );

      let added = 0;
      for (const caller of callerCandidates) {
        if (added >= 2) {
          break;
        }

        const callerFull = path.resolve(resolvedCw, caller.path);
        if (!within(resolvedCw, callerFull)) {
          continue;
        }
        const callerExt = path.extname(callerFull).toLowerCase();
        if (extSet.size > 0 && !extSet.has(callerExt)) {
          continue;
        }

        const callerContent = await readFileSlice(callerFull);
        if (!callerContent) {
          continue;
        }
        const callerLines = callerContent.split(/\r?\n/u);
        const callerTotal = callerLines.length;

        const win: Window = {
          startLine: Math.max(1, caller.line - 30),
          endLine: Math.min(callerTotal, caller.line + 30),
          weight: 0,
        };

        const slice = shrinkWindowToBudget({
          lines: callerLines,
          startLine: win.startLine,
          endLine: win.endLine,
          budgetTokens: budget,
          estimator,
        });
        if (!slice) {
          continue;
        }

        pushSlice({
          path: caller.path,
          startLine: slice.startLine,
          endLine: slice.endLine,
          tokens: slice.tokens,
          content: slice.content,
        });
        budget -= slice.tokens;
        added++;
      }
    }
  }

  // Merge overlapping slices per file (no adjacency merge) to reduce redundancy.
  const mergedFiles: ContextFileSlice[] = [];
  const byPath = new Map<string, ContextFileSlice[]>();
  const pathOrder: string[] = [];
  for (const f of files) {
    let list = byPath.get(f.path);
    if (!list) {
      list = [];
      byPath.set(f.path, list);
      pathOrder.push(f.path);
    }
    list.push(f);
  }

  for (const p of pathOrder) {
    const list = byPath.get(p);
    if (!list) {
      continue;
    }
    list.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
    const out: { startLine: number; endLine: number }[] = [];
    for (const s of list) {
      const last = out.at(-1);
      if (!last || s.startLine > last.endLine) {
        out.push({ startLine: s.startLine, endLine: s.endLine });
      } else {
        last.endLine = Math.max(last.endLine, s.endLine);
      }
    }

    const fullPath = path.resolve(resolvedCw, p);
    const content = await readFileSlice(fullPath);
    const lines = content ? content.split(/\r?\n/u) : null;

    for (const r of out) {
      const sliceContent =
        lines && lines.length > 0
          ? lines.slice(r.startLine - 1, r.endLine).join("\n")
          : (list[0]?.content ?? "");
      const tokens = estimator.estimate(sliceContent);
      mergedFiles.push({
        path: p,
        startLine: r.startLine,
        endLine: r.endLine,
        tokens,
        content: sliceContent,
      });
    }
  }

  files.length = 0;
  files.push(...mergedFiles);

  const estimatedTokens = files.reduce((sum, file) => sum + file.tokens, 0);
  const bundle: ContextBundle = {
    maxTokens: limit,
    estimatedTokens,
    files,
    links: buildBundleLinks(receipts),
    note: `Collected ${files.length} files within ~${estimatedTokens} tokens`,
  };

  await writer?.write({
    type: "context",
    phase: "bundle",
    bundle: serializeBundle(bundle),
  });

  return bundle;
}

export async function indexCodeEmbeddings({
  items,
  sourceId,
}: {
  items: {
    path: string;
    content: string;
    startLine?: number;
    endLine?: number;
    tokens?: number;
  }[];
  sourceId: string;
}): Promise<{ documentId: string | null }> {
  if (!Array.isArray(items) || items.length === 0) {
    return { documentId: null };
  }

  const filtered = items.filter(
    (item) => typeof item.content === "string" && item.content.trim().length > 0
  );
  if (filtered.length === 0) {
    return { documentId: null };
  }

  try {
    const documentId = await ingestCodeFiles(
      sourceId,
      filtered.map((item) => ({
        path: item.path,
        content: item.content,
        startLine: item.startLine,
        endLine: item.endLine,
        tokens: item.tokens,
      }))
    );
    return { documentId: documentId ?? null };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "rag_code_ingest_failed";
    throw new Error(`context_code_index_failed:${message}`, { cause: error });
  }
}

export const __internals = {
  contextCache,
  buildCacheKey,
  normalizeExts,
  normalizeIgnore,
};
