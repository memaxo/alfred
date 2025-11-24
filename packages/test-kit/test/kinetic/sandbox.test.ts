import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { DockerSandbox } from "../../src/kinetic/sandbox";

// Set a longer timeout for Docker operations
describe("DockerSandbox (Kinetic Layer)", () => {
  let sandbox: DockerSandbox;

  beforeAll(async () => {
    // Increase timeout for container startup
    sandbox = new DockerSandbox();
    await sandbox.start();
  });

  afterAll(async () => {
    await sandbox.stop();
  });

  it("executes commands", async () => {
    const res = await sandbox.exec(["echo", "hello"]);
    expect(res.exitCode).toBe(0);
    expect(res.output).toContain("hello");
  }, 30_000); // 30s timeout for execution

  it("writes and reads files", async () => {
    await sandbox.writeFile("/tmp/test.txt", "content");
    const content = await sandbox.readFile("/tmp/test.txt");
    expect(content.trim()).toBe("content");
  }, 30_000);
});
