import {
  renderAutonomyGauge,
  renderThresholdComparison,
} from "../panels/cognitive/autonomy";
import { renderPhaseIndicator } from "../panels/cognitive/phase";
import {
  renderPhysiology,
  renderPhysiologyIndicators,
  renderPhysiologyStatus,
} from "../panels/cognitive/physiology";
import type { CognitiveStateStore } from "../subscriptions/cognitive";
import type { MetricsStore } from "../subscriptions/metrics";
import type { VoiceStore } from "../subscriptions/voice";
import type { WorkflowStore } from "../subscriptions/workflow";

export type DashboardCallbacks = {
  onQuit?: () => boolean | Promise<boolean>;
  onRefresh?: () => void;
};

export type DashboardStores = {
  cognitive: CognitiveStateStore;
  workflow: WorkflowStore;
  metrics: MetricsStore;
  voice: VoiceStore;
};

export type PanelRect = { x: number; y: number; width: number; height: number };

export type DashboardPanel = {
  onResize: (rect: PanelRect) => void;
  renderContent: () => string[];
};

export type Dashboard = {
  getPanel: (id: string) => DashboardPanel | null;
};

export type CreateDashboardOptions = {
  stores: DashboardStores;
  callbacks: DashboardCallbacks;
  loadRegistry?: boolean;
};

export function createDashboard(options: CreateDashboardOptions): Dashboard {
  const panels = new Map<string, DashboardPanel>();

  // Minimal compatibility dashboard for tests: provide a cognitive panel that renders
  // directly from the cognitive store.
  let rect: PanelRect = { x: 0, y: 0, width: 60, height: 12 };

  const cognitivePanel: DashboardPanel = {
    onResize: (next) => {
      rect = next;
    },
    renderContent: () => {
      const state = options.stores.cognitive.getState();
      if (!state) {
        return ["Cognitive", "", "  Awaiting cognitive state..."];
      }

      const lines: string[] = [];
      lines.push(renderPhaseIndicator(state.phase, rect.width));
      lines.push("");
      lines.push(...renderAutonomyGauge(state.autonomy, rect.width));
      lines.push(
        renderThresholdComparison(
          state.autonomy.level,
          state.autonomy.threshold
        )
      );
      lines.push("");
      lines.push(renderPhysiology(state.physiology, rect.width));
      lines.push(...renderPhysiologyIndicators(state.physiology, rect.width));
      lines.push(renderPhysiologyStatus(state.physiology));
      return lines;
    },
  };

  panels.set("cognitive", cognitivePanel);

  return {
    getPanel: (id) => panels.get(id) ?? null,
  };
}
