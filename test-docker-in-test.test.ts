import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";

describe("Docker spawnSync test", () => {
  it("should create container", () => {
    const name = `alfred-agentfs-hardened-test-${Date.now().toString(36)}`;
    const testDir = ".agent/test-workspaces/agentfs-hardened-test-in-test";
    const agentfsDir = `${testDir}/.agentfs/hardened-test-in-test`;

    // Create directories
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
      mkdirSync(agentfsDir, { recursive: true });
    }

    const cmd = [
      "/usr/local/bin/docker",
      "run",
      "-d",
      "--name",
      name,
      "--restart",
      "unless-stopped",
      "-P",
      "-v",
      `${process.cwd()}/${testDir}:/workspace.base:ro`,
      "-v",
      `${process.cwd()}/${agentfsDir}:/agentfs`,
      "--device",
      "/dev/fuse",
      "--cap-add",
      "SYS_ADMIN",
      "--cpus",
      "1",
      "--memory",
      "1g",
      "alfred-agentfs:codex",
      "sh",
      "-lc",
      "sleep 10", // Keep container running
    ];

    console.log("Running command:", cmd.join(" "));
    const proc = Bun.spawnSync(cmd, {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
      env: {
        ...process.env,
        PATH: process.env.PATH ?? "",
        DOCKER_BUILDKIT: "0",
      },
    });

    const dec = new TextDecoder();
    console.log("exit", proc.exitCode);
    console.log(
      "stdout len",
      proc.stdout instanceof Uint8Array ? proc.stdout.length : 0
    );
    console.log(
      "stdout",
      proc.stdout instanceof Uint8Array ? dec.decode(proc.stdout) : "N/A"
    );
    console.log(
      "stderr",
      proc.stderr instanceof Uint8Array ? dec.decode(proc.stderr) : "N/A"
    );

    const ps = Bun.spawnSync(
      [
        "/usr/local/bin/docker",
        "ps",
        "-a",
        "--filter",
        `name=${name}`,
        "--format",
        "{{.ID}}",
      ],
      { stdout: "pipe", cwd: process.cwd() }
    );
    console.log(
      "ps output",
      ps.stdout instanceof Uint8Array ? dec.decode(ps.stdout) : "N/A"
    );

    expect(proc.exitCode).toBe(0);
    expect(
      proc.stdout instanceof Uint8Array ? proc.stdout.length : 0
    ).toBeGreaterThan(0);
  });
});
