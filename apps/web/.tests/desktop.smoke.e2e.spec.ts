import { expect, test } from "./helpers/ai-harness";
import { signUpTestUser } from "./helpers/auth";

type DesktopHarnessWindow = Window & {
  __DESKTOP_STORE__?: {
    getState: () => {
      focusedWindowId: string | null;
      enterFocusMode: (windowId: string) => void;
      spawnWindow: (
        type: string,
        resourceRef?: unknown,
        position?: { x: number; y: number }
      ) => string;
    };
  };
};

test.describe("Desktop smoke flows", () => {
  test("spawn/minimize/restore/mindscape/focus-mode", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    await safeAction(
      "signup-test-user",
      async () => {
        await signUpTestUser(page);
      },
      60_000
    );
    await screenshots.captureMilestone("desktop-ready");

    const componentsIcon = page.getByRole("button", {
      name: "Open Components",
    });
    await safeAction(
      "open-components",
      async () => {
        await componentsIcon.dblclick();
      },
      10_000
    );

    const componentsWindow = page
      .locator("[data-window-id]")
      .filter({ has: page.locator('[data-app="components"]') })
      .first();

    await safeAssert("components-window-visible", async () => {
      await expect(componentsWindow).toBeVisible();
    });
    await screenshots.captureMilestone("components-open");

    await safeAction(
      "minimize-components",
      async () => {
        await componentsWindow
          .getByRole("button", { name: "Minimize" })
          .click();
      },
      10_000
    );

    await safeAssert("components-minimized", async () => {
      await expect(componentsWindow).toHaveCount(0);
    });

    const taskbar = page.locator('[data-layer="taskbar"]');
    await safeAction(
      "restore-components-via-taskbar",
      async () => {
        await taskbar.getByRole("button", { name: "Components" }).click();
      },
      10_000
    );
    await safeAssert("components-restored", async () => {
      await expect(componentsWindow).toBeVisible();
    });
    await screenshots.captureMilestone("components-restored");

    await safeAction(
      "visualize-in-mindscape",
      async () => {
        await componentsWindow
          .getByRole("button", { name: "Visualize in Mindscape" })
          .click();
      },
      10_000
    );

    const mindscape = page.locator('[data-layer="mindscape"]');
    await safeAssert("mindscape-visible", async () => {
      await expect(mindscape).toBeVisible();
    });
    await safeAssert("components-hidden-in-mindscape", async () => {
      await expect(componentsWindow).toHaveCount(0);
    });
    await screenshots.captureMilestone("mindscape");

    await safeAction(
      "toggle-back-to-desktop",
      async () => {
        await page.keyboard.press("Meta+M");
      },
      10_000
    );

    await safeAssert("mindscape-hidden", async () => {
      await expect(mindscape).toHaveCount(0);
    });

    await safeAction(
      "restore-components-after-mindscape",
      async () => {
        await taskbar.getByRole("button", { name: "Components" }).click();
      },
      10_000
    );
    await safeAssert("components-visible-after-mindscape", async () => {
      await expect(componentsWindow).toBeVisible();
    });

    await safeAction(
      "spawn-second-components-window",
      async () => {
        await page.evaluate(() => {
          const store = (window as unknown as DesktopHarnessWindow)
            .__DESKTOP_STORE__;
          if (!store) {
            throw new Error("Desktop store unavailable");
          }
          store.getState().spawnWindow("components", undefined, {
            x: 280,
            y: 120,
          });
        });
      },
      10_000
    );

    const componentsWindows = page
      .locator("[data-window-id]")
      .filter({ has: page.locator('[data-app="components"]') });

    await safeAssert("two-windows-visible", async () => {
      await expect(componentsWindows).toHaveCount(2);
    });

    await safeAction(
      "focus-first-window",
      async () => {
        await componentsWindows.first().click();
      },
      10_000
    );

    await safeAction(
      "enter-focus-mode",
      async () => {
        await page.evaluate(() => {
          const store = (window as unknown as DesktopHarnessWindow)
            .__DESKTOP_STORE__;
          if (!store) {
            throw new Error("Desktop store unavailable");
          }
          const focused = store.getState().focusedWindowId;
          if (!focused) {
            throw new Error("No focused window");
          }
          store.getState().enterFocusMode(focused);
        });
      },
      10_000
    );

    const focusOverlay = page.locator('[data-focus-mode="active"]');
    await safeAssert("focus-overlay-visible", async () => {
      await expect(focusOverlay).toBeVisible();
    });
    await safeAssert("other-window-minimized", async () => {
      await expect(componentsWindows).toHaveCount(1);
    });
    await screenshots.captureMilestone("focus-mode");

    await safeAction(
      "exit-focus-mode",
      async () => {
        await focusOverlay.getByRole("button", { name: /Exit Focus/i }).click();
      },
      10_000
    );

    await safeAssert("focus-overlay-hidden", async () => {
      await expect(focusOverlay).toHaveCount(0);
    });
    await safeAssert("windows-restored", async () => {
      await expect(componentsWindows).toHaveCount(2);
    });
    await screenshots.captureMilestone("focus-mode-exited");
  });
});
