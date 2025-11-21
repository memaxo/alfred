#!/usr/bin/env bash
# Run Bun tests, excluding Playwright .spec.ts files
# Playwright tests should be run separately with: bunx playwright test

# Find all .test.ts files excluding apps/web/tests (Playwright directory)
find . -name "*.test.ts" -not -path "*/node_modules/*" -not -path "*/apps/web/tests/*" -exec bun test {} +

