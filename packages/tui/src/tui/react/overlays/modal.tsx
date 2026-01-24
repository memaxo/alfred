/**
 * Modal Dialog - React Component
 *
 * Migrated from packages/tui/src/tui/views/focus.ts showModal
 * Uses OpenTUI React <box> and <text> components.
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";

import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";

export type ModalButton = {
  label: string;
  value: string;
};

export type ModalProps = {
  title: string;
  message: string;
  buttons?: ModalButton[];
  defaultButton?: string;
  isOpen: boolean;
  onClose: (value: string | null) => void;
};

export function Modal({
  title,
  message,
  buttons = [{ label: "OK", value: "ok" }],
  defaultButton,
  isOpen,
  onClose,
}: ModalProps) {
  const { width: termWidth, height: termHeight } = useTerminalDimensions();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Find default button index
  useEffect(() => {
    if (isOpen) {
      const defaultIdx = buttons.findIndex(
        (b) => b.value === (defaultButton ?? buttons[0]?.value)
      );
      setSelectedIndex(defaultIdx >= 0 ? defaultIdx : 0);
    }
  }, [isOpen, buttons, defaultButton]);

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!isOpen) {
        return;
      }

      // Close with Escape
      if (event.name === "escape") {
        onClose(null);
        return;
      }

      // Execute with Enter
      if (event.name === "enter") {
        const selected = buttons[selectedIndex];
        if (selected) {
          onClose(selected.value);
        }
        return;
      }

      // Navigate buttons
      if (event.name === "left" || event.name === "h") {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }

      if (event.name === "right" || event.name === "l") {
        setSelectedIndex((i) => Math.min(buttons.length - 1, i + 1));
        return;
      }

      if (event.name === "tab") {
        setSelectedIndex((i) => (i + 1) % buttons.length);
        return;
      }
    },
    [isOpen, buttons, selectedIndex, onClose]
  );

  useKeyboard(handleKeyboard);

  if (!isOpen) {
    return null;
  }

  // Calculate modal dimensions
  const modalWidth = Math.min(50, termWidth - 4);
  const modalHeight = 7;
  const x = Math.floor((termWidth - modalWidth) / 2);
  const y = Math.floor(termHeight / 2) - 3;

  // Wrap message to fit width
  const maxMessageWidth = modalWidth - 4;
  const messageLines: string[] = [];
  const words = message.split(" ");
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + word).length <= maxMessageWidth) {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    } else {
      if (currentLine) {
        messageLines.push(currentLine);
      }
      currentLine = word;
    }
  }
  if (currentLine) {
    messageLines.push(currentLine);
  }

  return (
    <box
      border
      height={modalHeight}
      left={x}
      style={{
        borderStyle: "single",
        borderColor: "#39BAE6",
        backgroundColor: "#0A0E14",
      }}
      title={title}
      top={y}
      width={modalWidth}
    >
      {/* Message */}
      <box height={messageLines.length + 1} top={1} width={modalWidth}>
        {messageLines.map((line, i) => (
          <text content={` ${line}`} key={i} style={{ fg: "#E6E6E6" }} />
        ))}
      </box>

      {/* Buttons */}
      <box height={2} top={modalHeight - 3} width={modalWidth}>
        <text
          content={buttons
            .map((button, i) => {
              const isSelected = i === selectedIndex;
              return isSelected ? `[ ${button.label} ]` : `  ${button.label}  `;
            })
            .join(" ")}
          style={{
            fg: "#E6E6E6",
          }}
        />
      </box>
    </box>
  );
}
