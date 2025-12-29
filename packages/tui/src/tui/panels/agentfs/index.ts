/**
 * ALFRED TUI AgentFS Main Panel
 *
 * Top-level AgentFS panel with sub-panel navigation.
 */

import type { KeyEvent } from "../../input/keys";
import type {
  AgentFSSubscriptionState,
  AgentFSUnsubscribe,
} from "../../subscriptions/agentfs";
import { createAgentFSSubscription } from "../../subscriptions/agentfs";
import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";
import { BasePanel } from "../base";
import { AgentFSBrowserPanel } from "./browser";
import { AgentFSKVStorePanel } from "./kvstore";
import { AgentFSToolCallsPanel } from "./toolcalls";

// ─── AgentFS Main Panel ───────────────────────────────────────────────────────

export class AgentFSPanel extends BasePanel {
  readonly id = "agentfs";
  readonly label = "AgentFS";

  private readonly subscription = createAgentFSSubscription();
  private subscriptionUnsub: AgentFSUnsubscribe | null = null;

  private runId: string | null = null;
  private dbPath: string | null = null;

  private activeTab: "browser" | "toolcalls" | "kvstore" = "browser";

  private readonly browserPanel = new AgentFSBrowserPanel();
  private readonly toolCallsPanel = new AgentFSToolCallsPanel();
  private readonly kvStorePanel = new AgentFSKVStorePanel();

  private activePanel: BasePanel = this.browserPanel;

  constructor() {
    super();
    // Initialize panels
    this.browserPanel.init();
    this.toolCallsPanel.init();
    this.kvStorePanel.init();

    // Subscribe to data updates
    const unsub = this.subscription.subscribe(
      (state: AgentFSSubscriptionState) => {
        if (state.isLoading) {
          this.browserPanel.setLoading(true);
          this.toolCallsPanel.setLoading(true);
          this.kvStorePanel.setLoading(true);
        } else if (state.error) {
          this.browserPanel.setError(state.error);
          this.toolCallsPanel.setError(state.error);
          this.kvStorePanel.setError(state.error);
        } else {
          this.browserPanel.setLoading(false);
          this.browserPanel.setError(null);
          this.browserPanel.setEntries(state.entries);
          this.toolCallsPanel.setLoading(false);
          this.toolCallsPanel.setError(null);
          this.toolCallsPanel.setToolCalls(state.toolCalls);
          this.kvStorePanel.setLoading(false);
          this.kvStorePanel.setError(null);
          this.kvStorePanel.setEntries(state.kvStore);
        }
      }
    );

    this.addSubscription(unsub);
  }

  /**
   * Connect to a specific AgentFS workspace
   */
  connectToRun(runId: string, dbPath: string): void {
    if (this.subscriptionUnsub) {
      this.subscriptionUnsub();
    }

    this.runId = runId;
    this.dbPath = dbPath;

    this.subscriptionUnsub = this.subscription.connect(runId, dbPath);
  }

  /**
   * Disconnect from current workspace
   */
  disconnect(): void {
    if (this.subscriptionUnsub) {
      this.subscriptionUnsub();
      this.subscriptionUnsub = null;
    }

    this.runId = null;
    this.dbPath = null;
  }

  private switchTab(tab: "browser" | "toolcalls" | "kvstore"): void {
    this.activeTab = tab;

    if (tab === "browser") {
      this.activePanel = this.browserPanel;
    } else if (tab === "toolcalls") {
      this.activePanel = this.toolCallsPanel;
    } else {
      this.activePanel = this.kvStorePanel;
    }
  }

  init(): void {
    // Override to handle panel initialization
  }

  destroy(): void {
    this.disconnect();
    super.destroy();

    this.browserPanel.destroy();
    this.toolCallsPanel.destroy();
    this.kvStorePanel.destroy();
  }

  onFocus(): void {
    super.onFocus();
    this.activePanel.onFocus();
  }

  onBlur(): void {
    super.onBlur();
    this.activePanel.onBlur();
  }

  handleKey(event: KeyEvent): boolean {
    // Tab navigation
    if (event.key === "1" || event.key === "b") {
      this.switchTab("browser");
      return true;
    }
    if (event.key === "2" || event.key === "t") {
      this.switchTab("toolcalls");
      return true;
    }
    if (event.key === "3" || event.key === "k") {
      this.switchTab("kvstore");
      return true;
    }

    // Pass to active panel
    return this.activePanel.handleKey(event);
  }

  renderContent(): string[] {
    const width = this.contentBounds.width;

    // Connection status header
    const lines: string[] = [];

    if (this.runId && this.dbPath) {
      lines.push(
        bold(fg(colors.primary)("Connected:")),
        dim(`  ${this.runId}`),
        "",
        dim(`  DB: ${this.dbPath}`),
        dim("  ─"),
        ""
      );
    } else {
      lines.push(dim("  Not connected to AgentFS workspace"));
      lines.push(dim("  Use 'agentfs.connect()' to view data"));
      lines.push("");
      return lines;
    }

    // Tab navigation
    const renderTab = (
      label: string,
      key: string,
      isActive: boolean
    ): string => {
      const suffix = isActive
        ? fg(colors.primary)(`[${key}]`)
        : dim(`[${key}]`);
      if (isActive) {
        return `${bold(fg(colors.primary)(label))} ${suffix}`;
      }
      return `${dim(label)} ${suffix}`;
    };

    lines.push(
      `${renderTab("Browser", "1/b", this.activeTab === "browser")} ` +
        `${renderTab("Tool Calls", "2/t", this.activeTab === "toolcalls")} ` +
        `${renderTab("KV Store", "3/k", this.activeTab === "kvstore")}`
    );

    lines.push(dim("─".repeat(Math.min(30, width))));
    lines.push("");

    // Render active panel content
    const panelContent = this.activePanel.renderContent();
    for (const line of panelContent) {
      lines.push(line);
    }

    return lines;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createAgentFSPanel(): AgentFSPanel {
  return new AgentFSPanel();
}

// ─── Re-exports ─────────────────────────────────────────────────────────────

export type {
  AgentFSSubscriptionCallback,
  AgentFSSubscriptionState,
  AgentFSUnsubscribe,
  DirEntry,
  KVEntry,
  ToolCallInfo,
} from "../../subscriptions/agentfs";
export { createAgentFSSubscription } from "../../subscriptions/agentfs";
export { AgentFSBrowserPanel, createAgentFSBrowserPanel } from "./browser";
export { AgentFSKVStorePanel, createAgentFSKVStorePanel } from "./kvstore";
export {
  AgentFSToolCallsPanel,
  createAgentFSToolCallsPanel,
} from "./toolcalls";
