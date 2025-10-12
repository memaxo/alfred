import { implementationPlanSchema, type ImplementationPlan, type ModulePlan, type Task } from "@alfred/type";
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { toolDroid } from "../tool/droid";
import { toolGit } from "../tool/git";

const workflowInputSchema = z.object({
  requirement: z.string().min(1),
  auto: z.enum(["read", "low", "medium", "high"]).default("low"),
  authz: z.string().optional(),
  cw: z.string().optional(),
  mode: z.enum(["sequential", "parallel"]).default("sequential"),
  workspace: z.string().optional(),
  repoBase: z.string().optional(),
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
});

type WorkflowOutput = z.infer<typeof workflowOutputSchema>;

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

type PreparedVCS = {
  base: { branch: string; worktree: string };
  modules: Array<{ id: string; branch: string; worktree: string }>;
};

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

async function executeModule({
  module,
  authz,
  auto,
  writer,
}: {
  module: ModulePlan;
  authz: string | undefined;
  auto: "read" | "low" | "medium" | "high";
  writer?: { write: (chunk: unknown) => Promise<void> | void };
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
      const response = await toolDroid.execute({
        input: {
          prompt: task.description,
          auto: task.auto ?? auto,
          out: "debug",
          authz,
          cw: module.worktree,
        },
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
  execute: async ({ inputData, writer }): Promise<WorkflowOutput> => {
    const cw = inputData.cw ?? process.cwd();
    const plan = buildPlan(inputData.requirement, inputData.auto, inputData.mode);
    await writer?.write({ type: "progress", pct: 5, message: "plan_generated" });

    const results: WorkflowOutput["results"] = [];
    const createdWorktrees: string[] = [];
    let vcs: PreparedVCS | undefined;

    try {
      vcs = await prepareVcs({ plan, authz: inputData.authz, repoBase: inputData.repoBase, cw, writer });
      createdWorktrees.push(vcs.base.worktree, ...vcs.modules.map(module => module.worktree));

      plan.status = "executing";
      plan.started = new Date();

      await writer?.write({ type: "progress", pct: 20, message: "execution_start" });

      const moduleList =
        inputData.mode === "parallel"
          ? plan.modules
          : plan.modules.sort((a, b) => (a.id > b.id ? 1 : -1));

      for (const module of moduleList) {
        const moduleResults = await executeModule({
          module,
          authz: inputData.authz,
          auto: inputData.auto,
          writer,
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
          const idx = createdWorktrees.indexOf(module.worktree);
          if (idx !== -1) {
            createdWorktrees.splice(idx, 1);
          }
        }
      }

      if (vcs) {
        await mergeModules({ plan, vcs, authz: inputData.authz, writer });
      }

      await writer?.write({ type: "progress", pct: 90, message: "cleanup_start" });

      if (vcs) {
        await cleanupWorktrees({
          cw,
          authz: inputData.authz,
          worktrees: createdWorktrees,
          writer,
        });
        createdWorktrees.length = 0;
      }
    } catch (error) {
      plan.status = "failed";
      plan.completed = new Date();
      await writer?.write({
        type: "notice",
        message: "workflow_failed",
        error: error instanceof Error ? error.message : String(error),
      });

      if (createdWorktrees.length > 0) {
        await cleanupWorktrees({
          cw,
          authz: inputData.authz,
          worktrees: createdWorktrees.slice(),
          writer,
        });
      }

      throw error;
    }

    await writer?.write({ type: "progress", pct: 100, message: "workflow_completed" });

    return {
      summary: `Completed plan ${plan.id} with ${results.length} task(s).`,
      results,
      plan,
      vcs,
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
