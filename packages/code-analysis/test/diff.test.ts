import { describe, expect, it } from "bun:test";

import {
  categorizeFiles,
  getDiffStats,
  getFileExtension,
  parseDiffString,
} from "../src/diff";

const SAMPLE_DIFF = `diff --git a/src/index.ts b/src/index.ts
index 1234567..abcdefg 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,7 @@
 import { foo } from './foo';
+import { bar } from './bar';
 
 export function main() {
-  console.log('hello');
+  console.log('hello world');
+  bar();
 }
diff --git a/src/bar.ts b/src/bar.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/bar.ts
@@ -0,0 +1,3 @@
+export function bar() {
+  return 'bar';
+}
`;

describe("parseDiffString", () => {
  it("parses a unified diff into structured data", () => {
    const files = parseDiffString(SAMPLE_DIFF);

    expect(files.length).toBe(2);
    expect(files[0].path).toBe("src/index.ts");
    expect(files[1].path).toBe("src/bar.ts");
  });

  it("correctly identifies new files", () => {
    const files = parseDiffString(SAMPLE_DIFF);

    expect(files[0].isNew).toBe(false);
    expect(files[1].isNew).toBe(true);
  });

  it("counts additions and deletions", () => {
    const files = parseDiffString(SAMPLE_DIFF);

    // src/index.ts has 3 additions, 1 deletion
    expect(files[0].additions).toBe(3);
    expect(files[0].deletions).toBe(1);

    // src/bar.ts is new with 3 additions
    expect(files[1].additions).toBe(3);
    expect(files[1].deletions).toBe(0);
  });

  it("parses hunks with line numbers", () => {
    const files = parseDiffString(SAMPLE_DIFF);
    const { hunks } = files[0];

    expect(hunks.length).toBe(1);
    expect(hunks[0].oldStart).toBe(1);
    expect(hunks[0].newStart).toBe(1);
  });
});

describe("getDiffStats", () => {
  it("calculates correct statistics", () => {
    const files = parseDiffString(SAMPLE_DIFF);
    const stats = getDiffStats(files);

    expect(stats.totalFiles).toBe(2);
    expect(stats.totalAdditions).toBe(6);
    expect(stats.totalDeletions).toBe(1);
    expect(stats.newFiles).toBe(1);
    expect(stats.modifiedFiles).toBe(1);
  });
});

describe("getFileExtension", () => {
  it("extracts file extensions", () => {
    expect(getFileExtension("src/index.ts")).toBe("ts");
    expect(getFileExtension("README.md")).toBe("md");
    expect(getFileExtension("package.json")).toBe("json");
    expect(getFileExtension("Makefile")).toBe("");
  });
});

describe("categorizeFiles", () => {
  it("categorizes files by type", () => {
    const files = parseDiffString(SAMPLE_DIFF);
    const categories = categorizeFiles(files);

    expect(categories.source.length).toBe(2);
    expect(categories.tests.length).toBe(0);
    expect(categories.config.length).toBe(0);
  });
});
