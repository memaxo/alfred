import type { AgentFSWorkspace } from "@alfred/agent/environment/agentfs";
import type { AlfredCodexEvent } from "@alfred/agent/orchestrator/tool/codex/index";

import {
  requireToolScopesAndPolicy,
  type TokenClaims,
} from "@alfred/auth/token";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";

import { authedProcedure, router } from "../trpc";
import { buildCodexErrorResponse, formatCodexErrorMessage } from "./codex";

/**
 * Intent-based Codex API for mobile/simplified clients
 * Translates high-level intents into structured Codex prompts
 */

const codexIntentInputSchema = z.object({
  authz: z.string().optional(),
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  context: z
    .object({
      linearIssueId: z.string().optional(),
      linearSessionId: z.string().optional(),
      linearSpace: z.string().optional(),
      linearAuthz: z.string().optional(),
      relevantFiles: z.array(z.string()).optional(),
    })
    .optional(),
  cw: z.string().optional(),
  intent: z.string().min(1).max(500),
  sessionId: z.string().min(1).max(255).optional(),
});

function resolveContainerCw(args: {
  workspaceRoot: string;
  workingDirectory: string;
  baseCw: string;
}): string {
  const rel = path.relative(args.workspaceRoot, args.workingDirectory);
  const relPosix = rel.split(path.sep).join(path.posix.sep);
  if (relPosix && !relPosix.startsWith("..") && relPosix !== ".") {
    return path.posix.join(args.baseCw, relPosix);
  }
  return args.baseCw;
}

async function createCodexWorkspace(args: {
  cw?: string;
  authz?: string;
}): Promise<{
  workspace: AgentFSWorkspace;
  containerName: string;
  containerCw: string;
  agentfsDbPath: string;
}> {
  const { AgentFSWorkspace } =
    await import("@alfred/agent/environment/agentfs");
  const workspaceRoot = path.resolve(process.cwd());
  const resolvedCw =
    typeof args.cw === "string" && args.cw.length > 0
      ? path.resolve(workspaceRoot, args.cw)
      : workspaceRoot;
  const rel = path.relative(workspaceRoot, resolvedCw);
  const repoRoot =
    rel && !rel.startsWith("..") && rel !== "." ? workspaceRoot : resolvedCw;
  const runId = randomUUID();
  const workspace = new AgentFSWorkspace("codex-intent", runId, repoRoot, {
    authz: args.authz,
  });
  await workspace.initialize();
  const containerCw = resolveContainerCw({
    workspaceRoot: repoRoot,
    workingDirectory: resolvedCw,
    baseCw: workspace.containerCw,
  });
  return {
    workspace,
    containerName: workspace.containerName,
    containerCw,
    agentfsDbPath: workspace.dbPath,
  };
}

/**
 * Map high-level intents to structured Codex prompts
 * Examples:
 * - "fix bug in auth" -> "Analyze and fix authentication bugs in this repository"
 * - "add tests" -> "Add comprehensive test coverage for untested modules"
 * - "refactor module X" -> "Refactor module X following best practices"
 */
function intentToPrompt(intent: string): string {
  const lower = intent.toLowerCase().trim();

  // Common patterns
  if (lower.startsWith("fix")) {
    return `Analyze and ${intent}. Provide detailed reasoning and ensure the fix is safe.`;
  }
  if (lower.startsWith("add") || lower.startsWith("create")) {
    return `${intent}. Follow best practices and ensure quality.`;
  }
  if (lower.startsWith("refactor")) {
    return `${intent}. Maintain existing functionality and improve code quality.`;
  }
  if (lower.startsWith("debug") || lower.startsWith("investigate")) {
    return `${intent}. Provide thorough analysis and actionable recommendations.`;
  }
  if (lower.startsWith("test")) {
    return `${intent}. Ensure comprehensive coverage and edge cases.`;
  }

  // Default: pass through with encouragement for thorough analysis
  return `${intent}. Analyze carefully and provide high-quality results.`;
}

const codexIntentProcedures = {
  run: authedProcedure
    .input(codexIntentInputSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const requiresElevatedAutonomy =
        input.auto === "medium" || input.auto === "high";

      if (requiresElevatedAutonomy && !input.authz) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "authz_required_for_elevated_autonomy",
        });
      }

      if (requiresElevatedAutonomy) {
        let tokenClaims: TokenClaims;
        try {
          const tokenResult = await requireToolScopesAndPolicy(
            input.authz,
            ["droid.exec"],
            {
              action: "droid.exec",
              context: {
                auto: input.auto,
              },
              resource: {
                kind: "repo",
                id: input.cw ?? "cwd",
              },
            }
          );
          tokenClaims = tokenResult.claims;
        } catch (error) {
          if (error instanceof Error && error.message === "unauthorized") {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "authz_invalid",
            });
          }

          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "authz_validation_failed",
          });
        }

        if (!tokenClaims.elevated || tokenClaims.mfa !== "passkey") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "biometric_required",
          });
        }
      }

      const prompt = intentToPrompt(input.intent);

      try {
        const codexWorkspace = await createCodexWorkspace({
          cw: input.cw,
          authz: input.authz,
        });
        const { toolCodex } =
          await import("@alfred/agent/orchestrator/tool/codex/index");
        const chunks: string[] = [];
        const events: AlfredCodexEvent[] = [];

        try {
          const result = await toolCodex.execute({
            input: {
              action: "exec" as const,
              authz: input.authz,
              auto: input.auto,
              context: input.context,
              cw: input.cw,
              out: "text",
              prompt,
              sessionId: input.sessionId,
              agentfsDbPath: codexWorkspace.agentfsDbPath,
              containerName: codexWorkspace.containerName,
              containerCw: codexWorkspace.containerCw,
              userId,
            },
            writer: {
              write: (chunk: unknown) => {
                const event = chunk as {
                  type?: string;
                  text?: string;
                  event?: AlfredCodexEvent;
                };
                if (event.type === "stdout" && typeof event.text === "string") {
                  chunks.push(event.text);
                } else if (event.type === "codex_event" && event.event) {
                  events.push(event.event);
                }
              },
            },
          });

          return {
            artifacts: result.artifacts ?? [],
            eventCount: events.length,
            intent: input.intent,
            result: result.result,
          };
        } finally {
          await codexWorkspace.workspace.cleanup();
        }
      } catch (error) {
        const { sanitized, correlationId, trpcCode, cause } =
          buildCodexErrorResponse(error, "codex_intent_run_failed");
        throw new TRPCError({
          cause,
          code: trpcCode,
          message: formatCodexErrorMessage(sanitized, correlationId),
        });
      }
    }),
};

export const codexIntentRouter = router(codexIntentProcedures);
