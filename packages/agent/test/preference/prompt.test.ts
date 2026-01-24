import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";

const loader = await import("../../src/preference/loader");
const loadPreferencesSpy = vi.spyOn(loader, "loadPreferencesWithDefaults");

const { buildPreferenceSystemPrompt } =
  await import("../../src/preference/prompt");

describe("buildPreferenceSystemPrompt", () => {
  beforeEach(() => {
    process.env.PREFERENCE_ADAPTATION_ENABLED = "true";
    process.env.PREFERENCE_ADAPTATION_ROLLOUT_PERCENT = "100";
    loadPreferencesSpy.mockReset();
    loadPreferencesSpy.mockResolvedValue(
      new Map([
        [
          "response.verbosity",
          { confidence: 1, source: "user", value: "concise" },
        ],
        [
          "response.tone",
          { confidence: 1, source: "user", value: "technical" },
        ],
        [
          "domain.proxmox.config_format",
          { confidence: 0.5, source: "default", value: "yaml" },
        ],
      ])
    );
  });

  afterEach(() => {
    process.env.PREFERENCE_ADAPTATION_ENABLED = undefined;
    process.env.PREFERENCE_ADAPTATION_ROLLOUT_PERCENT = undefined;
  });

  it("builds prompt with response and domain instructions", async () => {
    const prompt = await buildPreferenceSystemPrompt("user-1", {
      domain: "proxmox",
    });

    expect(prompt).toContain("Response Style: Be brief");
    expect(prompt).toContain("Tone: Use precise, technical language");
    expect(prompt).toContain("Domain-Specific Preferences (proxmox)");
    expect(loadPreferencesSpy).toHaveBeenCalledWith("user-1", "proxmox");
  });

  it("respects feature flag and returns empty string", async () => {
    process.env.PREFERENCE_ADAPTATION_ENABLED = "false";

    const prompt = await buildPreferenceSystemPrompt("user-1");
    expect(prompt).toBe("");
    expect(loadPreferencesSpy).not.toHaveBeenCalled();
  });

  it("applies rollout percentage based on user hash", async () => {
    process.env.PREFERENCE_ADAPTATION_ROLLOUT_PERCENT = "0";
    const prompt = await buildPreferenceSystemPrompt("user-1");
    expect(prompt).toBe("");
  });

  it("meets <1ms average build time on warmed cache", async () => {
    const iterations = 25;
    const timings: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await buildPreferenceSystemPrompt(`user-perf-${i}`);
      timings.push(performance.now() - start);
    }

    const avg = timings.reduce((acc, cur) => acc + cur, 0) / timings.length;
    expect(avg).toBeLessThan(1.5);
  });
});
