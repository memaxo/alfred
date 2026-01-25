import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useNoteCreate, useNoteDelete, useNoteList } from "@/hooks/use-trpc";
import { trpc } from "@/utils/trpc";

import { createMockNote } from "../utils/mock-factories";

// Mock tRPC
jest.mock<typeof import("@/utils/trpc")>(
  "@/utils/trpc",
  () =>
    ({
      trpc: {
        note: {
          list: { useQuery: jest.fn() },
          create: { useMutation: jest.fn() },
          delete: { useMutation: jest.fn() },
        },
      },
      createTrpcClient: jest.fn(),
      queryClient: {},
    }) as unknown as typeof import("@/utils/trpc")
);

describe("tRPC Integration Flows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("notes Flow", () => {
    it("should create a note and then see it in the list", async () => {
      const mockNote = createMockNote({ id: "123", title: "Integration Test" });

      // Mock create mutation
      const mutate = jest.fn((_data, options) => {
        options?.onSuccess?.(mockNote);
      });
      jest.mocked(trpc.note.create.useMutation).mockReturnValue({
        mutate,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.note.create.useMutation>);

      // Mock list query
      jest.mocked(trpc.note.list.useQuery).mockReturnValue({
        data: [mockNote],
        isLoading: false,
        refetch: jest.fn(),
      } as unknown as ReturnType<typeof trpc.note.list.useQuery>);

      // 1. Create note
      const { result: createResult } = renderHook(() => useNoteCreate());
      act(() => {
        createResult.current.mutate({
          title: "Integration Test",
          content: "Content",
        });
      });

      expect(mutate).toHaveBeenCalledWith({
        title: "Integration Test",
        content: "Content",
      });

      // 2. Fetch list
      const { result: listResult } = renderHook(() =>
        useNoteList({ limit: 10, offset: 0 })
      );

      await waitFor(() => {
        expect(listResult.current.data).toHaveLength(1);
        expect(listResult.current.data?.[0].title).toBe("Integration Test");
      });
    });

    it("should delete a note", () => {
      const mutate = jest.fn();
      jest.mocked(trpc.note.delete.useMutation).mockReturnValue({
        mutate,
        isPending: false,
      } as unknown as ReturnType<typeof trpc.note.delete.useMutation>);

      const { result } = renderHook(() => useNoteDelete());

      act(() => {
        result.current.mutate({ id: "123" });
      });

      expect(mutate).toHaveBeenCalledWith({ id: "123" });
    });
  });
});

// Helper for act in hooks - already imported from @testing-library/react-native
