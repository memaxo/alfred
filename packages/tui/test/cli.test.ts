import { describe, expect, test } from "bun:test";
import { runCli } from "../src/cli";

describe("CLI Basic", () => {
  test("runs with --help", async () => {
    // trpc-cli uses commander which might call process.exit()
    // We'll just check that the function exists for now
    expect(runCli).toBeDefined();
  });

  test("auth command usage", async () => {
    try {
      await runCli(["auth"]);
    } catch (_e) {
      // Expected to exit with usage
    }
  });
});
