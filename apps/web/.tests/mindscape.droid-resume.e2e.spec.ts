import { expect, test } from "@playwright/test";

import { signUpTestUser } from "./helpers/auth";

type HarnessWindow = Window & {
  __droidStreamTestHarness__?: {
    active?: boolean;
    emit?: (event: unknown) => void;
    obligation?: (payload: unknown) => void;
    resume?: (payload: unknown) => void;
  };
};

const runId = "run-playwright";

function trpcSuccess(data: unknown) {
  return JSON.stringify([{ result: { data } }]);
}

test.describe("Mindscape droid biometric resume", () => {
  test.beforeEach(async ({ page }) => {
    let sessionUser: { id: string; email: string; name: string } | null = {
      id: "mindscape-playwright",
      email: "mindscape+playwright@example.com",
      name: "Mindscape Playwright",
    };

    await page.route("**/api/auth/get-session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          sessionUser ? { data: { user: sessionUser } } : { data: null }
        ),
      });
    });

    await page.route("**/api/auth/sign-up/email", async (route) => {
      let payload: { email?: string; name?: string } = {};
      try {
        payload = (await route.request().postDataJSON()) as {
          email?: string;
          name?: string;
        };
      } catch {
        // ignore parse failures
      }
      sessionUser = {
        id: `test-user-${Date.now()}`,
        email: payload.email ?? "mindscape+test@example.com",
        name: payload.name ?? "Mindscape Tester",
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            user: sessionUser,
          },
        }),
      });
    });

    await page.addInitScript(() => {
      const harness = {
        active: false,
        latestOptions: null,
        subscribe(options) {
          this.active = true;
          this.latestOptions = options;
          return {
            unsubscribe: () => {
              this.active = false;
              this.latestOptions = null;
            },
          };
        },
        emit(event) {
          this.latestOptions?.onEvent?.(event);
        },
        obligation(payload) {
          this.latestOptions?.onObligation?.(payload);
        },
        resume(payload) {
          this.latestOptions?.onResume?.(payload);
        },
        complete() {
          this.latestOptions?.onComplete?.();
        },
      };
      Object.defineProperty(window, "__droidStreamTestHarness__", {
        value: harness,
        configurable: true,
      });
    });

    await page.route("**/api/trpc/droid.resume*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: trpcSuccess({ success: true }),
      });
    });
  });

  test("suspend → biometric → resume", async ({ page }) => {
    await signUpTestUser(page);

    const droidNode = page.locator(".react-flow__node-droid").first();
    await droidNode.waitFor({ timeout: 15_000 });

    await droidNode
      .getByPlaceholder("Describe the task for droid...")
      .fill("List repo files");
    await droidNode.getByTestId("droid-run-button").click();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const scope = window as unknown as HarnessWindow;
          return Boolean(scope.__droidStreamTestHarness__?.active);
        })
      )
      .toBeTruthy();

    await page.evaluate(() => {
      const scope = window as unknown as HarnessWindow;
      scope.__droidStreamTestHarness__?.emit({
        type: "stdout",
        data: "Booting",
      });
    });
    await expect(droidNode.getByText(/Booting/)).toBeVisible();

    const resumeResponse = page.waitForResponse((response) =>
      response.url().includes("/api/trpc/droid.resume")
    );

    await page.evaluate(
      ({ id }) => {
        const scope = window as unknown as HarnessWindow;
        scope.__droidStreamTestHarness__?.obligation({
          runId: id,
          obligations: [
            {
              type: "biometric",
              reason: "biometric_required",
              metadata: { code: "requireBio" },
            },
          ],
        });
      },
      { id: runId }
    );

    await expect(droidNode.getByText(/Awaiting biometric/i)).toBeVisible();
    await resumeResponse;

    await page.evaluate(
      ({ id }) => {
        const scope = window as unknown as HarnessWindow;
        scope.__droidStreamTestHarness__?.resume({ runId: id });
      },
      { id: runId }
    );

    await expect(droidNode.getByText(/running/i)).toBeVisible();

    await page.evaluate(() => {
      const scope = window as unknown as HarnessWindow;
      scope.__droidStreamTestHarness__?.emit({ type: "stdout", data: "Done" });
      scope.__droidStreamTestHarness__?.emit({ type: "exit", code: 0 });
    });

    await expect(droidNode.getByText(/completed/i)).toBeVisible();
    await expect(droidNode.getByText(/Done/)).toBeVisible();
  });
});
