import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { metricsStub } from "./utils/mock-metrics";

const invalidatePreferenceCacheMock = vi.fn().mockResolvedValue(undefined);
const runPreferenceInferenceMock = vi.fn().mockResolvedValue(undefined);

mock.module("@alfred/agent/preference/loader", () => ({
  invalidatePreferenceCache: invalidatePreferenceCacheMock,
}));

mock.module("../src/scheduler/preference-inference", () => ({
  runPreferenceInference: runPreferenceInferenceMock,
}));

const {
  triggerPreferenceRefresh,
  __flushPreferenceRefreshQueueForTests,
  __resetPreferenceRefreshQueueForTests,
} = await import("../src/preference/refresh");

describe("triggerPreferenceRefresh", () => {
  beforeEach(() => {
    invalidatePreferenceCacheMock.mockReset().mockResolvedValue(undefined);
    runPreferenceInferenceMock.mockReset().mockResolvedValue(undefined);
    __resetPreferenceRefreshQueueForTests();
    metricsStub.preferenceCacheInvalidationsTotal.inc.mockReset();
    metricsStub.preferenceRefreshTotal.inc.mockReset();
  });

  it("invalidates caches immediately and runs inference on flush", async () => {
    triggerPreferenceRefresh("user-1", { reason: "test", debounceMs: 0 });

    await __flushPreferenceRefreshQueueForTests();

    expect(invalidatePreferenceCacheMock).toHaveBeenCalledWith("user-1");
    expect(runPreferenceInferenceMock).toHaveBeenCalledWith("user-1");
    expect(
      metricsStub.preferenceCacheInvalidationsTotal.inc
    ).toHaveBeenCalledWith({ reason: "test" });
    expect(metricsStub.preferenceRefreshTotal.inc).toHaveBeenCalledWith({
      reason: "test",
    });
  });

  it("deduplicates repeated triggers before flush", async () => {
    triggerPreferenceRefresh("user-1");
    triggerPreferenceRefresh("user-1");
    triggerPreferenceRefresh("user-1", { reason: "duplicate" });

    await __flushPreferenceRefreshQueueForTests();

    expect(runPreferenceInferenceMock).toHaveBeenCalledTimes(1);
    expect(runPreferenceInferenceMock).toHaveBeenCalledWith("user-1");
  });

  it("ignores falsy user identifiers", async () => {
    triggerPreferenceRefresh(undefined);
    triggerPreferenceRefresh(null);

    await __flushPreferenceRefreshQueueForTests();

    expect(invalidatePreferenceCacheMock).not.toHaveBeenCalled();
    expect(runPreferenceInferenceMock).not.toHaveBeenCalled();
    expect(
      metricsStub.preferenceCacheInvalidationsTotal.inc
    ).not.toHaveBeenCalled();
    expect(metricsStub.preferenceRefreshTotal.inc).not.toHaveBeenCalled();
  });
});
