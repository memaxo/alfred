import { toolDocker } from "@alfred/agent/orchestrator/tool/docker";
import { TRPCError } from "@trpc/server";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Container {
  id: string;
  name: string;
  image: string;
  status: "running" | "paused" | "exited";
  ports: string[];
  created: string;
  isAgentWorkspace: boolean;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
}

export interface ContainerStats {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
}

export interface ContainerInspect {
  networks: string[];
  mounts: {
    type: "bind" | "volume" | "tmpfs" | "npipe" | "cluster" | "unknown";
    source: string;
    destination: string;
    rw: boolean;
    name?: string;
  }[];
}

export interface Network {
  id: string;
  name: string;
  driver: string;
  scope: string;
}

export interface Volume {
  name: string;
  driver: string;
}

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Container List
// ─────────────────────────────────────────────────────────────────────────────

export async function listContainers(
  filter: "all" | "running" | "agent"
): Promise<Container[]> {
  try {
    const args =
      filter === "all"
        ? ["ps", "-a", "--no-trunc", "--format", "{{json .}}"]
        : ["ps", "--no-trunc", "--format", "{{json .}}"];

    const proc = Bun.spawn(["docker", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    const containers = output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          const raw = JSON.parse(line) as {
            ID: string;
            Names: string;
            Image: string;
            Status: string;
            Ports: string;
            CreatedAt: string;
          };

          const isRunning = raw.Status.toLowerCase().startsWith("up");
          const isPaused = raw.Status.toLowerCase().includes("paused");
          const isAgent =
            raw.Names.includes("alfred-agentfs") ||
            raw.Image.includes("alfred");

          // Skip non-agent containers if filter is agent
          if (filter === "agent" && !isAgent) {
            return null;
          }

          return {
            id: raw.ID,
            name: raw.Names,
            image: raw.Image,
            status: isPaused ? "paused" : isRunning ? "running" : "exited",
            ports: raw.Ports ? raw.Ports.split(", ").filter(Boolean) : [],
            created: raw.CreatedAt,
            isAgentWorkspace: isAgent,
            cpuPercent: 0,
            memoryUsage: 0,
            memoryLimit: 0,
          } as Container;
        } catch {
          return null;
        }
      })
      .filter((c): c is Container => c !== null);

    return containers;
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to list containers: ${(error as Error).message}`,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Container Stats
// ─────────────────────────────────────────────────────────────────────────────

export async function getContainerStats(
  containerId: string
): Promise<ContainerStats> {
  try {
    const proc = Bun.spawn(
      ["docker", "stats", containerId, "--no-stream", "--format", "{{json .}}"],
      { stdout: "pipe", stderr: "pipe" }
    );

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    const stats = JSON.parse(output.trim()) as {
      CPUPerc: string;
      MemUsage: string;
      MemPerc: string;
    };

    const cpuPercent = Number.parseFloat(
      stats.CPUPerc?.replace("%", "") ?? "0"
    );

    const memParts = stats.MemUsage?.split(" / ") ?? [];
    const memoryUsage = parseMemory(memParts[0] ?? "0");
    const memoryLimit = parseMemory(memParts[1] ?? "0");

    return {
      cpuPercent: Number.isNaN(cpuPercent) ? 0 : cpuPercent,
      memoryUsage,
      memoryLimit,
    };
  } catch {
    return { cpuPercent: 0, memoryUsage: 0, memoryLimit: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Container Inspect
// ─────────────────────────────────────────────────────────────────────────────

export async function getContainerInspect(
  containerId: string
): Promise<ContainerInspect> {
  try {
    const { stdout, exitCode } = await runDockerCapture([
      "inspect",
      containerId,
    ]);
    if (exitCode !== 0) {
      return { networks: [], mounts: [] };
    }

    const data = JSON.parse(stdout.trim()) as unknown;
    const first = Array.isArray(data) ? data[0] : null;
    if (!first || typeof first !== "object") {
      return { networks: [], mounts: [] };
    }

    const networks = readNetworks(first);
    const mounts = readMounts(first);
    return { networks, mounts };
  } catch {
    return { networks: [], mounts: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Container Logs
// ─────────────────────────────────────────────────────────────────────────────

export async function getContainerLogs(
  containerId: string,
  tail: number
): Promise<LogEntry[]> {
  try {
    const proc = Bun.spawn(
      ["docker", "logs", "--tail", String(tail), "--timestamps", containerId],
      { stdout: "pipe", stderr: "pipe" }
    );

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    await proc.exited;

    const logs = [...stdout.split("\n"), ...stderr.split("\n")]
      .filter(Boolean)
      .map((line) => {
        const match =
          /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/u.exec(line);
        if (match?.[1]) {
          return {
            timestamp: match[1],
            level: inferLogLevel(match[2] ?? ""),
            message: match[2] ?? "",
          };
        }
        return {
          timestamp: new Date().toISOString(),
          level: "info" as const,
          message: line,
        };
      })
      .sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return dateA.getTime() - dateB.getTime();
      });

    return logs;
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to get container logs: ${(error as Error).message}`,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Container Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function startContainer(
  containerId: string,
  authz?: string
): Promise<boolean> {
  if (!authz) {
    return (await runDockerOk(["start", containerId])) === 0;
  }
  const result = await toolDocker.execute({
    input: { action: "start", name: containerId, authz },
  });
  return result.ok;
}

export async function stopContainer(
  containerId: string,
  authz?: string
): Promise<boolean> {
  if (!authz) {
    return (await runDockerOk(["stop", containerId])) === 0;
  }
  const result = await toolDocker.execute({
    input: { action: "stop", name: containerId, authz },
  });
  return result.ok;
}

export async function removeContainer(
  containerId: string,
  authz?: string
): Promise<boolean> {
  if (!authz) {
    return (await runDockerOk(["rm", "-f", containerId])) === 0;
  }
  const result = await toolDocker.execute({
    input: { action: "rm", name: containerId, authz },
  });
  return result.ok;
}

export async function createContainer(input: {
  image: string;
  name?: string;
  ports?: { host: number; container: number }[];
  env?: Record<string, string>;
  network?: string;
  volumes?: string[];
  cmd?: string;
}): Promise<{ id: string | null }> {
  const args = buildRunArgs(input);
  const { stdout, stderr, exitCode } = await runDockerCapture(args);
  if (exitCode !== 0) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: stderr.trim() || "docker_run_failed",
    });
  }
  return { id: stdout.trim() || null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Management
// ─────────────────────────────────────────────────────────────────────────────

export async function listNetworks(): Promise<Network[]> {
  try {
    const { stdout } = await runDockerCapture([
      "network",
      "ls",
      "--format",
      "{{json .}}",
    ]);
    return parseJsonLines(stdout, (raw) => {
      const r = raw as {
        ID?: string;
        Name?: string;
        Driver?: string;
        Scope?: string;
      };
      if (!(r.ID && r.Name && r.Driver && r.Scope)) {
        return null;
      }
      return {
        id: r.ID,
        name: r.Name,
        driver: r.Driver,
        scope: r.Scope,
      } satisfies Network;
    });
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to list networks: ${(error as Error).message}`,
    });
  }
}

export async function createNetwork(input: {
  name: string;
  driver?: string;
}): Promise<{ id: string | null }> {
  const args = ["network", "create"];
  if (input.driver?.trim()) {
    args.push("--driver", input.driver.trim());
  }
  args.push(input.name);
  const { stdout, stderr, exitCode } = await runDockerCapture(args);
  if (exitCode !== 0) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: stderr.trim() || "docker_network_create_failed",
    });
  }
  return { id: stdout.trim() || null };
}

export async function removeNetwork(nameOrId: string): Promise<boolean> {
  return (await runDockerOk(["network", "rm", nameOrId])) === 0;
}

export async function connectNetwork(input: {
  network: string;
  container: string;
}): Promise<boolean> {
  return (
    (await runDockerOk([
      "network",
      "connect",
      input.network,
      input.container,
    ])) === 0
  );
}

export async function disconnectNetwork(input: {
  network: string;
  container: string;
  force?: boolean;
}): Promise<boolean> {
  const args = ["network", "disconnect"];
  if (input.force) {
    args.push("-f");
  }
  args.push(input.network, input.container);
  return (await runDockerOk(args)) === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume Management
// ─────────────────────────────────────────────────────────────────────────────

export async function listVolumes(): Promise<Volume[]> {
  try {
    const { stdout } = await runDockerCapture([
      "volume",
      "ls",
      "--format",
      "{{json .}}",
    ]);
    return parseJsonLines(stdout, (raw) => {
      const r = raw as { Name?: string; Driver?: string };
      if (!(r.Name && r.Driver)) {
        return null;
      }
      return { name: r.Name, driver: r.Driver } satisfies Volume;
    });
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to list volumes: ${(error as Error).message}`,
    });
  }
}

export async function createVolume(input: {
  name: string;
  driver?: string;
}): Promise<boolean> {
  const args = ["volume", "create"];
  if (input.driver?.trim()) {
    args.push("--driver", input.driver.trim());
  }
  args.push(input.name);
  return (await runDockerOk(args)) === 0;
}

export async function removeVolume(name: string): Promise<boolean> {
  return (await runDockerOk(["volume", "rm", name])) === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function parseMemory(str: string): number {
  if (!str) {
    return 0;
  }
  const num = Number.parseFloat(str);
  if (Number.isNaN(num)) {
    return 0;
  }

  if (str.includes("GiB") || str.includes("GB")) {
    return Math.round(num * 1024);
  }
  if (str.includes("MiB") || str.includes("MB")) {
    return Math.round(num);
  }
  if (str.includes("KiB") || str.includes("KB")) {
    return Math.round(num / 1024);
  }
  return Math.round(num);
}

async function runDockerCapture(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const proc = Bun.spawn(["docker", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return {
    stdout,
    stderr,
    exitCode: typeof exitCode === "number" ? exitCode : 1,
  };
}

async function runDockerOk(args: string[]): Promise<number> {
  const proc = Bun.spawn(["docker", ...args], {
    stdout: "ignore",
    stderr: "pipe",
  });
  await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return typeof exitCode === "number" ? exitCode : 1;
}

export function buildRunArgs(input: {
  image: string;
  name?: string;
  ports?: { host: number; container: number }[];
  env?: Record<string, string>;
  network?: string;
  volumes?: string[];
  cmd?: string;
}): string[] {
  const args = ["run", "-d"];

  if (input.name?.trim()) {
    args.push("--name", input.name.trim());
  }

  if (input.network?.trim()) {
    args.push("--network", input.network.trim());
  }

  for (const p of input.ports ?? []) {
    args.push("-p", `${p.host}:${p.container}`);
  }

  for (const [k, v] of Object.entries(input.env ?? {})) {
    if (!k.trim()) {
      continue;
    }
    args.push("-e", `${k}=${v}`);
  }

  for (const v of input.volumes ?? []) {
    if (v.trim()) {
      args.push("-v", v.trim());
    }
  }

  args.push(input.image);
  if (input.cmd?.trim()) {
    args.push(...splitArgs(input.cmd.trim()));
  }

  return args;
}

function splitArgs(command: string): string[] {
  const out: string[] = [];
  let buf = "";
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (!ch) {
      continue;
    }

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        buf += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\n") {
      if (buf.length > 0) {
        out.push(buf);
        buf = "";
      }
      continue;
    }

    buf += ch;
  }

  if (buf.length > 0) {
    out.push(buf);
  }
  return out;
}

function parseJsonLines<T>(
  stdout: string,
  map: (raw: unknown) => T | null
): T[] {
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return map(JSON.parse(line) as unknown);
      } catch {
        return null;
      }
    })
    .filter((x): x is T => x !== null);
}

function readNetworks(value: object): string[] {
  const v = value as {
    NetworkSettings?: { Networks?: Record<string, unknown> };
  };
  const networks = v.NetworkSettings?.Networks;
  if (!networks || typeof networks !== "object") {
    return [];
  }
  return Object.keys(networks).filter(Boolean);
}

function readMounts(value: object): ContainerInspect["mounts"] {
  const v = value as {
    Mounts?: {
      Type?: string;
      Source?: string;
      Destination?: string;
      RW?: boolean;
      Name?: string;
    }[];
  };
  const mounts = Array.isArray(v.Mounts) ? v.Mounts : [];
  return mounts
    .map((m) => {
      const type =
        m.Type === "bind" ||
        m.Type === "volume" ||
        m.Type === "tmpfs" ||
        m.Type === "npipe" ||
        m.Type === "cluster"
          ? (m.Type as ContainerInspect["mounts"][number]["type"])
          : "unknown";
      const source = typeof m.Source === "string" ? m.Source : "";
      const destination =
        typeof m.Destination === "string" ? m.Destination : "";
      if (!(source && destination)) {
        return null;
      }
      const entry: ContainerInspect["mounts"][number] = {
        type,
        source,
        destination,
        rw: m.RW === true,
      };
      if (typeof m.Name === "string") {
        entry.name = m.Name;
      }
      return entry;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

function inferLogLevel(message: string): "debug" | "info" | "warn" | "error" {
  const lower = message.toLowerCase();
  if (
    lower.includes("error") ||
    lower.includes("fatal") ||
    lower.includes("panic")
  ) {
    return "error";
  }
  if (lower.includes("warn") || lower.includes("warning")) {
    return "warn";
  }
  if (lower.includes("debug") || lower.includes("trace")) {
    return "debug";
  }
  return "info";
}
