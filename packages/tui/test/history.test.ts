import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

describe("chat preferences", () => {
  const baseDir = path.join(process.cwd(), ".tmp");
  let tmpHome = "";
  let prevHome: string | undefined;

  beforeEach(async () => {
    prevHome = process.env.HOME;
    await mkdir(baseDir, { recursive: true });
    tmpHome = await mkdtemp(path.join(baseDir, "tui-"));
    process.env.HOME = tmpHome;
  });

  afterEach(async () => {
    process.env.HOME = prevHome;
    if (tmpHome) {
      await rm(tmpHome, { recursive: true, force: true });
    }
  });

  test("saves and loads chat preferences", async () => {
    const { loadChatPreferences, saveChatPreferences } =
      await import("../src/tui/api/history");

    await saveChatPreferences({ selectedModelId: "mlx-test" });
    const prefs = await loadChatPreferences();
    expect(prefs?.selectedModelId).toBe("mlx-test");
  });
});
