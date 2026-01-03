import { toolDocker } from "@alfred/agent/orchestrator/tool/docker";
import { TRPCError } from "@trpc/server";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Container = {
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
};

export type ContainerStats = {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
};

export type LogEntry = {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Container List
// ─────────────────────────────────────────────────────────────────────────────

export async function listContainers(
  filter: "all" | "running" | "agent"
): Promise<Container[]> {
  try {
    const args =
      filter === "all"
        ? ["ps", "-a", "--format", "{{json .}}"]
        : ["ps", "--format", "{{json .}}"];

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
        if (match && match[1]) {
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
  const result = await toolDocker.execute({
    input: {
      action: "start",
      name: containerId,
      authz,
    },
  });
  return result.ok;
}

export async function stopContainer(
  containerId: string,
  authz?: string
): Promise<boolean> {
  const result = await toolDocker.execute({
    input: {
      action: "stop",
      name: containerId,
      authz,
    },
  });
  return result.ok;
}

export async function removeContainer(
  containerId: string,
  authz?: string
): Promise<boolean> {
  const result = await toolDocker.execute({
    input: {
      action: "rm",
      name: containerId,
      authz,
    },
  });
  return result.ok;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function parseMemory(str: string): number {
  if (!str) return 0;
  const num = Number.parseFloat(str);
  if (Number.isNaN(num)) return 0;

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
