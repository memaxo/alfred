import { describe, expect, it } from "bun:test";

import {
  detectBugs,
  filterBugsBySeverity,
  getBugSeverityStats,
} from "../src/detect";
import { parseDiffString } from "../src/diff";

const DIFF_WITH_BUGS = `diff --git a/src/unsafe.ts b/src/unsafe.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/unsafe.ts
@@ -0,0 +1,20 @@
+const API_KEY = "sk-secret-12345";
+
+function query(input: string) {
+  const sql = \`SELECT * FROM users WHERE id = \${input}\`;
+  return db.execute(sql);
+}
+
+function risky() {
+  eval("console.log('danger')");
+}
+
+function ignoreError() {
+  try {
+    doSomething();
+  } catch (e) {}
+}
+
+function typed(value: any): void {
+  console.log(value);
+}
`;

const DIFF_CLEAN = `diff --git a/src/safe.ts b/src/safe.ts
new file mode 100644
index 0000000..2222222
--- /dev/null
+++ b/src/safe.ts
@@ -0,0 +1,5 @@
+export function greet(name: string): string {
+  return \`Hello, \${name}!\`;
+}
`;

describe("detectBugs", () => {
  it("detects hardcoded secrets", () => {
    const files = parseDiffString(DIFF_WITH_BUGS);
    const bugs = detectBugs(files);

    const secretBug = bugs.find(
      (b) => b.type === "security" && b.description.includes("secret")
    );
    expect(secretBug).toBeDefined();
    expect(secretBug?.severity).toBe("critical");
  });

  it("detects multiple security issues", () => {
    const files = parseDiffString(DIFF_WITH_BUGS);
    const bugs = detectBugs(files);

    // Should find at least 2 critical security issues (secret and eval)
    const criticalBugs = bugs.filter(
      (b) => b.severity === "critical" || b.severity === "high"
    );
    expect(criticalBugs.length).toBeGreaterThanOrEqual(2);
  });

  it("detects eval usage", () => {
    const files = parseDiffString(DIFF_WITH_BUGS);
    const bugs = detectBugs(files);

    const evalBug = bugs.find((b) => b.description.includes("eval"));
    expect(evalBug).toBeDefined();
    expect(evalBug?.severity).toBe("high");
  });

  it("detects empty catch blocks", () => {
    const files = parseDiffString(DIFF_WITH_BUGS);
    const bugs = detectBugs(files);

    const catchBug = bugs.find((b) => b.description.includes("Empty catch"));
    expect(catchBug).toBeDefined();
    expect(catchBug?.severity).toBe("medium");
  });

  it("detects any type usage", () => {
    const files = parseDiffString(DIFF_WITH_BUGS);
    const bugs = detectBugs(files);

    const anyBug = bugs.find((b) => b.description.includes('"any" type'));
    expect(anyBug).toBeDefined();
    expect(anyBug?.severity).toBe("low");
  });

  it("returns empty array for clean code", () => {
    const files = parseDiffString(DIFF_CLEAN);
    const bugs = detectBugs(files);

    expect(bugs.length).toBe(0);
  });
});

describe("getBugSeverityStats", () => {
  it("counts bugs by severity", () => {
    const files = parseDiffString(DIFF_WITH_BUGS);
    const bugs = detectBugs(files);
    const stats = getBugSeverityStats(bugs);

    expect(stats.critical).toBeGreaterThan(0);
    expect(stats.high).toBeGreaterThan(0);
    expect(stats.medium).toBeGreaterThan(0);
    expect(stats.low).toBeGreaterThan(0);
  });
});

describe("filterBugsBySeverity", () => {
  it("filters bugs by minimum severity", () => {
    const files = parseDiffString(DIFF_WITH_BUGS);
    const bugs = detectBugs(files);

    const criticalOnly = filterBugsBySeverity(bugs, "critical");
    const highAndAbove = filterBugsBySeverity(bugs, "high");

    expect(criticalOnly.every((b) => b.severity === "critical")).toBe(true);
    expect(
      highAndAbove.every((b) => ["critical", "high"].includes(b.severity))
    ).toBe(true);
    expect(highAndAbove.length).toBeGreaterThanOrEqual(criticalOnly.length);
  });
});
