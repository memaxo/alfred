import { createTokenEstimator } from "@alfred/metrics/token";

import {
  buildHistoryContext,
  ContextBudgetManager,
  calculateBudget,
} from "../packages/history/src/index";

interface FixtureToolDef {
  name: string;
  description?: string;
  kind?: "core" | "mcp";
  schema?: unknown;
}

interface Fixture {
  id: string;
  modelId: string;
  maxContextTokens?: number;
  system?: {
    persona?: string;
    preferences?: string;
    domain?: string;
  };
  rag?: { content: string }[];
  tools?: FixtureToolDef[];
  messages: unknown[];
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function pct(saved: number, base: number): string {
  if (base <= 0) {
    return "0%";
  }
  return `${((saved / base) * 100).toFixed(1)}%`;
}

function ragBlock(chunks: readonly { content: string }[]): string {
  if (!chunks.length) {
    return "";
  }
  return [
    "<context_documents>",
    ...chunks.map((c) => `<document>\n${c.content}\n</document>`),
    "</context_documents>",
    "Use the above context to answer the user's question if relevant.",
  ].join("\n");
}

function mergeSystemParts(parts: {
  persona?: string;
  preferences?: string;
  domain?: string;
  rag?: string;
}): string {
  return [parts.persona, parts.preferences, parts.domain, parts.rag]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join("\n\n");
}

function estimateToolsTokens(
  estimator: ReturnType<typeof createTokenEstimator>,
  tools: readonly FixtureToolDef[]
): number {
  // Best-effort: represent tool schema cost without depending on AI SDK internals.
  // (In-product enforcement uses the real Tool objects.)
  if (!tools.length) {
    return 0;
  }
  const stable = tools
    .map((t) => ({
      description: t.description ?? "",
      kind: t.kind ?? "core",
      name: t.name,
      schema: t.schema ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return estimator.estimate(JSON.stringify(stable));
}

async function loadFixtures(): Promise<Fixture[]> {
  const dir = "packages/history/test/fixtures/contextbench";
  const glob = new Bun.Glob("*.json");
  const fixtures: Fixture[] = [];
  for await (const rel of glob.scan({ cwd: dir })) {
    const path = `${dir}/${rel}`;
    const raw = await Bun.file(path).text();
    fixtures.push(JSON.parse(raw) as Fixture);
  }
  fixtures.sort((a, b) => a.id.localeCompare(b.id));
  return fixtures;
}

async function runFixture(fix: Fixture, mode: "baseline" | "new") {
  const estimator = createTokenEstimator({ model: fix.modelId });

  const personaRaw = fix.system?.persona ?? "";
  const preferencesRaw = fix.system?.preferences ?? "";
  const domainRaw = fix.system?.domain ?? "";
  const ragChunks = fix.rag ?? [];

  const maxContextTokens =
    typeof fix.maxContextTokens === "number" ? fix.maxContextTokens : undefined;

  if (mode === "baseline") {
    process.env.CONTEXT_COMPRESSION_ENABLED = "0";
    process.env.CONTEXT_TOOL_TRUNCATION_ENABLED = "0";
  } else {
    // Defaults here are forward-looking; later milestones implement these flags.
    process.env.CONTEXT_COMPRESSION_ENABLED = "1";
    process.env.CONTEXT_TOOL_TRUNCATION_ENABLED = "1";
  }

  const tools = fix.tools ?? [];

  let systemText = "";
  let tokensPersona = 0;
  let tokensPreferences = 0;
  let tokensDomain = 0;
  let tokensRag = 0;
  let tokensTools = 0;

  let enforcedTools: Record<string, any> | undefined;
  let mgr: ContextBudgetManager | null = null;

  if (mode === "baseline") {
    const rag = ragBlock(ragChunks);
    systemText = mergeSystemParts({
      domain: domainRaw,
      persona: personaRaw,
      preferences: preferencesRaw,
      rag,
    });
    tokensPersona = estimator.estimate(personaRaw);
    tokensPreferences = estimator.estimate(preferencesRaw);
    tokensDomain = estimator.estimate(domainRaw);
    tokensRag = estimator.estimate(rag);
    tokensTools = estimateToolsTokens(estimator, tools);
  } else {
    const coreToolNames = tools
      .filter((t) => t.kind !== "mcp")
      .map((t) => t.name);

    const pre = new ContextBudgetManager({
      modelId: fix.modelId,
      ...(maxContextTokens ? { maxContextTokens } : {}),
      coreToolNames,
    });
    const alloc = pre.snapshot().allocated;

    const persona1 = pre.registerSystemPart("persona", personaRaw);
    const prefs1 = pre.registerSystemPart("preferences", preferencesRaw);
    const domain1 = pre.registerSystemPart("domain", domainRaw);
    const rag1 = pre.selectRagContext(ragChunks, { budgetTokens: alloc.rag });
    const sys1 = mergeSystemParts({
      domain: domain1.text,
      persona: persona1.text,
      preferences: prefs1.text,
      rag: rag1.injected,
    });

    const final = new ContextBudgetManager({
      modelId: fix.modelId,
      ...(maxContextTokens ? { maxContextTokens } : {}),
      coreToolNames,
      systemTokens: pre.estimate(sys1),
    });
    mgr = final;

    const persona2 = final.registerSystemPart("persona", personaRaw);
    const prefs2 = final.registerSystemPart("preferences", preferencesRaw);
    const domain2 = final.registerSystemPart("domain", domainRaw);
    const rag2 = final.selectRagContext(ragChunks);

    systemText = mergeSystemParts({
      domain: domain2.text,
      persona: persona2.text,
      preferences: prefs2.text,
      rag: rag2.injected,
    });

    const toolMap: Record<string, any> = {};
    for (const t of tools) {
      toolMap[t.name] = {
        description: t.description ?? t.name,
        inputSchema: t.schema ?? { type: "object" },
        execute: async () => ({}),
      };
    }
    const enforced = final.enforceTools(toolMap);
    enforcedTools = enforced.tools;

    const snap = final.snapshot();
    tokensPersona = snap.used.persona;
    tokensPreferences = snap.used.preferences;
    tokensDomain = snap.used.domain;
    tokensRag = snap.used.rag;
    tokensTools = snap.used.tools;
  }

  const calculated = calculateBudget({
    modelId: fix.modelId,
    ...(maxContextTokens ? { maxContextTokens } : {}),
    systemTokens: estimator.estimate(systemText),
  });

  const history = await buildHistoryContext({
    messages: (fix.messages ?? []) as any,
    modelId: fix.modelId,
    source: `contextbench-${mode}`,
    system: systemText,
    ...(enforcedTools ? { tools: enforcedTools } : {}),
    budget: {
      maxContextTokens: calculated.effectiveContextTokens,
      historyRatio: calculated.historyRatio,
      minSystemReserveTokens: calculated.systemReserveTokens,
      minHeadroomTokens: calculated.headroomTokens,
      reservedToolingTokens: calculated.toolingReserveTokens,
    },
  });

  mgr?._setHistoryUsed(history.keptTokens);
  if (mgr) {
    const snap = mgr.snapshot();
    tokensTools = snap.used.tools;
  }

  const promptTokens =
    tokensPersona +
    tokensPreferences +
    tokensDomain +
    tokensRag +
    tokensTools +
    history.keptTokens;

  return {
    history,
    mode,
    promptTokens,
    systemTokens: {
      domain: tokensDomain,
      persona: tokensPersona,
      preferences: tokensPreferences,
      rag: tokensRag,
    },
    toolsTokens: tokensTools,
  };
}

async function main() {
  const fixtures = await loadFixtures();
  if (fixtures.length === 0) {
    console.error(
      "no_fixtures_found: packages/history/test/fixtures/contextbench/*.json"
    );
    process.exitCode = 1;
    return;
  }

  const totals = {
    baseline: 0,
    new: 0,
  };

  for (const fix of fixtures) {
    const base = await runFixture(fix, "baseline");
    const next = await runFixture(fix, "new");

    totals.baseline += base.promptTokens;
    totals.new += next.promptTokens;

    const saved = base.promptTokens - next.promptTokens;
    const reduction = pct(saved, base.promptTokens);

    console.log(`${fix.id}  model=${fix.modelId}`);
    console.log(
      `  baseline promptTokens=${fmtInt(base.promptTokens)}  (history=${fmtInt(base.history.keptTokens)}, tools=${fmtInt(base.toolsTokens)}, system=${fmtInt(base.systemTokens.persona + base.systemTokens.preferences + base.systemTokens.domain + base.systemTokens.rag)})`
    );
    console.log(
      `  new      promptTokens=${fmtInt(next.promptTokens)}  (history=${fmtInt(next.history.keptTokens)}, tools=${fmtInt(next.toolsTokens)}, system=${fmtInt(next.systemTokens.persona + next.systemTokens.preferences + next.systemTokens.domain + next.systemTokens.rag)})`
    );
    console.log(`  saved=${fmtInt(saved)} (${reduction})`);
    console.log(
      `  history dropped=${base.history.droppedMessages} -> ${next.history.droppedMessages}`
    );
    console.log("");
  }

  const avgBase = totals.baseline / fixtures.length;
  const avgNew = totals.new / fixtures.length;
  const avgSaved = avgBase - avgNew;
  console.log(
    `aggregate fixtures=${fixtures.length}  avgBaseline=${fmtInt(Math.round(avgBase))}  avgNew=${fmtInt(Math.round(avgNew))}  avgSaved=${fmtInt(Math.round(avgSaved))} (${pct(avgSaved, avgBase)})`
  );
}

await main();
