import { expect, test } from "./helpers/ai-harness";
import { signUpTestUser } from "./helpers/auth";
import { spawnNode } from "./helpers/mindscape";

test.describe("Mindscape e2e", () => {
  test.setTimeout(120_000);
  test("end-to-end scenario across reloads and navigation", async ({
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
    await screenshots.captureMilestone("authenticated");

    await safeAction(
      "spawn-note-window",
      async () => {
        await spawnNode(page, "New Note");
      },
      20_000
    );
    await screenshots.captureMilestone("note-spawned");

    const visualize = page
      .getByRole("button", { name: "Visualize in Mindscape" })
      .last();

    await safeAssert("visualize-button-visible", async () => {
      await expect(visualize).toBeVisible();
    });

    await safeAction(
      "visualize-window",
      async () => {
        await visualize.click();
      },
      15_000
    );

    await safeAction(
      "enter-mindscape-mode",
      async () => {
        await page.evaluate(() => {
          const w = globalThis as unknown as {
            __DESKTOP_STORE__?: {
              getState: () => { setMode: (mode: string) => void };
            };
          };
          w.__DESKTOP_STORE__?.getState().setMode("mindscape");
        });
      },
      10_000
    );

    await safeAssert("mindscape-visible", async () => {
      await expect(page.locator(".react-flow")).toBeVisible();
    });
    await screenshots.captureMilestone("mindscape");

    const windowNodes = page.locator('[data-id^="window-"]');
    await safeAssert("window-node-spawned", async () => {
      await expect(windowNodes).toHaveCount(1);
      await expect(windowNodes.first()).toBeVisible();
    });
    await screenshots.captureMilestone("window-node");

    await safeAction(
      "open-window-from-mindscape",
      async () => {
        await windowNodes.first().click({ clickCount: 2, force: true });
      },
      20_000
    );

    await safeAssert("desktop-shell-visible", async () => {
      await expect(page.getByTestId("alfred-desktop-shell")).toBeVisible();
    });
    await screenshots.captureMilestone("completed");
  });
});
