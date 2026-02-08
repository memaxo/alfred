import { logger } from "@alfred/logger";
import * as fs from "node:fs/promises";

import type { Workspace } from "../../environment/types";
import type { ProjectConfig } from "../../utils/project-detector";

import { openDirectorySecure } from "../../security/filesystem.js";
import { toolCodex } from "../tool/codex/index";
import { toolRunner } from "../tool/runner";

export interface TDDContext {
  agentId: string;
  sessionId: string;
  workingDirectory: string;
  execPlanPath: string;
  requirement: string;
  auto: "low" | "medium" | "high";
  containerName: string;
  containerCw: string;
  model?: string;
  authz?: string;
  signal?: AbortSignal;
  agentfsDbPath?: string;
  context?: Record<string, unknown>;
  userId?: string;
}

export async function runTDDLoop(
  context: TDDContext,
  projectConfig: ProjectConfig,
  workspaceEnv?: Workspace,
  writer?: { write: (chunk: unknown) => Promise<void> }
): Promise<void> {
  // void WorkflowEvent;
  const {
    agentId,
    sessionId,
    workingDirectory,
    execPlanPath,
    requirement,
    auto,
    containerName,
    containerCw,
    model,
    authz,
    signal,
    agentfsDbPath,
  } = context;

  const cwdHandle = openDirectorySecure(workingDirectory);
  const resolvedWorkingDirectory = cwdHandle.path;
  try {
    const tddPlanPath = execPlanPath.replace(".md", ".tdd.md");

    // Create TDD plan
    await fs.writeFile(
      tddPlanPath,
      `# TDD Plan for ${agentId}\n\nGoal: Write a failing reproduction test for the following requirement:\n\n${requirement}`,
      "utf8"
    );

    const tddPrompt = [
      "You are a Test Engineer (TDD).",
      `ExecPlan path: ${tddPlanPath}`,
      "Goal: Write a REPRODUCTION TEST case that fails for the current requirement.",
      "1. Analyze the requirement.",
      "2. Create a new test file (e.g. in tests/ or __tests__) that asserts the desired behavior.",
      "3. Do NOT implement the feature yet. The test MUST FAIL.",
    ].join("\n");

    // Run TDD Agent
    await toolCodex.execute({
      input: {
        action: "exec",
        prompt: tddPrompt,
        out: "text",
        auto,
        cw: resolvedWorkingDirectory,
        sessionId: `${sessionId}:tdd`, // Separate session
        agentfsDbPath,
        containerName,
        containerCw,
        model,
        authz,
        context: context.context,
        userId: context.userId,
      },
      writer,
      signal,
    });

    // Verify Test Fails
    let testExitCode: number;

    if (workspaceEnv) {
      const res = await workspaceEnv.exec("test", {}, projectConfig);
      testExitCode = res.exitCode;
    } else {
      const res = await toolRunner.execute(
        "test",
        cwdHandle,
        60_000,
        projectConfig
      );
      testExitCode = res.exitCode;
    }

    if (testExitCode === 0) {
      // Test passed unexpectedly!
      logger.warn("tdd_test_passed_unexpectedly", {
        agentId,
      });
      if (writer) {
        await writer.write({
          type: "notice",
          message: "tdd_warning_test_passed_already",
        });
      }
    } else if (writer) {
      await writer.write({
        type: "notice",
        message: "tdd_failure_verified",
      });
    }
  } finally {
    cwdHandle.close();
  }
}
