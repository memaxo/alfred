import { describe, expect, it } from "bun:test";

import { createEvent } from "../src/events";

describe("PipelineRunner", () => {
  it("creates events with timestamps", () => {
    const event = createEvent("stage:enter", { stage: "init" });

    expect(event.type).toBe("stage:enter");
    expect(event.stage).toBe("init");
    expect(event.timestamp).toBeGreaterThan(0);
  });
});
