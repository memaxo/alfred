import { z } from "zod";

export type ProxmoxCfg = {
  base: string;
  tokenId: string;
  tokenSecret: string;
  timeoutMs?: number;
};

const lxcCreateSchema = z
  .object({
    vmid: z.number(),
    hostname: z.string(),
    ostemplate: z.string(),
    rootfs: z.string(),
    cores: z.number().optional(),
    memory: z.number().optional(),
    net0: z.string().optional(),
    password: z.string().optional(),
  })
  .strict();

const lxcStatusSchema = z.enum(["running", "stopped", "paused"]);
const vmPowerSchema = z.enum([
  "start",
  "stop",
  "reset",
  "shutdown",
  "suspend",
  "resume",
]);

export type ProxmoxError =
  | { kind: "auth"; status: 401 | 403; message: string; endpoint: string }
  | { kind: "notfound"; status: 404; message: string; endpoint: string }
  | { kind: "server"; status: number; message: string; endpoint: string }
  | { kind: "timeout"; message: string; endpoint: string }
  | { kind: "network"; message: string; endpoint: string; cause?: unknown };

type UpidResponse = { upid: string };
type StatusResponse = {
  status: "running" | "stopped" | "paused";
  pid?: number;
};
type TaskResponse = { exitstatus: "OK" | string };
type PveEnvelope<T> = { data: T };

export class proxmox {
  private cfg: Required<ProxmoxCfg>;

  constructor(cfg: ProxmoxCfg) {
    this.cfg = {
      base: cfg.base,
      tokenId: cfg.tokenId,
      tokenSecret: cfg.tokenSecret,
      timeoutMs: cfg.timeoutMs ?? 15_000,
    };
  }

  lxcCreate(
    node: string,
    spec: z.infer<typeof lxcCreateSchema>
  ): Promise<UpidResponse> {
    const validated = lxcCreateSchema.parse(spec);
    return this.request<UpidResponse>("POST", `/nodes/${node}/lxc`, validated);
  }

  lxcStart(node: string, vmid: number): Promise<UpidResponse> {
    return this.request<UpidResponse>(
      "POST",
      `/nodes/${node}/lxc/${vmid}/status/start`
    );
  }

  lxcStop(node: string, vmid: number): Promise<UpidResponse> {
    return this.request<UpidResponse>(
      "POST",
      `/nodes/${node}/lxc/${vmid}/status/stop`
    );
  }

  lxcDestroy(node: string, vmid: number): Promise<UpidResponse> {
    return this.request<UpidResponse>("DELETE", `/nodes/${node}/lxc/${vmid}`);
  }

  lxcSnapshot(
    node: string,
    vmid: number,
    name: string
  ): Promise<UpidResponse> {
    return this.request<UpidResponse>(
      "POST",
      `/nodes/${node}/lxc/${vmid}/snapshot`,
      {
        snapname: name,
      }
    );
  }

  lxcRollback(
    node: string,
    vmid: number,
    name: string
  ): Promise<UpidResponse> {
    return this.request<UpidResponse>(
      "POST",
      `/nodes/${node}/lxc/${vmid}/snapshot/${name}/rollback`
    );
  }

  async lxcStatus(node: string, vmid: number): Promise<StatusResponse> {
    const resp = await this.request<StatusResponse>(
      "GET",
      `/nodes/${node}/lxc/${vmid}/status/current`
    );
    lxcStatusSchema.parse(resp.status);
    return resp;
  }

  vmPower(
    node: string,
    vmid: number,
    action: z.infer<typeof vmPowerSchema>
  ): Promise<UpidResponse> {
    vmPowerSchema.parse(action);
    return this.request<UpidResponse>(
      "POST",
      `/nodes/${node}/qemu/${vmid}/status/${action}`
    );
  }

  async vmStatus(node: string, vmid: number): Promise<StatusResponse> {
    const resp = await this.request<StatusResponse>(
      "GET",
      `/nodes/${node}/qemu/${vmid}/status/current`
    );
    lxcStatusSchema.parse(resp.status);
    return resp;
  }

  async taskWait(
    node: string,
    upid: string,
    opts?: { timeoutMs?: number; intervalMs?: number }
  ): Promise<TaskResponse> {
    const timeoutMs = opts?.timeoutMs ?? 60_000;
    const intervalMs = opts?.intervalMs ?? 1000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const task = await this.request<{ status: string; exitstatus?: string }>(
        "GET",
        `/nodes/${node}/tasks/${upid}/status`
      );

      if (task.status === "stopped") {
        return { exitstatus: task.exitstatus ?? "OK" };
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw this.makeError(
      "timeout",
      0,
      "Task timeout",
      `/nodes/${node}/tasks/${upid}/status`
    );
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
    timeoutMs?: number
  ): Promise<T> {
    const url = `${this.cfg.base}${path}`;
    const timeout = timeoutMs ?? this.cfg.timeoutMs;

    try {
      const resp = await fetch(url, {
        method,
        headers: {
          Authorization: `PVEAPIToken=${this.cfg.tokenId}=${this.cfg.tokenSecret}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeout),
      });

      if (!resp.ok) {
        throw this.makeError(
          resp.status === 401 || resp.status === 403
            ? "auth"
            : resp.status === 404
              ? "notfound"
              : "server",
          resp.status,
          resp.statusText,
          path
        );
      }

      const json = (await resp.json()) as PveEnvelope<T>;
      return json.data;
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === "TimeoutError" ||
          err.name === "AbortError" ||
          err.message.includes("Timeout"))
      ) {
        throw this.makeError("timeout", 0, "Request timeout", path);
      }
      if (err instanceof Error && err.name === "TypeError") {
        throw this.makeError("network", 0, err.message, path, err);
      }
      throw err;
    }
  }

  private makeError(
    kind: ProxmoxError["kind"],
    status: number,
    message: string,
    endpoint: string,
    cause?: unknown
  ): ProxmoxError {
    switch (kind) {
      case "auth":
        return { kind: "auth", status: status as 401 | 403, message, endpoint };
      case "notfound":
        return { kind: "notfound", status: 404, message, endpoint };
      case "timeout":
        return { kind: "timeout", message, endpoint };
      case "network":
        return { kind: "network", message, endpoint, cause };
      default:
        return { kind: "server", status, message, endpoint };
    }
  }
}
