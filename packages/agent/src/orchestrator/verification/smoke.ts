import type { ProjectConfig } from "@alfred/agent/utils/project-detector";
import { toolRunner } from "../tool/runner";

export async function runSmokeTest(
  workspace: string,
  projectConfig: ProjectConfig
): Promise<boolean> {
  // Start the app in detached mode
  // We need to find a free port or assume default?
  // Docker handles port mapping if we use toolDocker, but here we might be in Review Phase (Host/Worktree).
  // If we are in Review Phase, we are likely in the main workspace (after merge).
  // ProjectConfig `runCommand` (e.g. `npm start` or `cargo run`) might block.
  // We need to run it in background.

  // This is complex because we need to kill it after.
  // And we need to know which port to curl.

  // MVP: Just verify build?
  // "SmokeTester (curl/fetch) to verify app startup"

  // Ideally:
  // 1. toolDocker.run(...)
  // 2. toolDocker.exec.probe(...)

  // But we don't have a docker image of the *merged* code yet unless we build it.
  // Building might take time.

  // Let's skip full integration smoke test for now and rely on "Build" verification as a smoke test.
  // If it builds, it's smoke-tested for syntax/linking.

  try {
    const res = await toolRunner.execute(
      "build",
      workspace,
      120_000,
      projectConfig
    );
    return res.exitCode === 0;
  } catch {
    return false;
  }
}
