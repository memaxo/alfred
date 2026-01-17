import { existsSync } from "node:fs";

const name = "alfred-agentfs-hardened-test-spawn";
const testDir = ".agent/test-workspaces/agentfs-hardened-test-spawn";
const agentfsDir = `${testDir}/.agentfs/hardened-test-spawn`;

// Create directories
if (!existsSync(testDir)) {
  const { mkdirSync } = await import("node:fs");
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
];
const _proc = Bun.spawnSync(cmd, {
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

const _dec = new TextDecoder();

const _ps = Bun.spawnSync(
  [
    "/usr/local/bin/docker",
    "ps",
    "-a",
    "--filter",
    `name=${name}`,
    "--format",
    "{{.ID}}",
  ],
  { stdout: "pipe" }
);
