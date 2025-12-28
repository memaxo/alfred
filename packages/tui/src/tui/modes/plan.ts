/**
 * ALFRED TUI Plan Mode
 *
 * Interactive workflow planning - describe a task, review the plan, execute.
 */

import { getApiClient } from "../api/client";
import {
  createInputLineActions,
  createInputLineState,
  handleInputLineKey,
  type InputLineState,
  renderInputLine,
} from "../components/input";
import {
  createStatusBarState,
  PLAN_HINTS,
  renderHintBar,
  type StatusBarState,
} from "../components/status";
import type { KeyEvent } from "../input/keys";
import { isEnter, isEscape } from "../input/keys";
import type { TerminalSize } from "../renderer";
import { colors } from "../theme";
import {
  bold,
  boxBottom,
  boxSide,
  boxTop,
  dim,
  fg,
  padRight,
} from "../typography";
import { BaseMode, type ModeCallbacks } from "./base";

// ─── Types ───────────────────────────────────────────────────────────────────

type PlanPhase =
  | "input"
  | "generating"
  | "review"
  | "executing"
  | "complete"
  | "error";

type PlanTask = {
  id: string;
  title: string;
  status: "pending" | "running" | "complete" | "error";
  description?: string;
};

type GeneratedPlan = {
  summary: string;
  tasks: PlanTask[];
  estimatedTime?: string;
};

type PlanModeState = {
  phase: PlanPhase;
  input: InputLineState;
  status: StatusBarState;
  requirement: string;
  plan: GeneratedPlan | null;
  runId: string | null;
  error: string | null;
  selectedTaskIndex: number;
};

// ─── Plan Mode ───────────────────────────────────────────────────────────────

export class PlanMode extends BaseMode {
  private state!: PlanModeState;
  private inputActions!: ReturnType<typeof createInputLineActions>;
  private readonly apiClient = getApiClient();

  constructor(callbacks: ModeCallbacks = {}) {
    super(callbacks);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  protected init(): void {
    this.state = {
      phase: "input",
      input: createInputLineState("Describe your task..."),
      status: {
        ...createStatusBarState("ALFRED Planner"),
        connectionStatus: "connected",
        keyHints: [
          { key: "Enter", description: "Generate Plan" },
          { key: "Esc", description: "Exit" },
        ],
      },
      requirement: "",
      plan: null,
      runId: null,
      error: null,
      selectedTaskIndex: 0,
    };

    this.inputActions = createInputLineActions(
      () => this.state.input,
      (input) => {
        this.state.input = input;
      }
    );
  }

  protected cleanup(): void {
    // Nothing to cleanup
  }

  // ─── Input Handling ──────────────────────────────────────────────────────────

  protected handleKey(event: KeyEvent): boolean {
    // Escape to exit or go back
    if (isEscape(event)) {
      if (this.state.phase === "review") {
        this.state.phase = "input";
        this.state.plan = null;
        this.updateHints();
        return true;
      }
      this.exit();
      return true;
    }

    switch (this.state.phase) {
      case "input":
        return this.handleInputPhase(event);

      case "review":
        return this.handleReviewPhase(event);

      case "executing":
        // Can't do much during execution
        return false;

      default:
        return false;
    }
  }

  private handleInputPhase(event: KeyEvent): boolean {
    return handleInputLineKey(event, this.inputActions, (requirement) => {
      this.state.requirement = requirement;
      void this.generatePlan();
    });
  }

  private handleReviewPhase(event: KeyEvent): boolean {
    // Navigate tasks
    if (event.key === "up" || event.key === "k") {
      if (this.state.plan && this.state.selectedTaskIndex > 0) {
        this.state.selectedTaskIndex--;
      }
      return true;
    }

    if (event.key === "down" || event.key === "j") {
      if (
        this.state.plan &&
        this.state.selectedTaskIndex < this.state.plan.tasks.length - 1
      ) {
        this.state.selectedTaskIndex++;
      }
      return true;
    }

    // Approve and execute
    if (isEnter(event)) {
      void this.executePlan();
      return true;
    }

    // Edit requirement
    if (event.key === "e") {
      this.state.phase = "input";
      this.updateHints();
      return true;
    }

    return false;
  }

  // ─── Plan Generation ─────────────────────────────────────────────────────────

  private async generatePlan(): Promise<void> {
    this.state.phase = "generating";
    this.state.error = null;
    this.updateHints();

    try {
      const result = await this.apiClient.startWorkflow(
        this.state.requirement,
        "read"
      );

      if (result.error) {
        this.state.phase = "error";
        this.state.error = result.error.message;
        return;
      }

      // Parse plan from response
      this.state.runId = result.data?.runId ?? null;
      this.state.plan = this.parsePlan(result.data);
      this.state.phase = "review";
      this.state.selectedTaskIndex = 0;
      this.updateHints();
    } catch (error) {
      this.state.phase = "error";
      this.state.error = (error as Error).message;
    }
  }

  private parsePlan(data: unknown): GeneratedPlan {
    // Parse the workflow response into a plan structure
    const plan = (data as Record<string, unknown>)?.plan;

    if (plan && typeof plan === "object") {
      const planObj = plan as Record<string, unknown>;
      const tasks = Array.isArray(planObj.tasks)
        ? planObj.tasks.map((t, i) => ({
            id: String(i),
            title: String(
              (t as Record<string, unknown>).title ?? `Task ${i + 1}`
            ),
            status: "pending" as const,
            description: String(
              (t as Record<string, unknown>).description ?? ""
            ),
          }))
        : [];

      return {
        summary: String(planObj.summary ?? this.state.requirement),
        tasks,
        estimatedTime: planObj.estimatedTime
          ? String(planObj.estimatedTime)
          : undefined,
      };
    }

    // Default plan if no structured response
    return {
      summary: this.state.requirement,
      tasks: [
        {
          id: "1",
          title: "Execute requirement",
          status: "pending",
          description: this.state.requirement,
        },
      ],
    };
  }

  // ─── Plan Execution ──────────────────────────────────────────────────────────

  private async executePlan(): Promise<void> {
    this.state.phase = "executing";
    this.updateHints();

    // For now, just show completion
    // In a full implementation, this would call workflow.resume
    // and stream progress updates

    // Simulate execution
    if (this.state.plan) {
      for (let i = 0; i < this.state.plan.tasks.length; i++) {
        const task = this.state.plan.tasks[i];
        if (task) {
          task.status = "running";
          this.state.selectedTaskIndex = i;
          await new Promise((r) => setTimeout(r, 500));
          task.status = "complete";
        }
      }
    }

    this.state.phase = "complete";
    this.updateHints();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private updateHints(): void {
    switch (this.state.phase) {
      case "input":
        this.state.status.keyHints = [
          { key: "Enter", description: "Generate Plan" },
          { key: "Esc", description: "Exit" },
        ];
        break;

      case "generating":
        this.state.status.keyHints = [];
        break;

      case "review":
        this.state.status.keyHints = PLAN_HINTS;
        break;

      case "executing":
        this.state.status.keyHints = [];
        break;

      case "complete":
        this.state.status.keyHints = [
          { key: "Enter", description: "New Plan" },
          { key: "Esc", description: "Exit" },
        ];
        break;

      case "error":
        this.state.status.keyHints = [
          { key: "Enter", description: "Retry" },
          { key: "Esc", description: "Exit" },
        ];
        break;
    }
  }

  // ─── Rendering ───────────────────────────────────────────────────────────────

  protected render(size: TerminalSize): string[] {
    const lines: string[] = [];
    const { width, height } = size;

    // Header
    lines.push(boxTop(width, "ALFRED Planner", true));

    // Content based on phase
    const contentHeight = height - 4; // Header, bottom border, hints
    const contentLines = this.renderPhaseContent(width - 2, contentHeight);

    for (const line of contentLines) {
      lines.push(
        `${boxSide(true)}${padRight(line, width - 2)}${boxSide(true)}`
      );
    }

    // Pad to fill height
    while (lines.length < height - 2) {
      lines.push(`${boxSide(true)}${" ".repeat(width - 2)}${boxSide(true)}`);
    }

    // Bottom border
    lines.push(boxBottom(width, true));

    // Hints
    lines.push(renderHintBar(this.state.status.keyHints, width));

    return lines;
  }

  private renderPhaseContent(width: number, _height: number): string[] {
    switch (this.state.phase) {
      case "input":
        return this.renderInputPhase(width);

      case "generating":
        return this.renderGeneratingPhase();

      case "review":
        return this.renderReviewPhase();

      case "executing":
        return this.renderExecutingPhase();

      case "complete":
        return this.renderCompletePhase();

      case "error":
        return this.renderErrorPhase();

      default:
        return [];
    }
  }

  private renderInputPhase(width: number): string[] {
    const lines: string[] = [];
    lines.push("");
    lines.push(dim(" Describe what you want to accomplish:"));
    lines.push("");
    lines.push(
      ` ${renderInputLine(this.state.input, width - 2, { prompt: "> " })}`
    );
    lines.push("");
    lines.push(dim(" Press Enter to generate an execution plan."));
    return lines;
  }

  private renderGeneratingPhase(): string[] {
    const lines: string[] = [];
    lines.push("");
    lines.push(fg(colors.primary)(" Generating plan..."));
    lines.push("");
    lines.push(dim(` "${this.state.requirement}"`));
    return lines;
  }

  private renderReviewPhase(): string[] {
    const lines: string[] = [];
    const plan = this.state.plan;

    if (!plan) {
      return [dim(" No plan generated")];
    }

    // Summary
    lines.push("");
    lines.push(bold(" Plan Summary:"));
    lines.push(` ${plan.summary}`);
    if (plan.estimatedTime) {
      lines.push(dim(` Estimated time: ${plan.estimatedTime}`));
    }
    lines.push("");

    // Tasks
    lines.push(bold(" Tasks:"));
    for (let i = 0; i < plan.tasks.length; i++) {
      const task = plan.tasks[i];
      if (!task) {
        continue;
      }
      const isSelected = i === this.state.selectedTaskIndex;
      const prefix = isSelected ? fg(colors.primary)("▸") : " ";
      const number = dim(`${i + 1}.`);
      const title = isSelected ? fg(colors.primary)(task.title) : task.title;
      lines.push(` ${prefix} ${number} ${title}`);
      if (task.description && isSelected) {
        lines.push(dim(`      ${task.description}`));
      }
    }

    lines.push("");
    lines.push(dim(" Press Enter to execute, e to edit, Esc to cancel."));

    return lines;
  }

  private renderExecutingPhase(): string[] {
    const lines: string[] = [];
    const plan = this.state.plan;

    if (!plan) {
      return [dim(" No plan to execute")];
    }

    lines.push("");
    lines.push(bold(" Executing plan..."));
    lines.push("");

    for (let i = 0; i < plan.tasks.length; i++) {
      const task = plan.tasks[i];
      if (!task) {
        continue;
      }
      let icon: string;
      let color: string;

      switch (task.status) {
        case "pending":
          icon = "○";
          color = colors.muted;
          break;
        case "running":
          icon = "●";
          color = colors.primary;
          break;
        case "complete":
          icon = "✓";
          color = colors.success;
          break;
        case "error":
          icon = "✗";
          color = colors.error;
          break;
      }

      lines.push(` ${fg(color)(icon)} ${task.title}`);
    }

    return lines;
  }

  private renderCompletePhase(): string[] {
    const lines: string[] = [];
    lines.push("");
    lines.push(fg(colors.success)(" ✓ Plan executed successfully!"));
    lines.push("");
    lines.push(dim(" Press Enter to create a new plan, Esc to exit."));
    return lines;
  }

  private renderErrorPhase(): string[] {
    const lines: string[] = [];
    lines.push("");
    lines.push(fg(colors.error)(` ✗ Error: ${this.state.error}`));
    lines.push("");
    lines.push(dim(" Press Enter to retry, Esc to exit."));
    return lines;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createPlanMode(callbacks: ModeCallbacks = {}): PlanMode {
  return new PlanMode(callbacks);
}

export function runPlanMode(): Promise<void> {
  const mode = createPlanMode();
  return new Promise((resolve) => {
    mode.callbacks.onExit = () => resolve();
    mode.start();
  });
}
