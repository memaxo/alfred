/**
 * OpenTUI React Dashboard
 *
 * Main dashboard layout using OpenTUI React components.
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";

import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useCallback, useState } from "react";

import { type Command, createStandardCommands } from "../input/commands";
import { StoresContext, type TuiStores } from "./hooks/stores";
import { ChatMode, DebugMode, HelpMode, PlanMode } from "./modes";
import { CommandPalette, Modal } from "./overlays";
import {
  CognitivePanel,
  FocusPanel,
  KnowledgePanel,
  MetricsPanel,
  VoicePanel,
  WorkflowPanel,
} from "./panels";

export type DashboardCallbacks = {
  onQuit?: () => boolean | Promise<boolean>;
  onRefresh?: () => void;
  onMode?: (mode: "chat" | "debug" | "plan" | "help") => void | Promise<void>;
  onFocusPanel?: (id: string) => void;
  onToggleFocusMode?: () => void;
};

type DashboardProps = {
  stores: TuiStores;
  callbacks: DashboardCallbacks;
  initialMode?: ModeId;
};

type PanelId =
  | "focus"
  | "cognitive"
  | "workflow"
  | "metrics"
  | "voice"
  | "knowledge";
type ModeId = "none" | "chat" | "debug" | "plan" | "help";

const PANELS: PanelId[] = [
  "focus",
  "cognitive",
  "workflow",
  "metrics",
  "voice",
  "knowledge",
];

export function Dashboard({
  stores,
  callbacks,
  initialMode = "none",
}: DashboardProps) {
  const { width, height } = useTerminalDimensions();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<ModeId>(initialMode);
  const [quitModalOpen, setQuitModalOpen] = useState(false);
  const [quitModalMessage, setQuitModalMessage] =
    useState<string>("Quit anyway?");

  const focusedPanel = PANELS[focusedIndex] ?? "cognitive";

  const requestQuit = useCallback(async () => {
    const activeCount = stores.workflow?.getActive().length ?? 0;
    if (activeCount > 0) {
      setQuitModalMessage(
        `${activeCount} workflow(s) are still active. Quit anyway?`
      );
      setQuitModalOpen(true);
      return;
    }

    const ok = await callbacks.onQuit?.();
    if (ok === false) {
      return;
    }
  }, [callbacks, stores.workflow]);

  const setMode = useCallback(
    (mode: ModeId) => {
      if (mode !== "none") {
        void callbacks.onMode?.(mode);
      }
      setActiveMode(mode);
    },
    [callbacks]
  );

  // Create standard commands
  const commands: Command[] = createStandardCommands({
    quit: requestQuit,
    help: () => {
      setMode("help");
    },
    refresh: () => {
      callbacks.onRefresh?.();
    },
    focusPanel: (id: string) => {
      const index = PANELS.indexOf(id as PanelId);
      if (index >= 0) {
        setFocusedIndex(index);
      }
      callbacks.onFocusPanel?.(id);
    },
    toggleFocusMode: () => {
      callbacks.onToggleFocusMode?.();
    },
    openMode: (mode: "chat" | "debug" | "plan") => {
      setMode(mode);
    },
  });

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      // Modes take absolute priority
      if (activeMode !== "none") {
        return;
      }

      // Command palette takes priority when open
      if (commandPaletteOpen) {
        // Command palette handles its own keys
        return;
      }

      // Open command palette with :
      if (event.name === ":") {
        setCommandPaletteOpen(true);
        return;
      }

      // Quit
      if (event.name === "q" && !event.ctrl) {
        void requestQuit();
        return;
      }

      // Mode switches
      if (event.ctrl) {
        if (event.name === "d") {
          setMode("debug");
          return;
        }
        if (event.name === "t") {
          setMode("chat");
          return;
        }
        if (event.name === "p") {
          setMode("plan");
          return;
        }
      }

      // Help
      if (event.name === "?" || (event.name === "/" && event.shift)) {
        setMode("help");
        return;
      }

      // Tab navigation
      if (event.name === "tab") {
        if (event.shift) {
          setFocusedIndex((i) => (i - 1 + PANELS.length) % PANELS.length);
        } else {
          setFocusedIndex((i) => (i + 1) % PANELS.length);
        }
        return;
      }

      // Number keys for direct panel access
      if (/^[1-6]$/.test(event.name)) {
        const index = Number.parseInt(event.name, 10) - 1;
        if (index < PANELS.length) {
          setFocusedIndex(index);
        }
      }
    },
    [activeMode, commandPaletteOpen, requestQuit]
  );

  useKeyboard(handleKeyboard);

  // Calculate layout
  const headerHeight = 3;
  const footerHeight = 2;
  const contentHeight = height - headerHeight - footerHeight;
  const leftWidth = Math.floor(width * 0.5);
  const rightWidth = width - leftWidth;
  const thirdHeight = Math.floor(contentHeight / 3);

  return (
    <StoresContext.Provider value={stores}>
      <box height={height} width={width}>
        {/* Header */}
        <box
          border
          height={headerHeight}
          style={{ borderStyle: "single" }}
          title="ALFRED"
          top={0}
          width={width}
        >
          <text
            content={`Dashboard | ${width}x${height} | Focus: ${focusedPanel}`}
          />
        </box>

        {/* Main content area */}
        <box height={contentHeight} top={headerHeight} width={width}>
          {/* Left column */}
          <FocusPanel
            focused={focusedPanel === "focus"}
            height={thirdHeight}
            width={leftWidth}
            x={0}
            y={0}
          />
          <CognitivePanel
            focused={focusedPanel === "cognitive"}
            height={thirdHeight}
            width={leftWidth}
            x={0}
            y={thirdHeight}
          />
          <WorkflowPanel
            focused={focusedPanel === "workflow"}
            height={contentHeight - thirdHeight * 2}
            width={leftWidth}
            x={0}
            y={thirdHeight * 2}
          />

          {/* Right column */}
          <MetricsPanel
            focused={focusedPanel === "metrics"}
            height={thirdHeight}
            width={rightWidth}
            x={leftWidth}
            y={0}
          />
          <VoicePanel
            focused={focusedPanel === "voice"}
            height={thirdHeight}
            width={rightWidth}
            x={leftWidth}
            y={thirdHeight}
          />
          <KnowledgePanel
            focused={focusedPanel === "knowledge"}
            height={contentHeight - thirdHeight * 2}
            width={rightWidth}
            x={leftWidth}
            y={thirdHeight * 2}
          />
        </box>

        {/* Footer */}
        <box
          height={footerHeight}
          style={{ backgroundColor: "#1A1F29" }}
          top={height - footerHeight}
          width={width}
        >
          <text
            content="[Tab] Navigate | [q] Quit | [?] Help | [Ctrl+D] Debug | [Ctrl+T] Chat | [1-6] Panels"
            style={{ fg: "#8A9199" }}
          />
        </box>

        {/* Command Palette Overlay */}
        <CommandPalette
          commands={commands}
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onExecute={(command) => {
            setCommandPaletteOpen(false);
            void command.action();
          }}
        />

        <Modal
          buttons={[
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ]}
          defaultButton="no"
          isOpen={quitModalOpen}
          message={quitModalMessage}
          onClose={(value) => {
            setQuitModalOpen(false);
            if (value !== "yes") {
              return;
            }
            void (async () => {
              const ok = await callbacks.onQuit?.();
              if (ok === false) {
                return;
              }
            })();
          }}
          title="Confirm Exit"
        />

        {/* Modes Overlays */}
        <HelpMode
          isOpen={activeMode === "help"}
          onClose={() => setMode("none")}
        />
        <ChatMode
          isOpen={activeMode === "chat"}
          onClose={() => setMode("none")}
        />
        <DebugMode
          isOpen={activeMode === "debug"}
          onClose={() => setMode("none")}
        />
        <PlanMode
          isOpen={activeMode === "plan"}
          onClose={() => setMode("none")}
        />
      </box>
    </StoresContext.Provider>
  );
}
