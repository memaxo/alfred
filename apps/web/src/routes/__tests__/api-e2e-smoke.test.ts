import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createTestClient } from "@/test/client";
import { createTestSession } from "@/test/auth";
import {
  cleanupTestServer,
  createTestServer,
  type TestServer,
} from "@/test/server";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeE2E = hasDatabase ? describe : describe.skip;

describeE2E("API E2E harness", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(server);
  });

  it("responds to healthCheck over HTTP", async () => {
    await server.reset();
    const client = createTestClient(server, {
      session: createTestSession({ id: "e2e-user" }),
    });
    const result = await client.healthCheck.query();
    expect(result).toBe("OK");
  });
});
