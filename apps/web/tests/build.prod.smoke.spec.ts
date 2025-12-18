import { expect, test } from "@playwright/test";

test("renders landing page from production build", async ({ page }) => {
  const response = await page.goto("/onboarding", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.ok()).toBe(true);

  await expect(
    page.getByRole("heading", { name: "Welcome to ALFRED" })
  ).toBeVisible();
});
