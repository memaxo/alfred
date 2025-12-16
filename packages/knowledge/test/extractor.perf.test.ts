import { describe, expect, it } from "bun:test";
import { extract } from "../src/extractor";
import { extractEntities } from "../src/extractor";
import { extractTemporal } from "../src/extractor";

// budget: fact-extraction

describe("extract() performance budget", () => {
  const SAMPLE_TEXT =
    "Dr. Alice Smith from Google Inc met Bob at 3pm yesterday. They discussed the project timeline and agreed to meet again next week.";

  it("completes within 10ms budget per cognitive architecture rule", () => {
    // Warmup
    for (let i = 0; i < 10; i++) {
      extract(SAMPLE_TEXT, "warmup");
    }

    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      extract(SAMPLE_TEXT, "perf-test");
      times.push(performance.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBeLessThan(10); // <10ms per `.ruler/11-cognitive-architecture.md` Rule 5
  });
});

describe("extractEntities() performance budget", () => {
  const SAMPLE_TEXT =
    "Dr. Alice Smith from Google Inc met Bob at 3pm yesterday.";

  it("completes within 5ms budget", () => {
    // Warmup
    for (let i = 0; i < 10; i++) {
      extractEntities(SAMPLE_TEXT);
    }

    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      extractEntities(SAMPLE_TEXT);
      times.push(performance.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    // CI runners are consistently slower than local dev machines.
    // This budget is intentionally loose in CI to avoid false negatives from
    // shared runners / CPU throttling, while still catching real blowups.
    const budgetMs = process.env.CI ? 40 : 5;
    expect(avg).toBeLessThan(budgetMs);
  });
});

describe("extractTemporal() performance budget", () => {
  const SAMPLE_TEXT = "Meet at 3pm yesterday or next week on Monday.";

  it("completes within 3ms budget", () => {
    // Warmup
    for (let i = 0; i < 10; i++) {
      extractTemporal(SAMPLE_TEXT);
    }

    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      extractTemporal(SAMPLE_TEXT);
      times.push(performance.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBeLessThan(3);
  });
});

