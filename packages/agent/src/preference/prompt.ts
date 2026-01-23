import { logger } from "@alfred/metrics";
import type {
  DomainName,
  PreferenceDetail,
  PreferenceKey,
} from "@alfred/type/preference";

import { detectDomain } from "./domain";
import { loadPreferencesWithDefaults } from "./loader";
import { sanitizePreferences } from "./sanitize";

export type DomainContext = {
  projectId?: string;
  domain?: DomainName | null;
  toolNames?: string[];
  conversationType?: "workflow" | "chat" | "assistant";
};

const RESPONSE_VERBOSITY_KEY = "response.verbosity";
const RESPONSE_TONE_KEY = "response.tone";
const RESPONSE_FORMAT_KEY = "response.format";
const RESPONSE_EXPLANATION_KEY = "response.explanation_depth";

const FEATURE_FLAG = "PREFERENCE_ADAPTATION_ENABLED";
const ROLLOUT_FLAG = "PREFERENCE_ADAPTATION_ROLLOUT_PERCENT";

export async function buildPreferenceSystemPrompt(
  userId: string,
  context?: DomainContext
): Promise<string> {
  if (!shouldApplyPreferences(userId)) {
    return "";
  }

  let domain = context?.domain ?? null;
  if (!domain && context?.toolNames?.length) {
    domain = (await detectDomain([], context.toolNames)) ?? null;
  }

  try {
    const rawPrefs = await loadPreferencesWithDefaults(
      userId,
      context?.projectId,
      domain
    );
    if (rawPrefs.size === 0) {
      return "";
    }

    const sanitized = sanitizePreferences(rawPrefs);
    const filtered = filterByContext(sanitized, domain);
    if (filtered.size === 0) {
      return "";
    }

    return renderPrompt(filtered, domain, context);
  } catch (error) {
    logger.warn("preference_prompt_build_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return "";
  }
}

function shouldApplyPreferences(userId: string): boolean {
  if (process.env[FEATURE_FLAG] !== "true") {
    return false;
  }

  const rollout = Number.parseInt(process.env[ROLLOUT_FLAG] ?? "100", 10);
  const normalized = Number.isFinite(rollout)
    ? Math.min(Math.max(rollout, 0), 100)
    : 100;

  if (normalized >= 100) {
    return true;
  }

  const bucket = hashUserId(userId) % 100;
  return bucket < normalized;
}

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function filterByContext(
  preferences: Map<PreferenceKey, PreferenceDetail>,
  domain: DomainName | null
): Map<PreferenceKey, PreferenceDetail> {
  const filtered = new Map<PreferenceKey, PreferenceDetail>();

  for (const [key, value] of preferences) {
    if (key.startsWith("response.")) {
      filtered.set(key, value);
      continue;
    }

    if (domain && key.startsWith(`domain.${domain}.`)) {
      filtered.set(key, value);
    }
  }

  return filtered;
}

function renderPrompt(
  preferences: Map<PreferenceKey, PreferenceDetail>,
  domain: DomainName | null,
  context?: DomainContext
): string {
  const segments: string[] = [];

  segments.push("User preferences (apply as response formatting):");

  const verbosity = preferences.get(RESPONSE_VERBOSITY_KEY)?.value;
  if (verbosity) {
    segments.push(`Response Style: ${explainVerbosity(verbosity as string)}`);
  }

  const tone = preferences.get(RESPONSE_TONE_KEY)?.value;
  if (tone) {
    segments.push(`Tone: ${explainTone(tone as string)}`);
  }

  const format = preferences.get(RESPONSE_FORMAT_KEY)?.value;
  if (format) {
    segments.push(`Format: ${explainFormat(format as string)}`);
  }

  const explanation = preferences.get(RESPONSE_EXPLANATION_KEY)?.value;
  if (explanation) {
    segments.push(`Explanation Depth: ${explainDepth(explanation as string)}`);
  }

  if (domain) {
    const domainLines = buildDomainSection(domain, preferences);
    if (domainLines.length) {
      segments.push(domainLines.join("\n"));
    }
  }

  if (context?.conversationType) {
    segments.push(`Conversation context: ${context.conversationType}`);
  }

  const prompt = segments.join("\n\n").trim();
  return prompt.length ? prompt : "";
}

function buildDomainSection(
  domain: DomainName,
  preferences: Map<PreferenceKey, PreferenceDetail>
): string[] {
  const lines: string[] = [];
  const domainEntries = Array.from(preferences.entries()).filter(([key]) =>
    key.startsWith(`domain.${domain}.`)
  );

  if (!domainEntries.length) {
    return lines;
  }

  lines.push(`Domain-Specific Preferences (${domain}):`);

  for (const [key, detail] of domainEntries) {
    const instruction = formatDomainPreference(key, detail.value);
    if (instruction) {
      lines.push(`- ${instruction}`);
    }
  }

  return lines;
}

function explainVerbosity(value: string): string {
  switch (value) {
    case "minimal":
      return "Be extremely concise. Use the fewest words possible.";
    case "concise":
      return "Be brief and to the point.";
    case "detailed":
      return "Provide thorough explanations with context.";
    case "verbose":
      return "Provide comprehensive explanations with extensive detail.";
    default:
      return "Match the user's requested level of brevity.";
  }
}

function explainTone(value: string): string {
  switch (value) {
    case "formal":
      return "Use formal, professional language.";
    case "casual":
      return "Use casual, conversational language.";
    case "technical":
      return "Use precise, technical language and terminology.";
    case "friendly":
      return "Use warm, encouraging language.";
    default:
      return "Match the user's tone preference.";
  }
}

function explainFormat(value: string): string {
  switch (value) {
    case "bullet":
      return "Use bullet points for key points.";
    case "paragraph":
      return "Respond in paragraph form.";
    case "structured":
      return "Use structured sections with headings.";
    case "narrative":
      return "Use narrative, story-like flow.";
    default:
      return "Choose the clearest formatting for the user.";
  }
}

function explainDepth(value: string): string {
  switch (value) {
    case "surface":
      return "Keep explanations high-level.";
    case "moderate":
      return "Provide balanced detail without overwhelming.";
    case "deep":
      return "Dive deep with step-by-step reasoning.";
    default:
      return "Match the user's desired level of explanation.";
  }
}

function formatDomainPreference(
  key: PreferenceKey,
  value: PreferenceDetail["value"]
): string | null {
  if (key.endsWith("config_format")) {
    return `Prefer ${value} format for configuration.`;
  }
  if (key.endsWith("output_style")) {
    return `Use ${value} output style.`;
  }
  if (key.endsWith("tool_preference")) {
    return `Favor the ${value} tool variant when options exist.`;
  }
  if (key.endsWith("commit_style")) {
    return `Write commits using the ${value} style.`;
  }
  if (key.endsWith("compose_version")) {
    return `Target Docker Compose version ${value}.`;
  }
  return null;
}
