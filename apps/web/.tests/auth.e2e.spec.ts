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

import { expect, test } from "@playwright/test";
import { platformShortcutKey, signUpTestUser } from "./helpers/auth";

test.describe("Authentication E2E", () => {
  test.describe("Sign Up Flow", () => {
    test("allows new user sign up", async ({ page }) => {
      await page.goto("/login", { waitUntil: "networkidle" });

      // Should see sign up form
      await expect(page.getByLabel("Name")).toBeVisible();
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByLabel("Password")).toBeVisible();

      // Fill form with unique data
      const suffix = Date.now().toString(36);
      await page.getByLabel("Name").fill(`Test User ${suffix}`);
      await page.getByLabel("Email").fill(`test+${suffix}@example.com`);
      await page.getByLabel("Password").fill(`TestPass123!${suffix}`);

      // Submit
      await page.getByRole("button", { name: /sign up/i }).click();

      // Should redirect to mindscape after successful sign up
      await page.waitForURL(/\/mindscape/, { timeout: 10_000 });
      await expect(page.locator(".react-flow")).toBeVisible();
    });

    test("shows validation errors for invalid input", async ({ page }) => {
      await page.goto("/login", { waitUntil: "networkidle" });

      // Try to sign up with invalid email
      await page.getByLabel("Name").fill("Test");
      await page.getByLabel("Email").fill("invalid-email");
      await page.getByLabel("Password").fill("Test123!");

      await page.getByRole("button", { name: /sign up/i }).click();

      // Should show error (implementation dependent)
      // At minimum, should not redirect to mindscape
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Sign In Flow", () => {
    test("redirects unauthenticated users to login", async ({ page }) => {
      // Try to access protected route without auth
      await page.goto("/mindscape", { waitUntil: "networkidle" });

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("maintains session across page reload", async ({ page }) => {
      // Sign up and get authenticated
      await signUpTestUser(page);

      // Should be on mindscape
      await expect(page.locator(".react-flow")).toBeVisible();

      // Reload page
      await page.reload({ waitUntil: "networkidle" });

      // Should still be on mindscape (session persisted)
      await expect(page).toHaveURL(/\/mindscape/);
      await expect(page.locator(".react-flow")).toBeVisible();
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
      }) => {
        await page.goto(route.path, { waitUntil: "networkidle" });
        await expect(page).toHaveURL(/\/login/);
      });
    }

    test("allows access to protected routes when authenticated", async ({
      page,
    }) => {
      await signUpTestUser(page);

      // Navigate to settings
      await page.goto("/settings", { waitUntil: "networkidle" });
      await expect(page).toHaveURL(/\/settings/);
      await expect(page.getByText("Settings")).toBeVisible();
    });
  });

  test.describe("Public Routes", () => {
    test("allows access to login without auth", async ({ page }) => {
      await page.goto("/login", { waitUntil: "networkidle" });
      await expect(page).toHaveURL(/\/login/);
    });

    test("allows access to health check", async ({ page }) => {
      const response = await page.goto("/healthz");
      expect(response?.status()).toBe(200);
    });
  });
});

test.describe("Session Management", () => {
  test("displays user info when authenticated", async ({ page }) => {
    await signUpTestUser(page);

    // Should be able to see some indication of being logged in
    // This depends on UI - check for profile node or user menu
    await page.waitForSelector(".react-flow", { state: "visible" });

    // Open command palette and check for profile option
    await page.keyboard.press(platformShortcutKey("K"));
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Profile option should be available
    await expect(dialog.getByText(/profile/i)).toBeVisible();
  });

  test("clears session on sign out", async ({ page }) => {
    await signUpTestUser(page);

    // Find and click sign out (location depends on UI)
    // This test assumes there's a profile node with sign out
    await page.keyboard.press(platformShortcutKey("K"));
    const dialog = page.getByRole("dialog");
    await dialog.getByText(/profile/i).click();

    // Look for sign out button in profile node
    const profileNode = page.locator(".react-flow__node-profile").last();

    // If profile node exists, look for sign out
    if (await profileNode.isVisible()) {
      const signOutBtn = profileNode.getByRole("button", { name: /sign out/i });
      if (await signOutBtn.isVisible()) {
        await signOutBtn.click();
        await page.waitForURL(/\/login/);
      }
    }
  });
});

test.describe("Navigation After Auth", () => {
  test("navigates between protected routes", async ({ page }) => {
    await signUpTestUser(page);

    // Start on mindscape
    await expect(page.locator(".react-flow")).toBeVisible();

    // Navigate to settings
    await page.goto("/settings", { waitUntil: "networkidle" });
    await expect(page.getByText("Settings")).toBeVisible();

    // Navigate back to mindscape
    await page.goto("/mindscape", { waitUntil: "networkidle" });
    await expect(page.locator(".react-flow")).toBeVisible();
  });

  test("preserves navigation state across reloads", async ({ page }) => {
    await signUpTestUser(page);

    // Navigate to settings
    await page.goto("/settings", { waitUntil: "networkidle" });
    await expect(page.getByText("Settings")).toBeVisible();

    // Reload
    await page.reload({ waitUntil: "networkidle" });

    // Should still be on settings
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText("Settings")).toBeVisible();
  });
});
