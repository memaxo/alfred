import type {
  ConversationHistory,
  FeedbackHistory,
  PreferenceDetail,
  PreferenceKey,
  PreferenceSource,
  ResponseFormat,
  ResponseTone,
  ResponseVerbosity,
  ToolCallHistory,
} from "@alfred/type/preference";
import type { UIMessage } from "@alfred/type/stream";

const VERBOSITY_HINTS: Record<ResponseVerbosity, string[]> = {
  minimal: ["one sentence", "single sentence", "shortest", "tiny"],
  concise: ["concise", "brief", "short", "too verbose", "trim down"],
  detailed: ["more detail", "expand", "elaborate", "add detail"],
  verbose: ["exhaustive", "comprehensive", "long form", "write a lot"],
};

const TONE_HINTS: Record<ResponseTone, string[]> = {
  formal: ["formal", "professional", "business"],
  casual: ["casual", "relaxed", "friendly"],
  technical: ["technical", "low-level", "use jargon"],
  friendly: ["friendly", "warm", "approachable"],
};

const FORMAT_HINTS: Record<ResponseFormat, string[]> = {
  bullet: ["bullet", "list", "- "],
  paragraph: ["paragraph", "full sentence"],
  structured: ["section", "heading", "outline"],
  narrative: ["story", "narrative", "flowing"],
};

const FORMAT_MATCHERS: Array<{ format: ResponseFormat; matcher: RegExp }> = [
  { format: "bullet", matcher: /(^|\n)(?:[-*]|\d+\.)/ },
  { format: "structured", matcher: /(^|\n)#+\s/m },
];

const toneHeuristics = {
  formal: /\b(regards|sincerely|therefore|henceforth)\b/i,
  casual: /\b(hey|yo|gonna|wanna|lol)\b/i,
  technical: /\b(cpu|api|latency|throughput|kernel|schema)\b/i,
  friendly: /!|\bemojis?\b/i,
};

function calculateConfidence(signals: number, base = 0.5): number {
  return Math.min(1, base + signals * 0.1);
}

function buildPreferenceDetail(
  value: PreferenceDetail["value"],
  source: PreferenceSource,
  confidence: number,
  evidence?: string[]
): PreferenceDetail {
  return {
    value,
    source,
    confidence,
    evidence: evidence?.length ? evidence : undefined,
  };
}

function collectUserTexts(messages: UIMessage[]): string[] {
  const texts: string[] = [];
  for (const message of messages) {
    if (message.role !== "user" || !message.parts) {
      continue;
    }
    for (const part of message.parts) {
      if (part.type === "text" && part.text) {
        texts.push(part.text.toLowerCase());
      }
    }
  }
  return texts;
}

function countHints(texts: string[], hints: string[]): number {
  let count = 0;
  for (const text of texts) {
    for (const hint of hints) {
      if (text.includes(hint)) {
        count += 1;
      }
    }
  }
  return count;
}

function joinText(message: UIMessage): string {
  if (!message.parts) {
    return "";
  }
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } =>
        part.type === "text" && Boolean(part.text)
    )
    .map((part) => part.text)
    .join(" ");
}

/**
 * Infer response-level preferences (verbosity, tone, format) from conversation history.
 * Pure heuristic using user utterances; no side effects.
 */
export function inferResponsePreferences(
  conversations: ConversationHistory[]
): Map<PreferenceKey, PreferenceDetail> {
  const preferences = new Map<PreferenceKey, PreferenceDetail>();
  if (!conversations.length) {
    return preferences;
  }

  const userTexts = conversations.flatMap((conversation) =>
    collectUserTexts(conversation.messages)
  );

  for (const [verbosity, hints] of Object.entries(VERBOSITY_HINTS) as [
    ResponseVerbosity,
    string[],
  ][]) {
    const matches = countHints(userTexts, hints);
    if (matches > 0) {
      preferences.set(
        "response.verbosity",
        buildPreferenceDetail(
          verbosity,
          "inferred",
          calculateConfidence(matches),
          conversations.map((c) => c.id)
        )
      );
      break;
    }
  }

  for (const [tone, hints] of Object.entries(TONE_HINTS) as [
    ResponseTone,
    string[],
  ][]) {
    const matches = countHints(userTexts, hints);
    if (matches > 0) {
      preferences.set(
        "response.tone",
        buildPreferenceDetail(
          tone,
          "inferred",
          calculateConfidence(matches),
          conversations.map((c) => c.id)
        )
      );
      break;
    }
  }

  for (const [format, hints] of Object.entries(FORMAT_HINTS) as [
    ResponseFormat,
    string[],
  ][]) {
    const matches = countHints(userTexts, hints);
    if (matches > 0) {
      preferences.set(
        "response.format",
        buildPreferenceDetail(
          format,
          "inferred",
          calculateConfidence(matches),
          conversations.map((c) => c.id)
        )
      );
      break;
    }
  }

  return preferences;
}

/**
 * Infer domain-specific preferences by inspecting tool call cadence and parameters.
 */
export function inferDomainPreferences(
  toolCalls: ToolCallHistory[]
): Map<PreferenceKey, PreferenceDetail> {
  const preferences = new Map<PreferenceKey, PreferenceDetail>();
  if (!toolCalls.length) {
    return preferences;
  }

  const grouped = new Map<string, ToolCallHistory[]>();
  for (const call of toolCalls) {
    const domain = call.domain || extractDomain(call.toolName);
    if (!domain) {
      continue;
    }
    if (!grouped.has(domain)) {
      grouped.set(domain, []);
    }
    grouped.get(domain)?.push(call);
  }

  for (const [domain, calls] of grouped) {
    const configPreference = inferConfigFormatPreference(calls);
    if (configPreference) {
      preferences.set(
        `domain.${domain}.config_format`,
        buildPreferenceDetail(
          configPreference.value,
          "inferred",
          calculateConfidence(configPreference.count, 0.6),
          calls.map((call) => call.eventId)
        )
      );
    }

    const toolPreference = inferToolPreference(calls);
    if (toolPreference) {
      preferences.set(
        `domain.${domain}.tool_preference`,
        buildPreferenceDetail(
          toolPreference.value,
          "inferred",
          calculateConfidence(toolPreference.count, 0.5),
          calls.map((call) => call.eventId)
        )
      );
    }
  }

  return preferences;
}

/**
 * Convert explicit feedback tags into preference adjustments with high confidence.
 */
export function inferPreferencesFromFeedback(
  feedbackItems: FeedbackHistory[]
): Map<PreferenceKey, PreferenceDetail> {
  const preferences = new Map<PreferenceKey, PreferenceDetail>();
  if (!feedbackItems.length) {
    return preferences;
  }

  const verbositySignals = feedbackItems.filter((item) =>
    item.tags?.some((tag) => tag === "too_verbose" || tag === "too_brief")
  );

  if (verbositySignals.length) {
    const wantsConcise = verbositySignals.some((item) =>
      item.tags?.includes("too_verbose")
    );
    const value: ResponseVerbosity = wantsConcise ? "concise" : "detailed";
    preferences.set(
      "response.verbosity",
      buildPreferenceDetail(
        value,
        "learned",
        calculateConfidence(verbositySignals.length, 0.7),
        verbositySignals.map((item) => item.feedbackId)
      )
    );
  }

  const formatSignals = feedbackItems.filter((item) =>
    item.tags?.some(
      (tag) => tag === "prefer_bullets" || tag === "prefer_paragraph"
    )
  );

  if (formatSignals.length) {
    const prefersBullets = formatSignals.some((item) =>
      item.tags?.includes("prefer_bullets")
    );
    preferences.set(
      "response.format",
      buildPreferenceDetail(
        prefersBullets ? "bullet" : "paragraph",
        "learned",
        calculateConfidence(formatSignals.length, 0.6),
        formatSignals.map((item) => item.feedbackId)
      )
    );
  }

  return preferences;
}

/**
 * Compare original vs. corrected messages to infer the preference the correction implies.
 */
export function inferPreferenceFromCorrection(
  original: UIMessage,
  corrected: UIMessage,
  correctionType: "verbosity" | "tone" | "format" | "content"
): { key: PreferenceKey; value: PreferenceDetail["value"] } | null {
  const originalText = joinText(original);
  const correctedText = joinText(corrected);

  if (!(originalText && correctedText)) {
    return null;
  }

  if (correctionType === "verbosity") {
    const ratio = correctedText.length / Math.max(originalText.length, 1);
    if (ratio < 0.75) {
      return { key: "response.verbosity", value: "concise" };
    }
    if (ratio > 1.25) {
      return { key: "response.verbosity", value: "detailed" };
    }
    return null;
  }

  if (correctionType === "tone") {
    const tone = detectTone(correctedText);
    return tone ? { key: "response.tone", value: tone } : null;
  }

  if (correctionType === "format") {
    const format = detectFormat(correctedText);
    return format ? { key: "response.format", value: format } : null;
  }

  if (correctionType === "content") {
    const explanation = detectExplanationDepth(originalText, correctedText);
    return explanation
      ? { key: "response.explanation_depth", value: explanation }
      : null;
  }

  return null;
}

function extractDomain(toolName: string): string | null {
  if (!toolName.includes(".")) {
    return null;
  }
  return toolName.split(".")[0] ?? null;
}

function inferConfigFormatPreference(
  calls: ToolCallHistory[]
): { value: string; count: number } | null {
  const counts = new Map<string, number>();

  for (const call of calls) {
    const explicitFormat = readStringProperty(call.parameters, [
      "format",
      "type",
    ]);
    if (explicitFormat) {
      const key = explicitFormat.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      continue;
    }

    if (call.toolName.includes("yaml")) {
      counts.set("yaml", (counts.get("yaml") ?? 0) + 1);
    } else if (call.toolName.includes("json")) {
      counts.set("json", (counts.get("json") ?? 0) + 1);
    }
  }

  if (!counts.size) {
    return null;
  }

  const topEntry = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!topEntry) {
    return null;
  }
  const [value, count] = topEntry;
  return { value, count };
}

function inferToolPreference(
  calls: ToolCallHistory[]
): { value: string; count: number } | null {
  const counts = new Map<string, number>();

  for (const call of calls) {
    counts.set(call.toolName, (counts.get(call.toolName) ?? 0) + 1);
  }

  if (!counts.size) {
    return null;
  }

  const topEntry = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!topEntry) {
    return null;
  }
  const [value, count] = topEntry;
  return { value, count };
}

function readStringProperty(
  parameters: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = parameters[key];
    if (typeof value === "string" && value.trim().length) {
      return value.trim();
    }
  }
  return null;
}

function detectTone(text: string): ResponseTone | null {
  for (const [tone, pattern] of Object.entries(toneHeuristics) as [
    ResponseTone,
    RegExp,
  ][]) {
    if (pattern.test(text)) {
      return tone;
    }
  }
  return null;
}

function detectFormat(text: string): ResponseFormat | null {
  for (const matcher of FORMAT_MATCHERS) {
    if (matcher.matcher.test(text)) {
      return matcher.format;
    }
  }
  if (text.includes("\n\n")) {
    return "structured";
  }
  return null;
}

function detectExplanationDepth(
  originalText: string,
  correctedText: string
): PreferenceDetail["value"] | null {
  const originalSentences = originalText.split(/[.!?]/).filter(Boolean).length;
  const correctedSentences = correctedText
    .split(/[.!?]/)
    .filter(Boolean).length;

  if (correctedSentences >= originalSentences + 2) {
    return "deep";
  }

  if (correctedSentences <= Math.max(1, originalSentences - 2)) {
    return "surface";
  }

  if (correctedSentences > originalSentences) {
    return "moderate";
  }

  return null;
}
