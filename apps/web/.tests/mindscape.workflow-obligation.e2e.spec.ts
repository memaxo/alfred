import type { WorkflowEvent } from "@alfred/type";

import { expect, test } from "./helpers/ai-harness";
import { signUpTestUser } from "./helpers/auth";

type WorkflowHarnessWindow = Window & {
  __workflowStreamTestHarness__?: {
    latestOptions?: {
      input?: unknown;
      onWorkflowEvent?: (event: WorkflowEvent) => void;
    };
    emit?: (event: WorkflowEvent) => void;
    reset?: () => void;
  };
};

function trpcSuccess(data: unknown) {
  return JSON.stringify([{ result: { data } }]);
}

test.describe("Mindscape workflow obligation flow", () => {
  test.beforeEach(async ({ page, screenshots }) => {
    await page.route("**/api/trpc/workflow.resume*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: trpcSuccess({ ok: true }),
      });
    });

    await page.addInitScript(() => {
      const harness = {
        latestOptions: null,
        subscribe(options: any) {
          this.latestOptions = options;
          return {
            close: () => {
              this.latestOptions = null;
            },
          };
        },
        emit(event: WorkflowEvent) {
          this.latestOptions?.onWorkflowEvent?.(event);
        },
        reset() {
          this.latestOptions = null;
        },
      };
      Object.defineProperty(window, "__workflowStreamTestHarness__", {
        value: harness,
        configurable: true,
      });
    });
    await screenshots.captureMilestone("harness-installed");
  });

  test("suspends on obligations and auto-resumes after biometric", async ({
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
      "inject-workflow-node",
      async () => {
        await page.evaluate(() => {
          const store = (
            window as unknown as WorkflowHarnessWindow & {
              __MINDSCAPE_STORE__?: {
                setState: (updater: (state: any) => any) => void;
              };
            }
          ).__MINDSCAPE_STORE__;
          if (!store) {
            throw new Error("Mindscape store unavailable");
          }
          store.setState((state: any) => {
            const workflowNode = {
              id: "workflow-obligation-node",
              type: "workflow",
              position: { x: 120, y: 140 },
              data: {
                type: "workflow",
                label: "Obligation Run",
                requirement: "Cautious execute",
                auto: "medium",
                mode: "sequential",
                status: "pending",
                messages: [],
              },
              selectable: true,
              draggable: false,
            };
            return {
              ...state,
              nodes: [
                ...state.nodes.filter((n: any) => n.id !== workflowNode.id),
                workflowNode,
              ],
            };
          });
        });
      },
      20_000
    );
    await screenshots.captureMilestone("node-injected");

    await safeAssert("stream-subscription-ready", async () => {
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const scope = window as WorkflowHarnessWindow;
            return Boolean(scope.__workflowStreamTestHarness__?.latestOptions);
          })
        )
        .toBeTruthy();
    });
    await screenshots.captureMilestone("subscribed");

    const runId = "run-workflow-playwright";
    const obligationEvent: WorkflowEvent = {
      type: "obligation",
      runId,
      obligations: [
        {
          type: "biometric",
          reason: "workflow_autonomy_passkey",
          metadata: { code: "requireBio" },
        },
      ],
      resumeEvents: ["bio-authz"],
    } as WorkflowEvent;

    await safeAction(
      "emit-obligation",
      async () => {
        await page.evaluate((event) => {
          const scope = window as WorkflowHarnessWindow;
          scope.__workflowStreamTestHarness__?.emit?.(event);
        }, obligationEvent);
      },
      10_000
    );
    await screenshots.captureMilestone("obligation-emitted");

    await safeAssert("obligation-ui-visible", async () => {
      await expect(page.getByText(/Biometric \/ MFA Required/i)).toBeVisible();
      await expect(page.getByText(/workflow_autonomy_passkey/i)).toBeVisible();
    });
    await screenshots.captureMilestone("obligation-visible");

    await safeAction(
      "wait-resume-call",
      async () => {
        await page.waitForResponse((response) =>
          response.url().includes("/api/trpc/workflow.resume")
        );
      },
      20_000
    );
    await screenshots.captureMilestone("resume-called");

    const runEvent: WorkflowEvent = {
      type: "run",
      id: runId,
    } as WorkflowEvent;

    await safeAction(
      "emit-run",
      async () => {
        await page.evaluate((event) => {
          const scope = window as WorkflowHarnessWindow;
          scope.__workflowStreamTestHarness__?.emit?.(event);
        }, runEvent);
      },
      10_000
    );
    await screenshots.captureMilestone("run-emitted");

    await safeAssert("running-visible", async () => {
      await expect(page.getByText(/running/i)).toBeVisible();
    });
    await screenshots.captureMilestone("running");
  });
});
