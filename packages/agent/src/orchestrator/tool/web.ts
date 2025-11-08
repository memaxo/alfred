import { clearTimeout, setTimeout as scheduleTimeout } from "node:timers";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { z } from "zod";

type WebProvider = "ddg" | "serpapi" | "tavily" | "exa";

type CostInfo = {
  total?: number;
  search?: number;
  contents?: number;
};

const HAS_EXA = Boolean(
  process.env.EXA_API_KEY && process.env.EXA_API_KEY.trim().length > 0
);
const DEFAULT_SEARCH_PROVIDER = (process.env.ORCH_WEB_PROVIDER ??
  (HAS_EXA ? "exa" : "ddg")) as WebProvider;
const DEFAULT_TOPK = 5;
const DEFAULT_TIMEOUT_SEC = 20;
const MAX_FETCH_BYTES = Number(process.env.WEB_FETCH_MAX_BYTES ?? 200_000);
const USER_AGENT =
  process.env.WEB_TOOL_USER_AGENT ??
  "Mozilla/5.0 (compatible; Alfred-Orchestrator/1.0; +https://github.com/factoryagency/alfred)";
const EXA_BASE_URL = process.env.EXA_BASE_URL ?? "https://api.exa.ai";
const EXA_TIMEOUT_MS = Number.isFinite(Number(process.env.EXA_TIMEOUT_MS))
  ? Number(process.env.EXA_TIMEOUT_MS)
  : 20_000;

const exaTextSchema = z.union([
  z.boolean(),
  z
    .object({
      maxCharacters: z.number().int().min(200).max(100_000).optional(),
      includeHtmlTags: z.boolean().optional(),
    })
    .strict(),
]);

const exaHighlightsSchema = z
  .object({
    numSentences: z.number().int().min(1).max(5).optional(),
    highlightsPerUrl: z.number().int().min(1).max(5).optional(),
    query: z.string().optional(),
  })
  .strict();

const exaSummarySchema = z
  .object({
    query: z.string().optional(),
    schema: z.record(z.string(), z.any()).optional(),
  })
  .strict();

const exaExtrasSchema = z
  .object({
    links: z.number().int().min(0).max(5).optional(),
    imageLinks: z.number().int().min(0).max(5).optional(),
  })
  .strict();

const exaContextSchema = z.union([
  z.boolean(),
  z
    .object({
      maxCharacters: z.number().int().min(500).max(200_000).optional(),
    })
    .strict(),
]);

const exaConfigSchema = z
  .object({
    type: z.enum(["auto", "neural", "keyword"]).optional(),
    category: z.string().optional(),
    livecrawl: z.enum(["never", "fallback", "always", "preferred"]).optional(),
    text: exaTextSchema.optional(),
    highlights: exaHighlightsSchema.optional(),
    summary: exaSummarySchema.optional(),
    subpages: z.number().int().min(0).max(5).optional(),
    subpageTarget: z.union([z.string(), z.array(z.string())]).optional(),
    extras: exaExtrasSchema.optional(),
    context: exaContextSchema.optional(),
  })
  .strict();

const webInputSchema = z.object({
  action: z.enum(["search", "fetch"]),
  q: z.string().min(3).optional(),
  url: z.string().url().optional(),
  topK: z.number().int().min(1).max(10).optional(),
  provider: z.enum(["ddg", "serpapi", "tavily", "exa"]).optional(),
  exa: exaConfigSchema.optional(),
  authz: z.string().optional(),
  timeoutSec: z.number().int().min(5).max(60).optional(),
});

type WebInput = z.infer<typeof webInputSchema>;

const webOutputSchema = z.object({
  ok: z.boolean(),
  action: z.enum(["search", "fetch"]),
  provider: z.enum(["ddg", "serpapi", "tavily", "exa"]).optional(),
  results: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        snippet: z.string().optional(),
        score: z.number().optional(),
        publishedDate: z.string().optional(),
        image: z.string().optional(),
        favicon: z.string().optional(),
      })
    )
    .optional(),
  details: z
    .object({
      url: z.string(),
      status: z.number().int(),
      contentType: z.string().optional(),
      text: z.string().optional(),
      json: z.unknown().optional(),
      truncated: z.boolean().optional(),
    })
    .optional(),
  cost: z
    .object({
      total: z.number().optional(),
      search: z.number().optional(),
      contents: z.number().optional(),
    })
    .optional(),
});

type WebOutput = z.infer<typeof webOutputSchema>;
type ExaConfig = z.infer<typeof exaConfigSchema>;

const exaCache = new Map<
  string,
  {
    expires: number;
    results: NonNullable<WebOutput["results"]>;
    cost?: CostInfo;
  }
>();
const EXA_CACHE_TTL_MS = 60_000;

function getExaHeaders() {
  const key = process.env.EXA_API_KEY;
  if (!key) {
    throw new Error("web_exa_missing_api_key");
  }
  return {
    "content-type": "application/json",
    "x-api-key": key,
    "user-agent": USER_AGENT,
  } satisfies Record<string, string>;
}

function createTimeoutController(timeoutSec?: number) {
  const controller = new AbortController();
  const ms = Math.min(
    (timeoutSec ?? DEFAULT_TIMEOUT_SEC) * 1000,
    EXA_TIMEOUT_MS
  );
  const timer = scheduleTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

async function enforcePolicy(input: WebInput) {
  await requireToolScopesAndPolicy(input.authz, ["web.read"], {
    action: `web.${input.action}`,
    resource: {
      kind: "web",
      id: input.url ?? input.q ?? "search",
    },
  });
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function compressSnippet(value: string | undefined, limit = 220) {
  if (!value) return;
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length === 0) return;
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 3).trimEnd()}...`;
}

function extractQueryTokens(query: string) {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .filter((token) => token.length >= 3)
    )
  );
}

function scoreExaResult(params: {
  entry: {
    score?: number;
    highlightScores?: number[];
    title?: string;
    summary?: string;
    highlights?: string[];
    text?: string;
  };
  queryTokens: string[];
  index: number;
}) {
  const { entry, queryTokens, index } = params;
  const base = clamp(typeof entry.score === "number" ? entry.score : 0, 0, 1);
  const highlight = clamp(
    Array.isArray(entry.highlightScores) && entry.highlightScores.length > 0
      ? Math.max(...entry.highlightScores.map((value) => clamp(value, 0, 1.5)))
      : 0,
    0,
    1
  );
  const textBuffer = [
    entry.title ?? "",
    entry.summary ?? "",
    ...(entry.highlights ?? []),
    entry.text ?? "",
  ]
    .join(" ")
    .toLowerCase();

  let tokenScore = 0;
  if (queryTokens.length > 0 && textBuffer.length > 0) {
    let matches = 0;
    for (const token of queryTokens) {
      if (textBuffer.includes(token)) {
        matches += 1;
      }
    }
    tokenScore = matches / queryTokens.length;
  }

  const position = clamp(1 / (index + 1), 0, 1);
  const weighted =
    base * 0.5 + highlight * 0.3 + tokenScore * 0.15 + position * 0.05;
  return clamp(weighted, 0, 1);
}

async function performDuckDuckGoSearch(
  query: string,
  topK: number
): Promise<WebOutput["results"]> {
  const url = new URL("https://lite.duckduckgo.com/lite/");
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`web_search_failed:${response.status}`);
  }

  const html = await response.text();
  const results: NonNullable<WebOutput["results"]> = [];
  const linkRegex =
    /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) && results.length < topK) {
    const href = match[1];
    if (!href || href.startsWith("/")) continue;
    const title = decodeEntities(match[2] ?? "").trim();
    results.push({
      url: href,
      title: title.length > 0 ? title : undefined,
    });
  }
  return results;
}

async function performSerpApiSearch(
  query: string,
  topK: number
): Promise<WebOutput["results"]> {
  const key = process.env.SERP_API_KEY;
  if (!key) {
    throw new Error("web_serpapi_missing_key");
  }
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(topK, 10)));
  url.searchParams.set("source", "alfred-orchestrator");
  url.searchParams.set("api_key", key);
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`web_search_failed:${response.status}`);
  }
  const payload = (await response.json()) as {
    organic_results?: Array<{
      link: string;
      title?: string;
      snippet?: string;
      position?: number;
    }>;
  };
  const organic = payload.organic_results ?? [];
  return organic.slice(0, topK).map((entry) => ({
    url: entry.link,
    title: entry.title,
    snippet: entry.snippet,
    score:
      typeof entry.position === "number" ? 1 / (entry.position + 1) : undefined,
  }));
}

function resolveProvider(provider?: WebProvider): WebProvider {
  const desired = provider ?? DEFAULT_SEARCH_PROVIDER;
  if (desired === "exa" && !HAS_EXA) {
    return "ddg";
  }
  return desired;
}

async function performExaSearch(
  query: string,
  topK: number,
  exaOpts: ExaConfig | undefined,
  timeoutSec?: number
): Promise<{ results: WebOutput["results"]; cost?: CostInfo }> {
  if (!HAS_EXA) {
    throw new Error("web_exa_missing_api_key");
  }

  const cacheKey = JSON.stringify({ query, topK, exaOpts });
  const now = Date.now();
  if (exaOpts?.livecrawl !== "always") {
    const cached = exaCache.get(cacheKey);
    if (cached && cached.expires > now) {
      return { results: cached.results, cost: cached.cost };
    }
  }

  const { signal, cancel } = createTimeoutController(timeoutSec);
  try {
    const fetchCount = Math.min(10, Math.max(topK + 2, topK));
    const queryTokens = extractQueryTokens(query);

    const body: Record<string, unknown> = {
      query,
      type: exaOpts?.type ?? "auto",
      numResults: fetchCount,
      contents: exaOpts?.text ?? false,
      liveCrawl: exaOpts?.livecrawl ?? "fallback",
    };

    if (exaOpts?.category) body.category = exaOpts.category;
    if (exaOpts?.highlights) body.highlights = exaOpts.highlights;
    if (exaOpts?.summary) body.summary = exaOpts.summary;
    if (typeof exaOpts?.subpages === "number") body.subpages = exaOpts.subpages;
    if (exaOpts?.subpageTarget) body.subpageTarget = exaOpts.subpageTarget;
    if (exaOpts?.extras) body.extras = exaOpts.extras;
    if (typeof exaOpts?.context !== "undefined") body.context = exaOpts.context;

    const response = await fetch(`${EXA_BASE_URL}/search`, {
      method: "POST",
      headers: getExaHeaders(),
      signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`web_exa_failed:${response.status}:${text}`);
    }

    const payload = (await response.json()) as {
      results?: Array<{
        id?: string;
        url: string;
        title?: string;
        highlights?: string[];
        highlightScores?: number[];
        summary?: string;
        text?: string;
        score?: number;
        publishedDate?: string;
        imageUrl?: string;
        faviconUrl?: string;
      }>;
      cost?: CostInfo;
    };

    const scoredResults = (payload.results ?? [])
      .slice(0, fetchCount)
      .map((entry, index) => {
        const snippetSource =
          entry.summary ??
          (Array.isArray(entry.highlights) && entry.highlights.length > 0
            ? entry.highlights[0]
            : entry.text);
        const relevance = scoreExaResult({
          entry,
          queryTokens,
          index,
        });
        return {
          entry,
          snippet: compressSnippet(snippetSource ?? undefined),
          relevance,
          index,
        };
      })
      .sort((a, b) => {
        if (b.relevance !== a.relevance) {
          return b.relevance - a.relevance;
        }
        return a.index - b.index;
      })
      .slice(0, topK);

    const results = scoredResults.map((item) => ({
      url: item.entry.url,
      title: item.entry.title ?? item.entry.url,
      snippet: item.snippet,
      score: item.relevance,
      publishedDate: item.entry.publishedDate,
      image: item.entry.imageUrl,
      favicon: item.entry.faviconUrl,
    }));

    if (exaOpts?.livecrawl !== "always") {
      exaCache.set(cacheKey, {
        results,
        cost: payload.cost,
        expires: Date.now() + EXA_CACHE_TTL_MS,
      });
    }

    return { results, cost: payload.cost };
  } finally {
    cancel();
  }
}

async function performExaContents(
  url: string,
  exaOpts: ExaConfig | undefined,
  timeoutSec?: number
): Promise<{ details: WebOutput["details"]; cost?: CostInfo }> {
  if (!HAS_EXA) {
    throw new Error("web_exa_missing_api_key");
  }
  const { signal, cancel } = createTimeoutController(timeoutSec);
  try {
    const maxCharacters = (() => {
      if (
        typeof exaOpts?.text === "object" &&
        typeof exaOpts.text.maxCharacters === "number"
      ) {
        return Math.min(exaOpts.text.maxCharacters, MAX_FETCH_BYTES);
      }
      if (
        typeof exaOpts?.context === "object" &&
        typeof exaOpts.context.maxCharacters === "number"
      ) {
        return Math.min(exaOpts.context.maxCharacters, MAX_FETCH_BYTES);
      }
      return Math.min(5000, MAX_FETCH_BYTES);
    })();

    const body: Record<string, unknown> = {
      urls: [url],
      text:
        typeof exaOpts?.text === "undefined" ? { maxCharacters } : exaOpts.text,
      summary: exaOpts?.summary,
      liveCrawl: exaOpts?.livecrawl ?? "fallback",
    };

    const response = await fetch(`${EXA_BASE_URL}/contents`, {
      method: "POST",
      headers: getExaHeaders(),
      signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`web_exa_contents_failed:${response.status}:${text}`);
    }

    const payload = (await response.json()) as {
      contents?: Array<{
        url: string;
        text?: string;
        summary?: string;
        status?: number;
        contentType?: string;
      }>;
      cost?: CostInfo;
    };

    const first = payload.contents?.[0];
    const text = first?.text ?? first?.summary ?? "";
    const truncated = text.length >= maxCharacters;

    return {
      details: {
        url,
        status: first?.status ?? 200,
        contentType: first?.contentType ?? "text/plain",
        text,
        truncated,
      },
      cost: payload.cost,
    };
  } finally {
    cancel();
  }
}

async function performSearch(
  query: string,
  topK: number,
  provider: WebProvider,
  exaOpts: ExaConfig | undefined,
  timeoutSec?: number
): Promise<{
  results: WebOutput["results"];
  cost?: CostInfo;
  provider: WebProvider;
}> {
  switch (provider) {
    case "exa":
      return {
        ...(await performExaSearch(query, topK, exaOpts, timeoutSec)),
        provider,
      };
    case "serpapi":
      return { results: await performSerpApiSearch(query, topK), provider };
    case "tavily":
      throw new Error("web_provider_tavily_unavailable");
    case "ddg":
    default:
      return {
        results: await performDuckDuckGoSearch(query, topK),
        provider: "ddg",
      };
  }
}

function ensureFetchUrl(url: string | undefined) {
  if (!url) {
    throw new Error("web_fetch_url_required");
  }
  return url;
}

async function performFetch(
  url: string,
  timeoutSec: number,
  provider: WebProvider,
  exaOpts: ExaConfig | undefined
): Promise<{
  details: WebOutput["details"];
  cost?: CostInfo;
  provider: WebProvider;
}> {
  if (provider === "exa") {
    return {
      ...(await performExaContents(url, exaOpts, timeoutSec)),
      provider,
    };
  }

  const controller = new AbortController();
  const timer = scheduleTimeout(() => controller.abort(), timeoutSec * 1000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/*,application/json",
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (
      !(
        /^text\//i.test(contentType) ||
        contentType.toLowerCase().startsWith("application/json")
      )
    ) {
      throw new Error("web_fetch_unsupported_content_type");
    }

    let text = "";
    let truncated = false;
    if (response.body) {
      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let received = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received <= MAX_FETCH_BYTES) {
            text += decoder.decode(value, { stream: true });
          } else {
            truncated = true;
            break;
          }
        }
      }
      text += decoder.decode();
      reader.releaseLock();
    } else {
      text = await response.text();
      if (text.length > MAX_FETCH_BYTES) {
        text = text.slice(0, MAX_FETCH_BYTES);
        truncated = true;
      }
    }

    let json: unknown;
    if (
      contentType.toLowerCase().startsWith("application/json") &&
      !truncated
    ) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }

    return {
      details: {
        url,
        status: response.status,
        contentType,
        text: json ? undefined : text,
        json,
        truncated: truncated || text.length >= MAX_FETCH_BYTES,
      },
      provider,
    };
  } finally {
    clearTimeout(timer);
  }
}

export const toolWeb = {
  name: "web",
  description:
    "Perform read-only web searches and content fetches for context gathering.",
  inputSchema: webInputSchema,
  outputSchema: webOutputSchema,
  execute: async ({ input }: { input: WebInput }): Promise<WebOutput> => {
    await enforcePolicy(input);

    const resolvedProvider = resolveProvider(
      input.provider as WebProvider | undefined
    );

    if (input.action === "search") {
      const query = input.q;
      if (!query) {
        throw new Error("web_search_query_required");
      }
      try {
        const { results, cost, provider } = await performSearch(
          query,
          input.topK ?? DEFAULT_TOPK,
          resolvedProvider,
          input.exa,
          input.timeoutSec
        );
        return {
          ok: true,
          action: "search",
          provider,
          results,
          cost,
        } satisfies WebOutput;
      } catch (error) {
        if (resolvedProvider === "exa") {
          const fallback = await performSearch(
            query,
            input.topK ?? DEFAULT_TOPK,
            "ddg",
            undefined,
            input.timeoutSec
          );
          return {
            ok: true,
            action: "search",
            provider: fallback.provider,
            results: fallback.results,
          } satisfies WebOutput;
        }
        throw error;
      }
    }

    const url = ensureFetchUrl(input.url);
    const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
    try {
      const { details, cost, provider } = await performFetch(
        url,
        timeoutSec,
        resolvedProvider,
        input.exa
      );
      return {
        ok: true,
        action: "fetch",
        provider,
        details,
        cost,
      } satisfies WebOutput;
    } catch (error) {
      if (resolvedProvider === "exa") {
        const fallback = await performFetch(url, timeoutSec, "ddg", undefined);
        return {
          ok: true,
          action: "fetch",
          provider: fallback.provider,
          details: fallback.details,
        } satisfies WebOutput;
      }
      throw error;
    }
  },
};

export type ToolWeb = typeof toolWeb;

export const __internals = {
  extractQueryTokens,
  scoreExaResult,
  compressSnippet,
};
