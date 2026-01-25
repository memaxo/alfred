import "bun";
import type {
  ContextBundle,
  ContextFileSlice,
  SearchReceipt,
  SearchReceiptItem,
} from "@alfred/type";

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
const WEB_SUMMARY_LIMIT = 180;

const contextCache = new Map<
  string,
  {
    expires: number;
    receipt: SearchReceipt;
  }
>();

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
}): Promise<SearchReceipt> {
  const resolvedCw = path.resolve(cw);
  const extSet = normalizeExts(exts);
  const ignoreSet = normalizeIgnore(ignore);
  const limit = topK ?? DEFAULT_TOPK;
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

  if (preferredExecutor === "codex") {
    try {
      const result = await toolCodex.execute({
        input: {
          action: "exec",
          prompt,
          out: "json",
          auto: "read",
          cw: resolvedCw,
          authz,
          profile,
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
          const fallbackResult = await toolDroid.execute({
            input: {
              prompt,
              out: "json",
              auto: "read",
              cw: resolvedCw,
              authz,
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

  if (items.length === 0 && preferredExecutor !== "codex") {
    try {
      const result = await toolDroid.execute({
        input: {
          prompt,
          out: "json",
          auto: "read",
          cw: resolvedCw,
          authz,
        },
        writer,
      });
      items = parseDroidOutput(result.result);
    } catch {
      items = [];
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
  maxTokens,
  sliceMaxLines,
  exts,
  writer,
}: {
  cw: string;
  receipts: SearchReceipt;
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

  let budget = limit;
  const files: ContextFileSlice[] = [];

  const sorted = [...(receipts.code ?? [])].sort((a, b) => b.score - a.score);

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

    let tokens = estimator.estimate(content);
    const startLine = 1;
    let endLine: number;
    let sliceContent = content;

    if (tokens > budget || content.split(/\r?\n/u).length > maxLines) {
      const lines = content.split(/\r?\n/u);
      let sliceLines = lines.slice(0, Math.min(maxLines, lines.length));
      sliceContent = sliceLines.join("\n");
      tokens = estimator.estimate(sliceContent);
      while (tokens > budget && sliceLines.length > 20) {
        sliceLines = sliceLines.slice(0, Math.floor(sliceLines.length * 0.75));
        sliceContent = sliceLines.join("\n");
        tokens = estimator.estimate(sliceContent);
      }
      endLine = sliceLines.length;
    } else {
      endLine = content.split(/\r?\n/u).length;
    }

    if (tokens > budget) {
      continue;
    }

    files.push({
      path: relativePath,
      startLine,
      endLine,
      tokens,
      content: sliceContent,
    });
    budget -= tokens;
  }

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
