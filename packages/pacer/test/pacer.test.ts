import { describe, expect, it } from "bun:test";
import { defaults, liteDebounce, liteThrottle, pacerKey } from "../src/index";

describe("@alfred/pacer (lite)", () => {
  it("pacerKey prefixes and joins parts", () => {
    expect(pacerKey(["ui", "desktop", "debounce"])).toBe(
      "alfred.ui.desktop.debounce"
    );
  });

  it("pacerKey rejects empty/whitespace parts", () => {
    expect(() => pacerKey([""])).toThrow();
    expect(() => pacerKey(["has space"])).toThrow();
  });

  it("exports defaults (named timings)", () => {
    expect(defaults.uiInputDebounceMs).toBeGreaterThan(0);
    expect(defaults.uiEventThrottleMs).toBeGreaterThan(0);
  });

  it("liteDebounce delays execution (trailing)", async () => {
    let n = 0;
    const fn = liteDebounce(
      () => {
        n += 1;
      },
      { wait: 25 }
    );

    fn();
    fn();
    fn();

    expect(n).toBe(0);
    await new Promise((r) => setTimeout(r, 60));
    expect(n).toBe(1);
  });

  it("liteThrottle executes leading and trailing", async () => {
    let n = 0;
    const fn = liteThrottle(
      () => {
        n += 1;
      },
      { wait: 25 }
    );

    fn(); // leading
    fn(); // throttled
    fn(); // throttled

    expect(n).toBe(1);
    await new Promise((r) => setTimeout(r, 60));
    expect(n).toBe(2);
  });
});
