import { generateObject } from "ai";
import * as z from "zod";
import type { WorkflowIntent } from "../intent/types.js";
import type { ResearchResult } from "../research/types.js";
import type { StructuredPlan } from "../types.js";
import type { GeneratePlanOptions } from "./types.js";

const taskOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  requirement: z.string(),
  complexity: z.enum(["low", "medium", "high"]),
  acceptance: z.array(z.string()),
  filesHint: z.array(z.string()),
});

const phaseOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tasks: z.array(taskOutputSchema),
  dependsOn: z.array(z.string()),
  estimatedDurationMs: z.number(),
  agentType: z.enum([
    "codex",
    "droid",
    "claude-code",
    "research",
    "review",
    "orchestrator",
  ]),
});

const generatePlanOutputSchema = z.object({
  phases: z.array(phaseOutputSchema).min(1),
  resources: z.object({
    agentCount: z.number().min(1),
    strategy: z.enum(["sequential", "parallel", "topological"]),
    isolation: z.enum(["agentfs"]),
  }),
  evaluationCriteria: z.array(
    z.object({
      name: z.string(),
      weight: z.number().min(0).max(1),
      threshold: z.string(),
    })
  ),
});

export type GeneratePlanResult = z.infer<typeof generatePlanOutputSchema>;

type GeneratePlanRuntimeOptions = GeneratePlanOptions & {
  signal?: AbortSignal;
};

function buildVariantHint(
  options?: GeneratePlanRuntimeOptions
): string | undefined {
  if (!options) {
    return;
  }

  const parts: string[] = [];

  if (typeof options.maxPhases === "number") {
    parts.push(
      "Keep phases to at most ".concat(String(options.maxPhases), ".")
    );
  }

  if (typeof options.preferParallel === "boolean") {
    parts.push(
      options.preferParallel
        ? "Prefer parallelizable phases where safe."
        : "Prefer sequential phases for safety."
    );
  }

  if (options.agentTypes && options.agentTypes.length > 0) {
    parts.push(
      "Prefer agent types: ".concat(options.agentTypes.join(", "), ".")
    );
  }

  return parts.length > 0 ? parts.join(" ") : undefined;
}

function toPriority(complexity: "low" | "medium" | "high"): number {
  if (complexity === "high") {
    return 3;
  }
  if (complexity === "medium") {
    return 2;
  }
  return 1;
}

function buildPlanPrompt(
  intent: WorkflowIntent,
  research: ResearchResult,
  options?: { variantHint?: string }
): string {
  const variant = options?.variantHint
    ? "\n\nOptimization Hint: ".concat(options.variantHint)
    : "";

  const externalContext =
    research.external.length > 0
      ? "External Research:\n".concat(
          research.external
            .map((r: any) => "- ".concat(r.source, ": ").concat(r.summary))
            .join("\n"),
          "\n"
        )
      : "";

  const internalContext = research.internal
    ? "Internal Context:\n".concat(
        "  Code Patterns: ".concat(
          research.internal.patterns?.map((p: any) => p.name).join(", ") ||
            "none",
          "\n"
        ),
        "  Conventions: ".concat(
          research.internal.conventions
            ?.map((c: any) => c.description)
            .join(", ") || "none",
          "\n"
        )
      )
    : "";

  return "You are ALFRED's workflow planner. Generate a phased plan for the following intent.\n\nIntent: ".concat(
    intent.description,
    "\n\n",
    externalContext,
    internalContext,
    variant,
    "\n\nGenerate a plan with:\n1. Phases grouping related work (3-6 phases typical)\n2. Tasks within each phase with clear requirements\n3. Dependencies between phases (dependsOn uses phase IDs)\n4. Agent type per phase:\n   - codex: Code generation, CSS, templates\n   - droid: Full codebase context, complex refactors\n   - claude-code: Computer use, multi-file edits\n   - research: External research, documentation\n   - review: Code review, quality checks\n\nPhase dependencies must be topological (no cycles). Estimated duration per phase in milliseconds (typical: 10min = 600000ms, 30min = 1800000ms)."
  );
}

export async function generatePhasedPlan(
  intent: WorkflowIntent,
  research: ResearchResult,
  options?: { variantHint?: string; signal?: AbortSignal }
): Promise<GeneratePlanResult> {
  const model = "gpt-4o";

  const result = await generateObject({
    model,
    schema: generatePlanOutputSchema,
    prompt: buildPlanPrompt(intent, research, options),
    abortSignal: options?.signal,
    temperature: 0.7,
  });

  return result.object;
}

export async function generatePlanVariants(
  intent: WorkflowIntent,
  research: ResearchResult,
  count: number,
  signal?: AbortSignal
): Promise<GeneratePlanResult[]> {
  const variantHints = [
    "Optimize for speed and simplicity",
    "Optimize for robustness and maintainability",
    "Balance speed, safety, and maintainability",
  ];

  const variants = await Promise.all(
    Array.from(
      { length: Math.min(count, variantHints.length) },
      async (_, i) => {
        const plan = await generatePhasedPlan(intent, research, {
          variantHint: variantHints[i],
          signal,
        });

        return plan;
      }
    )
  );

  return variants;
}

export async function generatePlan(
  intent: WorkflowIntent,
  research: ResearchResult,
  options?: GeneratePlanRuntimeOptions
): Promise<StructuredPlan> {
  const variantHint = buildVariantHint(options);
  const raw = await generatePhasedPlan(intent, research, {
    variantHint,
    signal: options?.signal,
  });

  const max = options?.maxPhases;
  const phasesRaw =
    typeof max === "number" && max > 0 ? raw.phases.slice(0, max) : raw.phases;

  const phaseIds = new Set(phasesRaw.map((p) => p.id));
  const phases = phasesRaw.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    dependsOn: (p.dependsOn || []).filter((id) => phaseIds.has(id)),
    estimatedDurationMs: p.estimatedDurationMs,
    agentType: p.agentType,
    tasks: (p.tasks || []).map((t) => ({
      id: t.id,
      title: t.title,
      requirement: t.requirement,
      deps: [],
      priority: toPriority(t.complexity),
      acceptance: t.acceptance,
      filesHint: t.filesHint,
      metadata: { complexity: t.complexity },
    })),
  }));

  const id = crypto.randomUUID();
  const title = intent.description.length > 0 ? intent.description : "Plan";
  const strategy =
    options?.preferParallel === true
      ? "parallel"
      : options?.preferParallel === false
        ? "sequential"
        : raw.resources?.strategy || "sequential";

  return {
    id,
    title,
    intent: intent.description,
    phases,
    resources: {
      agentCount: raw.resources?.agentCount || 1,
      strategy,
      isolation: "agentfs",
    },
    evaluationCriteria: raw.evaluationCriteria,
  };
}
