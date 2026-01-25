/**
 * VCR Types for AI Provider Recording
 *
 * Supports recording and replaying AI SDK provider responses
 * for deterministic integration testing without mocking internal logic.
 */

export type AIProvider = "openai" | "anthropic" | "google" | "cohere";

export type VCRMode = "record" | "replay" | "passthrough";

/**
 * A single recorded interaction with an AI provider
 */
export interface VCRInteraction {
  id: string;
  timestamp: number;
  provider: AIProvider;
  model: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
  /** Hash of request for matching */
  requestHash: string;
  /** Duration in ms */
  durationMs: number;
}

/**
 * A cassette file containing multiple recorded interactions
 */
export interface VCRCassette {
  version: 2;
  name: string;
  createdAt: string;
  interactions: VCRInteraction[];
}

/**
 * Options for VCR recording/replay
 */
export interface VCROptions {
  /** Cassette file path (relative to test file or absolute) */
  cassettePath: string;
  /** Mode: record, replay, or passthrough */
  mode?: VCRMode;
  /** Whether to fail if no matching recording found in replay mode */
  strictReplay?: boolean;
  /** Custom request matcher function */
  matcher?: (
    request: VCRInteraction["request"],
    recorded: VCRInteraction
  ) => boolean;
}

/**
 * Request hash options for matching
 */
export interface HashOptions {
  /** Include model in hash */
  includeModel?: boolean;
  /** Include specific headers in hash */
  includeHeaders?: string[];
  /** Fields to exclude from body hash */
  excludeBodyFields?: string[];
}
