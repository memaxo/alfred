import { expect, type Page } from "@playwright/test";

function uniqueSuffix() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function signUpTestUser(page: Page) {
  const suffix = uniqueSuffix();
  const name = `Mindscape Tester ${suffix}`;
  const email = `mindscape+${suffix}@example.com`;
  const password = `Mindscape-${suffix}!`; // satisfies length + variety

  page.on("console", (msg) => console.log(`BROWSER CONSOLE: ${msg.text()}`));
  page.on("pageerror", (err) => console.log(`BROWSER ERROR: ${err.message}`));

  await page.goto("/login", { waitUntil: "networkidle" });

  // Debug: print page title and content excerpt
  console.log("Page title:", await page.title());
  const content = await page.content();
  console.log("Page content length:", content.length);
  if (content.length < 2000) {
    console.log("Page content:", content);
  }

  try {
    await page.getByLabel("Name").fill(name);
  } catch (e) {
    console.log("Failed to find Name input. Dumping page content:");
    console.log(await page.content());
    throw e;
  }
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
