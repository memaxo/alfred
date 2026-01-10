import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  __internals,
  ensureServer,
  resolveExecProfile,
  stopAllServers,
  stopServer,
} from "./server.js";

describe("tool/shared/server registry", () => {
  beforeEach(() => {
    __internals.reset();
  });

  it("starts once per key and reuses the handle", async () => {
    const stop = mock(() => {});
    let starts = 0;

    const start = async () => {
      starts += 1;
      return { stop };
    };

    const a = await ensureServer({ key: "k1", start });
    const b = await ensureServer({ key: "k1", start });

    expect(a).toBe(b);
    expect(starts).toBe(1);
    expect(__internals.size()).toBe(1);
  });

  it("restarts when unhealthy and stops the old handle", async () => {
    const stop1 = mock(() => {});
    const stop2 = mock(() => {});
    let starts = 0;

    const start = async () => {
      starts += 1;
      return starts === 1 ? { stop: stop1 } : { stop: stop2 };
    };

    const first = await ensureServer({ key: "k2", start });
    const second = await ensureServer({
      key: "k2",
      start,
      healthy: () => false,
    });

    expect(first).not.toBe(second);
    expect(starts).toBe(2);
    expect(stop1).toHaveBeenCalledTimes(1);
    expect(stop2).toHaveBeenCalledTimes(0);
  });

  it("stopServer stops the running handle", async () => {
    const stop = mock(() => {});
    await ensureServer({
      key: "k3",
      start: async () => ({ stop }),
    });

    await stopServer("k3");
    expect(stop).toHaveBeenCalledTimes(1);
    expect(__internals.size()).toBe(0);
  });

  it("stopAllServers stops everything and clears the registry", async () => {
    const stopA = mock(() => {});
    const stopB = mock(() => {});

    await ensureServer({ key: "k4:a", start: async () => ({ stop: stopA }) });
    await ensureServer({ key: "k4:b", start: async () => ({ stop: stopB }) });

    await stopAllServers("test");

    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).toHaveBeenCalledTimes(1);
    expect(__internals.size()).toBe(0);
  });
});

describe("tool/shared/server resolveExecProfile", () => {
  it("defaults to server inside AgentFS container when unset", () => {
    expect(resolveExecProfile(undefined, "alfred-agentfs-123")).toBe("server");
  });

  it("defaults to default outside AgentFS containers when unset", () => {
    expect(resolveExecProfile(undefined, undefined)).toBe("default");
    expect(resolveExecProfile(undefined, "container-123")).toBe("default");
  });

  it("respects explicit profiles regardless of container name", () => {
    expect(resolveExecProfile("default", "alfred-agentfs-123")).toBe("default");
    expect(resolveExecProfile("server", undefined)).toBe("server");
  });
});
