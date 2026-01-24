import { expect, mock, test } from "bun:test";

import { type ProxmoxError, proxmox } from "./proxmox";

const mockBase = "https://pve.local:8006/api2/json";
const mockTokenId = "user@pam!token";
const mockTokenSecret = "secret";

test("lxcCreate sends correct request", async () => {
  const fetchMock = mock((url: string, init?: RequestInit) => {
    expect(url).toBe(`${mockBase}/nodes/pve/lxc`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: `PVEAPIToken=${mockTokenId}=${mockTokenSecret}`,
    });
    const body = JSON.parse((init?.body as string) ?? "{}");
    expect(body.vmid).toBe(100);
    expect(body.hostname).toBe("test");
    return Promise.resolve(
      new Response(JSON.stringify({ data: { upid: "UPID:test" } }), {
        status: 200,
      })
    );
  });
  // @ts-expect-error override in tests
  globalThis.fetch = fetchMock as typeof globalThis.fetch;

  const client = new proxmox({
    base: mockBase,
    tokenId: mockTokenId,
    tokenSecret: mockTokenSecret,
  });
  const result = await client.lxcCreate("pve", {
    vmid: 100,
    hostname: "test",
    ostemplate: "local:vztmpl/debian.tar.gz",
    rootfs: "local:8",
  });

  expect(result.upid).toBe("UPID:test");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("lxcStart sends correct request", async () => {
  const fetchMock = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: { upid: "UPID:start" } }), {
        status: 200,
      })
    )
  );
  // @ts-expect-error override in tests
  globalThis.fetch = fetchMock as typeof globalThis.fetch;

  const client = new proxmox({
    base: mockBase,
    tokenId: mockTokenId,
    tokenSecret: mockTokenSecret,
  });
  const result = await client.lxcStart("pve", 100);

  expect(result.upid).toBe("UPID:start");
});

test("lxcStatus returns parsed status", async () => {
  const fetchMock = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: { status: "running", pid: 1234 } }), {
        status: 200,
      })
    )
  );
  // @ts-expect-error override in tests
  globalThis.fetch = fetchMock as typeof globalThis.fetch;

  const client = new proxmox({
    base: mockBase,
    tokenId: mockTokenId,
    tokenSecret: mockTokenSecret,
  });
  const result = await client.lxcStatus("pve", 100);

  expect(result.status).toBe("running");
  expect(result.pid).toBe(1234);
});

test("vmPower validates action enum", async () => {
  const fetchMock = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: { upid: "UPID:power" } }), {
        status: 200,
      })
    )
  );
  // @ts-expect-error override in tests
  globalThis.fetch = fetchMock as typeof globalThis.fetch;

  const client = new proxmox({
    base: mockBase,
    tokenId: mockTokenId,
    tokenSecret: mockTokenSecret,
  });
  const result = await client.vmPower("pve", 100, "start");

  expect(result.upid).toBe("UPID:power");
});

test("taskWait polls until stopped", async () => {
  let callCount = 0;
  const fetchMock = mock(() => {
    callCount++;
    if (callCount < 3) {
      return Promise.resolve(
        new Response(JSON.stringify({ data: { status: "running" } }), {
          status: 200,
        })
      );
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({ data: { status: "stopped", exitstatus: "OK" } }),
        { status: 200 }
      )
    );
  });
  // @ts-expect-error override in tests
  globalThis.fetch = fetchMock as typeof globalThis.fetch;

  const client = new proxmox({
    base: mockBase,
    tokenId: mockTokenId,
    tokenSecret: mockTokenSecret,
  });
  const result = await client.taskWait("pve", "UPID:test", { intervalMs: 10 });

  expect(result.exitstatus).toBe("OK");
  expect(callCount).toBe(3);
});

test("taskWait times out", async () => {
  const fetchMock = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: { status: "running" } }), {
        status: 200,
      })
    )
  );
  // @ts-expect-error override in tests
  globalThis.fetch = fetchMock as typeof globalThis.fetch;

  const client = new proxmox({
    base: mockBase,
    tokenId: mockTokenId,
    tokenSecret: mockTokenSecret,
  });

  try {
    await client.taskWait("pve", "UPID:test", {
      timeoutMs: 50,
      intervalMs: 10,
    });
    expect(false).toBe(true);
  } catch (err) {
    const pveErr = err as ProxmoxError;
    expect(pveErr.kind).toBe("timeout");
  }
});

test("401 error maps to auth error", async () => {
  const fetchMock = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({}), {
        status: 401,
        statusText: "Unauthorized",
      })
    )
  );
  // @ts-expect-error override in tests
  globalThis.fetch = fetchMock as typeof globalThis.fetch;

  const client = new proxmox({
    base: mockBase,
    tokenId: mockTokenId,
    tokenSecret: mockTokenSecret,
  });

  try {
    await client.lxcStatus("pve", 100);
    expect(false).toBe(true);
  } catch (err) {
    const pveErr = err as ProxmoxError;
    expect(pveErr.kind).toBe("auth");
    expect(pveErr.status).toBe(401);
  }
});

test("404 error maps to notfound error", async () => {
  const fetchMock = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({}), { status: 404, statusText: "Not Found" })
    )
  );
  // @ts-expect-error override in tests
  globalThis.fetch = fetchMock as typeof globalThis.fetch;

  const client = new proxmox({
    base: mockBase,
    tokenId: mockTokenId,
    tokenSecret: mockTokenSecret,
  });

  try {
    await client.lxcStatus("pve", 999);
    expect(false).toBe(true);
  } catch (err) {
    const pveErr = err as ProxmoxError;
    expect(pveErr.kind).toBe("notfound");
  }
});

test("500 error maps to server error", async () => {
  const fetchMock = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({}), {
        status: 500,
        statusText: "Internal Server Error",
      })
    )
  );
  // @ts-expect-error override in tests
  globalThis.fetch = fetchMock as typeof globalThis.fetch;

  const client = new proxmox({
    base: mockBase,
    tokenId: mockTokenId,
    tokenSecret: mockTokenSecret,
  });

  try {
    await client.lxcStatus("pve", 100);
    expect(false).toBe(true);
  } catch (err) {
    const pveErr = err as ProxmoxError;
    expect(pveErr.kind).toBe("server");
    expect(pveErr.status).toBe(500);
  }
});

test("timeout abort triggers timeout error", async () => {
  const fetchMock = mock(
    () =>
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("TimeoutError")), 10);
      })
  );
  // @ts-expect-error override in tests
  globalThis.fetch = fetchMock as typeof globalThis.fetch;

  const client = new proxmox({
    base: mockBase,
    tokenId: mockTokenId,
    tokenSecret: mockTokenSecret,
    timeoutMs: 5,
  });

  try {
    await client.lxcStatus("pve", 100);
    expect(false).toBe(true);
  } catch (err) {
    const pveErr = err as ProxmoxError;
    expect(pveErr.kind).toBe("timeout");
  }
});
