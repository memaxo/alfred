import "@/test/dom";
import { capabilities } from "@alfred/agent/capability";
import { describe, expect, it } from "bun:test";

import { windowRegistry } from "@/components/desktop/windows/registry";

describe("capability registry parity", () => {
  it("only references known web window types", () => {
    const known = new Set(Object.keys(windowRegistry));
    const unknown = capabilities
      .map((c) => c.webWindowType)
      .filter((t): t is string => typeof t === "string" && t.length > 0)
      .filter((t) => !known.has(t));

    expect(unknown).toEqual([]);
  });
});
