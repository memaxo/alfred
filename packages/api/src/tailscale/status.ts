import { logger } from "@alfred/logger";

export type TailscaleProbe =
  | {
      ok: true;
      installed: true;
      running: boolean;
      self?: { dnsName?: string; hostName?: string; nodeId?: string };
      tailnet?: string;
    }
  | { ok: false; installed: false; error: string }
  | { ok: false; installed: true; error: string };

type StatusJson = {
  BackendState?: string;
  Self?: {
    DNSName?: string;
    HostName?: string;
    ID?: string;
  };
  CurrentTailnet?: { Name?: string } | string;
};

async function runCapture(
  args: string[],
  timeoutMs: number
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}> {
  const proc = Bun.spawn(["tailscale", ...args], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    try {
      proc.kill();
    } catch {
      // ignore
    }
  }, timeoutMs);

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return {
      stdout,
      stderr,
      exitCode: typeof exitCode === "number" ? exitCode : 1,
      timedOut,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function tailnetName(value: StatusJson["CurrentTailnet"]): string | undefined {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && typeof value.Name === "string") {
    return value.Name;
  }
  return;
}

let cached: { at: number; value: TailscaleProbe } | null = null;
let inFlight: Promise<TailscaleProbe> | null = null;

export function resetTailscaleProbeCacheForTest(): void {
  cached = null;
  inFlight = null;
}

async function probeOnce(timeoutMs: number): Promise<TailscaleProbe> {
  // Fast "is installed" probe.
  try {
    const version = await runCapture(["version"], 800);
    if (version.timedOut) {
      return {
        ok: false,
        installed: false,
        error: "tailscale_version_timeout",
      };
    }
    if (version.exitCode !== 0) {
      return {
        ok: false,
        installed: false,
        error: "tailscale_version_failed",
      };
    }
  } catch (error) {
    return {
      ok: false,
      installed: false,
      error:
        error instanceof Error
          ? error.message.toLowerCase().includes("no such file") ||
            error.message.toLowerCase().includes("not found")
            ? "tailscale_not_found"
            : `tailscale_spawn_failed:${error.message}`
          : "tailscale_spawn_failed",
    };
  }

  // Runtime probe.
  try {
    const res = await runCapture(["status", "--json"], timeoutMs);
    if (res.timedOut) {
      return { ok: false, installed: true, error: "tailscale_status_timeout" };
    }
    if (res.exitCode !== 0) {
      logger.debug("tailscale_status_nonzero", {
        exitCode: res.exitCode,
        stderr: res.stderr.slice(0, 2000),
      });
      return {
        ok: false,
        installed: true,
        error: "tailscale_status_failed",
      };
    }

    let parsed: StatusJson | null = null;
    try {
      parsed = JSON.parse(res.stdout) as StatusJson;
    } catch {
      return {
        ok: false,
        installed: true,
        error: "tailscale_status_parse_failed",
      };
    }

    const backend =
      typeof parsed?.BackendState === "string" ? parsed.BackendState : "";
    const running = backend.toLowerCase() === "running";
    const self = parsed?.Self;

    return {
      ok: true,
      installed: true,
      running,
      self: {
        dnsName: typeof self?.DNSName === "string" ? self.DNSName : undefined,
        hostName:
          typeof self?.HostName === "string" ? self.HostName : undefined,
        nodeId: typeof self?.ID === "string" ? self.ID : undefined,
      },
      tailnet: tailnetName(parsed?.CurrentTailnet),
    };
  } catch (error) {
    return {
      ok: false,
      installed: true,
      error:
        error instanceof Error
          ? `tailscale_status_error:${error.message}`
          : "tailscale_status_error",
    };
  }
}

export function probeTailscaleStatus(opts?: {
  timeoutMs?: number;
  cacheMs?: number;
  noCache?: boolean;
}): Promise<TailscaleProbe> {
  const timeoutMs = opts?.timeoutMs ?? 1500;
  const cacheMs = opts?.cacheMs ?? 3000;

  if (opts?.noCache) {
    return probeOnce(timeoutMs);
  }

  const now = Date.now();
  if (cached && now - cached.at <= cacheMs) {
    return cached.value;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const res = await probeOnce(timeoutMs);
      cached = { at: Date.now(), value: res };
      return res;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
