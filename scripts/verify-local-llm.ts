/**
 * Smoke test: route ALFRED's model selector to an OpenAI-compatible baseURL.
 *
 * Example (host):
 *   OPENAI_BASE_URL=http://localhost:8000/v1 \
 *   OPENAI_API_KEY=alfred-local \
 *   AI_MODEL_CHAT=local:default \
 *   bun run scripts/verify-local-llm.ts
 */

import { getModelForRole } from "@alfred/agent/selector";
import { generateText } from "ai";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`missing_env:${name}`);
  }
  return v.trim();
}

async function main(): Promise<void> {
  const baseUrl = requiredEnv("OPENAI_BASE_URL");
  const modelRef = process.env.AI_MODEL_CHAT?.trim() ?? "(unset)";

  console.log(`OPENAI_BASE_URL=${baseUrl}`);
  console.log(`AI_MODEL_CHAT=${modelRef}`);

  const { model, modelKey } = getModelForRole("chat");
  console.log(`resolved modelKey=${modelKey}`);

  const out = await generateText({
    model,
    temperature: 0,
    prompt: "Reply with exactly: ok",
  });

  console.log("text:", out.text);
  console.log("✓ ALFRED selector -> local OpenAI-compatible server works");
}

try {
  await main();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
} finally {
  // Some SDKs keep sockets/handles alive; force exit for a deterministic smoke test.
  process.exit(process.exitCode ?? 0);
}
