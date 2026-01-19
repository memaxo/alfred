import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

describe("embed router", () => {
  const env0 = {
    EMBED_MODEL: process.env.EMBED_MODEL,
    EMBED_DEVICE: process.env.EMBED_DEVICE,
    EMBED_POOL_SIZE: process.env.EMBED_POOL_SIZE,
    EMBED_REQUEST_TIMEOUT_MS: process.env.EMBED_REQUEST_TIMEOUT_MS,
  };

  let caller: Awaited<ReturnType<typeof createTestCaller>>;
  let unauthed: Awaited<ReturnType<typeof createUnauthedCaller>>;

  beforeAll(async () => {
    caller = await createTestCaller();
    unauthed = await createUnauthedCaller();
  });

  beforeEach(() => {
    process.env.EMBED_MODEL = env0.EMBED_MODEL;
    process.env.EMBED_DEVICE = env0.EMBED_DEVICE;
    process.env.EMBED_POOL_SIZE = env0.EMBED_POOL_SIZE;
    process.env.EMBED_REQUEST_TIMEOUT_MS = env0.EMBED_REQUEST_TIMEOUT_MS;
  });

  afterAll(() => {
    process.env.EMBED_MODEL = env0.EMBED_MODEL;
    process.env.EMBED_DEVICE = env0.EMBED_DEVICE;
    process.env.EMBED_POOL_SIZE = env0.EMBED_POOL_SIZE;
    process.env.EMBED_REQUEST_TIMEOUT_MS = env0.EMBED_REQUEST_TIMEOUT_MS;
  });

  it("requires authentication", async () => {
    await expect(unauthed.embed.getConfig()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns defaults when env vars are unset", async () => {
    process.env.EMBED_MODEL = undefined;
    process.env.EMBED_DEVICE = undefined;
    process.env.EMBED_POOL_SIZE = undefined;
    process.env.EMBED_REQUEST_TIMEOUT_MS = undefined;

    const result = await caller.embed.getConfig();

    expect(result).toMatchObject({
      device: "auto",
      poolSize: 2,
      requestTimeout: 30_000,
    });
    expect(typeof result.modelName).toBe("string");
    expect(result.modelName.length).toBeGreaterThan(0);
  });

  it("parses numeric env vars", async () => {
    process.env.EMBED_POOL_SIZE = "7";
    process.env.EMBED_REQUEST_TIMEOUT_MS = "12345";

    const result = await caller.embed.getConfig();
    expect(result.poolSize).toBe(7);
    expect(result.requestTimeout).toBe(12_345);
  });

  it("validates setConfig input", async () => {
    const badDevice = { device: "npu" } as unknown as Parameters<
      typeof caller.embed.setConfig
    >[0];
    await expect(caller.embed.setConfig(badDevice)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    await expect(
      caller.embed.setConfig({
        poolSize: 0,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      caller.embed.setConfig({
        poolSize: 11,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const ok = await caller.embed.setConfig({ device: "cpu", poolSize: 3 });
    expect(ok.success).toBe(true);
    expect(ok.message).toBeTruthy();
  });
});
