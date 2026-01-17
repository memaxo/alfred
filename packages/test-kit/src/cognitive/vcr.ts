import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@alfred/logger";
import type { LanguageModel } from "ai";

export type Interaction = {
  id: string;
  timestamp: number;
  input: {
    messages: unknown[];
    system?: string;
  };
  output: {
    text: string;
    toolCalls?: unknown[];
  };
};

export type Cassette = {
  version: 1;
  interactions: Interaction[];
};

export class CognitiveVCR {
  private readonly cassettePath: string;
  private interactions: Interaction[] = [];
  private readonly mode: "record" | "replay" | "passthrough";

  constructor(
    cassetteName: string,
    mode?: "record" | "replay" | "passthrough"
  ) {
    this.cassettePath = path.join(
      process.cwd(),
      "packages/test-kit/cassettes",
      `${cassetteName}.json`
    );
    this.mode = mode ?? (process.env.VCR_MODE as any) ?? "replay";
  }

  async load(): Promise<void> {
    if (this.mode === "record" || this.mode === "passthrough") {
      return;
    }

    try {
      const content = await readFile(this.cassettePath, "utf-8");
      const cassette = JSON.parse(content) as Cassette;
      this.interactions = cassette.interactions;
      logger.info("vcr_loaded", {
        path: this.cassettePath,
        interactions: this.interactions.length,
      });
    } catch {
      logger.warn("vcr_cassette_missing", { path: this.cassettePath });
      this.interactions = [];
    }
  }

  async save(): Promise<void> {
    if (this.mode !== "record") {
      return;
    }

    const cassette: Cassette = {
      version: 1,
      interactions: this.interactions,
    };

    await mkdir(path.dirname(this.cassettePath), { recursive: true });
    await writeFile(this.cassettePath, JSON.stringify(cassette, null, 2));
    logger.info("vcr_saved", {
      path: this.cassettePath,
      interactions: this.interactions.length,
    });
  }

  findMatch(input: Interaction["input"]): Interaction | undefined {
    // Simple exact match on system prompt + last user message content for V1
    const lastUserMsg = input.messages.at(-1);

    return this.interactions.find((i) => {
      const iLast = i.input.messages.at(-1);
      return (
        JSON.stringify(lastUserMsg) === JSON.stringify(iLast) &&
        i.input.system === input.system
      );
    });
  }

  record(interaction: Interaction) {
    this.interactions.push(interaction);
  }

  getMode() {
    return this.mode;
  }
}

export function wrapModelWithVCR(
  model: LanguageModel,
  vcr: CognitiveVCR
): LanguageModel {
  // Proxy the model to intercept doGenerate / doStream
  // This requires deeper integration with AI SDK internals or wrapping the call site.
  // For Level 5, we might wrap the `AIAdapter` instead of the `LanguageModel` directly
  // since `LanguageModel` is an interface, not a class we can easily extend without internal logic.

  // Placeholder: In a real implementation, we would return a Proxy that traps calls.
  // For now, we will expose VCR helper methods to be used manually in the Adapter.
  // Note: implement VCR wrapping once AI SDK integration is complete.
  // The vcr parameter is kept for future implementation compatibility
  void vcr; // Mark as intentionally unused until implementation
  return model;
}
