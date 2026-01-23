import * as workflowRepo from "@alfred/db/repo/workflow";

/**
 * Admin domain service
 *
 * Extracts complex system monitoring and management logic from admin router
 * to keep routers thin (validation, permissions, delegation).
 */

type ProcessInfo = {
  id: string;
  name: string;
  type: string;
  status: "running" | "idle" | "stopped";
  cpu: number;
  memory: number;
  uptime: number;
};

type NetworkConnection = {
  id: string;
  localAddress: string;
  remoteAddress: string;
  protocol: "tcp" | "udp";
  state: "established" | "listening" | "time_wait";
  process: string;
};

function parseMemoryMB(memStr: string): number {
  const match = /(\d+(?:\.\d+)?)\s*(MiB|MB|GiB|GB|KiB|KB)/i.exec(memStr);
  if (!(match?.[1] && match[2])) {
    return 0;
  }

  const value = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.includes("g")) {
    return Math.round(value * 1024);
  }
  if (unit.includes("k")) {
    return Math.round(value / 1024);
  }
  return Math.round(value);
}

function mapRunStatus(
  status: string | null | undefined
): "success" | "failure" | "cancelled" {
  if (!status) {
    return "success";
  }
  if (status === "completed" || status === "done") {
    return "success";
  }
  if (status === "failed" || status === "error") {
    return "failure";
  }
  if (status === "cancelled" || status === "aborted") {
    return "cancelled";
  }
  return "success";
}

export async function listProcesses(): Promise<{ processes: ProcessInfo[] }> {
  try {
    const proc = Bun.spawn(
      ["docker", "stats", "--no-stream", "--format", "{{json .}}"],
      { stdout: "pipe", stderr: "pipe" }
    );

    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    const containerProcesses = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          const stats = JSON.parse(line) as {
            ID?: string;
            Name?: string;
            CPUPerc?: string;
            MemUsage?: string;
          };
          return {
            id: stats.ID ?? "",
            name: stats.Name ?? "unknown",
            type: stats.Name?.includes("agent") ? "agent" : "service",
            status: "running" as const,
            cpu: Number.parseFloat(stats.CPUPerc?.replace("%", "") ?? "0"),
            memory: parseMemoryMB(stats.MemUsage ?? "0"),
            uptime: 0,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as ProcessInfo[];

    const nodeProcess: ProcessInfo = {
      id: `node-${process.pid}`,
      name: "api-server",
      type: "service",
      status: "running",
      cpu: 0,
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      uptime: Math.floor(process.uptime()),
    };

    return {
      processes: [nodeProcess, ...containerProcesses],
    };
  } catch {
    return {
      processes: [
        {
          id: `node-${process.pid}`,
          name: "api-server",
          type: "service",
          status: "running",
          cpu: 0,
          memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          uptime: Math.floor(process.uptime()),
        },
      ],
    };
  }
}

export async function listNetworkConnections(): Promise<{
  connections: NetworkConnection[];
}> {
  try {
    const proc = Bun.spawn(["lsof", "-i", "-P", "-n", "-F", "pcn"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    const lines = stdout.split("\n");
    const connections: NetworkConnection[] = [];

    let currentProcess = "";
    let currentId = 0;

    for (const line of lines) {
      if (line.startsWith("c")) {
        currentProcess = line.slice(1);
      } else if (line.startsWith("n")) {
        const addr = line.slice(1);
        if (addr.includes(":")) {
          currentId++;
          const isListening = addr.includes("*:") || addr.includes("0.0.0.0:");
          connections.push({
            id: String(currentId),
            localAddress: addr.split("->")[0] ?? addr,
            remoteAddress: addr.split("->")[1] ?? "0.0.0.0:*",
            protocol: "tcp",
            state: isListening ? "listening" : "established",
            process: currentProcess,
          });
        }
      }
    }

    return { connections: connections.slice(0, 50) };
  } catch {
    return {
      connections: [
        {
          id: "1",
          localAddress: "127.0.0.1:3000",
          remoteAddress: "0.0.0.0:*",
          protocol: "tcp",
          state: "listening",
          process: "api-server",
        },
      ],
    };
  }
}

export async function getTaskHistory(
  userId: string,
  projectId: string | undefined,
  limit: number
): Promise<{
  history: Array<{
    id: string;
    type: "agent";
    name: string;
    status: "success" | "failure" | "cancelled";
    startTime: string;
    duration: number;
    tokenUsage: undefined;
  }>;
}> {
  const runs = await workflowRepo.listRuns({
    userId,
    projectId,
    limit,
  });

  const history = runs.map((run) => {
    const runWithDates = run as {
      id: string;
      created?: Date;
      completedAt?: Date;
      requirement?: string;
      status?: string | null;
    };
    const startTime = runWithDates.created ?? new Date();
    const endTime = runWithDates.completedAt ?? new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    return {
      id: runWithDates.id,
      type: "agent" as const,
      name: runWithDates.requirement ?? `Run ${runWithDates.id.slice(0, 8)}`,
      status: mapRunStatus(runWithDates.status),
      startTime: startTime.toISOString(),
      duration: Math.round(durationMs / 1000),
      tokenUsage: undefined,
    };
  });

  return { history };
}
