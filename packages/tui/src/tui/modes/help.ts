/**
 * ALFRED TUI Help Mode
 *
 * Shows key bindings, headless usage, and mode navigation.
 */

import {
  createStatusBarState,
  renderHintBar,
  type StatusBarState,
} from "../components/status";
import type { KeyEvent } from "../input/keys";
import { isEscape, isQuit } from "../input/keys";
import type { TerminalSize } from "../renderer";
import { colors } from "../theme";
import { boxBottom, boxSide, boxTop, dim, fg, padRight } from "../typography";
import { BaseMode, type ModeCallbacks } from "./base";

type HelpModeState = {
  status: StatusBarState;
};

export class HelpMode extends BaseMode {
  private state!: HelpModeState;

  constructor(callbacks: ModeCallbacks = {}) {
    super(callbacks);
  }

  protected init(): void {
    this.state = {
      status: {
        ...createStatusBarState("ALFRED Help"),
        connectionStatus: "connected",
        keyHints: [
          { key: "Esc", description: "Back" },
          { key: "q", description: "Back" },
        ],
      },
    };
  }

  protected cleanup(): void {
    // No resources
  }

  protected handleKey(event: KeyEvent): boolean {
    if (isEscape(event) || isQuit(event)) {
      this.exit();
      return true;
    }
    return false;
  }

  protected render(size: TerminalSize): string[] {
    const lines: string[] = [];
    const { width, height } = size;

    lines.push(boxTop(width, "ALFRED Help", true));

    const contentHeight = height - 4; // header + bottom border + hint bar
    const content = this.renderContent(width - 2, contentHeight);
    for (const line of content) {
      lines.push(
        `${boxSide(true)}${padRight(line, width - 2)}${boxSide(true)}`
      );
    }

    while (lines.length < height - 2) {
      lines.push(`${boxSide(true)}${" ".repeat(width - 2)}${boxSide(true)}`);
    }

    lines.push(boxBottom(width, true));
    lines.push(renderHintBar(this.state.status.keyHints, width));

    return lines;
  }

  private renderContent(_width: number, height: number): string[] {
    const accent = fg(colors.primary);
    const muted = fg(colors.muted);

    const rows: string[] = [];
    rows.push("");
    rows.push(dim(" Keyboard Shortcuts"));
    rows.push("");

    rows.push(`  ${accent("?")}   Help`);
    rows.push(`  ${accent(":")}   Command palette`);
    rows.push(`  ${accent("Space")} Toggle focus layout`);
    rows.push(`  ${accent("Tab")} Next panel`);
    rows.push(`  ${accent("Shift+Tab")} Previous panel`);
    rows.push(`  ${accent("q")}   Quit (dashboard)`);
    rows.push(`  ${accent("Esc")} Back/Exit (modes)`);
    rows.push("");

    rows.push(dim(" Modes"));
    rows.push("");
    rows.push(`  ${accent("Ctrl+D")} Debug`);
    rows.push(`  ${accent("Ctrl+T")} Chat`);
    rows.push(`  ${accent("Ctrl+P")} Planner`);
    rows.push("");

    rows.push(dim(" Command Palette"));
    rows.push("");
    rows.push(`  ${accent(":")} open   ${muted("Type to filter commands")}`);
    rows.push(`  ${accent("Enter")} run  ${muted("Esc to close")}`);
    rows.push("");

    rows.push(dim(" Headless / CI"));
    rows.push("");
    rows.push(`  ${accent("alfred tui --headless")} (required without a TTY)`);
    rows.push(`  ${muted("ALFRED_TUI_HEADLESS=true")} env alternative`);

    // Fit to available height
    return rows.slice(0, Math.max(0, height));
  }
}

export function createHelpMode(callbacks: ModeCallbacks = {}): HelpMode {
  return new HelpMode(callbacks);
}
