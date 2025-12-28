/**
 * Voice Package CLI Manifest
 *
 * Registers voice-related commands, panels, and health checks
 * with the ALFRED TUI package registry.
 */

// Inline manifest types to avoid tsconfig rootDir issues
type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
};

type CommandDef = {
  name: string;
  description: string;
  handler: (args: unknown) => Promise<void>;
  category?: string;
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
  commands?: CommandDef[];
  panels?: TuiPanelDef[];
  subscriptions?: SubscriptionDef[];
  healthCheck?: () => Promise<HealthStatus>;
  dependencies?: string[];
};

/**
 * Voice package CLI manifest
 */
export const manifest: CliManifest = {
  name: "@alfred/voice",
  version: "0.0.1",
  description: "Voice processing (STT/TTS) with local models",

  commands: [
    {
      name: "test-stt",
      description: "Test speech-to-text with an audio file",
      category: "voice",
      handler: async (args) => {
        const { testSTT } = await import("./commands/test");
        await testSTT(args as { file?: string });
      },
    },
    {
      name: "test-tts",
      description: "Test text-to-speech with sample text",
      category: "voice",
      handler: async (args) => {
        const { testTTS } = await import("./commands/test");
        await testTTS(args as { text?: string });
      },
    },
    {
      name: "benchmark",
      description: "Run voice pipeline benchmark",
      category: "voice",
      handler: async () => {
        const { benchmark } = await import("./commands/benchmark");
        await benchmark();
      },
    },
  ],

  panels: [
    {
      id: "voice",
      name: "Voice Pipeline",
      description: "STT/TTS pool status and session monitoring",
      shortcut: "v",
      category: "monitoring",
      defaultVisible: true,
      factory: async () => {
        // TODO: Return actual VoicePanel once it's exported from @alfred/tui
        return class PlaceholderPanel {};
      },
    },
  ],

  subscriptions: [
    {
      id: "voice-sessions",
      path: "admin.getVoiceStats",
      description: "Real-time voice session statistics",
    },
  ],

  healthCheck: async (): Promise<HealthStatus> => {
    try {
      // Check if STT/TTS pools are available
      const { STTPool } = await import("./process/stt");
      const { TTSPool } = await import("./process/tts");

      // These are lazy-loaded, so just check the module imported
      return {
        status: "healthy",
        message: "Voice modules loaded",
        details: {
          sttPool: !!STTPool,
          ttsPool: !!TTSPool,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: (error as Error).message,
      };
    }
  },

  dependencies: ["@alfred/db", "@alfred/metrics"],
};

export default manifest;
