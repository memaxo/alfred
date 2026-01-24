import { makeEventId } from "@alfred/type/id";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

const OLD_ENV = { ...process.env } as NodeJS.ProcessEnv;

beforeEach(() => {
  process.env.DETERMINISTIC_EVENT_IDS = "1";
});

afterEach(() => {
  process.env = OLD_ENV;
});

describe("makeEventId", () => {
  it("uses stable hash when deterministic ids enabled", () => {
    const id1 = makeEventId({
      runId: "r1",
      type: "progress",
      data: { pct: 10, message: "ok" },
    });
    const id2 = makeEventId({
      runId: "r1",
      type: "progress",
      data: { message: "ok", pct: 10 },
    });
    expect(id1).toEqual(id2);
  });

  it("changes when payload changes", () => {
    const id1 = makeEventId({
      runId: "r1",
      type: "progress",
      data: { pct: 10 },
    });
    const id2 = makeEventId({
      runId: "r1",
      type: "progress",
      data: { pct: 11 },
    });
    expect(id1).not.toEqual(id2);
  });
});
