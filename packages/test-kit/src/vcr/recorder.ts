/**
 * VCR Recorder
 *
 * Intercepts fetch calls to AI providers and records/replays responses.
 * Uses global fetch patching to transparently capture API calls.
 */

import { randomUUID } from "node:crypto";
import {
  addInteraction,
  createCassette,
  findInteraction,
  loadCassette,
  saveCassette,
} from "./cassette";
import { defaultMatcher, hashRequest } from "./hash";
import type {
  AIProvider,
  VCRCassette,
  VCRInteraction,
  VCRMode,
  VCROptions,
} from "./types";

// AI provider API hosts
const PROVIDER_HOSTS: Record<string, AIProvider> = {
  "api.openai.com": "openai",
  "api.anthropic.com": "anthropic",
  "generativelanguage.googleapis.com": "google",
  "api.cohere.ai": "cohere",
};

/**
 * Determines if a URL is an AI provider endpoint
 */
function getProvider(url: string): AIProvider | null {
  try {
    const parsed = new URL(url);
    return PROVIDER_HOSTS[parsed.hostname] ?? null;
  } catch {
    return null;
  }
}

/**
 * Extracts model from request body
 */
function extractModel(body: unknown): string {
  if (body && typeof body === "object" && "model" in body) {
    return String((body as Record<string, unknown>).model);
  }
  return "unknown";
}

/**
 * Sanitizes headers for recording (removes sensitive data)
 */
function sanitizeHeaders(
  headers: Headers | Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  const sensitiveKeys = ["authorization", "api-key", "x-api-key"];

  const entries =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Object.entries(headers);

  for (const [key, value] of entries) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * VCR Recorder class - manages recording and replay of AI API calls
 */
export class VCRRecorder {
  private cassette: VCRCassette;
  private readonly cassettePath: string;
  private readonly mode: VCRMode;
  private readonly strictReplay: boolean;
  private readonly matcher: typeof defaultMatcher;
  private originalFetch: typeof globalThis.fetch | null = null;
  private isActive = false;

  constructor(options: VCROptions) {
    this.cassettePath = options.cassettePath;
    this.mode = options.mode ?? this.getModeFromEnv();
    this.strictReplay = options.strictReplay ?? true;
    this.matcher = options.matcher ?? defaultMatcher;
    this.cassette = createCassette(options.cassettePath);
  }

  private getModeFromEnv(): VCRMode {
    if (process.env.VCR_RECORD === "1" || process.env.VCR_MODE === "record") {
      return "record";
    }
    if (
      process.env.VCR_PASSTHROUGH === "1" ||
      process.env.VCR_MODE === "passthrough"
    ) {
      return "passthrough";
    }
    return "replay";
  }

  /**
   * Loads the cassette and starts intercepting fetch calls
   */
  async start(): Promise<void> {
    if (this.isActive) {
      return;
    }

    // Load existing cassette in replay mode
    if (this.mode === "replay") {
      const loaded = await loadCassette(this.cassettePath);
      if (loaded) {
        this.cassette = loaded;
      } else if (this.strictReplay) {
      }
    }

    // Patch global fetch
    this.originalFetch = globalThis.fetch;
    globalThis.fetch = this.createInterceptor();
    this.isActive = true;
  }

  /**
   * Stops intercepting and saves the cassette (in record mode)
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    // Restore original fetch
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }

    // Save cassette in record mode
    if (this.mode === "record" && this.cassette.interactions.length > 0) {
      await saveCassette(this.cassettePath, this.cassette);
    }

    this.isActive = false;
  }

  /**
   * Creates the fetch interceptor
   */
  private createInterceptor() {
    const originalFetch = this.originalFetch;
    if (!originalFetch) {
      throw new Error(
        "VCR: originalFetch is missing during interception setup"
      );
    }

    const interceptedFetch = async (
      input: string | URL | Request,
      init?: RequestInit
    ): Promise<Response> => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const provider = getProvider(url);

      // Pass through non-AI requests
      if (!provider) {
        return originalFetch(input, init);
      }

      // Passthrough mode - just forward
      if (this.mode === "passthrough") {
        return originalFetch(input, init);
      }

      // Build request info for matching/recording
      const method = init?.method ?? "POST";
      const headers = sanitizeHeaders(new Headers(init?.headers));
      let body: unknown = null;

      if (init?.body) {
        try {
          body =
            typeof init.body === "string" ? JSON.parse(init.body) : init.body;
        } catch {
          body = init.body;
        }
      }

      const requestInfo: VCRInteraction["request"] = {
        url,
        method,
        headers,
        body,
      };

      const requestHash = hashRequest(requestInfo);

      // Replay mode - find matching recording
      if (this.mode === "replay") {
        // Use custom matcher if provided, otherwise fall back to hash matching
        const recorded = this.matcher
          ? this.cassette.interactions.find((i) => this.matcher(requestInfo, i))
          : findInteraction(this.cassette, requestHash);

        if (recorded) {
          return this.createMockResponse(recorded);
        }

        if (this.strictReplay) {
          throw new Error(
            `VCR: No matching recording found for ${provider} request. ` +
              `Hash: ${requestHash}. Run with VCR_RECORD=1 to record.`
          );
        }
      }

      // Record mode - make real request and record
      const startTime = Date.now();
      const response = await originalFetch(input, init);
      const durationMs = Date.now() - startTime;

      // Clone response to read body
      const clonedResponse = response.clone();
      let responseBody: unknown;

      try {
        responseBody = await clonedResponse.json();
      } catch {
        responseBody = await clonedResponse.text();
      }

      const interaction: VCRInteraction = {
        id: randomUUID(),
        timestamp: Date.now(),
        provider,
        model: extractModel(body),
        request: requestInfo,
        response: {
          status: response.status,
          headers: sanitizeHeaders(response.headers),
          body: responseBody,
        },
        requestHash,
        durationMs,
      };

      addInteraction(this.cassette, interaction);

      return response;
    };

    return interceptedFetch as typeof globalThis.fetch;
  }

  /**
   * Creates a mock Response from a recorded interaction
   */
  private createMockResponse(recorded: VCRInteraction): Response {
    const body = JSON.stringify(recorded.response.body);
    const headers = new Headers(recorded.response.headers);
    headers.set("x-vcr-replay", "true");

    return new Response(body, {
      status: recorded.response.status,
      headers,
    });
  }

  /**
   * Returns the current mode
   */
  getMode(): VCRMode {
    return this.mode;
  }

  /**
   * Returns the number of recorded interactions
   */
  getInteractionCount(): number {
    return this.cassette.interactions.length;
  }
}

/**
 * Creates a VCR recorder for use in tests
 */
export function createVCR(options: VCROptions): VCRRecorder {
  return new VCRRecorder(options);
}

/**
 * Helper to use VCR in a test with automatic setup/teardown
 */
export async function withVCR<T>(
  options: VCROptions,
  fn: (vcr: VCRRecorder) => Promise<T>
): Promise<T> {
  const vcr = createVCR(options);
  await vcr.start();
  try {
    return await fn(vcr);
  } finally {
    await vcr.stop();
  }
}
