import { deployRepo } from "@alfred/db";
import { implementationPlanSchema, type ImplementationPlan, type ModulePlan, type Task } from "@alfred/type";
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { z } from "zod";
import { toolDroid } from "../tool/droid";
import { toolCodex } from "../tool/codex";
import { toolGit } from "../tool/git";
import { toolRouter } from "../tool/router";
import { toolTicket } from "../tool/ticket";
import { toolDocker } from "../tool/docker";
import { gatherCodeContext, gatherWebContext, buildContextBundle, indexCodeEmbeddings } from "./context";

const workflowInputSchema = z.object({
  requirement: z.string().min(1),
  auto: z.enum(["read", "low", "medium", "high"]).default("low"),
  executor: z.enum(["codex", "droid"]).optional(),
  authz: z.string().optional(),
  cw: z.string().optional(),
  mode: z.enum(["sequential", "parallel"]).default("sequential"),
  workspace: z.string().optional(),
  repoBase: z.string().optional(),
  authzDeploy: z.string().optional(),
  authzLinear: z.string().optional(),
  preview: z
    .object({
      host: z.string().min(1),
      upstream: z.string().url().optional(),
      tls: z.boolean().optional(),
    })
    .optional(),
  previewBuild: z
    .object({
      context: z.string().min(1),
      dockerfile: z.string().optional(),
      image: z.string().optional(),
      port: z.number().int().min(1).max(65535).optional(),
      env: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  promote: z
    .object({
      host: z.string().min(1),
      upstream: z.string().url(),
      tls: z.boolean().optional(),
    })
    .optional(),
  linear: z
    .object({
      space: z.string().min(1),
      teamId: z.string().optional(),
      sessionId: z.string().optional(),
    })
    .optional(),
  context: z
    .object({
      enable: z.boolean().optional(),
      web: z.boolean().optional(),
      topK: z.number().int().min(1).max(100).optional(),
      maxTokens: z.number().int().min(2000).max(200000).optional(),
      exts: z.array(z.string()).optional(),
      ignore: z.array(z.string()).optional(),
      seeds: z.array(z.string().url()).optional(),
    })
    .optional(),
  userId: z.string().min(1).optional(),
});

const workflowOutputSchema = z.object({
  summary: z.string(),
  results: z.array(
    z.object({
      task: z.string(),
      outcome: z.string(),
      module: z.string(),
      status: z.enum(["completed", "failed"]),
    }),
  ),
  plan: implementationPlanSchema,
  vcs: z
    .object({
      base: z.object({
        branch: z.string(),
        worktree: z.string(),
      }),
      modules: z.array(
        z.object({
          id: z.string(),
          branch: z.string(),
          worktree: z.string(),
        }),
      ),
    })
    .optional(),
  ticketId: z.string().optional(),
  ticketUrl: z.string().optional(),
});

type WorkflowOutput = z.infer<typeof workflowOutputSchema>;

const stepStateSchema = z.object({
  planBuilt: z.boolean().optional(),
  modulesCompleted: z.boolean().optional(),
  results: z
    .array(
      z.object({
        task: z.string(),
        outcome: z.string(),
        module: z.string(),
        status: z.enum(["completed", "failed"]),
      }),
    )
    .optional(),
  deployAuthz: z.string().optional(),
  linearAuthz: z.string().optional(),
  ticketId: z.string().optional(),
  ticketUrl: z.string().optional(),
  ticketCreated: z.boolean().optional(),
  ticketDelegated: z.boolean().optional(),
  ticketStarted: z.boolean().optional(),
  ticketCommented: z.boolean().optional(),
  previewRegistered: z.boolean().optional(),
  promoteUpdated: z.boolean().optional(),
  previewBuilt: z.boolean().optional(),
  previewStarted: z.boolean().optional(),
  previewContainerName: z.string().optional(),
  previewContainerId: z.string().optional(),
  previewHostPort: z.number().optional(),
  previewImage: z.string().optional(),
  previewPorts: z
    .array(
      z.object({
        host: z.number(),
        container: z.number(),
      }),
    )
    .optional(),
  previewStopped: z.boolean().optional(),
  previewRemoved: z.boolean().optional(),
  previewRouteRemoved: z.boolean().optional(),
  previewDeploymentId: z.string().optional(),
  previewHealthChecked: z.boolean().optional(),
  promotionDeploymentId: z.string().optional(),
  promotePreviousUpstream: z.string().optional(),
  deploymentApp: z.string().optional(),
  cleaned: z.boolean().optional(),
  merged: z.boolean().optional(),
  awaiting: z.enum(["deploy-authz", "linear-authz"]).optional(),
  activityPlanStarted: z.boolean().optional(),
  activityActionLogged: z.boolean().optional(),
  activitySummaryLogged: z.boolean().optional(),
  activityErrored: z.boolean().optional(),
  contextReceipts: z.unknown().optional(),
  contextBundle: z.unknown().optional(),
  contextIndexed: z.boolean().optional(),
});

type OrchestratorStepState = z.infer<typeof stepStateSchema>;

const resumePayloadSchema = z.object({
  event: z.enum(["deploy-authz", "linear-authz"]),
  authz: z.string().min(1),
});

type ResumePayload = z.infer<typeof resumePayloadSchema>;

const suspendPayloadSchema = z.object({
  event: z.enum(["deploy-authz", "linear-authz"]),
  scopes: z.array(z.string()),
  message: z.string().optional(),
});

function splitRequirement(requirement: string) {
  const candidates = requirement
    .split(/[\n.;]+/u)
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);

  if (candidates.length === 0) {
    return [requirement.trim()];
  }

  return candidates.slice(0, 5);
}

function sanitizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

type ExecutorName = "codex" | "droid";

function resolveExecutor(preferred?: ExecutorName): ExecutorName {
  if (preferred === "codex" || preferred === "droid") {
    return preferred;
  }
  const envExecutor = (process.env.ORCH_EXECUTOR ?? "").trim().toLowerCase();
  return envExecutor === "codex" ? "codex" : "droid";
}

function executorFallbackEnabled() {
  return process.env.ORCH_EXECUTOR_FALLBACK === "1";
}

function buildPlan(requirement: string, auto: "read" | "low" | "medium" | "high", mode: "sequential" | "parallel"): ImplementationPlan {
  const lines = splitRequirement(requirement);
  const planId = randomUUID();
  const modules: ModulePlan[] = lines.map((line, index) => {
    const task: Task = {
      id: `task-${index + 1}`,
      title: line.slice(0, 120),
      description: line,
      status: "pending",
      dependencies: [],
      auto,
      created: new Date(),
    };

    return {
      id: `module-${index + 1}`,
      path: ".",
      description: line,
      tasks: [task],
      status: "pending",
    };
  });

  return {
    id: planId,
    title: `Plan ${planId.slice(0, 8)}`,
    description: requirement,
    strategy: mode,
    status: "planning",
    created: new Date(),
    modules,
    metadata: {
      requirement,
    },
  };
}

const PREVIEW_HOST = "127.0.0.1";

const DEFAULT_CONTEXT_MAX_TOKENS = Number(process.env.ORCH_CONTEXT_MAX_TOKENS ?? "24000");

function parsePortEnv(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const PREVIEW_PORT_RANGE_START = parsePortEnv(process.env.PREVIEW_PORT_START, 30080);
const PREVIEW_PORT_RANGE_END = parsePortEnv(process.env.PREVIEW_PORT_END, 30200);

function buildPreviewImageTag(planId: string, override?: string) {
  return override ?? `alfred/preview-${planId.slice(0, 8)}`;
}

function buildPreviewContainerName(planId: string) {
  return `preview_${planId.slice(0, 8)}`;
}

async function allocatePort(rangeStart: number, rangeEnd: number): Promise<number> {
  const min = Math.min(rangeStart, rangeEnd);
  const max = Math.max(rangeStart, rangeEnd);

  for (let port = min; port <= max; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const available = await new Promise<boolean>(resolve => {
      const server = createServer();
      const finalize = (result: boolean) => {
        server.removeAllListeners();
        resolve(result);
      };
      server.once("error", () => finalize(false));
      server.once("listening", () => {
        server.close(() => finalize(true));
      });
      server.listen(port, PREVIEW_HOST);
    });

    if (available) {
      return port;
    }
  }

  throw new Error("preview_port_unavailable");
}

type PreparedVCS = {
  base: { branch: string; worktree: string };
  modules: Array<{ id: string; branch: string; worktree: string }>;
};

function delay(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function prepareVcs({
  plan,
  authz,
  repoBase,
  cw,
  writer,
}: {
  plan: ImplementationPlan;
  authz: string | undefined;
  repoBase: string | undefined;
  cw: string;
  writer?: { write: (chunk: unknown) => Promise<void> | void };
}): Promise<PreparedVCS> {
  const baseRef = repoBase ?? "origin/main";
  const branchSlug = sanitizeSlug(`feature-${plan.id.slice(0, 8)}`);
  const baseBranch = branchSlug.length > 0 ? branchSlug : `feature-${plan.id.slice(0, 8)}`;
  const worktreesDir = path.join(cw, ".worktrees");
  await mkdir(worktreesDir, { recursive: true });

  await writer?.write({ type: "notice", message: "prepare_vcs_start" });

  const fetchRemote = baseRef.includes("/") ? baseRef.split("/")[0] : "origin";
  await toolGit.execute({
    input: {
      action: "fetch",
      remote: fetchRemote,
      authz,
      cw,
    },
    writer,
  });

  try {
    await toolGit.execute({
      input: {
        action: "branch.create",
        name: baseBranch,
        base: baseRef,
        authz,
        cw,
      },
      writer,
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "git_branch_create_failed") {
      throw error;
    }
    await writer?.write({
      type: "notice",
      message: "branch_exists",
      branch: baseBranch,
    });
    await toolGit.execute({
      input: {
        action: "branch.update",
        name: baseBranch,
        base: baseRef,
        authz,
        cw,
      },
      writer,
    });
    await writer?.write({
      type: "notice",
      message: "branch_updated",
      branch: baseBranch,
      base: baseRef,
    });
  }

  const baseWorktree = path.join(worktreesDir, baseBranch);
  try {
    await toolGit.execute({
      input: {
        action: "worktree.add",
        path: baseWorktree,
        ref: baseBranch,
        authz,
        cw,
      },
      writer,
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "git_worktree_add_failed") {
      throw error;
    }
    await writer?.write({
      type: "notice",
      message: "worktree_exists",
      path: baseWorktree,
    });
    await toolGit.execute({
      input: {
        action: "reset.hard",
        ref: baseBranch,
        authz,
        cw: baseWorktree,
      },
      writer,
    });
    await writer?.write({
      type: "notice",
      message: "worktree_reset",
      path: baseWorktree,
      ref: baseBranch,
    });
  }

  const moduleEntries: Array<{ id: string; branch: string; worktree: string }> = [];

  for (const module of plan.modules) {
    const moduleBranch = sanitizeSlug(`${baseBranch}-${module.id}`);
    try {
      await toolGit.execute({
        input: {
          action: "branch.create",
          name: moduleBranch,
          base: baseBranch,
          authz,
          cw,
        },
        writer,
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "git_branch_create_failed") {
        throw error;
      }
      await writer?.write({
        type: "notice",
        message: "branch_exists",
        branch: moduleBranch,
      });
      await toolGit.execute({
        input: {
          action: "branch.update",
          name: moduleBranch,
          base: baseBranch,
          authz,
          cw,
        },
        writer,
      });
      await writer?.write({
        type: "notice",
        message: "branch_updated",
        branch: moduleBranch,
        base: baseBranch,
      });
    }

    const moduleWorktree = path.join(worktreesDir, moduleBranch);
    try {
      await toolGit.execute({
        input: {
          action: "worktree.add",
          path: moduleWorktree,
          ref: moduleBranch,
          authz,
          cw,
        },
        writer,
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "git_worktree_add_failed") {
        throw error;
      }
      await writer?.write({
        type: "notice",
        message: "worktree_exists",
        path: moduleWorktree,
      });
      await toolGit.execute({
        input: {
          action: "reset.hard",
          ref: moduleBranch,
          authz,
          cw: moduleWorktree,
        },
        writer,
      });
      await writer?.write({
        type: "notice",
        message: "worktree_reset",
        path: moduleWorktree,
        ref: moduleBranch,
      });
    }

    module.branch = moduleBranch;
    module.worktree = moduleWorktree;
    moduleEntries.push({ id: module.id, branch: moduleBranch, worktree: moduleWorktree });
  }

  plan.status = "scheduled";

  await writer?.write({
    type: "notice",
    message: "prepare_vcs_complete",
    baseBranch,
    modules: moduleEntries.map(entry => entry.branch),
  });

  return {
    base: { branch: baseBranch, worktree: baseWorktree },
    modules: moduleEntries,
  };
}

async function runExecutorTool({
  executor,
  allowFallback,
  prompt,
  out,
  auto,
  authz,
  cw,
  writer,
}: {
  executor: ExecutorName;
  allowFallback: boolean;
  prompt: string;
  out: "text" | "json" | "debug";
  auto: "read" | "low" | "medium" | "high";
  authz: string | undefined;
  cw: string;
  writer?: { write: (chunk: unknown) => Promise<void> | void };
}) {
  if (executor === "codex") {
    try {
      return await toolCodex.execute({
        input: {
          action: "exec",
          prompt,
          out,
          auto,
          authz,
          cw,
        },
        writer,
      });
    } catch (error) {
      await writer?.write?.({
        type: "notice",
        message: "codex_executor_error",
        error: error instanceof Error ? error.message : String(error),
      });

      if (allowFallback) {
        await writer?.write?.({
          type: "notice",
          message: "codex_fallback_droid",
        });
        return toolDroid.execute({
          input: {
            prompt,
            out,
            auto,
            authz,
            cw,
          },
          writer,
        });
      }

      throw error;
    }
  }

  return toolDroid.execute({
    input: {
      prompt,
      out,
      auto,
      authz,
      cw,
    },
    writer,
  });
}

async function executeModule({
  module,
  authz,
  auto,
  writer,
  executor,
  allowFallback,
}: {
  module: ModulePlan;
  authz: string | undefined;
  auto: "read" | "low" | "medium" | "high";
  writer?: { write: (chunk: unknown) => Promise<void> | void };
  executor: ExecutorName;
  allowFallback: boolean;
}) {
  if (!module.worktree) {
    throw new Error("module_worktree_missing");
  }

  module.status = "in_progress";
  await writer?.write({
    type: "notice",
    message: "module_started",
    module: module.id,
  });

  const moduleResults: Array<{ task: string; outcome: string; module: string; status: "completed" | "failed" }> =
    [];

  for (const task of module.tasks) {
    await writer?.write({
      type: "notice",
      message: "task_started",
      module: module.id,
      task: task.id,
    });

    try {
      const taskAuto = task.auto ?? auto;
      const response = await runExecutorTool({
        executor,
        allowFallback,
        prompt: task.description,
        out: "debug",
        auto: taskAuto,
        authz,
        cw: module.worktree,
        writer,
      });

      task.status = "completed";
      task.completed = new Date();
      moduleResults.push({
        task: task.description,
        outcome: response.result,
        module: module.id,
        status: "completed",
      });
    } catch (error) {
      task.status = "failed";
      task.error = error instanceof Error ? error.message : String(error);
      module.status = "failed";
      moduleResults.push({
        task: task.description,
        outcome: task.error ?? "task_failed",
        module: module.id,
        status: "failed",
      });
      await writer?.write({
        type: "notice",
        message: "task_failed",
        module: module.id,
        task: task.id,
        error: task.error,
      });
      throw error;
    }

    await writer?.write({
      type: "notice",
      message: "task_completed",
      module: module.id,
      task: task.id,
    });
  }

  const commitMessage = `feat(${module.id}): apply module changes`;
  await toolGit.execute({
    input: {
      action: "commit",
      message: commitMessage,
      authz,
      cw: module.worktree,
    },
    writer,
  });

  module.status = "completed";
  await writer?.write({
    type: "notice",
    message: "module_completed",
    module: module.id,
  });

  await writer?.write({
    type: "data-cache-handoff",
    key: ["modules", module.id],
    value: {
      moduleId: module.id,
      branch: module.branch,
      worktree: module.worktree,
      status: module.status,
    },
  });

  return moduleResults;
}

async function mergeModules({
  plan,
  vcs,
  authz,
  writer,
}: {
  plan: ImplementationPlan;
  vcs: PreparedVCS;
  authz: string | undefined;
  writer?: { write: (chunk: unknown) => Promise<void> | void };
}) {
  plan.status = "reviewing";
  await writer?.write({
    type: "notice",
    message: "merge_start",
    branch: vcs.base.branch,
  });

  for (const entry of vcs.modules) {
    await writer?.write({
      type: "notice",
      message: "module_merge_start",
      module: entry.id,
    });

    await toolGit.execute({
      input: {
        action: "merge",
        ref: entry.branch,
        authz,
        cw: vcs.base.worktree,
      },
      writer,
    });

    await writer?.write({
      type: "notice",
      message: "module_merge_complete",
      module: entry.id,
    });
  }

  plan.status = "completed";
  plan.completed = new Date();

  await writer?.write({
    type: "notice",
    message: "merge_complete",
  });
}

async function cleanupWorktrees({
  cw,
  authz,
  worktrees,
  writer,
}: {
  cw: string;
  authz: string | undefined;
  worktrees: string[];
  writer?: { write: (chunk: unknown) => Promise<void> | void };
}) {
  for (const wt of worktrees) {
    try {
      await toolGit.execute({
        input: {
          action: "worktree.remove",
          path: wt,
          authz,
          cw,
        },
        writer,
      });
    } catch {
      await writer?.write({
        type: "notice",
        message: "worktree_cleanup_failed",
        path: wt,
      });
    }
  }
}

const orchestratorStep = createStep({
  id: "orchestrator-plan",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
  stateSchema: stepStateSchema,
  resumeSchema: resumePayloadSchema,
  suspendSchema: suspendPayloadSchema,
  execute: async ({
    inputData,
    writer,
    state,
    setState,
    resumeData,
    suspend,
  }): Promise<WorkflowOutput> => {
    const cw = inputData.cw ?? process.cwd();
    const executor = resolveExecutor(inputData.executor);
    const allowExecutorFallback = executorFallbackEnabled();
    const currentState: OrchestratorStepState = state ?? {};
    const nextState: OrchestratorStepState = { ...currentState };

    if (resumeData) {
      if (resumeData.event === "deploy-authz") {
        nextState.deployAuthz = resumeData.authz;
      } else if (resumeData.event === "linear-authz") {
        nextState.linearAuthz = resumeData.authz;
      }
      if (nextState.awaiting === resumeData.event) {
        delete nextState.awaiting;
      }
      setState(nextState);
    }

    const plan = buildPlan(inputData.requirement, inputData.auto, inputData.mode);
    plan.metadata = {
      ...(plan.metadata ?? {}),
      workflowExecutor: executor,
    };
    await writer?.write({
      type: "notice",
      message: "executor_selected",
      executor,
    });
    await writer?.write({ type: "progress", pct: 5, message: "plan_generated" });
    const contextConfig = inputData.context;
    const contextEnabled = contextConfig?.enable !== false;
    if (contextEnabled) {
      await writer?.write({ type: "notice", message: "context_start" });
      const codeReceipts = await gatherCodeContext({
        requirement: inputData.requirement,
        cw,
        exts: contextConfig?.exts,
        ignore: contextConfig?.ignore,
        topK: contextConfig?.topK,
        writer,
        authz: inputData.authz,
        executor,
      });

      const combinedReceipts: typeof codeReceipts = { ...codeReceipts };

      if (contextConfig?.web !== false) {
        const webReceipts = await gatherWebContext({
          requirement: inputData.requirement,
          topK: Math.min(contextConfig?.topK ?? 5, 10),
          writer,
          authz: inputData.authz,
        });
        combinedReceipts.web = webReceipts.web;
        if (!combinedReceipts.summary && webReceipts.summary) {
          combinedReceipts.summary = webReceipts.summary;
        }
      }

      const bundle = await buildContextBundle({
        cw,
        receipts: combinedReceipts,
        maxTokens: contextConfig?.maxTokens ?? DEFAULT_CONTEXT_MAX_TOKENS,
        exts: contextConfig?.exts,
        writer,
      });

      if (contextConfig?.seeds && contextConfig.seeds.length > 0) {
        const existingLinks = bundle.links ?? [];
        const seen = new Set(existingLinks.map(link => link.url));
        for (const seed of contextConfig.seeds) {
          if (!seen.has(seed)) {
            existingLinks.push({ url: seed });
            seen.add(seed);
          }
        }
        bundle.links = existingLinks;
      }

      nextState.contextReceipts = combinedReceipts;
      nextState.contextBundle = bundle;
      setState(nextState);

      await writer?.write({
        type: "data-cache-handoff",
        key: ["context", "bundle", plan.id] as const,
        value: {
          maxTokens: bundle.maxTokens,
          estimatedTokens: bundle.estimatedTokens,
          files: bundle.files.map(file => ({
            path: file.path,
            startLine: file.startLine,
            endLine: file.endLine,
            tokens: file.tokens,
          })),
          links: bundle.links,
        },
      });

      try {
        const ingestItems = bundle.files
          .filter(file => file.content && file.content.length > 0)
          .map(file => ({ path: file.path, content: file.content }));
        if (ingestItems.length > 0) {
          await indexCodeEmbeddings({
            items: ingestItems,
            sourceId: `repo:${plan.id}`,
          });
          nextState.contextIndexed = true;
          setState(nextState);
        }
      } catch (error) {
        await writer?.write({
          type: "notice",
          message: error instanceof Error ? `context_index_failed:${error.message}` : "context_index_failed",
        });
      }

      const metadataContext = {
        receiptsSummary: combinedReceipts.summary,
        estimatedTokens: bundle.estimatedTokens,
        files: bundle.files.map(file => ({
          path: file.path,
          startLine: file.startLine,
          endLine: file.endLine,
          tokens: file.tokens,
        })),
        links: bundle.links,
      };

      plan.metadata = {
        ...(plan.metadata ?? {}),
        context: metadataContext,
      };
    }

    const deploymentUserId = inputData.userId ?? "system";
    if (!nextState.deploymentApp) {
      nextState.deploymentApp =
        inputData.preview?.host ?? inputData.promote?.host ?? `plan-${plan.id.slice(0, 8)}`;
      setState(nextState);
    }
    const deploymentApp = nextState.deploymentApp;

    if (nextState.ticketId) {
      plan.metadata = {
        ...plan.metadata,
        ticketId: nextState.ticketId,
        ticketUrl: nextState.ticketUrl,
      };
    }

    const createdWorktrees = new Set<string>();
    let vcs: PreparedVCS | undefined;

    const results: WorkflowOutput["results"] = nextState.results ? [...nextState.results] : [];
    const previewBuildConfig = inputData.previewBuild;
    let computedPreviewUpstream = inputData.preview?.upstream;

    const acquireLinearAuthz = async (): Promise<string> => {
      const existing = nextState.linearAuthz ?? inputData.authzLinear;
      if (existing) {
        nextState.linearAuthz = existing;
        setState(nextState);
        return existing;
      }
      nextState.awaiting = "linear-authz";
      setState(nextState);
      await writer?.write({
        type: "require-scope",
        event: "linear-authz",
        scopes: ["linear.write"],
      });
      const payload = (await suspend({
        event: "linear-authz",
        scopes: ["linear.write"],
      })) as ResumePayload;
      nextState.linearAuthz = payload.authz;
      delete nextState.awaiting;
      setState(nextState);
      return payload.authz;
    };

    const acquireDeployAuthz = async (): Promise<string> => {
      const existing = nextState.deployAuthz ?? inputData.authzDeploy;
      if (existing) {
        nextState.deployAuthz = existing;
        setState(nextState);
        return existing;
      }
      nextState.awaiting = "deploy-authz";
      setState(nextState);
      await writer?.write({
        type: "require-scope",
        event: "deploy-authz",
        scopes: ["router.write", "deploy.write"],
      });
      const payload = (await suspend({
        event: "deploy-authz",
        scopes: ["router.write", "deploy.write"],
      })) as ResumePayload;
      nextState.deployAuthz = payload.authz;
      delete nextState.awaiting;
      setState(nextState);
      return payload.authz;
    };

    const summaryFromResults = () => {
      const completedCount = results.filter(entry => entry.status === "completed").length;
      const failedCount = results.filter(entry => entry.status === "failed").length;
      return { completedCount, failedCount };
    };

    const previewHost = inputData.preview?.host ?? null;
    const previewBaseUrl = previewHost ? `${inputData.preview?.tls ? "https" : "http"}://${previewHost}` : null;

    const ensurePreviewDeployment = async (
      status: string,
      overrides: {
        url?: string | null;
        containerName?: string | null;
        containerId?: string | null;
        port?: number | null;
        ports?: Array<{ host: number; container: number }> | null;
        healthUrl?: string | null;
        metadata?: unknown;
      } = {},
    ) => {
      if (!inputData.preview) return null;
      const record = await deployRepo.upsertDeployment({
        userId: deploymentUserId,
        app: deploymentApp,
        type: "preview",
        status,
        domain: previewHost,
        url: overrides.url ?? previewBaseUrl,
        containerName: overrides.containerName ?? nextState.previewContainerName ?? null,
        containerId: overrides.containerId ?? nextState.previewContainerId ?? null,
        port: overrides.port ?? nextState.previewHostPort ?? null,
        ports: overrides.ports ?? nextState.previewPorts ?? null,
        healthUrl: overrides.healthUrl ?? computedPreviewUpstream ?? previewBaseUrl ?? null,
        metadata:
          overrides.metadata ??
          {
            preview: true,
            planId: plan.id,
            auto: inputData.auto,
            hostPort: nextState.previewHostPort,
          },
      });
      nextState.previewDeploymentId = record.id;
      setState(nextState);
      return record;
    };

    const setPreviewStatus = async (
      status: string,
      overrides: {
        url?: string | null;
        containerName?: string | null;
        containerId?: string | null;
        port?: number | null;
        ports?: Array<{ host: number; container: number }> | null;
        healthUrl?: string | null;
        metadata?: unknown;
      } = {},
    ) => {
      if (!nextState.previewDeploymentId) {
        return ensurePreviewDeployment(status, overrides);
      }
      return deployRepo.setDeploymentStatus(nextState.previewDeploymentId, status, {
        domain: previewHost ?? undefined,
        url: overrides.url ?? previewBaseUrl ?? undefined,
        containerName: overrides.containerName ?? nextState.previewContainerName ?? undefined,
        containerId: overrides.containerId ?? nextState.previewContainerId ?? undefined,
        port: overrides.port ?? nextState.previewHostPort ?? undefined,
        ports: overrides.ports ?? nextState.previewPorts ?? undefined,
        healthUrl: overrides.healthUrl ?? computedPreviewUpstream ?? previewBaseUrl ?? undefined,
        metadata: overrides.metadata,
      });
    };

    const recordPreviewHealth = async (healthStatus: string, healthUrl?: string | null) => {
      if (!nextState.previewDeploymentId) {
        await ensurePreviewDeployment("running", { url: previewBaseUrl });
      }
      if (!nextState.previewDeploymentId) return;
      await deployRepo.recordHealthCheck(nextState.previewDeploymentId, healthStatus, {
        healthUrl: healthUrl ?? computedPreviewUpstream ?? null,
      });
      nextState.previewHealthChecked = healthStatus === "healthy";
      setState(nextState);
    };

    const promoteHost = inputData.promote?.host ?? null;
    const promoteBaseUrl = promoteHost ? `${inputData.promote?.tls ? "https" : "http"}://${promoteHost}` : null;

    const ensureProductionDeployment = async (
      status: string,
      overrides: {
        url?: string | null;
        containerName?: string | null;
        containerId?: string | null;
        port?: number | null;
        ports?: Array<{ host: number; container: number }> | null;
        healthUrl?: string | null;
        metadata?: unknown;
      } = {},
    ) => {
      if (!inputData.promote) return null;
      const record = await deployRepo.upsertDeployment({
        userId: deploymentUserId,
        app: deploymentApp,
        type: "production",
        status,
        domain: promoteHost,
        url: overrides.url ?? promoteBaseUrl,
        containerName: overrides.containerName ?? null,
        containerId: overrides.containerId ?? null,
        port: overrides.port ?? null,
        ports: overrides.ports ?? null,
        healthUrl: overrides.healthUrl ?? inputData.promote?.upstream ?? null,
        metadata:
          overrides.metadata ?? {
            production: true,
            planId: plan.id,
            previewHost,
          },
      });
      nextState.promotionDeploymentId = record.id;
      setState(nextState);
      return record;
    };

    const setProductionStatus = async (
      status: string,
      overrides: {
        url?: string | null;
        containerName?: string | null;
        containerId?: string | null;
        port?: number | null;
        ports?: Array<{ host: number; container: number }> | null;
        healthUrl?: string | null;
        metadata?: unknown;
      } = {},
    ) => {
      if (!nextState.promotionDeploymentId) {
        return ensureProductionDeployment(status, overrides);
      }
      return deployRepo.setDeploymentStatus(nextState.promotionDeploymentId, status, {
        domain: promoteHost ?? undefined,
        url: overrides.url ?? promoteBaseUrl ?? undefined,
        containerName: overrides.containerName ?? undefined,
        containerId: overrides.containerId ?? undefined,
        port: overrides.port ?? undefined,
        ports: overrides.ports ?? undefined,
        healthUrl: overrides.healthUrl ?? inputData.promote?.upstream ?? promoteBaseUrl ?? undefined,
        metadata: overrides.metadata,
      });
    };

    const recordProductionHealth = async (healthStatus: string, healthUrl?: string | null) => {
      if (!nextState.promotionDeploymentId) {
        await ensureProductionDeployment("active", { url: promoteBaseUrl });
      }
      if (!nextState.promotionDeploymentId) return;
      await deployRepo.recordHealthCheck(nextState.promotionDeploymentId, healthStatus, {
        healthUrl: healthUrl ?? null,
      });
    };

    const cleanupPreview = async ({
      allowPrompt = false,
      removeRoute = true,
    }: { allowPrompt?: boolean; removeRoute?: boolean } = {}) => {
      if (!inputData.preview) return;

      let authz = nextState.deployAuthz ?? inputData.authzDeploy;
      if (!authz && allowPrompt) {
        authz = await acquireDeployAuthz();
      }
      if (!authz) return;

      const host = inputData.preview.host;

      if (removeRoute && nextState.previewRegistered && !nextState.previewRouteRemoved) {
        try {
          await toolRouter.execute({
            input: {
              action: "remove",
              host,
              authz,
            },
          });
          nextState.previewRouteRemoved = true;
          nextState.previewRegistered = false;
          setState(nextState);
          await writer?.write({
            type: "notice",
            message: "preview_router_removed",
            host,
          });
        } catch (error) {
          await writer?.write({
            type: "notice",
            message: "preview_router_remove_failed",
            host,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const containerName = nextState.previewContainerName;
      const containerId = nextState.previewContainerId;
      if (!containerName) {
        return;
      }

      if (!nextState.previewStopped) {
        try {
          await toolDocker.execute({
            input: {
              action: "stop",
              name: containerName,
              authz,
            },
            writer,
          });
          nextState.previewStopped = true;
          setState(nextState);
          await writer?.write({
            type: "notice",
            message: "preview_container_stopped",
            name: containerName,
          });
          await setPreviewStatus("stopped", {
            containerName,
            containerId,
            port: nextState.previewHostPort ?? null,
            ports: nextState.previewPorts ?? null,
            metadata: {
              preview: true,
              stoppedAt: new Date().toISOString(),
            },
          });
        } catch (error) {
          await writer?.write({
            type: "notice",
            message: "preview_container_stop_failed",
            name: containerName,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (!nextState.previewRemoved) {
        try {
          await toolDocker.execute({
            input: {
              action: "rm",
              name: containerName,
              authz,
            },
            writer,
          });
          nextState.previewRemoved = true;
          setState(nextState);
          await writer?.write({
            type: "notice",
            message: "preview_container_removed",
            name: containerName,
          });
          await setPreviewStatus("removed", {
            containerName,
            containerId,
            port: nextState.previewHostPort ?? null,
            ports: nextState.previewPorts ?? null,
            metadata: {
              preview: true,
              removedAt: new Date().toISOString(),
            },
          });
        } catch (error) {
          await writer?.write({
            type: "notice",
            message: "preview_container_remove_failed",
            name: containerName,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };

    const hasLinearSession = Boolean(inputData.linear?.sessionId);

    const sendLinearActivity = async (
      type: "thought" | "action" | "response" | "error",
      {
        title,
        body,
        parameter,
        result,
        ephemeral,
      }: {
        title?: string;
        body?: string;
        parameter?: string;
        result?: string;
        ephemeral?: boolean;
      },
    ) => {
      if (!hasLinearSession || !inputData.linear) return;
      const authzLinear = await acquireLinearAuthz();
      await toolTicket.execute({
        input: {
          action: `activity.${type}`,
          space: inputData.linear.space,
          sessionId: inputData.linear.sessionId,
          title,
          description: body,
          parameter,
          result,
          ephemeral,
          authz: authzLinear,
        },
      });
      nextState.linearAuthz = authzLinear;
      setState(nextState);
    };

    try {
      if (hasLinearSession && !nextState.activityPlanStarted) {
        await sendLinearActivity("thought", {
          body: `Starting workflow for plan ${plan.id} (${plan.title}).`,
          ephemeral: true,
        });
        nextState.activityPlanStarted = true;
        setState(nextState);
      }

      vcs = await prepareVcs({
        plan,
        authz: inputData.authz,
        repoBase: inputData.repoBase,
        cw,
        writer,
      });
      createdWorktrees.add(vcs.base.worktree);
      for (const moduleEntry of vcs.modules) {
        createdWorktrees.add(moduleEntry.worktree);
      }

      if (inputData.linear && !nextState.ticketCreated) {
        const authzLinear = await acquireLinearAuthz();
        const created = await toolTicket.execute({
          input: {
            action: "create",
            space: inputData.linear.space,
            teamId: inputData.linear.teamId,
            title: plan.title,
            description: plan.description,
            authz: authzLinear,
          },
        });
        nextState.linearAuthz = authzLinear;
        if (created.id) nextState.ticketId = created.id;
        const rawUrl = (created as { url?: unknown }).url;
        const createdUrl = typeof rawUrl === "string" ? rawUrl : undefined;
        if (createdUrl) nextState.ticketUrl = createdUrl;
        nextState.ticketCreated = true;
        plan.metadata = {
          ...plan.metadata,
          ticketId: nextState.ticketId,
          ticketUrl: nextState.ticketUrl,
        };
        setState(nextState);
        await writer?.write({
          type: "notice",
          message: "ticket_created",
          id: created.id,
          url: createdUrl,
        });
      }

      if (!nextState.modulesCompleted) {
        plan.status = "executing";
        plan.started = new Date();

        if (hasLinearSession && !nextState.activityActionLogged) {
          await sendLinearActivity("action", {
            title: "Executing modules",
            body: `Processing ${plan.modules.length} module(s) for plan ${plan.id}.`,
          });
          nextState.activityActionLogged = true;
          setState(nextState);
        }

        const moduleList =
          inputData.mode === "parallel"
            ? plan.modules
            : plan.modules.slice().sort((a, b) => (a.id > b.id ? 1 : -1));

        results.length = 0;

        for (const module of moduleList) {
          const moduleResults = await executeModule({
            module,
            authz: inputData.authz,
            auto: inputData.auto,
            writer,
            executor,
            allowFallback: allowExecutorFallback,
          });
          results.push(...moduleResults);

          await writer?.write({
            type: "progress",
            pct: Math.min(60, 20 + (results.length / Math.max(plan.modules.length, 1)) * 40),
            message: `module_${module.id}_completed`,
          });

          if (module.worktree) {
            await toolGit.execute({
              input: {
                action: "worktree.remove",
                path: module.worktree,
                authz: inputData.authz,
                cw,
              },
              writer,
            });
            createdWorktrees.delete(module.worktree);
          }
        }

        nextState.results = [...results];
        nextState.modulesCompleted = true;
        setState(nextState);
      } else if (nextState.results) {
        results.length = 0;
        results.push(...nextState.results);
      }

      for (const module of plan.modules) {
        const moduleResult = results.find(entry => entry.module === module.id);
        if (moduleResult) {
          module.status = moduleResult.status === "failed" ? "failed" : "completed";
        }
      }

      if (inputData.linear && nextState.ticketId && !nextState.ticketDelegated) {
        const authzLinear = await acquireLinearAuthz();
        await toolTicket.execute({
          input: {
            action: "set-delegate",
            space: inputData.linear.space,
            issueId: nextState.ticketId,
            authz: authzLinear,
          },
        });
        nextState.linearAuthz = authzLinear;
        nextState.ticketDelegated = true;
        setState(nextState);
        await writer?.write({
          type: "notice",
          message: "ticket_set_delegate",
          id: nextState.ticketId,
        });
      }

      if (inputData.linear && nextState.ticketId && !nextState.ticketStarted) {
        const authzLinear = await acquireLinearAuthz();
        await toolTicket.execute({
          input: {
            action: "set-started",
            space: inputData.linear.space,
            issueId: nextState.ticketId,
            authz: authzLinear,
          },
        });
        nextState.linearAuthz = authzLinear;
        nextState.ticketStarted = true;
        setState(nextState);
        await writer?.write({
          type: "notice",
          message: "ticket_set_started",
          id: nextState.ticketId,
        });
      }

      if (inputData.preview && previewBuildConfig) {
        const deployAuthz = await acquireDeployAuthz();
        nextState.deployAuthz = deployAuthz;
        setState(nextState);

        const imageTag = buildPreviewImageTag(plan.id, previewBuildConfig.image);
        nextState.previewImage = imageTag;
        setState(nextState);

        const containerName = nextState.previewContainerName ?? buildPreviewContainerName(plan.id);
        let hostPort = nextState.previewHostPort;
        const containerPort = previewBuildConfig.port ?? 3000;

        if (!nextState.previewBuilt) {
          await toolDocker.execute({
            input: {
              action: "build",
              cw,
              context: previewBuildConfig.context,
              dockerfile: previewBuildConfig.dockerfile,
              tag: imageTag,
              authz: deployAuthz,
            },
            writer,
          });
          nextState.previewBuilt = true;
          nextState.previewImage = imageTag;
          setState(nextState);
          await writer?.write({
            type: "notice",
            message: "preview_image_built",
            image: imageTag,
          });
          await setPreviewStatus("building", {
            metadata: {
              preview: true,
              image: imageTag,
              stage: "build",
            },
          });
        }

        if (!hostPort) {
          hostPort = await allocatePort(PREVIEW_PORT_RANGE_START, PREVIEW_PORT_RANGE_END);
          nextState.previewHostPort = hostPort;
          setState(nextState);
        }

        if (!nextState.previewStarted) {
          const runResult = await toolDocker.execute({
            input: {
              action: "run",
              name: containerName,
              tag: imageTag,
              containerPort,
              hostPort,
              env: previewBuildConfig.env,
              network: process.env.DOCKER_NETWORK,
              authz: deployAuthz,
            },
            writer,
          });
          const runDetails =
            (runResult as {
              details?: {
                hostPort?: number | null;
                containerId?: string;
                ports?: Array<{ host: number; container: number }>;
              };
            }).details ?? {};
          const resolvedHostPort =
            typeof runDetails.hostPort === "number" ? runDetails.hostPort : hostPort ?? null;
          const resolvedContainerId =
            typeof runDetails.containerId === "string" && runDetails.containerId.trim().length > 0
              ? runDetails.containerId
              : undefined;
          const resolvedPorts = Array.isArray(runDetails.ports) ? runDetails.ports : undefined;
          if (resolvedHostPort !== null) {
            nextState.previewHostPort = resolvedHostPort;
          }
          if (resolvedContainerId) {
            nextState.previewContainerId = resolvedContainerId;
          } else if (!nextState.previewContainerId) {
            nextState.previewContainerId = containerName;
          }
          if (resolvedPorts && resolvedPorts.length > 0) {
            nextState.previewPorts = resolvedPorts;
          } else if (!nextState.previewPorts && resolvedHostPort !== null) {
            nextState.previewPorts = [{ host: resolvedHostPort, container: containerPort }];
          }
          nextState.previewContainerName = containerName;
          nextState.previewStarted = true;
          setState(nextState);
          await writer?.write({
            type: "notice",
            message: "preview_container_started",
            name: containerName,
            hostPort: nextState.previewHostPort,
          });
          await setPreviewStatus("starting", {
            containerName,
            containerId: nextState.previewContainerId ?? containerName,
            port: nextState.previewHostPort ?? null,
            ports: nextState.previewPorts ?? null,
            metadata: {
              preview: true,
              image: imageTag,
              stage: "run",
            },
          });
        }

        if (!computedPreviewUpstream) {
          const hostPortValue = nextState.previewHostPort;
          if (!hostPortValue) {
            throw new Error("preview_host_port_missing");
          }
          computedPreviewUpstream = `http://${PREVIEW_HOST}:${hostPortValue}`;
        }

        if (!nextState.previewHealthChecked) {
          const upstream = computedPreviewUpstream ?? inputData.preview.upstream;
          if (!upstream) {
            throw new Error("preview_upstream_unavailable");
          }

          const baseUrl = new URL(upstream);
          const candidates = new Set<string>();
          const clone = new URL(baseUrl.toString());
          if (clone.pathname === "" || clone.pathname === "/") {
            const healthz = new URL(clone.toString());
            healthz.pathname = "/healthz";
            candidates.add(healthz.toString());
          }
          candidates.add(baseUrl.toString());

          const attemptLimit = 6;
          const intervalMs = 2000;
          let success = false;
          let lastError: unknown;

          for (let attempt = 1; attempt <= attemptLimit && !success; attempt += 1) {
            for (const candidate of candidates) {
              try {
                await writer?.write({
                  type: "notice",
                  message: "preview_health_probe",
                  attempt,
                  url: candidate,
                });
                await toolDocker.execute({
                  input: {
                    action: "exec.probe",
                    url: candidate,
                    timeoutSec: 15,
                    authz: deployAuthz,
                  },
                  writer,
                });
                await writer?.write({
                  type: "notice",
                  message: "preview_health_ok",
                  attempt,
                  url: candidate,
                });
                await recordPreviewHealth("healthy", candidate);
                await setPreviewStatus("running", {
                  url: previewBaseUrl,
                  containerName: nextState.previewContainerName ?? containerName,
                  containerId: nextState.previewContainerId ?? containerName,
                  port: nextState.previewHostPort ?? null,
                  ports: nextState.previewPorts ?? null,
                  healthUrl: candidate,
                  metadata: {
                    preview: true,
                    stage: "health",
                  },
                });
                await writer?.write({ type: "progress", pct: 68, message: "preview_health_passed" });
                success = true;
                break;
              } catch (error) {
                lastError = error;
                await writer?.write({
                  type: "notice",
                  message: "preview_health_retry",
                  attempt,
                  url: candidate,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
            if (!success && attempt < attemptLimit) {
              await delay(intervalMs);
            }
          }

          if (!success) {
            const fallback = Array.from(candidates).at(-1) ?? upstream;
            await recordPreviewHealth("unhealthy", fallback);
            await setPreviewStatus("failed", {
              containerName: nextState.previewContainerName ?? containerName,
              containerId: nextState.previewContainerId ?? containerName,
              port: nextState.previewHostPort ?? null,
              ports: nextState.previewPorts ?? null,
              healthUrl: fallback,
              metadata: {
                preview: true,
                stage: "health",
                error: lastError instanceof Error ? lastError.message : String(lastError ?? "unknown"),
              },
            });
            throw new Error("preview_unhealthy");
          }
        }
      }

      if (inputData.preview && !nextState.previewRegistered) {
        const deployAuthz = await acquireDeployAuthz();
        const upstream = computedPreviewUpstream ?? inputData.preview.upstream;
        if (!upstream) {
          throw new Error("preview_upstream_unavailable");
        }
        await toolRouter.execute({
          input: {
            action: "register",
            host: inputData.preview.host,
            upstream,
            tls: inputData.preview.tls,
            authz: deployAuthz,
          },
        });
        nextState.deployAuthz = deployAuthz;
        nextState.previewRegistered = true;
        setState(nextState);
        await writer?.write({
          type: "notice",
          message: "preview_router_registered",
          host: inputData.preview.host,
        });
        await writer?.write({
          type: "progress",
          pct: 70,
          message: "preview_ready",
        });
        await setPreviewStatus("preview", {
          url: previewBaseUrl,
          containerName: nextState.previewContainerName ?? inputData.preview.host,
          containerId: nextState.previewContainerId ?? nextState.previewContainerName ?? undefined,
          port: nextState.previewHostPort ?? null,
          ports: nextState.previewPorts ?? null,
          healthUrl: computedPreviewUpstream ?? inputData.preview.upstream ?? null,
          metadata: {
            preview: true,
            route: inputData.preview.host,
          },
        });
      }

      if (vcs && !nextState.merged) {
        await mergeModules({ plan, vcs, authz: inputData.authz, writer });
        nextState.merged = true;
        setState(nextState);
      }

      if (inputData.linear && nextState.ticketId && !nextState.ticketCommented && !hasLinearSession) {
        const authzLinear = await acquireLinearAuthz();
        const { completedCount, failedCount } = summaryFromResults();
        const comment = [
          `Plan ${plan.id} completed.`,
          `Tasks completed: ${completedCount}`,
          `Tasks failed: ${failedCount}`,
        ].join("\n");
        await toolTicket.execute({
          input: {
            action: "comment",
            space: inputData.linear.space,
            issueId: nextState.ticketId,
            description: comment,
            authz: authzLinear,
          },
        });
        nextState.linearAuthz = authzLinear;
        nextState.ticketCommented = true;
        setState(nextState);
        await writer?.write({
          type: "notice",
          message: "ticket_commented",
          id: nextState.ticketId,
        });
      }

      if (inputData.promote && !nextState.promoteUpdated) {
        const deployAuthz = await acquireDeployAuthz();
        nextState.deployAuthz = deployAuthz;
        setState(nextState);

        const promoteUpstream = inputData.promote.upstream;
        await ensureProductionDeployment("promoting", {
          url: promoteBaseUrl,
          healthUrl: promoteUpstream,
          metadata: {
            production: true,
            stage: "precheck",
            previewHost,
          },
        });

        const probeAttempts = 3;
        let promoteHealthy = false;
        let promoteError: unknown;
        for (let attempt = 1; attempt <= probeAttempts; attempt += 1) {
          try {
            await writer?.write({
              type: "notice",
              message: "promote_health_probe",
              attempt,
              url: promoteUpstream,
            });
            await toolDocker.execute({
              input: {
                action: "exec.probe",
                url: promoteUpstream,
                timeoutSec: 15,
                authz: deployAuthz,
              },
              writer,
            });
            promoteHealthy = true;
            await writer?.write({
              type: "notice",
              message: "promote_health_ok",
              attempt,
              url: promoteUpstream,
            });
            await recordProductionHealth("healthy", promoteUpstream);
            break;
          } catch (error) {
            promoteError = error;
            await writer?.write({
              type: "notice",
              message: "promote_health_retry",
              attempt,
              url: promoteUpstream,
              error: error instanceof Error ? error.message : String(error),
            });
            if (attempt < probeAttempts) {
              await delay(2000);
            }
          }
        }

        if (!promoteHealthy) {
          await recordProductionHealth("unhealthy", promoteUpstream);
          await setProductionStatus("failed", {
            url: promoteBaseUrl,
            healthUrl: promoteUpstream,
            metadata: {
              production: true,
              stage: "precheck",
              error: promoteError instanceof Error ? promoteError.message : String(promoteError ?? "unknown"),
            },
          });
          throw new Error("promote_upstream_unhealthy");
        }

        nextState.promotePreviousUpstream = computedPreviewUpstream ?? inputData.preview?.upstream ?? undefined;
        setState(nextState);

        try {
          await toolRouter.execute({
            input: {
              action: "register",
              host: inputData.promote.host,
              upstream: promoteUpstream,
              tls: inputData.promote.tls,
              authz: deployAuthz,
            },
          });

          if (inputData.preview?.host) {
            await toolRouter.execute({
              input: {
                action: "remove",
                host: inputData.preview.host,
                authz: deployAuthz,
              },
            });
            await writer?.write({
              type: "notice",
              message: "preview_router_removed",
              host: inputData.preview.host,
            });
            nextState.previewRouteRemoved = true;
            nextState.previewRegistered = false;
          }

          await setProductionStatus("active", {
            url: promoteBaseUrl,
            healthUrl: promoteUpstream,
            metadata: {
              production: true,
              stage: "active",
              previewHost,
            },
          });

          nextState.promoteUpdated = true;
          setState(nextState);
          await writer?.write({
            type: "notice",
            message: "prod_router_updated",
            host: inputData.promote.host,
          });

          await cleanupPreview({ allowPrompt: false, removeRoute: false });
        } catch (error) {
          await setProductionStatus("failed", {
            url: promoteBaseUrl,
            healthUrl: promoteUpstream,
            metadata: {
              production: true,
              stage: "rollback",
              error: error instanceof Error ? error.message : String(error),
            },
          });
          await recordProductionHealth("unhealthy", promoteUpstream);

          if (inputData.preview?.host && nextState.promotePreviousUpstream) {
            try {
              await toolRouter.execute({
                input: {
                  action: "register",
                  host: inputData.preview.host,
                  upstream: nextState.promotePreviousUpstream,
                  tls: inputData.preview.tls,
                  authz: deployAuthz,
                },
              });
              nextState.previewRegistered = true;
              nextState.previewRouteRemoved = false;
              await writer?.write({
                type: "notice",
                message: "preview_router_restored",
                host: inputData.preview.host,
              });
              await setPreviewStatus("preview", {
                url: previewBaseUrl,
                metadata: {
                  preview: true,
                  restored: true,
                },
              });
            } catch (restoreError) {
              await writer?.write({
                type: "notice",
                message: "preview_router_restore_failed",
                host: inputData.preview.host,
                error: restoreError instanceof Error ? restoreError.message : String(restoreError),
              });
            }
          }

          throw error;
        }
      }

      if (!nextState.cleaned) {
        await cleanupPreview({ allowPrompt: false });
        if (createdWorktrees.size > 0) {
          await writer?.write({ type: "progress", pct: 95, message: "cleanup_start" });
          await cleanupWorktrees({
            cw,
            authz: inputData.authz,
            worktrees: Array.from(createdWorktrees),
            writer,
          });
        }
        nextState.cleaned = true;
        setState(nextState);
      }
    } catch (error) {
      plan.status = "failed";
      plan.completed = new Date();
      await writer?.write({
        type: "notice",
        message: "workflow_failed",
        error: error instanceof Error ? error.message : String(error),
      });

      if (hasLinearSession && !nextState.activityErrored) {
        await sendLinearActivity("error", {
          body: `Workflow failed: ${error instanceof Error ? error.message : String(error)}`,
        });
        nextState.activityErrored = true;
        setState(nextState);
      }

      if (nextState.cleaned !== true) {
        await cleanupPreview({ allowPrompt: false });
        await cleanupWorktrees({
          cw,
          authz: inputData.authz,
          worktrees: Array.from(createdWorktrees),
          writer,
        });
      }

      nextState.results = results.length > 0 ? [...results] : nextState.results;
      setState(nextState);
      throw error;
    }

    plan.status = "completed";
    plan.completed = new Date();

    await writer?.write({ type: "progress", pct: 100, message: "workflow_completed" });

    const summary = `Completed plan ${plan.id} with ${results.length} task(s).`;

    if (hasLinearSession && !nextState.activitySummaryLogged) {
      const { completedCount, failedCount } = summaryFromResults();
      await sendLinearActivity("response", {
        body: [`Plan ${plan.id} completed.`, `Tasks completed: ${completedCount}`, `Tasks failed: ${failedCount}`].join(
          "\n",
        ),
      });
      nextState.activitySummaryLogged = true;
      setState(nextState);
    }

    return {
      summary,
      results,
      plan,
      vcs,
      ticketId: nextState.ticketId,
      ticketUrl: nextState.ticketUrl,
    };
  },
});

export const planWorkflow = createWorkflow({
  id: "plan",
  description: "Secure SWE orchestrator workflow with git, router, and ticket integrations.",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(orchestratorStep)
  .commit();
