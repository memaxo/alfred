import { renderHook } from "@testing-library/react-native";

import {
  useBookmarkList,
  useNoteCreate,
  useNoteList,
  useReminderList,
  useTimerActive,
} from "@/hooks/use-trpc";

// Mock tRPC (these hooks are pure wrappers around `trpc.*.useQuery/useMutation`)
jest.mock<typeof import("@/utils/trpc")>(
  "@/utils/trpc",
  () =>
    ({
      trpc: {
        note: {
          list: { useQuery: jest.fn() },
          create: { useMutation: jest.fn() },
        },
        remind: {
          list: { useQuery: jest.fn() },
        },
        timer: {
          active: { useQuery: jest.fn() },
        },
        book: {
          list: { useQuery: jest.fn() },
        },
      },
      createTrpcClient: jest.fn(),
      queryClient: {},
    }) as unknown as typeof import("@/utils/trpc")
);

import { trpc } from "@/utils/trpc";

describe("tRPC hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("useNoteList should call trpc.note.list.useQuery", () => {
    const mockQuery = { data: [], isLoading: false } as unknown as ReturnType<
      typeof trpc.note.list.useQuery
    >;
    jest.mocked(trpc.note.list.useQuery).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useNoteList({ limit: 10, offset: 0 }), {
      // No providers needed: trpc hooks are mocked.
    });

    expect(trpc.note.list.useQuery).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
    });
    expect(result.current).toStrictEqual(mockQuery);
  });

  it("useNoteCreate should call trpc.note.create.useMutation", () => {
    const mockMutation = {
      mutate: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof trpc.note.create.useMutation>;
    jest.mocked(trpc.note.create.useMutation).mockReturnValue(mockMutation);

    const { result } = renderHook(() => useNoteCreate());

    expect(trpc.note.create.useMutation).toHaveBeenCalledWith();
    expect(result.current).toStrictEqual(mockMutation);
  });

  it("useReminderList should call trpc.remind.list.useQuery", () => {
    jest
      .mocked(trpc.remind.list.useQuery)
      .mockReturnValue({ data: [] } as unknown as ReturnType<
        typeof trpc.remind.list.useQuery
      >);
    renderHook(() => useReminderList({ limit: 10, offset: 0 }));
    expect(trpc.remind.list.useQuery).toHaveBeenCalledWith();
  });

  it("useTimerActive should call trpc.timer.active.useQuery", () => {
    jest
      .mocked(trpc.timer.active.useQuery)
      .mockReturnValue({ data: [] } as unknown as ReturnType<
        typeof trpc.timer.active.useQuery
      >);
    renderHook(() => useTimerActive());
    expect(trpc.timer.active.useQuery).toHaveBeenCalledWith();
  });

  it("useBookmarkList should call trpc.book.list.useQuery", () => {
    jest
      .mocked(trpc.book.list.useQuery)
      .mockReturnValue({ data: [] } as unknown as ReturnType<
        typeof trpc.book.list.useQuery
      >);
    renderHook(() => useBookmarkList({ limit: 100, offset: 0 }));
    expect(trpc.book.list.useQuery).toHaveBeenCalledWith();
  });
});
