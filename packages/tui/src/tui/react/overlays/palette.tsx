/**
 * Command Palette - React Component
 *
 * Migrated from packages/tui/src/tui/views/dashboard.ts renderCommandPalette
 * Uses OpenTUI React <input> and <scrollbox> components.
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";

import { TextAttributes } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";

import type { Command } from "../../input/commands";

import { searchCommands } from "../../input/commands";

export type CommandPaletteProps = {
  commands: Command[];
  isOpen: boolean;
  onClose: () => void;
  onExecute: (command: Command) => void;
};

export function CommandPalette({
  commands,
  isOpen,
  onClose,
  onExecute,
}: CommandPaletteProps) {
  const { width: termWidth, height: termHeight } = useTerminalDimensions();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = searchCommands(commands, query);
  const visibleCommands = filteredCommands.slice(0, 8); // Show up to 8 commands

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!isOpen) {
        return;
      }

      const alt = (event as { alt?: boolean }).alt ?? false;

      // Close with Escape
      if (event.name === "escape") {
        onClose();
        return;
      }

      // Navigate with arrows
      if (event.name === "up") {
        setSelectedIndex((i) => (i > 0 ? i - 1 : filteredCommands.length - 1));
        return;
      }
      if (event.name === "down") {
        setSelectedIndex((i) => (i < filteredCommands.length - 1 ? i + 1 : 0));
        return;
      }

      // Execute with Enter
      if (event.name === "enter") {
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          onExecute(selected);
          onClose();
        }
        return;
      }

      // Backspace
      if (event.name === "backspace") {
        setQuery((q) => q.slice(0, -1));
        return;
      }

      // Type characters (capture all text input when open)
      if (event.name.length === 1 && !event.ctrl && !alt && !event.shift) {
        setQuery((q) => q + event.name);
        return;
      }

      // Capture all other events when open to prevent dashboard from handling them
      // (This prevents Tab, etc. from affecting dashboard when palette is open)
    },
    [isOpen, filteredCommands, selectedIndex, onClose, onExecute]
  );

  useKeyboard(handleKeyboard);

  if (!isOpen) {
    return null;
  }

  // Calculate palette dimensions
  const paletteWidth = Math.min(60, termWidth - 4);
  const paletteHeight = Math.min(12, visibleCommands.length + 4);
  const x = Math.floor((termWidth - paletteWidth) / 2);
  const y = Math.floor((termHeight - paletteHeight) / 2);

  return (
    <box
      border
      height={paletteHeight}
      left={x}
      style={{
        borderStyle: "single",
        borderColor: "#39BAE6",
        backgroundColor: "#0A0E14",
      }}
      title="Commands"
      top={y}
      width={paletteWidth}
    >
      {/* Search input */}
      <box height={1} top={1} width={paletteWidth}>
        <text
          content={`> ${query}▌`}
          style={{
            fg: "#39BAE6",
            attributes: TextAttributes.BOLD,
          }}
        />
      </box>

      {/* Separator */}
      <box height={1} top={2} width={paletteWidth}>
        <text
          content={"─".repeat(paletteWidth - 2)}
          style={{ fg: "#5C6370" }}
        />
      </box>

      {/* Command list */}
      <scrollbox
        focused={true}
        height={paletteHeight - 4}
        left={1}
        top={3}
        width={paletteWidth - 2}
      >
        {visibleCommands.map((cmd, i) => {
          const isSelected = i === selectedIndex;
          const prefix = isSelected ? " > " : "   ";
          const shortcut = cmd.shortcut ? ` [${cmd.shortcut}]` : "";

          return (
            <text
              content={`${prefix}${cmd.label}${shortcut}`}
              key={cmd.id}
              style={{
                fg: isSelected ? "#39BAE6" : "#E6E6E6",
                bg: isSelected ? "#1A1F29" : undefined,
                attributes: isSelected ? TextAttributes.BOLD : undefined,
              }}
            />
          );
        })}
        {filteredCommands.length === 0 && (
          <text content="  No commands found" style={{ fg: "#8A9199" }} />
        )}
      </scrollbox>
    </box>
  );
}
