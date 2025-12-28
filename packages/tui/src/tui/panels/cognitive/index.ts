/**
 * ALFRED TUI Cognitive Panel
 *
 * Main cognitive state visualization panel.
 */

import type { KeyEvent } from "../../input/keys";
import {
  createScrollActions,
  createScrollState,
  createVimKeyHandler,
  type ScrollState,
} from "../../input/vim";
import type {
  CognitiveState,
  CognitiveTransition,
} from "../../subscriptions/cognitive";
import {
  type CognitiveStateStore,
  createCognitiveStore,
} from "../../subscriptions/cognitive";
import { bold, dim } from "../../typography";
import { BasePanel } from "../base";
import { renderAutonomyGauge, renderThresholdComparison } from "./autonomy";
import { renderHistory, renderTimeline } from "./history";
import { renderPhaseIndicator } from "./phase";
import { renderPhysiology, renderPhysiologyStatus } from "./physiology";

// ─── Cognitive Panel ─────────────────────────────────────────────────────────

export class CognitivePanel extends BasePanel {
  readonly id = "cognitive";
  readonly label = "Cognitive";

  private readonly store: CognitiveStateStore;
  private state: CognitiveState | null = null;
  private transitions: CognitiveTransition[] = [];
  private scrollState: ScrollState;
  private readonly vimHandler: (event: KeyEvent) => boolean;

  constructor(store?: CognitiveStateStore) {
    super();
    this.store = store ?? createCognitiveStore();
    this.scrollState = createScrollState(0, 10);

    const scrollActions = createScrollActions(
      () => this.scrollState,
      (s) => {
        this.scrollState = s;
      }
    );
    this.vimHandler = createVimKeyHandler(scrollActions);
  }

  init(): void {
    // Subscribe to store updates
    const unsub = this.store.subscribe((state) => {
      this.state = state;
      this.transitions = this.store.getHistory();
    });
    this.addSubscription(unsub);
  }

  handleKey(event: KeyEvent): boolean {
    return this.vimHandler(event);
  }

  renderContent(): string[] {
    const width = this.contentBounds.width;
    const height = this.contentBounds.height;

    if (!this.state) {
      return ["", dim("  Awaiting cognitive state..."), ""];
    }

    const lines: string[] = [];
    const { phase, physiology, autonomy } = this.state;

    // Section 1: Current Phase
    lines.push(renderPhaseIndicator(phase, width));
    lines.push("");

    // Section 2: Autonomy
    const autonomyLines = renderAutonomyGauge(autonomy, width);
    for (const line of autonomyLines) {
      lines.push(line);
    }
    lines.push(renderThresholdComparison(autonomy.level, autonomy.threshold));
    lines.push("");

    // Section 3: Physiology
    lines.push(bold(dim("Physiology")));
    const physiologyLines = renderPhysiology(physiology, width);
    for (const line of physiologyLines) {
      lines.push(line);
    }
    lines.push(renderPhysiologyStatus(physiology));
    lines.push("");

    // Section 4: Timeline
    if (this.transitions.length > 0) {
      lines.push(bold(dim("Recent Activity")));
      const timelineLines = renderTimeline(this.transitions, phase, width);
      for (const line of timelineLines) {
        lines.push(line);
      }
      lines.push("");

      // Transition history (if space permits)
      const remainingHeight = height - lines.length - 2;
      if (remainingHeight > 3) {
        const historyLines = renderHistory(
          this.transitions,
          remainingHeight - 1,
          width
        );
        for (const line of historyLines) {
          lines.push(line);
        }
      }
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

  // ─── Data Setters ────────────────────────────────────────────────────────

  setState(state: CognitiveState): void {
    this.state = state;
  }

  setHistory(transitions: CognitiveTransition[]): void {
    this.transitions = transitions;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createCognitivePanel(
  store?: CognitiveStateStore
): CognitivePanel {
  return new CognitivePanel(store);
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export * from "./autonomy";
export * from "./history";
export * from "./phase";
export * from "./physiology";
