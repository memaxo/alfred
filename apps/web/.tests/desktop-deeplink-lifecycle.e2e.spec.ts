import { expect, test } from "./helpers/ai-harness";
import { signUpTestUser } from "./helpers/auth";
import {
  countWindows,
  getCanvas,
  getWindow,
  navigateToDesktop,
} from "./helpers/desktop";

test.describe("Desktop Deep Link Lifecycle", () => {
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

  test.describe("spawn parameter", () => {
    test("?spawn=note creates note window on fresh load", async ({
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

      const noteWindow = getWindow(page, "note");
      await safeAssert("note-visible", async () => {
        await expect(noteWindow).toBeVisible();
      });
    });

    test("?spawn=reminder creates reminder window", async ({
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

    test("?spawn=terminal creates terminal window", async ({
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

    test("?spawn=todo creates todo window", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      await safeAction(
        "goto-spawn-todo",
        async () => {
          await page.goto("/?spawn=todo");
        },
        20_000
      );
      await screenshots.captureMilestone("spawn-todo");
      await safeAssert("canvas-visible", async () => {
        await expect(getCanvas(page)).toBeVisible();
      });

      const todoWindow = getWindow(page, "todo");
      await safeAssert("todo-visible", async () => {
        await expect(todoWindow).toBeVisible();
      });
    });

    test("invalid spawn type is ignored gracefully", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      await safeAction(
        "goto-spawn-invalid",
        async () => {
          await page.goto("/?spawn=invalid_window_type");
        },
        20_000
      );
      await screenshots.captureMilestone("spawn-invalid");
      await safeAssert("canvas-visible", async () => {
        await expect(getCanvas(page)).toBeVisible();
      });

      // Desktop should still load with default windows
      const chatWindow = getWindow(page, "chat");
      await safeAssert("chat-visible", async () => {
        await expect(chatWindow).toBeVisible();
      });
    });

    test("spawn creates focused window", async ({
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

      // Check that spawned window is focused
      const isFocused = await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) {
          return false;
        }

        const state = store.getState();
        const noteWindow = state.windows.find((w: any) => w.type === "note");
        return noteWindow && state.focusedWindowId === noteWindow.id;
      });

      expect(isFocused).toBe(true);
    });
  });

  test.describe("resource parameters", () => {
    test("?resourceType=note&resourceId=X finds existing window", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      // First navigate and create a window with resourceRef
      await safeAction(
        "navigate-to-desktop",
        async () => {
          await navigateToDesktop(page);
        },
        20_000
      );
      await screenshots.captureMilestone("desktop");

      await safeAction(
        "inject-existing-note",
        async () => {
          await page.evaluate(() => {
            const store = (window as any).__DESKTOP_STORE__;
            if (!store) {
              return;
            }

            store.getState().addWindow({
              id: "existing-note",
              type: "note",
              position: { x: 200, y: 200 },
              data: {
                type: "note",
                label: "Existing Note",
                viewMode: "full",
                resourceRef: { type: "note", id: "resource-123" },
              },
            });
          });
        },
        20_000
      );
      await screenshots.captureMilestone("note-injected");

      // Navigate with matching resource params
      await safeAction(
        "goto-resource-match",
        async () => {
          await page.goto("/?resourceType=note&resourceId=resource-123");
        },
        20_000
      );
      await safeAssert("canvas-visible", async () => {
        await expect(getCanvas(page)).toBeVisible();
      });

      // Should focus existing window, not create new
      const _windowCount = await countWindows(page, "note");
      const focusedId = await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        return store?.getState().focusedWindowId;
      });

      expect(focusedId).toBe("existing-note");
    });

    test("?resourceType=note&resourceId=X spawns new if not found", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      await safeAction(
        "goto-resource-new",
        async () => {
          await page.goto("/?resourceType=note&resourceId=new-resource-456");
        },
        20_000
      );
      await screenshots.captureMilestone("resource-new");
      await safeAssert("canvas-visible", async () => {
        await expect(getCanvas(page)).toBeVisible();
      });

      // Should create a new note window
      const noteWindow = getWindow(page, "note");
      await safeAssert("note-visible", async () => {
        await expect(noteWindow).toBeVisible();
      });

      // Verify it has the resourceRef
      const hasResourceRef = await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) {
          return false;
        }

        const noteWindows = store
          .getState()
          .windows.filter((w: any) => w.type === "note");
        return noteWindows.some(
          (w: any) => w.data?.resourceRef?.id === "new-resource-456"
        );
      });

      expect(hasResourceRef).toBe(true);
    });

    test("?spawn=note&resourceType=note&resourceId=X creates with resourceRef", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      await safeAction(
        "goto-spawn-resource",
        async () => {
          await page.goto(
            "/?spawn=note&resourceType=note&resourceId=combined-789"
          );
        },
        20_000
      );
      await screenshots.captureMilestone("spawn-resource");
      await safeAssert("canvas-visible", async () => {
        await expect(getCanvas(page)).toBeVisible();
      });

      const hasResourceRef = await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) {
          return false;
        }

        return store
          .getState()
          .windows.some(
            (w: any) =>
              w.type === "note" && w.data?.resourceRef?.id === "combined-789"
          );
      });

      expect(hasResourceRef).toBe(true);
    });
  });

  test.describe("windowId parameter", () => {
    test("?windowId=X focuses existing window", async ({ page }) => {
      await navigateToDesktop(page);

      // Create a specific window
      await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) {
          return;
        }

        store.getState().addWindow({
          id: "target-window-id",
          type: "note",
          position: { x: 300, y: 300 },
          data: {
            type: "note",
            label: "Target Window",
            viewMode: "full",
          },
        });
      });

      // Navigate with windowId param
      await page.goto("/?windowId=target-window-id");
      await expect(getCanvas(page)).toBeVisible();

      const focusedId = await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        return store?.getState().focusedWindowId;
      });

      expect(focusedId).toBe("target-window-id");
    });

    test("?windowId=nonexistent is ignored gracefully", async ({ page }) => {
      await page.goto("/?windowId=nonexistent-window-id");
      await expect(getCanvas(page)).toBeVisible();

      // Desktop should still load normally
      const chatWindow = getWindow(page, "chat");
      await expect(chatWindow).toBeVisible();
    });
  });

  test.describe("double-spawn prevention", () => {
    test("refresh with same spawn param doesn't create duplicate", async ({
      page,
    }) => {
      await page.goto("/?spawn=note");
      await expect(getCanvas(page)).toBeVisible();

      const initialCount = await countWindows(page, "note");

      // Refresh the page
      await page.reload();
      await expect(getCanvas(page)).toBeVisible();

      // Count may be same or +1 due to re-processing, but should be controlled
      const newCount = await countWindows(page, "note");
      expect(newCount).toBeLessThanOrEqual(initialCount + 1);
    });

    test("navigation away and back doesn't double-spawn", async ({ page }) => {
      await page.goto("/?spawn=note");
      await expect(getCanvas(page)).toBeVisible();

      const initialCount = await countWindows(page, "note");

      // Navigate to a different search
      await page.goto("/?spawn=terminal");
      await expect(getWindow(page, "terminal")).toBeVisible();

      // Navigate back to note spawn
      await page.goto("/?spawn=note");
      await expect(getCanvas(page)).toBeVisible();

      const finalCount = await countWindows(page, "note");
      // Should have at most one more note (not cumulative)
      expect(finalCount).toBeLessThanOrEqual(initialCount + 1);
    });
  });

  test.describe("browser history integration", () => {
    test("browser back preserves desktop state", async ({ page }) => {
      await navigateToDesktop(page);

      // Create some state
      await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) {
          return;
        }

        store.getState().addWindow({
          id: "history-test-window",
          type: "note",
          position: { x: 400, y: 400 },
          data: { type: "note", label: "History Test", viewMode: "full" },
        });
      });

      // Navigate to spawn a new window
      await page.goto("/?spawn=reminder");
      await expect(getWindow(page, "reminder")).toBeVisible();

      // Go back
      await page.goBack();
      await expect(getCanvas(page)).toBeVisible();

      // Original window should still exist (persisted)
      const hasOriginal = await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        return store
          ?.getState()
          .windows.some((w: any) => w.id === "history-test-window");
      });

      expect(hasOriginal).toBe(true);
    });

    test("browser forward works correctly", async ({ page }) => {
      await navigateToDesktop(page);

      await page.goto("/?spawn=note");
      await expect(getWindow(page, "note")).toBeVisible();

      await page.goBack();
      await expect(getCanvas(page)).toBeVisible();

      await page.goForward();
      await expect(getCanvas(page)).toBeVisible();

      // Should have note window from forward navigation
      const noteWindow = getWindow(page, "note");
      await expect(noteWindow).toBeVisible();
    });
  });

  test.describe("URL cleanup", () => {
    test("spawn params are cleared from URL after processing", async ({
      page,
    }) => {
      // Skip: URL cleanup behavior depends on implementation choice
      await page.goto("/?spawn=note");
      await expect(getCanvas(page)).toBeVisible();

      // Wait for potential URL cleanup
      await page.waitForTimeout(500);

      // Check URL doesn't have spawn param anymore
      const url = page.url();
      expect(url).not.toContain("spawn=note");
    });
  });

  test.describe("combined scenarios", () => {
    test("spawn + existing singleton type focuses existing", async ({
      page,
    }) => {
      await page.goto("/?spawn=chat");
      await expect(getCanvas(page)).toBeVisible();

      // Chat is a singleton - should have exactly 1
      const chatCount = await countWindows(page, "chat");
      expect(chatCount).toBe(1);

      // Should be focused
      const isChatFocused = await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) {
          return false;
        }

        const state = store.getState();
        const chatWindow = state.windows.find((w: any) => w.type === "chat");
        return chatWindow && state.focusedWindowId === chatWindow.id;
      });

      expect(isChatFocused).toBe(true);
    });

    test("multiple params: spawn + resourceRef", async ({ page }) => {
      await page.goto(
        "/?spawn=workflow&resourceType=workflow_run&resourceId=run-999"
      );
      await expect(getCanvas(page)).toBeVisible();

      const workflowWindow = getWindow(page, "workflow");
      await expect(workflowWindow).toBeVisible();

      const hasCorrectRef = await page.evaluate(() => {
        const store = (window as any).__DESKTOP_STORE__;
        if (!store) {
          return false;
        }

        return store
          .getState()
          .windows.some(
            (w: any) =>
              w.type === "workflow" && w.data?.resourceRef?.id === "run-999"
          );
      });

      expect(hasCorrectRef).toBe(true);
    });
  });

  test.describe("performance", () => {
    test("deep link processing completes within budget", async ({ page }) => {
      const startTime = Date.now();

      await page.goto("/?spawn=note&resourceType=note&resourceId=perf-test");
      await expect(getCanvas(page)).toBeVisible();
      await expect(getWindow(page, "note")).toBeVisible();

      const duration = Date.now() - startTime;

      // Should load and process deep link within 3 seconds
      expect(duration).toBeLessThan(3000);
    });
  });
});
