/**
 * ALFRED Response Prefilling
 * Steers LLM responses by providing initial text
 */

import type { CoreMessage } from "ai";

// ============================================================================
// Types
// ============================================================================

export type PrefillConfig = {
  // Steering prefills
  reasoningPrefix?: string;
  personaPrefix?: string;

  // Format steering
  outputFormat?: "json" | "markdown" | "code" | "plain";
  structuredPrefix?: string;

  // Chain-of-thought steering
  chainOfThought?: boolean;
  stepPrefix?: string;
};

export type PrefillMessage = {
  role: "assistant";
  content: string;
};

// ============================================================================
// Prefill Templates
// ============================================================================

const REASONING_PREFIXES: Record<string, string> = {
  default: "Let me analyze this step by step:\n\n1.",
  quick: "Here's my analysis:\n\n",
  deep: "I'll think through this carefully, considering multiple angles:\n\n## Initial Assessment\n",
  code: "I'll implement this solution:\n\n```",
  debug: "Let me debug this systematically:\n\n## Error Analysis\n1.",
};

const PERSONA_PREFIXES: Record<string, string> = {
  engineer: "As a senior software engineer, I'll approach this by",
  architect: "From an architectural perspective, I'll design this as",
  reviewer: "Reviewing this code, I notice",
  teacher: "Let me explain this clearly:",
  researcher: "Based on my analysis of the available information,",
  assistant: "I'd be happy to help with that.",
};

const FORMAT_PREFIXES: Record<string, string> = {
  json: '{\n  "',
  markdown: "# ",
  code: "```",
  plain: "",
};

// ============================================================================
// Prefill Building Functions
// ============================================================================

/**
 * Build a prefill message from configuration
 */
export function buildPrefillMessage(config: PrefillConfig): PrefillMessage {
  const parts: string[] = [];

  // Add persona prefix if specified
  if (config.personaPrefix) {
    const prefix =
      PERSONA_PREFIXES[config.personaPrefix] ?? config.personaPrefix;
    parts.push(prefix);
  }

  // Add chain-of-thought prefix
  if (config.chainOfThought) {
    const stepPrefix = config.stepPrefix ?? "Step 1:";
    parts.push(`\n\n<thinking>\n${stepPrefix}`);
  }

  // Add reasoning prefix if specified
  if (config.reasoningPrefix) {
    const prefix =
      REASONING_PREFIXES[config.reasoningPrefix] ?? config.reasoningPrefix;
    if (parts.length > 0) {
      parts.push(" ");
    }
    parts.push(prefix);
  }

  // Add format prefix if specified
  if (config.outputFormat && !config.structuredPrefix) {
    const prefix = FORMAT_PREFIXES[config.outputFormat] ?? "";
    if (prefix) {
      parts.push(prefix);
    }
  }

  // Add custom structured prefix if specified
  if (config.structuredPrefix) {
    parts.push(config.structuredPrefix);
  }

  return {
    role: "assistant",
    content: parts.join(""),
  };
}

/**
 * Build a prefill for code generation
 */
export function buildCodePrefill(
  language: string,
  context?: string
): PrefillMessage {
  let content = `\`\`\`${language}\n`;
  if (context) {
    content += `// ${context}\n`;
  }
  return {
    role: "assistant",
    content,
  };
}

/**
 * Build a prefill for JSON output
 */
export function buildJsonPrefill(schema?: {
  firstKey?: string;
  firstValue?: string;
}): PrefillMessage {
  let content = "```json\n{";
  if (schema?.firstKey) {
    content += `\n  "${schema.firstKey}": `;
    if (schema.firstValue) {
      content += schema.firstValue;
    }
  }
  return {
    role: "assistant",
    content,
  };
}

/**
 * Build a prefill for reasoning/analysis
 */
export function buildReasoningPrefill(
  style: "default" | "quick" | "deep" | "debug" = "default"
): PrefillMessage {
  return {
    role: "assistant",
    content: REASONING_PREFIXES[style] ?? REASONING_PREFIXES.default,
  };
}

/**
 * Build a prefill for a specific persona
 */
export function buildPersonaPrefill(
  persona: string,
  continuation?: string
): PrefillMessage {
  const prefix = PERSONA_PREFIXES[persona] ?? persona;
  return {
    role: "assistant",
    content: continuation ? `${prefix} ${continuation}` : prefix,
  };
}

// ============================================================================
// Message Integration
// ============================================================================

/**
 * Append prefill to messages array
 */
export function appendPrefill(
  messages: CoreMessage[],
  prefill: PrefillMessage
): CoreMessage[] {
  // Only add if content is non-empty
  if (!prefill.content || prefill.content.trim().length === 0) {
    return messages;
  }

  return [...messages, prefill as CoreMessage];
}

/**
 * Check if messages already have a prefill (assistant message at end)
 */
export function hasPrefill(messages: CoreMessage[]): boolean {
  const last = messages.at(-1);
  return last?.role === "assistant";
}

/**
 * Remove existing prefill if present
 */
export function removePrefill(messages: CoreMessage[]): CoreMessage[] {
  if (!hasPrefill(messages)) {
    return messages;
  }
  return messages.slice(0, -1);
}

// ============================================================================
// Context-Aware Prefill Selection
// ============================================================================

export type PrefillContext = {
  domain?: string;
  taskType?: string;
  urgency?: "low" | "medium" | "high";
  userPreference?: {
    verbosity?: "concise" | "normal" | "detailed";
    codeStyle?: string;
  };
};

/**
 * Select appropriate prefill based on context
 */
export function selectPrefill(context: PrefillContext): PrefillConfig | null {
  // High urgency = quick response
  if (context.urgency === "high") {
    return {
      reasoningPrefix: "quick",
    };
  }

  // Code tasks
  if (context.taskType === "code" || context.domain === "coding") {
    return {
      personaPrefix: "engineer",
      outputFormat: "code",
    };
  }

  // Analysis tasks
  if (context.taskType === "analysis" || context.taskType === "research") {
    return {
      reasoningPrefix: "deep",
      chainOfThought: true,
    };
  }

  // Debugging
  if (context.taskType === "debug" || context.taskType === "fix") {
    return {
      reasoningPrefix: "debug",
      personaPrefix: "engineer",
    };
  }

  // Review tasks
  if (context.taskType === "review") {
    return {
      personaPrefix: "reviewer",
    };
  }

  // Default - no prefill
  return null;
}

/**
 * Build prefill message from context
 */
export function buildContextualPrefill(
  context: PrefillContext
): PrefillMessage | null {
  const config = selectPrefill(context);
  if (!config) {
    return null;
  }
  return buildPrefillMessage(config);
}
