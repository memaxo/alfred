import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";

import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

describe("integration router", () => {
  const env0 = {
    LINEAR_CLIENT_ID: process.env.LINEAR_CLIENT_ID,
    HOME_BASE_URL: process.env.HOME_BASE_URL,
    TAILSCALE_API_KEY: process.env.TAILSCALE_API_KEY,
  };

  let caller: Awaited<ReturnType<typeof createTestCaller>>;
  let unauthed: Awaited<ReturnType<typeof createUnauthedCaller>>;

  beforeAll(async () => {
    caller = await createTestCaller();
    unauthed = await createUnauthedCaller();
  });

  beforeEach(() => {
    process.env.LINEAR_CLIENT_ID = env0.LINEAR_CLIENT_ID;
    process.env.HOME_BASE_URL = env0.HOME_BASE_URL;
    process.env.TAILSCALE_API_KEY = env0.TAILSCALE_API_KEY;
  });

  afterAll(() => {
    process.env.LINEAR_CLIENT_ID = env0.LINEAR_CLIENT_ID;
    process.env.HOME_BASE_URL = env0.HOME_BASE_URL;
    process.env.TAILSCALE_API_KEY = env0.TAILSCALE_API_KEY;
  });

  it("requires authentication", async () => {
    await expect(unauthed.integration.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("reflects env configuration in list()", async () => {
    process.env.LINEAR_CLIENT_ID = undefined;
    process.env.HOME_BASE_URL = undefined;
    process.env.TAILSCALE_API_KEY = undefined;

    const none = await caller.integration.list();
    expect(none.find((i) => i.id === "linear")?.enabled).toBe(false);
    expect(none.find((i) => i.id === "homeassistant")?.enabled).toBe(false);
    // Tailscale may be installed on some hosts; just assert the shape is present.
    expect(typeof none.find((i) => i.id === "tailscale")?.enabled).toBe(
      "boolean"
    );

    process.env.LINEAR_CLIENT_ID = "x";
    process.env.HOME_BASE_URL = "http://home.local";
    process.env.TAILSCALE_API_KEY = "tskey";

    const all = await caller.integration.list();
    expect(all.find((i) => i.id === "linear")?.enabled).toBe(true);
    expect(all.find((i) => i.id === "linear")?.connected).toBe(true);
    expect(all.find((i) => i.id === "homeassistant")?.enabled).toBe(true);
    expect(all.find((i) => i.id === "tailscale")?.enabled).toBe(true);
  });

  it("validates testConnection input and returns placeholder response", async () => {
    await expect(
      caller.integration.testConnection({} as unknown as { id: string })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const result = await caller.integration.testConnection({ id: "linear" });
    expect(result).toMatchObject({
      success: false,
      message: "Connection testing not yet implemented",
    });
  });
});
