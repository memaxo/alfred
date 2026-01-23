/**
 * Authentication E2E Tests
 *
 * Tests the complete authentication flow in the browser:
 * - Sign up with email
 * - Sign in with email
 * - Session persistence across reloads
 * - Protected route redirects
 * - Sign out
 */

import { expect, test } from "./helpers/ai-harness";
import { platformShortcutKey, signUpTestUser } from "./helpers/auth";

const REAL_AUTH = process.env.PLAYWRIGHT_REAL_AUTH === "1";
const SIGNUP_MS = 60_000;

test.describe("Authentication E2E", () => {
  test.describe("Sign Up Flow", () => {
    test("allows new user sign up", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      test.skip(!REAL_AUTH, "requires real auth signup UI");
      await safeAction(
        "goto-login",
        async () => {
          await page.goto("/login", { waitUntil: "networkidle" });
        },
        15_000
      );
      await screenshots.capturePageLoad("login");

      // Should see sign up form
      await safeAssert("signup-form-visible", async () => {
        await expect(page.getByLabel("Name")).toBeVisible();
        await expect(page.getByLabel("Email")).toBeVisible();
        await expect(page.getByLabel("Password")).toBeVisible();
      });

      // Fill form with unique data
      const suffix = Date.now().toString(36);
      await safeAction("fill-signup-form", async () => {
        await page.getByLabel("Name").fill(`Test User ${suffix}`);
        await page.getByLabel("Email").fill(`test+${suffix}@example.com`);
        await page.getByLabel("Password").fill(`TestPass123!${suffix}`);
      });

      // Submit
      await safeAction("submit-signup", async () => {
        await page.getByRole("button", { name: /sign up/i }).click();
      });

      // Should redirect to mindscape after successful sign up
      await safeAction(
        "wait-mindscape-url",
        async () => {
          await page.waitForURL(/\/mindscape/, { timeout: 10_000 });
        },
        15_000
      );
      await screenshots.captureMilestone("signed-up");
      await safeAssert("mindscape-visible", async () => {
        await expect(page.locator(".react-flow")).toBeVisible();
      });
    });

    test("shows validation errors for invalid input", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      test.skip(!REAL_AUTH, "requires real auth signup UI");
      await safeAction(
        "goto-login",
        async () => {
          await page.goto("/login", { waitUntil: "networkidle" });
        },
        15_000
      );
      await screenshots.capturePageLoad("login");

      // Try to sign up with invalid email
      await safeAction("fill-invalid-signup", async () => {
        await page.getByLabel("Name").fill("Test");
        await page.getByLabel("Email").fill("invalid-email");
        await page.getByLabel("Password").fill("Test123!");
      });

      await safeAction("submit-signup-invalid", async () => {
        await page.getByRole("button", { name: /sign up/i }).click();
      });

      // Should show error (implementation dependent)
      // At minimum, should not redirect to mindscape
      await safeAction(
        "settle",
        async () => {
          await page.waitForTimeout(1000);
        },
        5000
      );
      await screenshots.captureMilestone("invalid-signup-submitted");
      await safeAssert("still-on-login", async () => {
        await expect(page).toHaveURL(/\/login/);
      });
    });
  });

  test.describe("Sign In Flow", () => {
    test("redirects unauthenticated users to login", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      test.skip(!REAL_AUTH, "test mode does not enforce login redirects");
      // Try to access protected route without auth
      await safeAction(
        "goto-mindscape-unauth",
        async () => {
          await page.goto("/mindscape", { waitUntil: "networkidle" });
        },
        15_000
      );
      await screenshots.captureMilestone("unauth-redirect");

      // Should redirect to login
      await safeAssert("redirected-to-login", async () => {
        await expect(page).toHaveURL(/\/login/);
      });
    });

    test("maintains session across page reload", async ({
      page,
      screenshots,
      safeAction,
      safeAssert,
    }) => {
      // Sign up and get authenticated
      await safeAction(
        "signup-test-user",
        async () => {
          await signUpTestUser(page);
        },
        SIGNUP_MS
      );
      await screenshots.captureMilestone("authenticated");

      await safeAssert("desktop-visible", async () => {
        await expect(page.getByTestId("alfred-desktop-shell")).toBeVisible();
      });

      // Reload page
      await safeAction(
        "reload",
        async () => {
          await page.reload({ waitUntil: "networkidle" });
        },
        20_000
      );
      await screenshots.captureMilestone("reloaded");

      // Desktop shell should still be present after reload (session persisted).
      await safeAssert("still-desktop", async () => {
        await expect(page.getByTestId("alfred-desktop-shell")).toBeVisible();
        await expect(page).not.toHaveURL(/\/login/);
      });
    });
  });

  test.describe("Protected Routes", () => {
    const protectedRoutes = [
      { path: "/mindscape", name: "Mindscape" },
      { path: "/settings", name: "Settings" },
      { path: "/drive", name: "Drive Mode" },
      { path: "/voice-s2s", name: "Voice S2S" },
    ];

    for (const route of protectedRoutes) {
      test(`redirects from ${route.name} when unauthenticated`, async ({
        page,
        screenshots,
        safeAction,
        safeAssert,
      }) => {
        test.skip(!REAL_AUTH, "test mode does not enforce login redirects");
        await safeAction(
          `goto-protected-${route.name}`,
          async () => {
            await page.goto(route.path, { waitUntil: "networkidle" });
          },
          15_000
        );
        await screenshots.captureMilestone(`unauth-${route.name}`);
        await safeAssert(`redirect-${route.name}`, async () => {
          await expect(page).toHaveURL(/\/login/);
        });
      });
    }

    test("allows access to protected routes when authenticated", async ({
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
        SIGNUP_MS
      );
      await screenshots.captureMilestone("authenticated");

      // Navigate to settings
      await safeAction(
        "goto-settings",
        async () => {
          await page.goto("/settings", { waitUntil: "networkidle" });
        },
        15_000
      );
      await screenshots.captureMilestone("settings");
      await safeAssert("settings-visible", async () => {
        await expect(page).toHaveURL(/\/settings/);
        await expect(
          page.getByRole("heading", { name: "Settings", exact: true })
        ).toBeVisible();
      });
    });
  });

  test.describe("Public Routes", () => {
    test("allows access to login without auth", async ({
      page,
      safeAction,
      safeAssert,
    }) => {
      await safeAction(
        "goto-login",
        async () => {
          await page.goto("/login", { waitUntil: "networkidle" });
        },
        15_000
      );
      await safeAssert("on-login", async () => {
        await expect(page).toHaveURL(/\/login/);
      });
    });

    test("allows access to health check", async ({ page, safeAction }) => {
      const response = await safeAction(
        "goto-healthz",
        async () => await page.goto("/healthz"),
        10_000
      );
      expect(response?.status()).toBe(200);
    });
  });
});

test.describe("Session Management", () => {
  test.skip(!REAL_AUTH, "session UI assertions require real auth surface");
  test("displays user info when authenticated", async ({
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
      SIGNUP_MS
    );
    await screenshots.captureMilestone("authenticated");

    // Should be able to see some indication of being logged in
    // This depends on UI - check for profile node or user menu
    await safeAction(
      "wait-react-flow",
      async () => {
        await page.waitForSelector(".react-flow", { state: "visible" });
      },
      15_000
    );

    // Open command palette and check for profile option
    await safeAction("open-command-palette", async () => {
      await page.keyboard.press(platformShortcutKey("K"));
    });
    const dialog = page.getByRole("dialog");
    await screenshots.captureMilestone("palette-open");
    await safeAssert("dialog-visible", async () => {
      await expect(dialog).toBeVisible();
    });

    // Profile option should be available
    await safeAssert("profile-option-visible", async () => {
      await expect(dialog.getByText(/profile/i)).toBeVisible();
    });
  });

  test("clears session on sign out", async ({
    page,
    screenshots,
    safeAction,
  }) => {
    test.skip(!REAL_AUTH, "sign out flow is only meaningful with real auth");
    await safeAction(
      "signup-test-user",
      async () => {
        await signUpTestUser(page);
      },
      SIGNUP_MS
    );
    await screenshots.captureMilestone("authenticated");

    // Find and click sign out (location depends on UI)
    // This test assumes there's a profile node with sign out
    await safeAction("open-command-palette", async () => {
      await page.keyboard.press(platformShortcutKey("K"));
    });
    const dialog = page.getByRole("dialog");
    await safeAction("open-profile", async () => {
      await dialog.getByText(/profile/i).click();
    });
    await screenshots.captureMilestone("profile-opened");

    // Look for sign out button in profile node
    const profileNode = page.locator(".react-flow__node-profile").last();

    // If profile node exists, look for sign out
    if (await profileNode.isVisible()) {
      const signOutBtn = profileNode.getByRole("button", { name: /sign out/i });
      if (await signOutBtn.isVisible()) {
        await safeAction(
          "sign-out",
          async () => {
            await signOutBtn.click();
            await page.waitForURL(/\/login/);
          },
          20_000
        );
        await screenshots.captureMilestone("signed-out");
      }
    }
  });
});

test.describe("Navigation After Auth", () => {
  test.skip(!REAL_AUTH, "navigation UI assertions require real auth surface");
  test("navigates between protected routes", async ({
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
      SIGNUP_MS
    );
    await screenshots.captureMilestone("authenticated");

    // Start on mindscape
    await safeAssert("mindscape-visible", async () => {
      await expect(page.locator(".react-flow")).toBeVisible();
    });

    // Navigate to settings
    await safeAction(
      "goto-settings",
      async () => {
        await page.goto("/settings", { waitUntil: "networkidle" });
      },
      15_000
    );
    await screenshots.captureMilestone("settings");
    await safeAssert("settings-visible", async () => {
      await expect(page.getByText("Settings")).toBeVisible();
    });

    // Navigate back to mindscape
    await safeAction(
      "goto-mindscape",
      async () => {
        await page.goto("/mindscape", { waitUntil: "networkidle" });
      },
      15_000
    );
    await screenshots.captureMilestone("mindscape");
    await safeAssert("mindscape-visible-again", async () => {
      await expect(page.locator(".react-flow")).toBeVisible();
    });
  });

  test("preserves navigation state across reloads", async ({
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
      SIGNUP_MS
    );
    await screenshots.captureMilestone("authenticated");

    // Navigate to settings
    await safeAction(
      "goto-settings",
      async () => {
        await page.goto("/settings", { waitUntil: "networkidle" });
      },
      15_000
    );
    await safeAssert("settings-visible", async () => {
      await expect(page.getByText("Settings")).toBeVisible();
    });

    // Reload
    await safeAction(
      "reload",
      async () => {
        await page.reload({ waitUntil: "networkidle" });
      },
      20_000
    );
    await screenshots.captureMilestone("reloaded");

    // Should still be on settings
    await safeAssert("still-on-settings", async () => {
      await expect(page).toHaveURL(/\/settings/);
      await expect(page.getByText("Settings")).toBeVisible();
    });
  });
});
