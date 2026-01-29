import type { ContextBundle, SearchReceipt } from "@alfred/type";

import { contextBundleSchema, searchReceiptSchema } from "@alfred/type";
import { z } from "zod";

import type { ToolExecuteArgs } from "./shared/context.js";

import { DefaultAIAdapter } from "../../services/aigeneration";
import {
  buildContextBundle,
  gatherCodeContext,
  gatherWebContext,
} from "../flow/context";

const citationSchema = z.object({
  path: z.string(),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
});

const analysisSchema = z.object({
  summary: z.string(),
  architecture: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      citations: z.array(citationSchema),
    })
  ),
  hotspots: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      citations: z.array(citationSchema),
    })
  ),
  changePlan: z.array(
    z.object({
      step: z.string(),
      detail: z.string(),
      citations: z.array(citationSchema),
    })
  ),
  tests: z.array(z.string()),
  risks: z.array(
    z.object({
      risk: z.string(),
      mitigation: z.string(),
    })
  ),
});

const intentSchema = z.object({
  filesToEdit: z.array(z.string()),
  commands: z.array(z.string()),
  touchPoints: z.array(
    z.object({
      path: z.string(),
      startLine: z.number().int().min(1),
      endLine: z.number().int().min(1),
      reason: z.string(),
    })
  ),
});

function overlaps(
  a: { startLine: number; endLine: number },
  b: {
    startLine: number;
    endLine: number;
  }
) {
  return a.startLine <= b.endLine && b.startLine <= a.endLine;
}

function sanitizeCitations(
  analysis: z.infer<typeof analysisSchema>,
  bundle: ContextBundle
): z.infer<typeof analysisSchema> {
  const byPath = new Map<string, { startLine: number; endLine: number }[]>();
  for (const f of bundle.files) {
    let list = byPath.get(f.path);
    if (!list) {
      list = [];
      byPath.set(f.path, list);
    }
    list.push({ startLine: f.startLine, endLine: f.endLine });
  }

  const fix = <
    T extends { detail: string; citations: z.infer<typeof citationSchema>[] },
  >(
    item: T
  ): T => {
    const citations = item.citations.filter((c) => {
      const ranges = byPath.get(c.path);
      if (!ranges) {
        return false;
      }
      return ranges.some((r) => overlaps(r, c));
    });

    if (citations.length === 0) {
      return {
        ...item,
        citations,
        detail: item.detail.toLowerCase().includes("insufficient")
          ? item.detail
          : "Insufficient evidence in provided bundle.",
      };
    }

    return { ...item, citations };
  };

  return {
    ...analysis,
    architecture: analysis.architecture.map((i) => fix(i)),
    hotspots: analysis.hotspots.map((i) => fix(i)),
    changePlan: analysis.changePlan.map((i) => fix(i)),
  };
}

export const contextInputSchema = z.object({
  requirement: z.string().min(1).max(10_000),
  cw: z.string().min(1).optional(),
  topK: z.number().int().min(1).max(100).optional(),
  maxTokens: z.number().int().min(1000).max(100_000).optional(),
  includeWeb: z.boolean().optional(),
  includeAnalysis: z.boolean().optional(),
  authz: z.string().optional(),
  userId: z.string().optional(),
  projectId: z.string().optional(),
});

export type ContextToolInput = z.infer<typeof contextInputSchema>;

export const toolContext = {
  name: "context",
  description:
    "Collect code/web receipts, build a token-bounded evidence bundle, and optionally generate a structured analysis with explicit citations.",
  inputSchema: contextInputSchema,
  outputSchema: z.object({
    receipts: searchReceiptSchema,
    bundle: contextBundleSchema,
    analysis: analysisSchema.optional(),
    analysisError: z.string().optional(),
    intent: intentSchema.optional(),
  }),
  execute: async ({ input }: ToolExecuteArgs<ContextToolInput>) => {
    const cw = input.cw ?? process.cwd();
    const includeWeb = input.includeWeb ?? false;
    const includeAnalysis = input.includeAnalysis ?? false;

    const codeReceipt = await gatherCodeContext({
      requirement: input.requirement,
      cw,
      topK: input.topK,
      authz: input.authz,
      userId: input.userId,
    });

    const webReceipt = includeWeb
      ? await gatherWebContext({
          requirement: input.requirement,
          authz: input.authz,
        })
      : null;

    const receipts: SearchReceipt = {
      code: codeReceipt.code,
      web: webReceipt?.web,
      created: new Date(),
      summary: [codeReceipt.summary, webReceipt?.summary]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 500),
    } as SearchReceipt;

    const bundle: ContextBundle = await buildContextBundle({
      cw,
      receipts,
      requirement: input.requirement,
      maxTokens: input.maxTokens ?? 24_000,
    });

    const intent = {
      filesToEdit: [...new Set(bundle.files.map((f) => f.path))],
      commands: ["bun run typecheck", "bun run test:fast"],
      touchPoints: bundle.files.slice(0, 12).map((f) => ({
        path: f.path,
        startLine: f.startLine,
        endLine: f.endLine,
        reason: "evidence",
      })),
    };

    if (!includeAnalysis) {
      return { receipts, bundle, intent };
    }

    const adapter = new DefaultAIAdapter({
      userId: input.userId,
      projectId: input.projectId,
      role: "planner",
    });

    const evidence = bundle.files
      .map((f) => `FILE ${f.path}:${f.startLine}-${f.endLine}\n${f.content}`)
      .join("\n\n");

    const prompt = `You are a senior engineer. Using ONLY the provided evidence, produce a structured analysis.

Requirement:\n${input.requirement}\n\nEvidence:\n${evidence}\n\nRules:
- Every claim must be supported by at least one citation.
- Citations must refer to the evidence slices exactly: {path,startLine,endLine}.
- If evidence is insufficient, say so explicitly and keep citations empty for that item.
`;

    try {
      const result = await adapter.generateObject({
        messages: [],
        schema: analysisSchema,
        prompt,
      });

      const analysis =
        process.env.ORCH_CONTEXT_VALIDATE_CITATIONS === "0"
          ? (result.object as z.infer<typeof analysisSchema>)
          : sanitizeCitations(
              result.object as z.infer<typeof analysisSchema>,
              bundle
            );

      return {
        receipts,
        bundle,
        analysis,
        intent,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        receipts,
        bundle,
        analysisError: message,
        intent,
      };
    }
  },
};
