/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";

import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";

export interface ModelOption {
  id: string;
  label: string;
  provider: "mlx" | "openai" | "anthropic" | "local";
}

export const MODELS: ModelOption[] = [
  {
    id: "mlx-community/GLM-4.7-Flash-8bit-gs32",
    label: "GLM-4.7 Flash (MLX)",
    provider: "mlx",
  },
  {
    id: "LiquidAI/LFM2.5-1.2B-Thinking-MLX-8bit",
    label: "LFM2.5 Thinking (MLX)",
    provider: "mlx",
  },
  { id: "openai:gpt-4o", label: "GPT-4o (OpenAI)", provider: "openai" },
  {
    id: "openai:gpt-4o-mini",
    label: "GPT-4o Mini (OpenAI)",
    provider: "openai",
  },
  {
    id: "anthropic:claude-3-5-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "anthropic",
  },
];

interface ModelPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (model: ModelOption) => void;
  selectedId?: string;
  width: number;
  height: number;
}

export function ModelPicker({
  isOpen,
  onClose,
  onSelect,
  selectedId,
  width,
  height,
}: ModelPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const idx = MODELS.findIndex((m) => m.id === selectedId);
    return Math.max(idx, 0);
  });

  useEffect(() => {
    const idx = MODELS.findIndex((m) => m.id === selectedId);
    if (idx !== -1) {
      setSelectedIndex(idx);
    }
  }, [selectedId]);

  const handleKeyboard = useCallback(
    async (e: KeyEvent) => {
      if (!isOpen) {
        return;
      }

      if (e.name === "escape") {
        onClose();
        return;
      }

      if (e.name === "up") {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }

      if (e.name === "down") {
        setSelectedIndex((i) => Math.min(MODELS.length - 1, i + 1));
        return;
      }

      if (e.name === "enter") {
        const model = MODELS[selectedIndex];
        if (model) {
          onSelect(model);
        }
        onClose();
      }
    },
    [isOpen, onClose, onSelect, selectedIndex]
  );

  useKeyboard(handleKeyboard);

  if (!isOpen) {
    return null;
  }

  const modalWidth = Math.min(width - 4, 50);
  const modalHeight = MODELS.length + 6;
  const x = Math.floor((width - modalWidth) / 2);
  const y = Math.floor((height - modalHeight) / 2);

  return (
    <box
      border
      height={modalHeight}
      left={x}
      style={{
        backgroundColor: "#0A0E14",
        borderColor: "#39BAE6",
        borderStyle: "single",
      }}
      title="Select Model"
      top={y}
      width={modalWidth}
    >
      <text content={`  ${bold("Model Selection")}`} />
      <text content={dim("  " + "─".repeat(modalWidth - 4))} />
      <text content="" />

      {MODELS.map((model, i) => {
        const isSelected = i === selectedIndex;
        const isCurrent = model.id === selectedId;
        const prefix = isSelected ? bold(fg(colors.primary)("> ")) : "  ";
        const label = isCurrent ? bold(model.label) : model.label;
        const provider = dim(` (${model.provider})`);

        return (
          <text
            content={`${prefix}${label}${provider}`}
            key={model.id}
            style={{
              bg: isSelected ? "#1A1F29" : undefined,
              fg: isSelected ? colors.primary : undefined,
            }}
          />
        );
      })}

      <text content="" />
      <text content={dim("  [↑↓] Select [Enter] Confirm [Esc] Cancel")} />
    </box>
  );
}
