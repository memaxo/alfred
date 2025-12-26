import { createGatewayProvider } from "@ai-sdk/gateway";

/**
 * Shared AI configuration for @alfred/plan
 * This breaks the circular dependency with @alfred/agent.
 */

export function getModelId(): string {
  return process.env.AI_MODEL || "openai/gpt-4o-mini";
}

let cachedGateway: ReturnType<typeof createGatewayProvider> | null = null;

export function getOpenAI() {
  if (cachedGateway) {
    return cachedGateway;
  }

  // Test override: allow empty client in tests if key is missing
  if (process.env.NODE_ENV === "test" && !process.env.OPENAI_API_KEY) {
    return {
      languageModel: () => ({}),
    } as unknown as ReturnType<typeof createGatewayProvider>;
  }

  cachedGateway = createGatewayProvider({
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
      },
    },
  });

  return cachedGateway;
}
