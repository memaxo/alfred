/**
 * Cognitive Package CLI Manifest
 *
 * Registers cognitive-related panels and health checks
 * with the ALFRED TUI package registry.
 */

// Inline manifest types to avoid tsconfig rootDir issues
type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
};

type TuiPanelDef = {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  factory: () => Promise<unknown>;
  category?: "monitoring" | "admin" | "debug" | "data";
  defaultVisible?: boolean;
};

type SubscriptionDef = {
  id: string;
  path: string;
  description?: string;
};

type CliManifest = {
  name: string;
  version: string;
  description: string;
  panels?: TuiPanelDef[];
  subscriptions?: SubscriptionDef[];
  healthCheck?: () => Promise<HealthStatus>;
  dependencies?: string[];
};

/**
 * Cognitive package CLI manifest
 */
export const manifest: CliManifest = {
  name: "@alfred/cognitive",
  version: "0.1.0",
  description: "Cognitive state machine and autonomy management",

  panels: [
    {
      id: "cognitive",
      name: "Cognitive State",
      description: "Phase transitions, autonomy, and physiology",
      shortcut: "c",
      category: "monitoring",
      defaultVisible: true,
      factory: () => {
        // TODO: Return actual CognitivePanel once it's exported from @alfred/tui
        return Promise.resolve(class PlaceholderPanel {});
      },
    },
  ],

  subscriptions: [
    {
      id: "cognitive-state",
      path: "cognitive.state",
      description: "Real-time cognitive state updates",
    },
  ],

  healthCheck: async (): Promise<HealthStatus> => {
    try {
      // Verify core exports are available
      const stateModule = await import("./state");
      const { applyTransition } = await import("./transition");

      return {
        status: "healthy",
        message: "Cognitive modules loaded",
        details: {
          hasStateModule: !!stateModule,
          transitionFn: typeof applyTransition === "function",
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: (error as Error).message,
      };
    }
  },

  dependencies: ["@alfred/rag"],
};

export default manifest;
