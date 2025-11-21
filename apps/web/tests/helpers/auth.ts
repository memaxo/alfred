import { expect, Page } from "@playwright/test";

function uniqueSuffix() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function signUpTestUser(page: Page) {
  const suffix = uniqueSuffix();
  const name = `Mindscape Tester ${suffix}`;
  const email = `mindscape+${suffix}@example.com`;
  const password = `Mindscape-${suffix}!`; // satisfies length + variety

  await page.goto("/login", { waitUntil: "networkidle" });

  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign up/i }).click();

  await page.waitForURL(/\/mindscape$/, { timeout: 60_000 });
  await expect(page.locator(".react-flow")).toBeVisible();

  return { name, email, password };
}

export function platformShortcutKey(key: string) {
  return process.platform === "darwin" ? `Meta+${key}` : `Control+${key}`;
}
