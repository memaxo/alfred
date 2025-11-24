import "@/test/dom";
import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useCognitiveFeedback } from "@/hooks/use-cognitive-feedback";

describe("useCognitiveFeedback", () => {
  it("submits feedback successfully", async () => {
    const responseBody = [{ result: { data: { state: { _: "reflecting" } } } }];
    const fetchMock = mock(async () => ({
      ok: true,
      json: async () => responseBody,
    }));
    // @ts-expect-error - override global fetch for test
    globalThis.fetch = fetchMock;

    const { result } = renderHook(() => useCognitiveFeedback());
    await act(async () => {
      await result.current.submit({
        streamId: "stream-1",
        expected: "expected",
        actual: "actual",
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("success");
    expect(result.current.error).toBeNull();
  });

  it("records errors when request fails", async () => {
    const fetchMock = mock(async () => ({
      ok: false,
      status: 500,
    }));
    // @ts-expect-error - test double
    globalThis.fetch = fetchMock;

    const { result } = renderHook(() => useCognitiveFeedback());

    await act(async () => {
      await expect(
        result.current.submit({
          streamId: "stream-err",
          expected: "expected",
          actual: "actual",
        })
      ).rejects.toThrow();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
