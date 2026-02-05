import type { UIMessage } from "@alfred/type/stream";

import { withBudget } from "@alfred/metrics/performance";
import { createTokenEstimator } from "@alfred/metrics/token";

import { contextCompressionRatio, historySummarizationsTotal } from "./metrics";

type Estimator = ReturnType<typeof createTokenEstimator>;

export interface CompressHistoryArgs {
  messages: readonly UIMessage[];
  modelId: string;
  budgetTokens: number;
  thresholdRatio: number;
  source?: string;
}

export interface CompressHistoryResult {
  messages: UIMessage[];
  changed: boolean;
  originalTokens: number;
  compressedTokens: number;
  method: "none" | "extractive" | "rolling_summary" | "emergency";
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) {
    return min;
  }
  if (n > max) {
    return max;
  }
  return n;
}

function messageText(message: UIMessage): string {
  const parts = Array.isArray(message.parts) ? message.parts : [];
  if (parts.length === 0) {
    const legacy = (message as any)?.content;
    return typeof legacy === "string" ? legacy : "";
  }
  const out: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") {
      continue;
    }
    if ((part as any).type === "text" || (part as any).type === "reasoning") {
      const t = (part as any).text;
      if (typeof t === "string" && t.trim().length > 0) {
        out.push(t);
      }
    }
  }
  return out.join("\n");
}

function tokenizeSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  // Deterministic, cheap sentence-ish split; keep newlines as hard boundaries.
  const chunks = trimmed
    .split(/(?<=[.!?])\s+|\n{2,}/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return chunks.length > 0 ? chunks : [trimmed];
}

function scoreSentence(s: string, index: number, total: number): number {
  let score = 0;
  if (index === 0) {
    score += 10;
  }
  if (index === total - 1) {
    score += 6;
  }
  const lower = s.toLowerCase();
  if (
    lower.includes("error") ||
    lower.includes("failed") ||
    lower.includes("exception")
  ) {
    score += 6;
  }
  if (
    s.includes("```") ||
    s.includes("`") ||
    s.includes("stack") ||
    s.includes("trace")
  ) {
    score += 6;
  }
  if (/[/]|\.(ts|tsx|js|json|md|sql|yml|yaml)\b/i.test(s)) {
    score += 5;
  }
  if (/\b\d{2,}\b/.test(s)) {
    score += 3;
  }
  // Prefer moderately dense sentences.
  score += clamp(s.length / 120, 0, 3);
  return score;
}

function truncateToTokens(
  estimator: Estimator,
  text: string,
  maxTokens: number
): string {
  if (!text) {
    return "";
  }
  if (maxTokens <= 0) {
    return "";
  }
  if (estimator.estimate(text) <= maxTokens) {
    return text;
  }
  const suffix = "\n[truncated]";
  const suffixTokens = estimator.estimate(suffix);
  const target = Math.max(1, maxTokens - suffixTokens);
  let lo = 0;
  let hi = text.length;
  let best = 0;
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) >> 1;
    const candidate = text.slice(0, mid);
    const t = estimator.estimate(candidate);
    if (t <= target) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return `${text.slice(0, best)}${suffix}`;
}

function extractiveCompress(estimator: Estimator, text: string): string {
  const sentences = tokenizeSentences(text);
  if (sentences.length <= 2) {
    return text;
  }

  const originalTokens = estimator.estimate(text);
  const cap = clamp(Math.floor(originalTokens * 0.4), 40, 250);
  if (originalTokens <= cap) {
    return text;
  }

  const scored = sentences.map((s, i) => ({
    i,
    s,
    score: scoreSentence(s, i, sentences.length),
  }));
  scored.sort((a, b) => b.score - a.score || a.i - b.i);

  const picked: { i: number; s: string }[] = [];
  let used = 0;
  for (const cand of scored) {
    const t = estimator.estimate(cand.s);
    if (picked.length === 0 || used + t <= cap) {
      picked.push({ i: cand.i, s: cand.s });
      used += t;
    }
    if (used >= cap) {
      break;
    }
  }
  picked.sort((a, b) => a.i - b.i);
  const out = picked.map((p) => p.s).join("\n");
  return truncateToTokens(estimator, out, cap);
}

function ensureTextParts(message: UIMessage, text: string): UIMessage {
  const parts = Array.isArray(message.parts) ? message.parts : [];
  const nonText = parts.filter(
    (p) => (p as any)?.type !== "text" && (p as any)?.type !== "reasoning"
  );
  return {
    ...message,
    parts: [...nonText, { type: "text", text } as any],
  };
}

function makeSummaryId(messages: readonly UIMessage[]): string {
  const first = messages[0]?.id;
  const last = messages.at(-1)?.id;
  const f = typeof first === "string" ? first : "first";
  const l = typeof last === "string" ? last : "last";
  return `summary:${f}:${l}`;
}

interface CacheEntry {
  text: string;
  createdAt: number;
}
const SUMMARY_CACHE_MAX = 32;
const summaryCache = new Map<string, CacheEntry>();

function cacheGet(key: string): string | null {
  const e = summaryCache.get(key);
  if (!e) {
    return null;
  }
  // refresh LRU
  summaryCache.delete(key);
  summaryCache.set(key, e);
  return e.text;
}

function cacheSet(key: string, text: string) {
  summaryCache.set(key, { createdAt: Date.now(), text });
  while (summaryCache.size > SUMMARY_CACHE_MAX) {
    const it = summaryCache.keys().next();
    if (it.done) {
      break;
    }
    summaryCache.delete(it.value);
  }
}

async function rollingSummary(
  estimator: Estimator,
  modelId: string,
  slice: readonly UIMessage[],
  budgetTokens: number,
  source: string
): Promise<string> {
  const key = `${modelId}:${makeSummaryId(slice)}:${budgetTokens}`;
  const cached = cacheGet(key);
  if (cached) {
    return cached;
  }

  const lines: string[] = [];
  for (const m of slice) {
    const role = typeof m.role === "string" ? m.role : "assistant";
    const text = messageText(m);
    if (!text) {
      continue;
    }
    const capped = truncateToTokens(estimator, text, 200);
    lines.push(`${role}: ${capped}`);
  }
  const combined = lines.join("\n\n");

  const targetTokens = clamp(Math.floor(budgetTokens * 0.25), 200, 800);
  const instruction =
    "Summarize the conversation history for future turns. Preserve concrete file paths, errors, decisions, and constraints.";

  const heuristic = () => {
    const out = extractiveCompress(estimator, combined);
    return truncateToTokens(estimator, out, targetTokens);
  };

  return await withBudget(
    `history_rolling_summary_${source}`,
    100,
    async () => {
      try {
        const { summarize } = await import("@alfred/summarize");
        const p = summarize(combined, {
          instruction,
          targetTokens,
          targetRatio: 0.25,
        });

        const timeoutMs = 80;
        const timeout = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), timeoutMs).unref?.()
        );
        const res = (await Promise.race([p, timeout])) as any;
        if (
          !res ||
          typeof res.text !== "string" ||
          res.text.trim().length === 0
        ) {
          historySummarizationsTotal.inc({
            reason: "rolling_summary_fallback",
            source,
          });
          const out = heuristic();
          cacheSet(key, out);
          return out;
        }

        const text = truncateToTokens(estimator, res.text, targetTokens);
        historySummarizationsTotal.inc({ reason: "rolling_summary", source });
        cacheSet(key, text);

        // If the summarize call completes after timeout, we still want to populate
        // cache for future turns.
        void p
          .then((late: any) => {
            if (
              late &&
              typeof late.text === "string" &&
              late.text.trim().length > 0
            ) {
              cacheSet(
                key,
                truncateToTokens(estimator, late.text, targetTokens)
              );
            }
          })
          .catch(() => {});

        return text;
      } catch {
        historySummarizationsTotal.inc({
          reason: "rolling_summary_fallback",
          source,
        });
        const out = heuristic();
        cacheSet(key, out);
        return out;
      }
    }
  );
}

function emergencyTruncateAnchor(
  estimator: Estimator,
  message: UIMessage,
  budgetTokens: number
): UIMessage {
  const text = messageText(message);
  if (!text) {
    return message;
  }

  const headTokens = clamp(Math.floor(budgetTokens * 0.25), 80, 400);
  const tailTokens = clamp(Math.floor(budgetTokens * 0.2), 60, 300);
  const highlightTokens = clamp(Math.floor(budgetTokens * 0.25), 80, 400);

  const head = truncateToTokens(estimator, text, headTokens);
  const tail = truncateToTokens(
    estimator,
    text.slice(Math.max(0, text.length - 6000)),
    tailTokens
  );
  const highlights = truncateToTokens(
    estimator,
    extractiveCompress(estimator, text),
    highlightTokens
  );
  const out = [
    "[anchor_message_emergency_truncation]",
    "[head]",
    head,
    "[highlights]",
    highlights,
    "[tail]",
    tail,
  ].join("\n");

  return ensureTextParts(
    message,
    truncateToTokens(estimator, out, budgetTokens)
  );
}

export async function compressHistoryMessages(
  args: CompressHistoryArgs
): Promise<CompressHistoryResult> {
  const source = args.source ?? "history";
  const messages = Array.isArray(args.messages) ? args.messages : [];
  const budgetTokens = Math.max(0, Math.floor(args.budgetTokens));
  const thresholdRatio = clamp(args.thresholdRatio, 0, 1);
  const estimator = createTokenEstimator({ model: args.modelId });

  if (messages.length === 0 || budgetTokens <= 0) {
    return {
      changed: false,
      compressedTokens: 0,
      messages: [...messages],
      method: "none",
      originalTokens: 0,
    };
  }

  const tokensByIndex = messages.map((m) => estimator.estimate(messageText(m)));
  const total = tokensByIndex.reduce((sum, n) => sum + n, 0);

  // Emergency: never drop the last user message; rewrite if it alone exceeds budget.
  const lastUserIndex = [...messages]
    .map((m, i) => ({ i, role: m.role }))
    .toReversed()
    .find((x) => x.role === "user")?.i;
  if (typeof lastUserIndex === "number") {
    const lastUserTokens = tokensByIndex[lastUserIndex] ?? 0;
    if (lastUserTokens > budgetTokens) {
      const next = [...messages];
      next[lastUserIndex] = emergencyTruncateAnchor(
        estimator,
        next[lastUserIndex] as UIMessage,
        budgetTokens
      );
      const compressedTotal = next
        .map((m) => estimator.estimate(messageText(m)))
        .reduce((sum, n) => sum + n, 0);
      contextCompressionRatio.observe(
        { method: "emergency", source },
        compressedTotal / Math.max(total, 1)
      );
      return {
        changed: true,
        compressedTokens: compressedTotal,
        messages: next,
        method: "emergency",
        originalTokens: total,
      };
    }
  }

  const threshold = Math.floor(budgetTokens * thresholdRatio);
  if (total <= threshold) {
    contextCompressionRatio.observe({ method: "none", source }, 1);
    return {
      changed: false,
      compressedTokens: total,
      messages: [...messages],
      method: "none",
      originalTokens: total,
    };
  }

  const keepLast = 10;
  const veryOldCutoffFromEnd = 40;
  const fullTailStart = Math.max(0, messages.length - keepLast);
  const veryOldEnd = Math.max(0, messages.length - veryOldCutoffFromEnd);
  const veryOldSlice = messages.slice(0, veryOldEnd);
  const midSlice = messages.slice(veryOldEnd, fullTailStart);
  const tailSlice = messages.slice(fullTailStart);

  const out: UIMessage[] = [];
  let method: CompressHistoryResult["method"] = "extractive";

  if (veryOldSlice.length > 0) {
    method = "rolling_summary";
    const summaryText = await rollingSummary(
      estimator,
      args.modelId,
      veryOldSlice,
      budgetTokens,
      source
    );
    out.push({
      id: makeSummaryId(veryOldSlice),
      role: "assistant",
      parts: [{ type: "text", text: `Conversation summary:\n${summaryText}` }],
    } as any);
  }

  for (const m of midSlice) {
    const t = messageText(m);
    if (!t) {
      out.push(m);
      continue;
    }
    const compressed = extractiveCompress(estimator, t);
    out.push(ensureTextParts(m, compressed));
  }

  out.push(...tailSlice);

  const compressedTotal = out
    .map((m) => estimator.estimate(messageText(m)))
    .reduce((sum, n) => sum + n, 0);

  contextCompressionRatio.observe(
    { method, source },
    compressedTotal / Math.max(total, 1)
  );

  return {
    changed: true,
    compressedTokens: compressedTotal,
    messages: out,
    method,
    originalTokens: total,
  };
}
