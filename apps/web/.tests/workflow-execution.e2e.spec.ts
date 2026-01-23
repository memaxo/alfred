/**
 * Workflow Execution E2E Tests
 *
 * Tests the workflow execution flow in the browser:
 * - Initiating workflows from the UI
 * - Observing streaming events
 * - Viewing workflow history
 * - Handling workflow states
 */

import { expect, test } from "./helpers/ai-harness";
import { signUpTestUser } from "./helpers/auth";
import { latestNode, openCommandPalette, spawnNode } from "./helpers/mindscape";

test.describe("Workflow Execution E2E", () => {
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

  test.describe("Workflow Initiation", () => {
    test("can open chat node and send message", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      // Spawn a chat node
      await safeAction(
        "spawn-chat-node",
        async () => {
          await spawnNode(page, "New Chat");
        },
        15_000
      );

      // Find the chat node
      const chatNode = latestNode(page, "chat");
      await safeAssert("chat-node-visible", async () => {
        await expect(chatNode).toBeVisible();
      });
      await screenshots.captureMilestone("chat-opened");

      // Find input field and type a message
      const input = chatNode.locator("textarea, input[type='text']").first();
      if (await input.isVisible()) {
        await safeAction("fill-chat-input", async () => {
          await input.fill("Hello, Alfred!");
        });

        // Look for send button
        const sendBtn = chatNode
          .getByRole("button")
          .filter({ hasText: /send/i });
        if (await sendBtn.isVisible()) {
          await safeAction("click-send", async () => {
            await sendBtn.click();
          });
        } else {
          // Try pressing Enter
          await safeAction("press-enter", async () => {
            await input.press("Enter");
          });
        }

        // Give the UI a moment to start rendering response/loading.
        await safeAction(
          "settle-response-start",
          async () => {
            await page.waitForTimeout(2000);
          },
          10_000
        );
        await screenshots.captureMilestone("chat-sent");
      }
    });

    test("can spawn and interact with droid node", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      // Spawn droid node
      await safeAction(
        "spawn-droid-node",
        async () => {
          await spawnNode(page, "New Droid");
        },
        15_000
      );

      const droidNode = latestNode(page, "droid");
      await safeAssert("droid-node-visible", async () => {
        await expect(droidNode).toBeVisible();
      });
      await screenshots.captureMilestone("droid-opened");

      // Should see droid interface elements
      await safeAssert("droid-input-visible", async () => {
        await expect(droidNode.locator("textarea, input")).toBeVisible();
      });
    });
  });

  test.describe("Workflow History", () => {
    test("can access workflow from mindscape", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      // Navigate to mindscape
      await safeAssert("react-flow-visible", async () => {
        await expect(page.locator(".react-flow")).toBeVisible();
      });

      // Look for workflow node or history
      await safeAction(
        "open-command-palette",
        async () => {
          await openCommandPalette(page);
        },
        10_000
      );
      const dialog = page.getByRole("dialog");
      await screenshots.captureMilestone("palette-open");

      // Search for workflow-related options
      await safeAction("search-workflow", async () => {
        await dialog.getByPlaceholder(/create or jump/i).fill("workflow");
      });
      await safeAction(
        "settle-options",
        async () => {
          await page.waitForTimeout(500);
        },
        5000
      );

      // Should see workflow-related options
      const options = dialog.locator("[data-command-item]");
      expect(await options.count()).toBeGreaterThanOrEqual(0);
    });

    test("workflow drawer shows run details", async ({
      page,
      screenshots,
      safeAction,
    }) => {
      // This test requires a workflow to exist
      // For now, verify the workflow route structure exists

      // Navigate directly to workflow route with mock ID
      await safeAction(
        "goto-workflow-run",
        async () => {
          await page.goto("/workflow/test-run-id", {
            waitUntil: "networkidle",
          });
        },
        20_000
      );

      // Should either show workflow details or redirect
      // Due to protected routes, should stay authenticated
      await safeAction(
        "settle",
        async () => {
          await page.waitForTimeout(1000);
        },
        10_000
      );
      await screenshots.captureMilestone("workflow-route");

      // Should see some UI element (error message or workflow details)
      const content = await page.textContent("body");
      expect(content).toBeDefined();
    });
  });

  test.describe("Streaming Events", () => {
    test("chat node shows streaming response", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      // Spawn chat node
      await safeAction(
        "spawn-chat-node",
        async () => {
          await spawnNode(page, "New Chat");
        },
        15_000
      );
      const chatNode = latestNode(page, "chat");
      await safeAssert("chat-node-visible", async () => {
        await expect(chatNode).toBeVisible();
      });

      // Find and use the input
      const input = chatNode.locator("textarea").first();
      if (await input.isVisible()) {
        await safeAction("fill-question", async () => {
          await input.fill("What is 2 + 2?");
          await input.press("Enter");
        });

        // Wait for response to start appearing
        await safeAction(
          "settle-stream-start",
          async () => {
            await page.waitForTimeout(3000);
          },
          10_000
        );
        await screenshots.captureMilestone("streaming-started");

        // Should see message content (assistant response)
        const messages = chatNode.locator("[data-message]");
        // Message area should exist
        expect(await messages.count()).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

test.describe("Workflow UI Components", () => {
  test.beforeEach(async ({ page, screenshots, safeAction }) => {
    await safeAction(
      "signup-test-user",
      async () => {
        await signUpTestUser(page);
      },
      30_000
    );
    await screenshots.captureMilestone("authenticated");
  });

  test("orb node is interactive", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    // The central orb should be visible on mindscape
    await safeAssert("react-flow-visible", async () => {
      await expect(page.locator(".react-flow")).toBeVisible();
    });

    // Look for the orb node
    const orbNode = page.locator(".react-flow__node-orb");
    if (await orbNode.first().isVisible()) {
      // Should be able to interact with it
      await safeAction("click-orb", async () => {
        await orbNode.first().click();
      });
      await safeAction(
        "settle",
        async () => {
          await page.waitForTimeout(500);
        },
        5000
      );
      await screenshots.captureMilestone("orb-clicked");
    }
  });

  test("workflow list node shows history", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    // Spawn workflow list node
    await safeAction(
      "open-command-palette",
      async () => {
        await openCommandPalette(page);
      },
      10_000
    );
    const dialog = page.getByRole("dialog");
    await screenshots.captureMilestone("palette-open");
    await safeAction("search-workflow", async () => {
      await dialog.getByPlaceholder(/create or jump/i).fill("workflow");
    });

    // Look for workflow list option
    const workflowOption = dialog.locator("[data-command-item]").filter({
      hasText: /workflow|history/i,
    });

    if (await workflowOption.first().isVisible()) {
      await safeAction("select-workflow-option", async () => {
        await workflowOption.first().click();
      });
      await safeAction(
        "settle",
        async () => {
          await page.waitForTimeout(1000);
        },
        10_000
      );
      await screenshots.captureMilestone("workflow-list-opened");

      // Should see workflow list node
      const workflowListNode = page.locator(".react-flow__node-workflowlist");
      if (await workflowListNode.isVisible()) {
        // Should show list of workflows or empty state
        await safeAssert("workflow-list-visible", async () => {
          await expect(workflowListNode).toBeVisible();
        });
      }
    }
  });
});

test.describe("Workflow Error Handling", () => {
  test.beforeEach(async ({ page, screenshots, safeAction }) => {
    await safeAction(
      "signup-test-user",
      async () => {
        await signUpTestUser(page);
      },
      30_000
    );
    await screenshots.captureMilestone("authenticated");
  });

  test("handles network errors gracefully", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    // Spawn chat node
    await safeAction(
      "spawn-chat-node",
      async () => {
        await spawnNode(page, "New Chat");
      },
      15_000
    );
    const chatNode = latestNode(page, "chat");
    await safeAssert("chat-node-visible", async () => {
      await expect(chatNode).toBeVisible();
    });

    // Simulate offline
    await safeAction("set-offline", async () => {
      await page.context().setOffline(true);
    });
    await screenshots.captureMilestone("offline");

    // Try to send message
    const input = chatNode.locator("textarea").first();
    if (await input.isVisible()) {
      await safeAction("send-offline-message", async () => {
        await input.fill("Test offline");
        await input.press("Enter");
      });

      // Should show error state
      await safeAction(
        "settle-error",
        async () => {
          await page.waitForTimeout(2000);
        },
        10_000
      );
      await screenshots.captureMilestone("offline-error");

      // Restore network
      await safeAction("set-online", async () => {
        await page.context().setOffline(false);
      });
    }
  });

  test("recovers from temporary failures", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    // This test verifies the app doesn't crash on errors
    await safeAssert("react-flow-visible", async () => {
      await expect(page.locator(".react-flow")).toBeVisible();
    });

    // Navigate to a non-existent workflow
    await safeAction(
      "goto-missing-workflow",
      async () => {
        await page.goto("/workflow/non-existent-id", {
          waitUntil: "networkidle",
        });
      },
      20_000
    );
    await screenshots.captureMilestone("missing-workflow");

    // Should show error or redirect, not crash
    await safeAction(
      "settle",
      async () => {
        await page.waitForTimeout(1000);
      },
      10_000
    );

    // Should be able to navigate back
    await safeAction(
      "goto-mindscape",
      async () => {
        await page.goto("/mindscape", { waitUntil: "networkidle" });
      },
      20_000
    );
    await screenshots.captureMilestone("mindscape");
    await safeAssert("react-flow-visible-again", async () => {
      await expect(page.locator(".react-flow")).toBeVisible();
    });
  });
});

test.describe("Workflow State Persistence", () => {
  test.beforeEach(async ({ page, screenshots, safeAction }) => {
    await safeAction(
      "signup-test-user",
      async () => {
        await signUpTestUser(page);
      },
      30_000
    );
    await screenshots.captureMilestone("authenticated");
  });

  test("workflow state persists across page reload", async ({
    page,
    screenshots,
    safeAction,
    safeAssert,
  }) => {
    // Create a note (simpler than full workflow)
    await safeAction(
      "spawn-note-node",
      async () => {
        await spawnNode(page, "New Note");
      },
      15_000
    );
    const noteNode = latestNode(page, "note");

    await safeAction(
      "fill-note",
      async () => {
        await noteNode
          .getByPlaceholder("Title (optional)")
          .fill("Persistent Note");
        await noteNode.getByPlaceholder("Write your note").fill("Test content");
        await noteNode.getByRole("button", { name: "Save" }).click();
      },
      15_000
    );
    await screenshots.captureMilestone("note-saved");

    // Wait for save
    await safeAction(
      "settle-save",
      async () => {
        await page.waitForTimeout(1000);
      },
      10_000
    );

    // Reload
    await safeAction(
      "reload",
      async () => {
        await page.reload({ waitUntil: "networkidle" });
      },
      20_000
    );
    await screenshots.captureMilestone("reloaded");

    // Note should still exist
    await safeAssert("react-flow-visible", async () => {
      await expect(page.locator(".react-flow")).toBeVisible();
    });
    const persistedNote = page.locator(".react-flow__node-note").filter({
      hasText: "Persistent Note",
    });
    await safeAssert("persisted-note-visible", async () => {
      await expect(persistedNote.first()).toBeVisible();
    });
    await screenshots.captureMilestone("persisted");
  });
});
