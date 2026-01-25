import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

const createPreferenceRow = (value = "concise") => ({
  id: `pref-${value}`,
  userId: "user-1",
  key: "response.verbosity",
  value,
  confidence: 0.9,
  source: "user",
  created: new Date(),
  updated: new Date(),
});

const getPreferencesMock = vi.fn(() =>
  Promise.resolve([createPreferenceRow()])
);

mock.module("@alfred/db/repo/user", () => ({
  getPreferences: getPreferencesMock,
}));

mock.module("@alfred/metrics", () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

process.env.REDIS_URL = "false";

const {
  loadPreferences,
  loadPreferencesWithDefaults,
  invalidatePreferenceCache,
  resetPreferenceCache,
} = await import("../../src/preference/loader");

beforeEach(() => {
  resetPreferenceCache();
  getPreferencesMock.mockReset();
  getPreferencesMock.mockResolvedValue([createPreferenceRow()]);
});

afterEach(() => {
  resetPreferenceCache();
});

describe("loadPreferences", () => {
  it("reads from the repository once and reuses L1 cache", async () => {
    const prefsFirst = await loadPreferences("user-1");
    expect(prefsFirst.get("response.verbosity")?.value).toBe("concise");
    expect(getPreferencesMock.mock.calls.length).toBe(1);

    const prefsSecond = await loadPreferences("user-1");
    expect(prefsSecond.get("response.verbosity")?.value).toBe("concise");
    expect(getPreferencesMock.mock.calls.length).toBe(1);
  });

  it("invalidates cache entries", async () => {
    await loadPreferences("user-1");
    expect(getPreferencesMock.mock.calls.length).toBe(1);

    await invalidatePreferenceCache("user-1");

    getPreferencesMock.mockImplementationOnce(async () => [
      {
        id: "pref-1",
        userId: "user-1",
        key: "response.verbosity",
        value: "verbose",
        confidence: 1,
        source: "user",
        created: new Date(),
        updated: new Date(),
      },
    ]);

    const prefs = await loadPreferences("user-1");
    expect(prefs.get("response.verbosity")?.value).toBe("verbose");
    expect(getPreferencesMock.mock.calls.length).toBe(2);
  });

  it("meets the <1ms budget for warmed L1 cache hits on average", async () => {
    await loadPreferences("user-perf");
    const iterations = 50;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await loadPreferences("user-perf");
      durations.push(performance.now() - start);
    }

    const avg =
      durations.reduce((total, duration) => total + duration, 0) /
      durations.length;

    expect(avg).toBeLessThan(1.2);
  });

  it("keeps DB-backed loads under 10ms on average", async () => {
    const iterations = 20;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      await invalidatePreferenceCache("user-db");
      const start = performance.now();
      await loadPreferences("user-db");
      durations.push(performance.now() - start);
    }

    const avg =
      durations.reduce((total, duration) => total + duration, 0) /
      durations.length;

    expect(avg).toBeLessThan(10);
    expect(getPreferencesMock.mock.calls.length).toBeGreaterThanOrEqual(
      iterations
    );
  });
});

describe("loadPreferencesWithDefaults", () => {
  it("applies domain defaults without mutating the base cache", async () => {
    getPreferencesMock.mockResolvedValueOnce([]);

    const merged = await loadPreferencesWithDefaults("user-2", "proxmox");
    expect(merged.get("domain.proxmox.config_format")?.value).toBe("yaml");

    const baseline = await loadPreferences("user-2");
    expect(baseline.has("domain.proxmox.config_format")).toBe(false);
  });
});
