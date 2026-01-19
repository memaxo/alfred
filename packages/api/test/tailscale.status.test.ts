import { beforeEach, describe, expect, it, vi } from "bun:test";
import {
  probeTailscaleStatus,
  resetTailscaleProbeCacheForTest,
} from "../src/tailscale/status";

function streamFromText(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

type SpawnResult = Bun.Subprocess & {
  kill: () => void;
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  exited: Promise<number>;
};

function makeProc(opts: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}): SpawnResult {
  return {
    kill: () => {},
    stdout: streamFromText(opts.stdout ?? ""),
    stderr: streamFromText(opts.stderr ?? ""),
    exited: Promise.resolve(opts.exitCode ?? 0),
  } as unknown as SpawnResult;
}

function makeProcDelayed(opts: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  delayMs: number;
}): SpawnResult {
  return {
    kill: () => {},
    stdout: streamFromText(opts.stdout ?? ""),
    stderr: streamFromText(opts.stderr ?? ""),
    exited: new Promise<number>((resolve) => {
      setTimeout(() => resolve(opts.exitCode ?? 0), opts.delayMs);
    }),
  } as unknown as SpawnResult;
}

describe("tailscale.status", () => {
  const bunAny = Bun as unknown as {
    spawn: (args: string[], opts: unknown) => unknown;
  };
  let spawnMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetTailscaleProbeCacheForTest();
    spawnMock = vi.fn();
    bunAny.spawn = spawnMock as unknown as typeof bunAny.spawn;
  });

  it("returns installed=false when tailscale version fails", async () => {
    spawnMock.mockReturnValueOnce(makeProc({ exitCode: 1, stderr: "nope" }));
    const res = await probeTailscaleStatus({ noCache: true });
    expect(res).toMatchObject({ ok: false, installed: false });
  });

  it("returns tailscale_not_found when spawn error indicates missing binary", async () => {
    spawnMock.mockImplementationOnce(() => {
      throw new Error("No such file or directory");
    });
    const res = await probeTailscaleStatus({ noCache: true });
    expect(res).toMatchObject({
      ok: false,
      installed: false,
      error: "tailscale_not_found",
    });
  });

  it("returns installed=true ok=true when status json parses", async () => {
    spawnMock
      // version
      .mockReturnValueOnce(makeProc({ exitCode: 0, stdout: "1.0.0" }))
      // status
      .mockReturnValueOnce(
        makeProc({
          exitCode: 0,
          stdout: JSON.stringify({
            BackendState: "Running",
            Self: { DNSName: "alfred.example.ts.net", HostName: "alfred" },
            CurrentTailnet: { Name: "example" },
          }),
        })
      );

    const res = await probeTailscaleStatus({ noCache: true });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.installed).toBe(true);
      expect(res.running).toBe(true);
      expect(res.tailnet).toBe("example");
      expect(res.self?.dnsName).toBe("alfred.example.ts.net");
    }
  });

  it("returns installed=true ok=false when status output is not json", async () => {
    spawnMock
      .mockReturnValueOnce(makeProc({ exitCode: 0, stdout: "1.0.0" }))
      .mockReturnValueOnce(makeProc({ exitCode: 0, stdout: "not json" }));

    const res = await probeTailscaleStatus({ noCache: true });
    expect(res).toMatchObject({ ok: false, installed: true });
  });

  it("returns tailscale_status_timeout when status exceeds timeoutMs", async () => {
    spawnMock
      .mockReturnValueOnce(makeProc({ exitCode: 0, stdout: "1.0.0" }))
      .mockReturnValueOnce(
        makeProcDelayed({
          exitCode: 0,
          stdout: JSON.stringify({ BackendState: "Running" }),
          delayMs: 5,
        })
      );

    const res = await probeTailscaleStatus({ noCache: true, timeoutMs: 1 });
    expect(res).toMatchObject({
      ok: false,
      installed: true,
      error: "tailscale_status_timeout",
    });
  });

  it("caches results for cacheMs window", async () => {
    spawnMock
      .mockReturnValueOnce(makeProc({ exitCode: 0, stdout: "1.0.0" }))
      .mockReturnValueOnce(
        makeProc({
          exitCode: 0,
          stdout: JSON.stringify({ BackendState: "Running" }),
        })
      );

    const a = await probeTailscaleStatus({ cacheMs: 10_000 });
    const b = await probeTailscaleStatus({ cacheMs: 10_000 });
    expect(a).toEqual(b);
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });
});
