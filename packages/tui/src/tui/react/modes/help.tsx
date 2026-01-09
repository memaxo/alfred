/**
 * Help Mode - React Component
 *
 * Shows key bindings, headless usage, and mode navigation.
 * Migrated from packages/tui/src/tui/modes/help.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useCallback } from "react";

export type HelpModeProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function HelpMode({ isOpen, onClose }: HelpModeProps) {
  const { width, height } = useTerminalDimensions();

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!isOpen) {
        return;
      }

      if (event.name === "escape" || event.name === "q") {
        onClose();
        return;
      }
    },
    [isOpen, onClose]
  );

  useKeyboard(handleKeyboard);

  if (!isOpen) {
    return null;
  }

  return (
    <box
      height={height}
      left={0}
      style={{ backgroundColor: "#0A0E14" }}
      top={0}
      width={width}
    >
      <box
        border
        height={height - 1}
        style={{ borderStyle: "single", borderColor: "#39BAE6" }}
        title="ALFRED Help"
        width={width}
      >
        <scrollbox focused={true}>
          <text content="" />
          <text content=" Keyboard Shortcuts" style={{ fg: "#8A9199" }} />
          <text content="" />

          <text content="  ?         Help" style={{ fg: "#39BAE6" }} />
          <text
            content="  :         Command palette"
            style={{ fg: "#39BAE6" }}
          />
          <text
            content="  Space     Toggle focus layout"
            style={{ fg: "#39BAE6" }}
          />
          <text content="  Tab       Next panel" style={{ fg: "#39BAE6" }} />
          <text
            content="  Shift+Tab Previous panel"
            style={{ fg: "#39BAE6" }}
          />
          <text
            content="  q         Quit (dashboard)"
            style={{ fg: "#39BAE6" }}
          />
          <text
            content="  Esc       Back/Exit (modes)"
            style={{ fg: "#39BAE6" }}
          />
          <text content="" />

          <text content=" Modes" style={{ fg: "#8A9199" }} />
          <text content="" />
          <text content="  Ctrl+D    Debug" style={{ fg: "#39BAE6" }} />
          <text content="  Ctrl+T    Chat" style={{ fg: "#39BAE6" }} />
          <text content="  Ctrl+P    Planner" style={{ fg: "#39BAE6" }} />
          <text content="" />

          <text content=" Command Palette" style={{ fg: "#8A9199" }} />
          <text content="" />
          <text
            content="  : open    Type to filter commands"
            style={{ fg: "#39BAE6" }}
          />
          <text content="  Enter run Esc to close" style={{ fg: "#39BAE6" }} />
          <text content="" />

          <text content=" Headless / CI" style={{ fg: "#8A9199" }} />
          <text content="" />
          <text
            content="  alfred tui --headless (required without a TTY)"
            style={{ fg: "#39BAE6" }}
          />
          <text
            content="  ALFRED_TUI_HEADLESS=true env alternative"
            style={{ fg: "#8A9199" }}
          />
        </scrollbox>
      </box>

      {/* Footer / Hint Bar */}
      <box
        height={1}
        style={{ backgroundColor: "#39BAE6" }}
        top={height - 1}
        width={width}
      >
        <text content=" [Esc] Back | [q] Back" style={{ fg: "#0A0E14" }} />
      </box>
    </box>
  );
}
