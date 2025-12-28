/**
 * ALFRED TUI Workflow Panel
 *
 * Main workflow management panel.
 */

import type { KeyEvent } from "../../input/keys";
import {
  createScrollActions,
  createScrollState,
  createVimKeyHandler,
  type ScrollState,
} from "../../input/vim";
import type { Workflow } from "../../subscriptions/workflow";
import {
  createWorkflowStore,
  type WorkflowStore,
} from "../../subscriptions/workflow";
import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";
import { BasePanel } from "../base";
import { renderActiveWorkflows } from "./active";
import {
  getActionForKey,
  isActionAvailable,
  type WorkflowAction,
} from "./controls";
import { renderHistory } from "./history";
import { renderQueue } from "./queue";

// ─── Workflow Panel ──────────────────────────────────────────────────────────

export class WorkflowPanel extends BasePanel {
  readonly id = "workflow";
  readonly label = "Workflows";

  private readonly store: WorkflowStore;
  private selectedIndex = 0;
  private scrollState: ScrollState;
  private readonly vimHandler: (event: KeyEvent) => boolean;
  private onAction?: (action: WorkflowAction, workflow: Workflow) => void;

  constructor(store?: WorkflowStore) {
    super();
    this.store = store ?? createWorkflowStore();
    this.scrollState = createScrollState(0, 10);

    const scrollActions = createScrollActions(
      () => this.scrollState,
      (s) => {
        this.scrollState = s;
      }
    );
    this.vimHandler = createVimKeyHandler(scrollActions, {
      enableCursor: false,
    });
  }

  init(): void {
    // Subscribe to store updates
    const unsub = this.store.subscribe(() => {
      // Force re-render when data changes
    });
    this.addSubscription(unsub);
  }

  setActionHandler(
    handler: (action: WorkflowAction, workflow: Workflow) => void
  ): void {
    this.onAction = handler;
  }

  handleKey(event: KeyEvent): boolean {
    // Vim navigation
    if (this.vimHandler(event)) {
      return true;
    }

    // Selection navigation
    const allWorkflows = this.getAllDisplayedWorkflows();
    if (event.key === "j" || event.key === "down") {
      this.selectedIndex = Math.min(
        this.selectedIndex + 1,
        allWorkflows.length - 1
      );
      return true;
    }
    if (event.key === "k" || event.key === "up") {
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      return true;
    }

    // Actions
    const selected = allWorkflows[this.selectedIndex];
    if (selected) {
      const action = getActionForKey(event.key);
      if (action && isActionAvailable(selected, action)) {
        this.onAction?.(action, selected);
        return true;
      }
    }

    return false;
  }

  private getAllDisplayedWorkflows(): Workflow[] {
    return [
      ...this.store.getActive(),
      ...this.store.getPending(),
      ...this.store.getHistory(),
    ];
  }

  renderContent(): string[] {
    const width = this.contentBounds.width;
    const height = this.contentBounds.height;
    const lines: string[] = [];

    const active = this.store.getActive();
    const pending = this.store.getPending();
    const history = this.store.getHistory();

    // Summary line
    const activeSummary =
      active.length > 0
        ? `${fg(colors.success)(active.length.toString())} active`
        : dim("no active");
    const pendingSummary =
      pending.length > 0
        ? `${fg(colors.primary)(pending.length.toString())} pending`
        : "";
    const historySummary =
      history.length > 0 ? `${dim(history.length.toString())} completed` : "";

    const summaryParts = [activeSummary, pendingSummary, historySummary].filter(
      Boolean
    );
    lines.push(summaryParts.join(dim(" • ")));
    lines.push("");

    // Active workflows section
    if (active.length > 0) {
      lines.push(bold(dim("Active")));
      const activeLines = renderActiveWorkflows(active, width, 2);
      for (const line of activeLines) {
        lines.push(line);
      }
      lines.push("");
    }

    // Queue section
    if (pending.length > 0) {
      lines.push(bold(dim("Queue")));
      const queueLines = renderQueue([...active, ...pending], width, 3);
      for (const line of queueLines) {
        lines.push(line);
      }
      lines.push("");
    }

    // History section (if space permits)
    const remainingHeight = height - lines.length - 3;
    if (remainingHeight > 4 && history.length > 0) {
      lines.push(bold(dim("Recent")));
      const historyLines = renderHistory(
        history,
        width,
        Math.min(remainingHeight - 2, 5)
      );
      for (const line of historyLines) {
        lines.push(line);
      }
    }

    // Empty state
    if (active.length === 0 && pending.length === 0 && history.length === 0) {
      lines.push("");
      lines.push(dim("  No workflows"));
      lines.push(dim("  Use ALFRED to start a workflow"));
    }

    // Update scroll state
    this.scrollState = {
      ...this.scrollState,
      totalLines: lines.length,
      viewportHeight: height,
    };

    // Apply scrolling
    const visibleStart = Math.min(
      this.scrollState.scrollTop,
      Math.max(0, lines.length - height)
    );
    return lines.slice(visibleStart, visibleStart + height);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createWorkflowPanel(store?: WorkflowStore): WorkflowPanel {
  return new WorkflowPanel(store);
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export * from "./active";
export * from "./controls";
export * from "./history";
export * from "./queue";
