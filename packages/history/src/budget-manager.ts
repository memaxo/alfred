import type { Tool } from "ai";

import { createTokenEstimator } from "@alfred/metrics/token";

import { calculateBudget } from "./calculator";

export type ContextBudgetSource =
  | "persona"
  | "preferences"
  | "domain"
  | "rag"
  | "history"
  | "tools";

export interface ContextBudgetSnapshot {
  modelId: string;
  effectiveContextTokens: number;
  targetTotalTokens: number;
  allocated: Record<ContextBudgetSource, number>;
  used: Record<ContextBudgetSource, number>;
  utilization: Record<ContextBudgetSource, number>;
  overallUtilization: number;
}

type Estimator = ReturnType<typeof createTokenEstimator>;

function clamp(n: number, min: number, max: number): number {
  if (n < min) {
    return min;
  }
  if (n > max) {
    return max;
  }
  return n;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function truncateToTokens(
  estimator: Estimator,
  text: string,
  maxTokens: number
): { text: string; tokens: number; truncated: boolean } {
  if (!text) {
    return { text: "", tokens: 0, truncated: false };
  }
  if (maxTokens <= 0) {
    return { text: "", tokens: 0, truncated: true };
  }

  const fullTokens = estimator.estimate(text);
  if (fullTokens <= maxTokens) {
    return { text, tokens: fullTokens, truncated: false };
  }

  // Token estimator does not provide token-aligned slicing; approximate with a
  // bounded binary search over UTF-16 code unit offsets.
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

  const out = `${text.slice(0, best)}${suffix}`;
  const outTokens = estimator.estimate(out);
  return { text: out, tokens: outTokens, truncated: true };
}

function toolSchemaSignature(schema: unknown): unknown {
  // This intentionally does NOT attempt a full Zod->JSONSchema conversion.
  // We only need a deterministic, cheap approximation for relative tool costs.
  // Prefer counting keys and node kinds over copying full literals.
  if (!schema) {
    return null;
  }
  if (typeof schema === "string") {
    return { kind: "string", len: schema.length };
  }
  if (typeof schema === "number" || typeof schema === "boolean") {
    return { kind: typeof schema };
  }
  if (Array.isArray(schema)) {
    return { kind: "array", len: schema.length };
  }
  if (isRecord(schema)) {
    const keys = Object.keys(schema).sort();
    const out: Record<string, unknown> = { kind: "object", keys };
    // Include shallow hints that tend to dominate JSON schema size.
    if ("type" in schema && typeof schema.type === "string") {
      out.type = schema.type;
    }
    if ("properties" in schema && isRecord(schema.properties)) {
      out.properties = Object.keys(schema.properties).sort();
    }
    if ("required" in schema && Array.isArray(schema.required)) {
      out.required = [...schema.required].sort();
    }
    if ("description" in schema && typeof schema.description === "string") {
      out.descriptionLen = schema.description.length;
    }
    return out;
  }
  return { kind: typeof schema };
}

function extractToolSchema(tool: Tool): unknown {
  const t = tool as unknown as Record<string, unknown>;
  return (
    t.inputSchema ??
    t.parameters ??
    t.schema ??
    (isRecord(t.definition) ? t.definition : null) ??
    null
  );
}

function estimateToolTokens(estimator: Estimator, name: string, tool: Tool) {
  const t = tool as unknown as Record<string, unknown>;
  const description = typeof t.description === "string" ? t.description : "";
  const schema = extractToolSchema(tool);
  const payload = {
    description,
    name,
    schema: toolSchemaSignature(schema),
  };
  return estimator.estimate(JSON.stringify(payload));
}

function isMcpTool(name: string, tool: Tool): boolean {
  const t = tool as unknown as Record<string, unknown>;
  const description = typeof t.description === "string" ? t.description : "";
  return description.startsWith("[mcp:") || name.includes("__");
}

export class ContextBudgetManager {
  private readonly modelId: string;
  private readonly estimator: Estimator;
  private readonly effectiveContextTokens: number;
  private readonly targetTotalTokens: number;
  private readonly allocated: Record<ContextBudgetSource, number>;
  private readonly used: Record<ContextBudgetSource, number>;
  private readonly coreTools: Set<string>;

  constructor(input: {
    modelId: string;
    maxContextTokens?: number;
    historyRatio?: number;
    systemTokens?: number;
    coreToolNames?: readonly string[];
  }) {
    this.modelId = input.modelId;
    this.estimator = createTokenEstimator({ model: input.modelId });
    this.used = {
      domain: 0,
      history: 0,
      persona: 0,
      preferences: 0,
      rag: 0,
      tools: 0,
    };
    this.coreTools = new Set(
      (input.coreToolNames ?? []).filter((v) => typeof v === "string")
    );

    const budget = calculateBudget({
      modelId: input.modelId,
      ...(typeof input.maxContextTokens === "number"
        ? { maxContextTokens: input.maxContextTokens }
        : {}),
      ...(typeof input.historyRatio === "number"
        ? { historyRatio: input.historyRatio }
        : {}),
      ...(typeof input.systemTokens === "number"
        ? { systemTokens: input.systemTokens }
        : {}),
    });

    this.effectiveContextTokens = budget.effectiveContextTokens;
    this.targetTotalTokens = Math.floor(
      budget.effectiveContextTokens * budget.historyRatio
    );

    const systemBudget = budget.systemReserveTokens;
    const persona = Math.max(800, Math.floor(systemBudget * 0.3));
    const preferences = Math.max(400, Math.floor(systemBudget * 0.15));
    const domain = Math.max(400, Math.floor(systemBudget * 0.2));
    const rag = Math.max(0, systemBudget - (persona + preferences + domain));

    this.allocated = {
      domain,
      history: budget.historyBudgetTokens,
      persona,
      preferences,
      rag,
      tools: budget.toolingReserveTokens,
    };
  }

  estimate(text: string): number {
    return this.estimator.estimate(text);
  }

  registerSystemPart(
    source: "persona" | "preferences" | "domain",
    text: string
  ): { text: string; tokens: number; truncated: boolean } {
    const maxTokens = this.allocated[source];
    const out = truncateToTokens(this.estimator, text, maxTokens);
    this.used[source] = out.tokens;
    return out;
  }

  selectRagContext(
    chunks: readonly { content: string }[],
    opts?: { budgetTokens?: number }
  ): {
    injected: string;
    usedTokens: number;
    dropped: number;
    truncated: number;
  } {
    const budgetTokens =
      typeof opts?.budgetTokens === "number"
        ? Math.max(0, Math.floor(opts.budgetTokens))
        : this.allocated.rag;
    if (budgetTokens <= 0 || chunks.length === 0) {
      this.used.rag = 0;
      return {
        dropped: chunks.length,
        injected: "",
        truncated: 0,
        usedTokens: 0,
      };
    }

    const prefix = "<context_documents>\n";
    const suffix =
      "\n</context_documents>\nUse the above context to answer the user's question if relevant.";

    const prefixTokens = this.estimator.estimate(prefix);
    const suffixTokens = this.estimator.estimate(suffix);
    const wrapperTokens = prefixTokens + suffixTokens;
    if (wrapperTokens >= budgetTokens) {
      const out = truncateToTokens(
        this.estimator,
        `${prefix}${suffix}`,
        budgetTokens
      );
      this.used.rag = out.tokens;
      return {
        injected: out.text,
        usedTokens: out.tokens,
        dropped: chunks.length,
        truncated: chunks.length,
      };
    }

    const kept: string[] = [];
    let used = wrapperTokens;
    let dropped = 0;
    let truncated = 0;

    for (const chunk of chunks) {
      const content = typeof chunk?.content === "string" ? chunk.content : "";
      if (!content) {
        dropped += 1;
        continue;
      }
      const docPrefix = "<document>\n";
      const docSuffix = "\n</document>\n";
      const docWrapperTokens =
        this.estimator.estimate(docPrefix) + this.estimator.estimate(docSuffix);
      const remaining = budgetTokens - used;
      if (remaining <= docWrapperTokens + 1) {
        dropped += 1;
        continue;
      }
      const docTokens = this.estimator.estimate(content) + docWrapperTokens;
      if (docTokens <= remaining) {
        kept.push(`${docPrefix}${content}${docSuffix}`);
        used += docTokens;
        continue;
      }

      // Truncate oversized doc to fit remaining budget.
      const maxDocTokens = remaining - docWrapperTokens;
      const out = truncateToTokens(this.estimator, content, maxDocTokens);
      kept.push(`${docPrefix}${out.text}${docSuffix}`);
      used += docWrapperTokens + out.tokens;
      truncated += 1;
    }

    const injected =
      kept.length > 0 ? `${prefix}${kept.join("")}${suffix}` : "";
    const usedTokens = injected ? this.estimator.estimate(injected) : 0;
    this.used.rag = usedTokens;
    return { injected, usedTokens, dropped, truncated };
  }

  enforceTools(tools: Record<string, Tool>): {
    tools: Record<string, Tool>;
    usedTokens: number;
    droppedToolNames: string[];
  } {
    const entries = Object.entries(tools ?? {});
    if (entries.length === 0) {
      this.used.tools = 0;
      return { tools: {}, usedTokens: 0, droppedToolNames: [] };
    }

    const costs = entries.map(([name, tool]) => ({
      cost: estimateToolTokens(this.estimator, name, tool),
      isCore: this.coreTools.size > 0 ? this.coreTools.has(name) : true,
      isMcp: isMcpTool(name, tool),
      name,
      tool,
    }));
    let total = costs.reduce((sum, c) => sum + c.cost, 0);
    const budget = this.allocated.tools;
    if (total <= budget) {
      this.used.tools = total;
      return { tools, usedTokens: total, droppedToolNames: [] };
    }

    const dropped: string[] = [];
    let remaining = costs;

    const dropWhere = (predicate: (c: (typeof costs)[number]) => boolean) => {
      if (total <= budget) {
        return;
      }
      const toDrop = remaining
        .filter(predicate)
        .toSorted((a, b) => b.cost - a.cost);
      for (const c of toDrop) {
        if (total <= budget) {
          break;
        }
        remaining = remaining.filter((r) => r.name !== c.name);
        total -= c.cost;
        dropped.push(c.name);
      }
    };

    // 1) Drop MCP tools first.
    dropWhere((c) => c.isMcp);
    // 2) Drop non-core tools by largest schema first.
    dropWhere((c) => !c.isCore);
    // 3) Last resort: drop largest remaining tools until budget fits, but keep at least 1.
    if (total > budget && remaining.length > 1) {
      const sorted = remaining.toSorted((a, b) => b.cost - a.cost);
      for (const c of sorted) {
        if (total <= budget || remaining.length <= 1) {
          break;
        }
        remaining = remaining.filter((r) => r.name !== c.name);
        total -= c.cost;
        dropped.push(c.name);
      }
    }

    const out: Record<string, Tool> = {};
    for (const c of remaining) {
      out[c.name] = c.tool;
    }

    this.used.tools = clamp(total, 0, Number.MAX_SAFE_INTEGER);
    return {
      tools: out,
      usedTokens: this.used.tools,
      droppedToolNames: dropped,
    };
  }

  snapshot(): ContextBudgetSnapshot {
    const utilization = {
      domain:
        this.allocated.domain > 0
          ? this.used.domain / this.allocated.domain
          : 0,
      history:
        this.allocated.history > 0
          ? this.used.history / this.allocated.history
          : 0,
      persona:
        this.allocated.persona > 0
          ? this.used.persona / this.allocated.persona
          : 0,
      preferences:
        this.allocated.preferences > 0
          ? this.used.preferences / this.allocated.preferences
          : 0,
      rag: this.allocated.rag > 0 ? this.used.rag / this.allocated.rag : 0,
      tools:
        this.allocated.tools > 0 ? this.used.tools / this.allocated.tools : 0,
    } satisfies Record<ContextBudgetSource, number>;

    const totalUsed =
      this.used.persona +
      this.used.preferences +
      this.used.domain +
      this.used.rag +
      this.used.tools +
      this.used.history;

    return {
      allocated: { ...this.allocated },
      effectiveContextTokens: this.effectiveContextTokens,
      modelId: this.modelId,
      overallUtilization:
        this.targetTotalTokens > 0 ? totalUsed / this.targetTotalTokens : 0,
      targetTotalTokens: this.targetTotalTokens,
      used: { ...this.used },
      utilization,
    };
  }

  // Called by the history layer once final history tokens are known.
  _setHistoryUsed(tokens: number): void {
    this.used.history = Math.max(0, Math.floor(tokens));
  }
}
