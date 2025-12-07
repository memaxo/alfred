import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MindscapeCommandPalette } from "../mindscape/command-palette";

// Use mock.module for mocking imports in bun:test
mock.module("@/hooks/use-command-usage", () => ({
  useCommandUsage: () => ({
    getUsage: () => ({ "New Chat": 5 }),
    recordUsage: mock(),
  }),
}));

const mockStore = {
  focusedNodeId: null,
  removeArtifact: mock(),
  updateArtifactData: mock(),
};

mock.module("@/store/mindscape", () => ({
  useMindscapeStore: (selector: any) => selector(mockStore),
}));

// Mock the UI components that might use unsupported DOM APIs if any
mock.module("@/components/ui/command", () => ({
  CommandDialog: ({ children, open }: any) =>
    open ? <div role="dialog">{children}</div> : null,
  CommandInput: ({
    placeholder,
    onValueChange,
    onKeyDown,
    value,
    suggestion,
  }: any) => (
    <div>
      <input
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        value={value}
      />
      {suggestion && <span>{suggestion}</span>}
    </div>
  ),
  CommandList: ({ children }: any) => <ul>{children}</ul>,
  CommandEmpty: () => null,
  CommandGroup: ({ heading, children }: any) => (
    <div>
      <h3>{heading}</h3>
      {children}
    </div>
  ),
  CommandItem: ({ children, onSelect }: any) => (
    <li onClick={onSelect}>{children}</li>
  ),
  CommandShortcut: () => null,
  CommandSeparator: () => null,
}));

// Helper to open palette
const openPalette = () => {
  // Simulate opening by rendering with open=true prop?
  // No, the component manages its own state via event listener.
  // In JSDOM/HappyDOM, we dispatch the event.
  const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
  window.dispatchEvent(event);
};

describe("MindscapeCommandPalette", () => {
  afterEach(cleanup);

  it("should open on Cmd+K", async () => {
    render(
      <MindscapeCommandPalette onFocus={mock()} onSpawn={mock()} />
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    openPalette();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
  });

  it("should show create actions by default", async () => {
    render(
      <MindscapeCommandPalette onFocus={mock()} onSpawn={mock()} />
    );
    openPalette();

    await waitFor(() => {
      expect(screen.getByText("New Chat")).toBeTruthy();
      expect(screen.getByText("New Note")).toBeTruthy();
    });
  });

  // Skip filter test as we mocked CommandList which normally handles filtering via cmk
  // In a real integration test we'd want the real cmk, but it requires full DOM.

  it("should show ghost text suggestion", async () => {
    render(
      <MindscapeCommandPalette onFocus={mock()} onSpawn={mock()} />
    );
    openPalette();

    const input = screen.getByPlaceholderText(/Create or jump/i);
    fireEvent.change(input, { target: { value: "wri" } });

    await waitFor(() => {
      // Our mock Input renders suggestion in a span
      // The logic for calculating suggestion is in the component, so it should render.
      // "wri" -> "write" (alias for New Note) -> matches "New Note" label?
      // Trie stores: insert("write", "New Note", score)
      // findCompletion("wri") -> returns value "New Note"
      // So suggestion should be "New Note"? Wait, Trie returns VALUE.
      // Does it return completion text? Yes { completion: "write...", value: "New Note" }
      // But Palette uses `match.value` as suggestion?
      // Let's check Palette code: `return match ? match.value : undefined`
      // So suggestion will be "New Note".

      expect(screen.getByText("New Note")).toBeTruthy();
    });
  });
});
