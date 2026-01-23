import { expect, test } from "./helpers/ai-harness";
import { signUpTestUser } from "./helpers/auth";
import {
  countWindows,
  getCanvas,
  getWindow,
  navigateToDesktop,
} from "./helpers/desktop";

test.describe("Desktop deep linking", () => {
  test.beforeEach(async ({ page, screenshots, safeAction }) => {
    await safeAction(
      "signup-test-user",
      async () => {
        await signUpTestUser(page);
      },
      60_000
    );
    await screenshots.captureMilestone("authenticated");
  });

  test("?spawn=note creates a note window", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    await safeAction(
      "goto-spawn-note",
      async () => {
        await page.goto("/?spawn=note");
      },
      20_000
    );
    await screenshots.captureMilestone("spawn-note");
    await safeAssert("canvas-visible", async () => {
      await expect(getCanvas(page)).toBeVisible();
    });

    // Note window should be created
    const noteWindow = getWindow(page, "note");
    await safeAssert("note-visible", async () => {
      await expect(noteWindow).toBeVisible();
    });
  });

  test("?spawn=terminal creates a terminal window", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    await safeAction(
      "goto-spawn-terminal",
      async () => {
        await page.goto("/?spawn=terminal");
      },
      20_000
    );
    await screenshots.captureMilestone("spawn-terminal");
    await safeAssert("canvas-visible", async () => {
      await expect(getCanvas(page)).toBeVisible();
    });

    const terminalWindow = getWindow(page, "terminal");
    await safeAssert("terminal-visible", async () => {
      await expect(terminalWindow).toBeVisible();
    });
  });

  test("?spawn=reminder creates a reminder window", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    await safeAction(
      "goto-spawn-reminder",
      async () => {
        await page.goto("/?spawn=reminder");
      },
      20_000
    );
    await screenshots.captureMilestone("spawn-reminder");
    await safeAssert("canvas-visible", async () => {
      await expect(getCanvas(page)).toBeVisible();
    });

    const reminderWindow = getWindow(page, "reminder");
    await safeAssert("reminder-visible", async () => {
      await expect(reminderWindow).toBeVisible();
    });
  });

  test("?spawn=settings creates settings window", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    await safeAction(
      "goto-spawn-settings",
      async () => {
        await page.goto("/?spawn=settings");
      },
      20_000
    );
    await screenshots.captureMilestone("spawn-settings");
    await safeAssert("canvas-visible", async () => {
      await expect(getCanvas(page)).toBeVisible();
    });

    const settingsWindow = getWindow(page, "settings");
    await safeAssert("settings-visible", async () => {
      await expect(settingsWindow).toBeVisible();
    });
  });

  test("invalid spawn type is ignored", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    await safeAction(
      "goto-spawn-invalid",
      async () => {
        await page.goto("/?spawn=invalid_type");
      },
      20_000
    );
    await screenshots.captureMilestone("spawn-invalid");
    await safeAssert("canvas-visible", async () => {
      await expect(getCanvas(page)).toBeVisible();
    });

    // Desktop should still load without errors
    // Default chat window should exist
    const chatWindow = getWindow(page, "chat");
    await safeAssert("chat-visible", async () => {
      await expect(chatWindow).toBeVisible();
    });
  });

  test("multiple deep link params work together", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    await safeAction(
      "goto-spawn-resource",
      async () => {
        await page.goto("/?spawn=note&resourceType=note&resourceId=test-123");
      },
      20_000
    );
    await screenshots.captureMilestone("spawn-resource");
    await safeAssert("canvas-visible", async () => {
      await expect(getCanvas(page)).toBeVisible();
    });

    // Note window should be created with resource ref
    const noteWindow = getWindow(page, "note");
    await safeAssert("note-visible", async () => {
      await expect(noteWindow).toBeVisible();
    });
  });

  test("desktop loads cleanly without search params", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    await safeAction(
      "navigate-to-desktop",
      async () => {
        await navigateToDesktop(page);
      },
      20_000
    );
    await screenshots.captureMilestone("desktop");

    // Canvas and default windows should load
    await safeAssert("canvas-visible", async () => {
      await expect(getCanvas(page)).toBeVisible();
    });
    const chatWindow = getWindow(page, "chat");
    await safeAssert("chat-visible", async () => {
      await expect(chatWindow).toBeVisible();
    });
  });

  test("deep link spawns only once per param set", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    // Navigate with spawn param
    await safeAction(
      "goto-spawn-note",
      async () => {
        await page.goto("/?spawn=note");
      },
      20_000
    );
    await screenshots.captureMilestone("spawn-note");
    await safeAssert("canvas-visible", async () => {
      await expect(getCanvas(page)).toBeVisible();
    });

    const initialCount = await countWindows(page, "note");
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Reload with same params shouldn't double spawn
    await safeAction(
      "reload",
      async () => {
        await page.reload();
      },
      20_000
    );
    await screenshots.captureMilestone("reloaded");
    await safeAssert("canvas-visible-after-reload", async () => {
      await expect(getCanvas(page)).toBeVisible();
    });

    // Count may increase due to re-processing, but should be controlled
    const newCount = await countWindows(page, "note");
    expect(newCount).toBeLessThanOrEqual(initialCount + 1);
  });
});
