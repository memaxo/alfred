import type { ContextBudgetManager } from "@alfred/history/budget-manager";

interface MemoryOptions {
  semanticRecall?: {
    topK?: number;
    messageRange?:
      | number
      | {
          before?: number;
          after?: number;
        };
  };
}

interface BuildAssistantContextOptions {
  messages: unknown[];
  memory?: MemoryOptions;
  baseInstructions: string;
  modelId?: string;
  budgetManager?: ContextBudgetManager;
}

interface BuildAssistantContextResult {
  systemInstruction: string;
  detectedDomains: string[];
  budgetManager?: ContextBudgetManager;
}

interface AssistantAdapter {
  analyzeContext: (
    messages: { role: string; content: string }[]
  ) => Promise<{ domains: string[] }> | { domains: string[] };
  getPersonaInstruction?: (domains: string[]) => string | null;
}

type KnowledgeEngineCtor = new () => {
  retrieveContext: (
    query: string,
    options: {
      topK?: number;
      boostConcepts?: string[];
      useHybrid?: boolean;
      useReranking?: boolean;
    }
  ) => Promise<{ content: string }[]>;
};

function getLastUserQuery(messages: unknown[]): string {
  const lastMessage = messages.at(-1) as {
    role?: string;
    content?: string;
  } | null;
  return lastMessage?.role === "user" ? String(lastMessage.content ?? "") : "";
}

export async function buildAssistantContext(
  options: BuildAssistantContextOptions
): Promise<BuildAssistantContextResult> {
  const [{ analyzeContext, getPersonaInstruction }, { KnowledgeEngine }] =
    await Promise.all([
      import("@alfred/agent/assistant/src/adapter"),
      import("@alfred/runtime/engines/knowledge"),
    ]);

  return buildAssistantContextWithDeps(options, {
    adapter: {
      analyzeContext,
      getPersonaInstruction,
    },
    KnowledgeEngine,
  });
}

export async function buildAssistantContextWithDeps(
  options: BuildAssistantContextOptions,
  deps: {
    adapter: AssistantAdapter;
    KnowledgeEngine: KnowledgeEngineCtor;
  }
): Promise<BuildAssistantContextResult> {
  const { messages, memory, baseInstructions } = options;
  const query = getLastUserQuery(messages);

  const modelId = typeof options.modelId === "string" ? options.modelId : null;
  const budgetingEnabled = !!(modelId && options.budgetManager);
  let systemInstruction = baseInstructions;
  let detectedDomains: string[] = [];

  if (!query) {
    if (budgetingEnabled && options.budgetManager) {
      const pre = options.budgetManager;
      const prePersona = pre.registerSystemPart("persona", baseInstructions);
      const sys1 = prePersona.text;
      const { ContextBudgetManager } =
        await import("@alfred/history/budget-manager");
      const final = new ContextBudgetManager({
        modelId,
        systemTokens: pre.estimate(sys1),
      });
      systemInstruction = final.registerSystemPart(
        "persona",
        baseInstructions
      ).text;
      return { budgetManager: final, detectedDomains, systemInstruction };
    }
    return { detectedDomains, systemInstruction };
  }

  const analysis = await deps.adapter.analyzeContext(
    messages as { role: string; content: string }[]
  );
  detectedDomains = analysis.domains;

  const personaInstruction =
    deps.adapter.getPersonaInstruction?.(detectedDomains);
  const personaExtra =
    personaInstruction && personaInstruction.trim().length > 0
      ? personaInstruction.trim()
      : "";

  const recallOpts = memory?.semanticRecall;
  if (recallOpts) {
    const engine = new deps.KnowledgeEngine();
    const chunks = await engine.retrieveContext(query, {
      topK: recallOpts.topK ?? 5,
      boostConcepts: detectedDomains,
      useHybrid: true,
      useReranking: process.env.RAG_RERANK === "1",
    });

    const pre =
      budgetingEnabled && options.budgetManager ? options.budgetManager : null;
    if (!pre || !modelId) {
      // Back-compat (no budgeting).
      systemInstruction = baseInstructions;
      if (personaExtra) {
        systemInstruction += `\n\n${personaExtra}`;
      }
      if (chunks.length > 0) {
        const ragContext = [
          "<context_documents>",
          chunks.map((c) => `<document>\n${c.content}\n</document>`).join("\n"),
          "</context_documents>",
          "Use the above context to answer the user's question if relevant.",
        ].join("\n");
        systemInstruction += `\n\n${ragContext}`;
      }
      return { detectedDomains, systemInstruction };
    }

    // Two-phase budgeting:
    // - phase 1 bounds pieces without knowing final systemTokens
    // - phase 2 recomputes allocations using systemTokens (for downstream history/tools)
    const prePersona = pre.registerSystemPart("persona", baseInstructions);
    const preDomain = personaExtra
      ? pre.registerSystemPart("domain", personaExtra)
      : { text: "", tokens: 0, truncated: false };
    const preRag = chunks.length > 0 ? pre.selectRagContext(chunks) : null;
    const sys1 = [prePersona.text, preDomain.text, preRag?.injected]
      .filter(Boolean)
      .join("\n\n");

    const { ContextBudgetManager } =
      await import("@alfred/history/budget-manager");
    const final = new ContextBudgetManager({
      modelId,
      systemTokens: pre.estimate(sys1),
    });

    const personaFinal = final.registerSystemPart("persona", baseInstructions);
    const domainFinal = personaExtra
      ? final.registerSystemPart("domain", personaExtra)
      : { text: "", tokens: 0, truncated: false };
    const ragFinal = chunks.length > 0 ? final.selectRagContext(chunks) : null;

    systemInstruction = [
      personaFinal.text,
      domainFinal.text,
      ragFinal?.injected,
    ]
      .filter(Boolean)
      .join("\n\n");

    if (ragFinal) {
      const { ragBudgetExceededTotal } = await import("../metrics");
      if (ragFinal.dropped > 0) {
        ragBudgetExceededTotal.inc({ action: "dropped" }, ragFinal.dropped);
      }
      if (ragFinal.truncated > 0) {
        ragBudgetExceededTotal.inc({ action: "truncated" }, ragFinal.truncated);
      }
    }

    return { budgetManager: final, detectedDomains, systemInstruction };
  }

  // No recall path.
  if (budgetingEnabled && options.budgetManager && modelId) {
    const pre = options.budgetManager;
    const prePersona = pre.registerSystemPart("persona", baseInstructions);
    const preDomain = personaExtra
      ? pre.registerSystemPart("domain", personaExtra)
      : { text: "", tokens: 0, truncated: false };
    const sys1 = [prePersona.text, preDomain.text].filter(Boolean).join("\n\n");
    const { ContextBudgetManager } =
      await import("@alfred/history/budget-manager");
    const final = new ContextBudgetManager({
      modelId,
      systemTokens: pre.estimate(sys1),
    });
    const personaFinal = final.registerSystemPart("persona", baseInstructions);
    const domainFinal = personaExtra
      ? final.registerSystemPart("domain", personaExtra)
      : { text: "", tokens: 0, truncated: false };
    systemInstruction = [personaFinal.text, domainFinal.text]
      .filter(Boolean)
      .join("\n\n");
    return { budgetManager: final, detectedDomains, systemInstruction };
  }

  systemInstruction = baseInstructions;
  if (personaExtra) {
    systemInstruction += `\n\n${personaExtra}`;
  }
  return { detectedDomains, systemInstruction };
}
