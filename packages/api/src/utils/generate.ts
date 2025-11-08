export function sanitizeResult(result: unknown): {
  text: string;
  toolCalls: unknown[];
  toolResults: unknown[];
  usage: unknown;
  object: unknown | null;
  steps: unknown[];
  warnings: unknown[];
  reasoning: unknown | null;
  finishReason: string | null;
} {
  if (!result || typeof result !== "object") {
    return {
      text: "",
      toolCalls: [],
      toolResults: [],
      usage: null,
      object: null,
      steps: [],
      warnings: [],
      reasoning: null,
      finishReason: null,
    };
  }

  const output = result as Record<string, unknown>;
  return {
    text: typeof output.text === "string" ? output.text : "",
    toolCalls: Array.isArray(output.toolCalls) ? output.toolCalls : [],
    toolResults: Array.isArray(output.toolResults) ? output.toolResults : [],
    usage: output.usage ?? null,
    object: output.object ?? null,
    steps: Array.isArray(output.steps) ? output.steps : [],
    warnings: Array.isArray(output.warnings) ? output.warnings : [],
    reasoning: output.reasoning ?? null,
    finishReason:
      typeof output.finishReason === "string" ? output.finishReason : null,
  };
}
