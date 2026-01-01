import { describe, expect, test } from "bun:test";
import { createCognitiveStore } from "../src/tui/subscriptions/cognitive";
import { createMetricsStore } from "../src/tui/subscriptions/metrics";
import { createVoiceStore } from "../src/tui/subscriptions/voice";
import { createWorkflowStore } from "../src/tui/subscriptions/workflow";
import { createDashboard } from "../src/tui/views/dashboard";

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

describe("Dashboard store wiring", () => {
  test("Cognitive panel renders updated store state", async () => {
    const cognitive = createCognitiveStore();
    const workflow = createWorkflowStore();
    const metrics = createMetricsStore();
    const voice = createVoiceStore();

    const dashboard = createDashboard({
      callbacks: {},
      stores: { cognitive, workflow, metrics, voice },
      loadRegistry: false,
    });

    // Panel should exist immediately (registered in constructor initPromise).
    // Wait a microtask for async init to complete deterministically in tests.
    await new Promise((r) => setTimeout(r, 0));

    const panel = dashboard.getPanel("cognitive");
    expect(panel).not.toBeNull();
    panel?.onResize({ x: 0, y: 0, width: 40, height: 12 });

    cognitive.update({
      phase: "thinking",
      physiology: { energy: 0.9, boredom: 0.1, frustration: 0.05 },
      autonomy: { level: 0.72, confidence: 0.8, threshold: 0.5 },
      timestamp: Date.now(),
    });

    const content = panel?.renderContent().join("\n") ?? "";
    const plain = stripAnsi(content);
    expect(plain.toLowerCase()).toContain("thinking");
  });
});
