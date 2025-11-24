import { expect, type Page } from "@playwright/test";
import {
  issueTestSession,
  serializeTestSession,
  TEST_SESSION_HEADER,
  type TestSession,
} from "../../src/lib/test-auth";

function uniqueSuffix() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function useRealAuth() {
  return process.env.PLAYWRIGHT_REAL_AUTH === "1";
}

async function primeBrowserSession(page: Page, session: TestSession) {
  const serialized = serializeTestSession(session);
  await page.context().setExtraHTTPHeaders({
    [TEST_SESSION_HEADER]: serialized,
  });
  await page.addInitScript(({ session: initSession }) => {
    (window as typeof window & {
      __TEST_SESSION__?: { data: TestSession };
    }).__TEST_SESSION__ = { data: initSession };
    window.sessionStorage?.setItem("alfred:test-session", JSON.stringify(initSession));
  }, { session });
}

async function legacySignUp(page: Page) {
  const suffix = uniqueSuffix();
  const name = `Mindscape Tester ${suffix}`;
  const email = `mindscape+${suffix}@example.com`;
  const password = `Mindscape-${suffix}!`;

  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign up/i }).click();
  await page.waitForURL(/\/mindscape$/);
  await expect(page.locator(".react-flow")).toBeVisible();
  return { name, email, password };
}

export async function signUpTestUser(page: Page) {
  if (useRealAuth()) {
    return legacySignUp(page);
  }
  page.on("console", (msg) => {
    console.log(`BROWSER CONSOLE: ${msg.type().toUpperCase()} ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    console.log(`BROWSER ERROR: ${err.message}`);
  });
  const suffix = uniqueSuffix();
  const session = issueTestSession({
    name: `Mindscape Tester ${suffix}`,
    email: `mindscape+${suffix}@example.com`,
  });
  await primeBrowserSession(page, session);
  await page.goto("/mindscape", { waitUntil: "networkidle" });
  await expect(page.locator(".react-flow")).toBeVisible();
  return {
    name: session.user.name,
    email: session.user.email,
    password: "test-bypass",
  };
}

export function platformShortcutKey(key: string) {
  return process.platform === "darwin" ? `Meta+${key}` : `Control+${key}`;
}
