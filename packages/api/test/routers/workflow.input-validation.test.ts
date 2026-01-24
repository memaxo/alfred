import { describe, expect, it } from "bun:test";

import { parseWorkflowInputData } from "../../src/workflow/input";

describe("workflow input validation", () => {
  describe("parseWorkflowInputData", () => {
    it("parses valid object", () => {
      const input = { workspace: "/test", requirement: "test" };
      const result = parseWorkflowInputData(input);
      expect(result).toEqual(input);
    });

    it("returns empty object for null", () => {
      const result = parseWorkflowInputData(null);
      expect(result).toEqual({});
    });

    it("returns empty object for undefined", () => {
      const result = parseWorkflowInputData(undefined);
      expect(result).toEqual({});
    });

    it("returns empty object for arrays", () => {
      const result = parseWorkflowInputData([1, 2, 3]);
      expect(result).toEqual({});
    });

    it("returns empty object for primitives", () => {
      expect(parseWorkflowInputData("string")).toEqual({});
      expect(parseWorkflowInputData(123)).toEqual({});
      expect(parseWorkflowInputData(true)).toEqual({});
    });

    it("handles nested objects", () => {
      const input = {
        workspace: "/test",
        nested: { key: "value" },
        array: [1, 2, 3],
      };
      const result = parseWorkflowInputData(input);
      expect(result).toEqual(input);
    });

    it("handles empty object", () => {
      const result = parseWorkflowInputData({});
      expect(result).toEqual({});
    });

    it("preserves all string keys", () => {
      const input = {
        key1: "value1",
        key2: 123,
        key3: true,
        key4: null,
        key5: { nested: "value" },
      };
      const result = parseWorkflowInputData(input);
      expect(result).toEqual(input);
    });
  });
});
