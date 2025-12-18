#!/usr/bin/env bun
/**
 * Wrapper script for running Bun tests.
 *
 * Playwright E2E tests are in apps/web/.tests/ (hidden directory),
 * which Bun automatically excludes from discovery.
 *
 * Run Playwright tests separately with:
 *   bunx playwright test --config apps/web/playwright.config.ts
 */

import { $ } from "bun";

const args = process.argv.slice(2);
const result = await $`bun test ${args}`.quiet();
process.exit(result.exitCode ?? 0);
