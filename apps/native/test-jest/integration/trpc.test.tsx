import { act, renderHook, waitFor } from "@testing-library/react-native";
import type React from "react";
import { useNoteCreate, useNoteDelete, useNoteList } from "@/hooks/use-trpc";
import { trpc } from "@/utils/trpc";
import { createMockNote } from "../utils/mock-factories";
import { TestProviders } from "../utils/test-helpers";

// Mock tRPC
jest.mock("@/utils/trpc", () => ({
  trpc: {
    note: {
      list: { useQuery: jest.fn() },
      create: { useMutation: jest.fn() },
      delete: { useMutation: jest.fn() },
    },
  },
}));

describe("tRPC Integration Flows", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestProviders>{children}</TestProviders>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Notes Flow", () => {
    it("should create a note and then see it in the list", async () => {
      const mockNote = createMockNote({ id: "123", title: "Integration Test" });

      // Mock create mutation
      const mutate = jest.fn((_data, options) => {
        options?.onSuccess?.(mockNote);
      });
      (trpc.note.create.useMutation as jest.Mock).mockReturnValue({
        mutate,
        isPending: false,
      });

      // Mock list query
      (trpc.note.list.useQuery as jest.Mock).mockReturnValue({
        data: [mockNote],
        isLoading: false,
        refetch: jest.fn(),
      });

      // 1. Create note
      const { result: createResult } = renderHook(() => useNoteCreate(), {
        wrapper,
      });
      act(() => {
        createResult.current.mutate({
          title: "Integration Test",
          content: "Content",
        });
      });

      expect(mutate).toHaveBeenCalled();

      // 2. Fetch list
      const { result: listResult } = renderHook(
        () => useNoteList({ limit: 10, offset: 0 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(listResult.current.data).toHaveLength(1);
        expect(listResult.current.data?.[0].title).toBe("Integration Test");
      });
    });

    it("should delete a note", async () => {
      const mutate = jest.fn((_data, options) => {
        options?.onSuccess?.();
      });
      (trpc.note.delete.useMutation as jest.Mock).mockReturnValue({
        mutate,
        isPending: false,
      });

      const { result } = renderHook(() => useNoteDelete(), { wrapper });

      act(() => {
        result.current.mutate({ id: "123" });
      });

      expect(mutate).toHaveBeenCalledWith({ id: "123" }, expect.any(Object));
    });
  });
});

// Helper for act in hooks - already imported from @testing-library/react-native
