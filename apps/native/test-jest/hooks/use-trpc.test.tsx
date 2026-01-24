import { renderHook } from "@testing-library/react-native";

import {
  useBookmarkList,
  useNoteCreate,
  useNoteList,
  useReminderList,
  useTimerActive,
} from "@/hooks/use-trpc";

// Mock tRPC (these hooks are pure wrappers around `trpc.*.useQuery/useMutation`)
jest.mock("@/utils/trpc", () => ({
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
}));

import { trpc } from "@/utils/trpc";

describe("tRPC hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("useNoteList should call trpc.note.list.useQuery", () => {
    const mockQuery = { data: [], isLoading: false };
    (trpc.note.list.useQuery as jest.Mock).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useNoteList({ limit: 10, offset: 0 }), {
      // No providers needed: trpc hooks are mocked.
    });

    expect(trpc.note.list.useQuery).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
    });
    expect(result.current).toEqual(mockQuery);
  });

  it("useNoteCreate should call trpc.note.create.useMutation", () => {
    const mockMutation = { mutate: jest.fn(), isPending: false };
    (trpc.note.create.useMutation as jest.Mock).mockReturnValue(mockMutation);

    const { result } = renderHook(() => useNoteCreate());

    expect(trpc.note.create.useMutation).toHaveBeenCalled();
    expect(result.current).toEqual(mockMutation);
  });

  it("useReminderList should call trpc.remind.list.useQuery", () => {
    (trpc.remind.list.useQuery as jest.Mock).mockReturnValue({ data: [] });
    renderHook(() => useReminderList({ limit: 10, offset: 0 }));
    expect(trpc.remind.list.useQuery).toHaveBeenCalled();
  });

  it("useTimerActive should call trpc.timer.active.useQuery", () => {
    (trpc.timer.active.useQuery as jest.Mock).mockReturnValue({ data: [] });
    renderHook(() => useTimerActive());
    expect(trpc.timer.active.useQuery).toHaveBeenCalled();
  });

  it("useBookmarkList should call trpc.book.list.useQuery", () => {
    (trpc.book.list.useQuery as jest.Mock).mockReturnValue({ data: [] });
    renderHook(() => useBookmarkList({ limit: 100, offset: 0 }));
    expect(trpc.book.list.useQuery).toHaveBeenCalled();
  });
});
