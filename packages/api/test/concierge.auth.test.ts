import { beforeAll, describe, expect, it } from "bun:test";
import { createUnauthedCaller } from "./utils/trpc";

describe("concierge routers auth", () => {
  let unauthed: Awaited<ReturnType<typeof createUnauthedCaller>>;

  beforeAll(async () => {
    unauthed = await createUnauthedCaller();
  });

  it("requires authentication (focus)", async () => {
    await expect(unauthed.focus.active()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      unauthed.focus.create({ title: "x", wipLimit: 3 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(unauthed.focus.commitmentList({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("requires authentication (attention)", async () => {
    await expect(unauthed.attention.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      unauthed.attention.resolve({
        id: "00000000-0000-0000-0000-000000000000",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(unauthed.attention.subscribe()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("requires authentication (delta)", async () => {
    await expect(unauthed.delta.list({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(unauthed.delta.subscribe()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("requires authentication (notify)", async () => {
    await expect(unauthed.notify.status()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(unauthed.notify.ping({ message: "hi" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(unauthed.notify.subscribe()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

