import { ragRepo } from "@alfred/db";
import type { ContextBundle, ContextFileSlice, SearchReceipt, SearchReceiptItem } from "@alfred/type";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createTokenEstimator } from "../util/token";
import { toolDroid } from "../tool/droid";
import { toolWeb } from "../tool/web";

type Writer = { write: (chunk: unknown) => Promise<void> | void } | undefined;

const DEFAULT_EXTS = [".ts", ".tsx", ".js", ".jsx", ".json", ".md"];
const DEFAULT_IGNORE = ["node_modules", ".git", "dist", "build", ".turbo", ".tsbuild", ".factory"];
const DEFAULT_TOPK = 25;
const DEFAULT_SLICE_MAX_LINES = 400;
const DEFAULT_MAX_TOKENS = Number(process.env.ORCH_CONTEXT_MAX_TOKENS ?? "24000");

function normalizeExts(exts?: string[]) {
  const list = exts && exts.length > 0 ? exts : DEFAULT_EXTS;
  return new Set(list.map(ext => (ext.startsWith(".") ? ext : `.${ext}`)));
}

function normalizeIgnore(ignore?: string[]) {
  if (!ignore || ignore.length === 0) {
    return new Set(DEFAULT_IGNORE);
  }
  return new Set(ignore);
}

function within(base: string, target: string) {
  const relative = path.relative(base, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function serializeReceipt(receipt: SearchReceipt) {
  return {
    ...receipt,
    created: receipt.created.toISOString(),
  };
}

function serializeBundle(bundle: ContextBundle) {
  return {
    ...bundle,
  };
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
      if (!entry || typeof entry !== "object") continue;
      const pathValue = typeof entry.path === "string" ? entry.path : undefined;
      if (!pathValue) continue;
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

async function fallbackScan(requirement: string, cw: string, exts: Set<string>, ignore: Set<string>, topK: number): Promise<SearchReceiptItem[]> {
  const keywords = Array.from(
    new Set(
      requirement
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .filter(token => token.length >= 3),
    ),
  );

  const queue: string[] = [cw];
  const collected: SearchReceiptItem[] = [];

  while (queue.length > 0 && collected.length < topK * 4) {
    const current = queue.pop();
    if (!current) continue;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        if (!exts.has(`.${entry.name}`)) {
          if (ignore.has(entry.name)) continue;
        }
      }
      if (ignore.has(entry.name)) continue;
      const resolved = path.join(current, entry.name);
      if (!within(cw, resolved)) continue;
      if (entry.isDirectory()) {
        queue.push(resolved);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (exts.size > 0 && !exts.has(ext)) continue;
      let stats;
      try {
        stats = await stat(resolved);
      } catch {
        continue;
      }
      const relPath = path.relative(cw, resolved) || entry.name;
      const lowerPath = relPath.toLowerCase();
      let score = 0;
      for (const keyword of keywords) {
        if (lowerPath.includes(keyword)) {
          score += 1;
        }
      }
      score = keywords.length > 0 ? Math.min(1, score / keywords.length) : 0.1;
      const reason = score > 0 ? `Matches keywords: ${keywords.filter(k => lowerPath.includes(k)).join(", ")}` : "Potentially relevant source file.";
      collected.push({
        id: `code:${relPath}`,
        kind: "code",
        path: relPath,
        score,
        reason,
        bytes: stats.size,
      });
    }
  }

  collected.sort((a, b) => (b.score - a.score) || (a.path ?? "").localeCompare(b.path ?? ""));
  return collected.slice(0, topK);
}

function summariseReceipt(items: SearchReceiptItem[]) {
  if (items.length === 0) return "No files identified.";
  return `Top ${Math.min(5, items.length)} files: ${items
    .slice(0, 5)
    .map(item => item.path ?? item.id)
    .join(", ")}`;
}

export async function gatherCodeContext({
  requirement,
  cw,
  exts,
  ignore,
  topK,
  writer,
  authz,
}: {
  requirement: string;
  cw: string;
  exts?: string[];
  ignore?: string[];
  topK?: number;
  writer?: Writer;
  authz: string | undefined;
}): Promise<SearchReceipt> {
  const resolvedCw = path.resolve(cw);
  const extSet = normalizeExts(exts);
  const ignoreSet = normalizeIgnore(ignore);
  const limit = topK ?? DEFAULT_TOPK;

  let items: SearchReceiptItem[] = [];
  try {
    const prompt = buildDroidPrompt(requirement, limit);
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

  if (items.length === 0) {
    items = await fallbackScan(requirement, resolvedCw, extSet, ignoreSet, limit);
  }

  const receipt: SearchReceipt = {
    code: items.slice(0, limit),
    created: new Date(),
    summary: summariseReceipt(items),
  };

  await writer?.write({
    type: "context",
    phase: "scan",
    receipts: serializeReceipt(receipt),
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
  const limit = topK ?? 5;
  let results: SearchReceiptItem[] = [];
  try {
    const provider = (process.env.ORCH_WEB_PROVIDER ?? (process.env.EXA_API_KEY ? "exa" : "ddg")) as
      | "exa"
      | "ddg"
      | "serpapi"
      | "tavily";

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
                livecrawl: "always",
                text: { maxCharacters: 1_000 },
                highlights: { numSentences: 1, highlightsPerUrl: 1, query: requirement.slice(0, 280) },
                summary: { query: "Key findings" },
                subpages: 1,
                subpageTarget: "sources",
              }
            : undefined,
      },
    });
    results = (output.results ?? []).map((entry, index) => ({
      id: entry.url ?? `web:${index}`,
      kind: "web",
      url: entry.url,
      title: entry.title,
      score: entry.score ?? 1 / (index + 1),
      reason: entry.snippet ?? entry.title ?? entry.url,
      snippet: entry.snippet,
      publishedDate: (entry as { publishedDate?: string }).publishedDate,
      image: (entry as { image?: string }).image,
      favicon: (entry as { favicon?: string }).favicon,
    }));
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
    };
  }

  const topResult = results[0];
  const receipt: SearchReceipt = {
    code: [],
    web: results,
    created: new Date(),
    summary: topResult
      ? `Top web result: ${topResult.title ?? topResult.url}${topResult.snippet ? ` — ${topResult.snippet}` : ""}`
      : "No web results",
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
    const content = await readFile(fullPath, "utf8");
    return content;
  } catch {
    return null;
  }
}

function buildBundleLinks(receipt: SearchReceipt) {
  if (!receipt.web || receipt.web.length === 0) {
    return undefined;
  }
  return receipt.web.slice(0, 5).map(link => ({
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
  const limit = Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : DEFAULT_MAX_TOKENS;
  const maxLines = sliceMaxLines ?? DEFAULT_SLICE_MAX_LINES;
  const extSet = normalizeExts(exts);
  const estimator = createTokenEstimator();

  let budget = limit;
  const files: ContextFileSlice[] = [];

  const sorted = [...(receipts.code ?? [])].sort((a, b) => b.score - a.score);

  for (const item of sorted) {
    if (budget <= 0) break;
    const relativePath = item.path ?? item.id.replace(/^code:/, "");
    if (!relativePath) continue;
    const fullPath = path.resolve(resolvedCw, relativePath);
    if (!within(resolvedCw, fullPath)) continue;
    const ext = path.extname(fullPath).toLowerCase();
    if (extSet.size > 0 && !extSet.has(ext)) continue;
    const content = await readFileSlice(fullPath);
    if (content === null || content.length === 0) continue;

    let tokens = estimator.estimate(content);
    let startLine = 1;
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
  items: Array<{ path: string; content: string }>;
  sourceId: string;
}): Promise<{ documentId: string | null }> {
  if (!items || items.length === 0) {
    return { documentId: null };
  }

  try {
    const document = (await ragRepo.createDocument(sourceId, `Context bundle ${new Date().toISOString()}`)) as
      | { id?: string }
      | null
      | undefined;
    const documentId = document?.id;
    if (!documentId) {
      return { documentId: null };
    }
    let order = 0;
    const chunks: Array<{ content: string; order: number; metadata?: Record<string, unknown> }> = [];
    for (const item of items) {
      if (!item.content) continue;
      chunks.push({
        content: `// ${item.path}\n${item.content}`,
        order: order += 1,
        metadata: {
          path: item.path,
          source: sourceId,
        },
      });
    }
    if (chunks.length === 0) {
      return { documentId };
    }
    await ragRepo.addChunks(documentId, chunks);
    return { documentId };
  } catch {
    return { documentId: null };
  }
}
