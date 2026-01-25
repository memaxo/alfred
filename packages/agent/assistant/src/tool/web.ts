import { toolWeb as orchestratorToolWeb } from "@alfred/agent/orchestrator/tool/web";
import { z } from "zod";

import { recordAssistantToolCall } from "../../../src/metrics";

const MAX_TOPK = 3;
const MAX_TIMEOUT = 15;
const DEFAULT_TOPK = 3;
const DEFAULT_TIMEOUT = 10;
const MAX_TEXT_PREVIEW = 2000;

const assistantWebInputSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["search", "fetch"]),
  q: z.string().min(1).optional(),
  url: z.string().url().optional(),
  topK: z.number().int().min(1).max(MAX_TOPK).optional(),
  timeoutSec: z.number().int().min(1).max(MAX_TIMEOUT).optional(),
  authz: z.string().optional(),
});

const assistantWebSearchResultSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  snippet: z.string().optional(),
  score: z.number().optional(),
  rank: z.number().int(),
});

const assistantWebFetchDetailsSchema = z.object({
  url: z.string(),
  status: z.number().int(),
  contentType: z.string().nullable().optional(),
  text: z.string().optional(),
  truncated: z.boolean().optional(),
});

const assistantWebOutputSchema = z.union([
  z.object({
    ok: z.boolean().optional(),
    action: z.literal("search"),
    provider: z.string().optional(),
    results: z.array(assistantWebSearchResultSchema),
  }),
  z.object({
    ok: z.boolean().optional(),
    action: z.literal("fetch"),
    provider: z.string().optional(),
    details: assistantWebFetchDetailsSchema,
  }),
]);

type AssistantWebInput = z.infer<typeof assistantWebInputSchema>;

function sanitizeTopK(input?: number) {
  if (!(input && Number.isFinite(input))) {
    return DEFAULT_TOPK;
  }
  return Math.min(Math.max(1, Math.floor(input)), MAX_TOPK);
}

function sanitizeTimeout(input?: number) {
  if (!(input && Number.isFinite(input))) {
    return DEFAULT_TIMEOUT;
  }
  return Math.min(Math.max(1, Math.floor(input)), MAX_TIMEOUT);
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 1);
}

function termScore(terms: string[], haystack: string) {
  if (terms.length === 0 || haystack.length === 0) {
    return { overlap: 0, frequency: 0 };
  }
  let overlap = 0;
  let frequency = 0;
  for (const term of terms) {
    const occurrences = haystack.split(term).length - 1;
    if (occurrences > 0) {
      overlap += 1;
      frequency += occurrences;
    }
  }
  return { overlap, frequency };
}

function rerankResults(
  query: string,
  original: {
    url?: string;
    title?: string;
    snippet?: string;
    score?: number;
  }[]
) {
  const terms = tokenize(query);
  const scored = original.map((result, index) => {
    const haystack =
      `${result.title ?? ""} ${result.snippet ?? ""}`.toLowerCase();
    const { overlap, frequency } = termScore(terms, haystack);
    const baseScore = Number.isFinite(result.score) ? Number(result.score) : 0;
    const positionBoost = 1 / (index + 2); // diminish rapidly
    const finalScore =
      baseScore * 0.6 + overlap * 0.3 + frequency * 0.05 + positionBoost * 0.05;
    return {
      ...result,
      _rawScore: finalScore,
    };
  });

  scored.sort((a, b) => {
    if (b._rawScore === a._rawScore) {
      return (a.url ?? "").localeCompare(b.url ?? "");
    }
    return b._rawScore - a._rawScore;
  });

  return scored.map((result, index) => ({
    url: result.url,
    title: result.title,
    snippet: result.snippet,
    score: Number.isFinite(result._rawScore)
      ? Number(result._rawScore.toFixed(3))
      : undefined,
    rank: index + 1,
  }));
}

function truncateText(text?: string | null): string | undefined {
  if (!text) {
    return;
  }
  if (text.length <= MAX_TEXT_PREVIEW) {
    return text;
  }
  return `${text.slice(0, MAX_TEXT_PREVIEW)}…`;
}

export const toolWebAssistant = {
  name: "web",
  description:
    "Guarded web access for the assistant agent (search and fetch with conservative limits).",
  inputSchema: assistantWebInputSchema,
  outputSchema: assistantWebOutputSchema,
  execute: async ({ input }: { input: AssistantWebInput }) => {
    recordAssistantToolCall("web");

    const topK = sanitizeTopK(input.topK);
    const timeoutSec = sanitizeTimeout(input.timeoutSec);

    if (input.action === "search") {
      const query = input.q;
      if (!query) {
        throw new Error("assistant_web_search_query_required");
      }
      const base = await orchestratorToolWeb.execute({
        input: {
          action: "search",
          q: query,
          topK,
          timeoutSec,
          authz: input.authz,
        },
      });

      const ranked = rerankResults(query, base.results ?? []);
      const clipped = ranked.slice(0, topK);

      return assistantWebOutputSchema.parse({
        ok: true,
        action: "search",
        provider: base.provider,
        results: clipped,
      });
    }

    const { url } = input;
    if (!url) {
      throw new Error("assistant_web_fetch_url_required");
    }

    const base = await orchestratorToolWeb.execute({
      input: {
        action: "fetch",
        url,
        timeoutSec,
        authz: input.authz,
      },
    });

    const { details } = base;
    if (!details) {
      throw new Error("assistant_web_fetch_missing_details");
    }

    return assistantWebOutputSchema.parse({
      ok: true,
      action: "fetch",
      provider: base.provider,
      details: {
        url: details.url,
        status: details.status,
        contentType: details.contentType,
        text: truncateText(details.text),
        truncated:
          details.truncated ??
          (details.text ? details.text.length > MAX_TEXT_PREVIEW : undefined),
      },
    });
  },
};

export type ToolWebAssistant = typeof toolWebAssistant;
