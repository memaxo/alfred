/**
 * Voice Package CLI Manifest
 *
 * Registers voice-related commands, panels, and health checks
 * with the ALFRED TUI package registry.
 */

import { z } from "zod";

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
  args?: z.ZodType;
  handler: (args: unknown) => Promise<void>;
  category?: string;
  requiresAuth?: boolean;
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

// Zod schemas for command arguments
const testSttArgsSchema = z.object({
  file: z
    .string()
    .optional()
    .default("test.wav")
    .describe("Path to audio file to transcribe"),
});

const testTtsArgsSchema = z.object({
  text: z
    .string()
    .optional()
    .default("Hello, this is a test of the text to speech system.")
    .describe("Text to synthesize"),
  output: z
    .string()
    .optional()
    .default("tts-output.wav")
    .describe("Output file path"),
});

const benchmarkArgsSchema = z.object({
  iterations: z
    .number()
    .int()
    .positive()
    .optional()
    .default(3)
    .describe("Number of benchmark iterations"),
});

const statusArgsSchema = z.object({
  json: z.boolean().optional().default(false).describe("Output as JSON"),
});

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
      args: testSttArgsSchema,
      handler: async (args) => {
        const validated = testSttArgsSchema.parse(args);
        const { testSTT } = await import("./commands/test");
        await testSTT(validated);
      },
    },
    {
      name: "test-tts",
      description: "Test text-to-speech with sample text",
      category: "voice",
      args: testTtsArgsSchema,
      handler: async (args) => {
        const validated = testTtsArgsSchema.parse(args);
        const { testTTS } = await import("./commands/test");
        await testTTS(validated);
      },
    },
    {
      name: "benchmark",
      description: "Run voice pipeline benchmark",
      category: "voice",
      args: benchmarkArgsSchema,
      handler: async (args) => {
        benchmarkArgsSchema.parse(args);
        const { benchmark } = await import("./commands/benchmark");
        await benchmark();
      },
    },
    {
      name: "status",
      description: "Show voice pool status and active sessions",
      category: "voice",
      args: statusArgsSchema,
      handler: async (args) => {
        const validated = statusArgsSchema.parse(args);
        const { status } = await import("./commands/status");
        await status(validated);
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
      factory: () => {
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
