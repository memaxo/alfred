import { TRPCError } from "@trpc/server";
import { performance } from "node:perf_hooks";
import { z } from "zod";

import { requirePolicy } from "../../../gate";
import { authedProcedure, rateLimit } from "../../../trpc";
import { toTRPCError } from "../../../utils/error";
import { getSessionId, getSessionUser } from "../../../utils/session";
import {
  getTestCheckpointStorage,
  WorkflowCheckpointStorage,
} from "../../../workflow/checkpoint";
import { createCognitiveBridge } from "../../../workflow/cognitive";
import { mapWorkflowRunResourceLocal } from "../../../workflow/resource";

const isTestMode =
  process.env.VITE_TEST_MODE === "true" || process.env.MINDSCAPE_TEST === "1";

const workflowPreparePolicy = requirePolicy("workflow.execute", (raw) =>
  mapWorkflowRunResourceLocal(raw)
);

const phasePrepareProcedure = isTestMode
  ? authedProcedure.use(rateLimit)
  : authedProcedure.use(rateLimit).use(workflowPreparePolicy);

export const workflowPhasePrepareProcedure = phasePrepareProcedure
  .input(
    z.object({
      runId: z.string().min(1).max(200),
      /** Tool authz (Bearer <jwt>) used for docker + executor tools */
      authz: z.string().min(1),
      projectId: z.string().uuid().optional(),
      /** Optional workspace override (required when snapshot does not exist) */
      workspace: z.string().min(1).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const sessionId = getSessionId(ctx);
    const user = getSessionUser(ctx.session);
    if (!sessionId || !user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    const startedAt = performance.now();

    try {
      const [{ PostgresCheckpointStorage }, { createContextFromSnapshot }] =
        await Promise.all([
          import("@alfred/db/repo/workflow"),
          import("@alfred/pipeline/snapshot"),
        ]);

      const storageInner = isTestMode
        ? getTestCheckpointStorage()
        : new PostgresCheckpointStorage();
      const storage = new WorkflowCheckpointStorage(storageInner);

      const snapshot = await storage.load(input.runId);
      const workspace = (() => {
        if (typeof input.workspace === "string" && input.workspace.length > 0) {
          return input.workspace;
        }
        if (!snapshot) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "workspace_required",
          });
        }
        const decoded = createContextFromSnapshot(snapshot, { emit: () => {} });
        const fromCtx = decoded.get<string>("workspace");
        if (typeof fromCtx === "string" && fromCtx.length > 0) {
          return fromCtx;
        }
        // Fallback: keep behaviour consistent with other endpoints.
        return process.cwd();
      })();

      // Best-effort: ensure cognitive stream has an input event for this run.
      if (snapshot) {
        const cognitive = createCognitiveBridge({
          requirement: snapshot.requirement,
          runId: input.runId,
          source: "phase",
          startedAtMs: snapshot.startedAt,
          userId: user.id,
          workspace,
        });
        await cognitive.ensureInput();
      }

      const { WorkspaceFactory } =
        await import("@alfred/agent/environment/factory");
      const { isAgentFSWorkspace } = await import("@alfred/agent/environment");

      // Prepare a run-scoped AgentFS container + DB for deterministic executor routing.
      const env = await WorkspaceFactory.create(
        "agentfs",
        `prepare-${input.runId}`,
        input.runId,
        workspace,
        {
          authz: input.authz,
          projectId: input.projectId,
        }
      );
      await env.initialize();

      if (!isAgentFSWorkspace(env)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "agentfs_workspace_expected",
        });
      }

      // Best-effort: persist hints into snapshot context so UIs can discover them.
      if (snapshot) {
        const contextMap = new Map(snapshot.contextEntries ?? []);
        contextMap.set("agentfsDbPath", env.dbPath);
        contextMap.set("agentfsContainerName", env.containerName);
        if (env.containerId) {
          contextMap.set("agentfsContainerId", env.containerId);
        }
        contextMap.set("agentfsContainerCw", env.containerCw);
        await storage.save(input.runId, {
          ...snapshot,
          contextEntries: [...contextMap.entries()],
        });
      }

      return {
        runId: input.runId,
        workspace,
        dbPath: env.dbPath,
        containerName: env.containerName,
        containerId: env.containerId,
        containerCw: env.containerCw,
        durationMs: Math.round(performance.now() - startedAt),
      };
    } catch (error) {
      throw toTRPCError(error, "workflow_phase_prepare_failed");
    }
  });
