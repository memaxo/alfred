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

async function dismissDesktopIntro(page: Page): Promise<void> {
  // The intro overlay is dismissed by user interaction events.
  // Use real input events (not `evaluate`) to avoid edge cases.
  await page.waitForTimeout(50);
  await page.mouse.move(10, 10);
  await page.mouse.click(10, 10);
  await page.keyboard.press("Escape").catch(() => {});

  const intro = page.getByText(/signal in the void/i);
  if ((await intro.count()) > 0) {
    await intro.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  }
}

async function waitForDesktopReady(page: Page): Promise<void> {
  const shell = page.getByTestId("alfred-desktop-shell");

  // The intro overlay is dismissed by user interaction, but effects/hydration
  // can race in Playwright. Nudge repeatedly until the shell is visible.
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await dismissDesktopIntro(page);
    if (await shell.isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(250);
  }

  const debug = await page
    .evaluate(() => {
      const sessionCarrier = (
        globalThis as unknown as { __TEST_SESSION__?: { data?: unknown } }
      ).__TEST_SESSION__;
      const session = sessionCarrier?.data;
      let storageValue: string | null = null;
      try {
        storageValue =
          window.sessionStorage?.getItem("alfred:test-session") ?? null;
      } catch {
        storageValue = null;
      }
      return {
        url: window.location.href,
        hasSession: Boolean(session),
        stored:
          typeof storageValue === "string" ? storageValue.slice(0, 24) : null,
      };
    })
    .catch(() => ({ url: page.url(), hasSession: false, stored: null }));

  if ((await shell.count()) === 0) {
    const errorText = await page
      .getByText(/Something went wrong/i)
      .locator("..")
      .innerText()
      .catch(() => null);
    throw new Error(
      `desktop_shell_missing: ${JSON.stringify({ ...debug, errorText })}`
    );
  }

  await expect(shell).toBeVisible({ timeout: 60_000 });
}

async function primeBrowserSession(page: Page, session: TestSession) {
  const serialized = serializeTestSession(session);
  await page.context().setExtraHTTPHeaders({
    [TEST_SESSION_HEADER]: serialized,
  });
  await page.addInitScript(
    ({ session: initSession }) => {
      (
        window as typeof window & {
          __TEST_SESSION__?: { data: TestSession };
        }
      ).__TEST_SESSION__ = { data: initSession };
      window.sessionStorage?.setItem(
        "alfred:test-session",
        // Keep in sync with serializeTestSession() (base64 JSON).
        btoa(JSON.stringify(initSession))
      );
    },
    { session }
  );
}

async function legacySignUp(page: Page) {
  const suffix = uniqueSuffix();
  const name = `Mindscape Tester ${suffix}`;
  const email = `mindscape+${suffix}@example.com`;
  const password = `Mindscape-${suffix}!`;

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign up/i }).click();
  await page.waitForURL(/\/$/);
  await page.goto("/_protected", { waitUntil: "domcontentloaded" });
  await waitForDesktopReady(page);
  return { name, email, password };
}

export async function signUpTestUser(page: Page) {
  if (useRealAuth()) {
    return legacySignUp(page);
  }
  let lastConsoleError: string | null = null;
  const consoleErrors: string[] = [];
  const requestFailures: Array<{ url: string; errorText: string | null }> = [];
  const nodeModuleRequests: string[] = [];
  let lastPageError: { message: string; stack: string | null } | null = null;
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      lastConsoleError = msg.text();
      consoleErrors.push(msg.text());
      if (consoleErrors.length > 10) {
        consoleErrors.shift();
      }
    }
  });
  page.on("pageerror", (err) => {
    lastPageError = { message: err.message, stack: err.stack ?? null };
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure();
    requestFailures.push({
      url: req.url(),
      errorText: failure?.errorText ?? null,
    });
    if (requestFailures.length > 20) {
      requestFailures.shift();
    }
  });
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("node:module") || url.includes("node%3Amodule")) {
      nodeModuleRequests.push(url);
      if (nodeModuleRequests.length > 10) {
        nodeModuleRequests.shift();
      }
    }
  });
  const suffix = uniqueSuffix();
  const session = issueTestSession({
    name: `Desktop Tester ${suffix}`,
    email: `desktop+${suffix}@example.com`,
  });
  await primeBrowserSession(page, session);
  await page.goto("/_protected", { waitUntil: "domcontentloaded" });

  // If the init script / header injection didn’t land in time, TanStack Router
  // will redirect to `/login` before we can observe the test session. Patch the
  // session into the runtime and reload.
  if (page.url().includes("/login")) {
    await page.evaluate((initSession: TestSession) => {
      (
        globalThis as unknown as { __TEST_SESSION__?: { data: TestSession } }
      ).__TEST_SESSION__ = { data: initSession };
      try {
        window.sessionStorage?.setItem(
          "alfred:test-session",
          btoa(JSON.stringify(initSession))
        );
      } catch {
        // ignore
      }
    }, session);
    await page.goto("/_protected", { waitUntil: "domcontentloaded" });
  }
  try {
    await waitForDesktopReady(page);
  } catch (err) {
    const suffix = JSON.stringify({
      lastConsoleError,
      consoleErrors,
      lastPageError,
      requestFailures,
      nodeModuleRequests,
    });
    if (err instanceof Error) {
      err.message = `${err.message}\n\nplaywright_page_errors: ${suffix}`;
    }
    throw err;
  }
  return {
    name: session.user.name,
    email: session.user.email,
    password: "test-bypass",
  };
}

export function platformShortcutKey(key: string) {
  return process.platform === "darwin" ? `Meta+${key}` : `Control+${key}`;
}
