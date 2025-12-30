import { linkEntities } from "../../services/entity-linker";
import { JARVIS_SYSTEM_ENHANCEMENT } from "./jarvis-persona";

const PERSONAS: Partial<Record<string, string>> = {
  Coding: `
You are an expert Senior Software Engineer.
- Prioritize terse, efficient, and idiomatic code.
- Prefer TypeScript, Bun, and modern patterns (e.g., Functional Programming).
- When providing code, give the complete solution, not just snippets.
- Assume the user is technical; skip basic explanations unless asked.
`,
  Security: `
You are a Cybersecurity Researcher and Ethical Hacker.
- Prioritize safety, privacy, and secure coding practices.
- Validate all inputs and assume an adversarial environment.
- Warn about potential vulnerabilities (XSS, SQLi, RCE) in any code discussed.
- Use standard terminology (CVE, Zero-day, Mitre ATT&CK).
`,
  AI: `
You are an AI Research Scientist.
- Focus on model architecture, inference efficiency, and vector semantics.
- Explain concepts using mathematical or architectural precision (e.g., Attention mechanisms, Embeddings).
- Distinguish between Training, Fine-tuning, and RAG.
`,
  Politics: `
You are a Political Analyst.
- Maintain neutrality and objectivity.
- Focus on policy mechanics, historical precedent, and verifiable facts.
- Avoid partisan rhetoric; analyze causes and effects.
`,
  News: `
You are a News Curator.
- Prioritize recency, accuracy, and source attribution.
- Summarize facts clearly; distinguish between confirmed reports and speculation.
`,
};

function isJarvisPersonaEnabled(): boolean {
  const raw =
    typeof process !== "undefined"
      ? process.env.ENABLE_JARVIS_PERSONA
      : undefined;
  return raw === "1" || raw === "true";
}

function getJarvisEnhancement(): string | null {
  if (!isJarvisPersonaEnabled()) {
    return null;
  }
  return JARVIS_SYSTEM_ENHANCEMENT.trim();
}

/**
 * Analyze the conversation context to determine the dominant domain.
 * Uses Graph Topology:
 * 1. Extract entities from recent messages.
 * 2. Find path from entities to Anchor Concepts in the Graph.
 */
export function analyzeContext(
  messages: Array<{ role: string; content: string }>
): Promise<{ domains: string[]; paths: string[][] }> {
  return Promise.resolve(linkEntities(messages));
}

/**
 * Get the persona instruction for the detected domains.
 * Merges instructions if multiple domains are detected.
 */
export function getPersonaInstruction(domains: string[]): string | null {
  const jarvisEnhancement = getJarvisEnhancement();

  if (domains.length === 0) {
    return jarvisEnhancement;
  }

  const instructions: string[] = [];
  const sortedDomains = [...domains].sort();

  for (const domain of sortedDomains) {
    const instruction = PERSONAS[domain];
    if (instruction) {
      instructions.push(instruction.trim());
    }
  }

  if (instructions.length === 0) {
    return jarvisEnhancement;
  }

  const adaptivePersona = `
### ADAPTIVE PERSONA ACTIVE
${instructions.join("\n\n")}
`;
  if (!jarvisEnhancement) {
    return adaptivePersona;
  }
  return `${adaptivePersona.trim()}\n\n${jarvisEnhancement}`;
}

export {
  buildJarvisOpening,
  selectGreeting,
  selectTransition,
} from "./jarvis-persona";
