import { type Domain, detectDomains } from "../../../../knowledge/src/taxonomy";

const PERSONAS: Partial<Record<Domain, string>> = {
  coding: `
You are an expert Senior Software Engineer.
- Prioritize terse, efficient, and idiomatic code.
- Prefer TypeScript, Bun, and modern patterns (e.g., Functional Programming).
- When providing code, give the complete solution, not just snippets.
- Assume the user is technical; skip basic explanations unless asked.
`,
  cybersecurity: `
You are a Cybersecurity Researcher and Ethical Hacker.
- Prioritize safety, privacy, and secure coding practices.
- Validate all inputs and assume an adversarial environment.
- Warn about potential vulnerabilities (XSS, SQLi, RCE) in any code discussed.
- Use standard terminology (CVE, Zero-day, Mitre ATT&CK).
`,
  ai: `
You are an AI Research Scientist.
- Focus on model architecture, inference efficiency, and vector semantics.
- Explain concepts using mathematical or architectural precision (e.g., Attention mechanisms, Embeddings).
- Distinguish between Training, Fine-tuning, and RAG.
`,
  politics: `
You are a Political Analyst.
- Maintain neutrality and objectivity.
- Focus on policy mechanics, historical precedent, and verifiable facts.
- Avoid partisan rhetoric; analyze causes and effects.
`,
  news: `
You are a News Curator.
- Prioritize recency, accuracy, and source attribution.
- Summarize facts clearly; distinguish between confirmed reports and speculation.
`,
};

/**
 * Analyze the conversation context to determine the dominant domain.
 * Uses a hybrid approach:
 * 1. Keyword detection (fast, deterministic)
 * 2. Vector classification (semantic, robust) - *Not used here to keep latency low, relying on keywords for now*
 *
 * NOTE: We are currently using only `detectDomains` (keywords) for the synchronous chat path
 * to ensure <100ms latency overhead. Vector classification is reserved for background workers.
 */
export function analyzeContext(
  messages: Array<{ role: string; content: string }>
): Domain[] {
  // Aggregate the last 3 user messages to get current context
  const recentUserMessages = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join("\n");

  if (!recentUserMessages) {
    return [];
  }

  // Detect domains using the taxonomy (fast regex)
  const domains = detectDomains(recentUserMessages);

  return domains;
}

/**
 * Get the persona instruction for the detected domains.
 * Merges instructions if multiple domains are detected.
 */
export function getPersonaInstruction(domains: Domain[]): string | null {
  if (domains.length === 0) {
    return null;
  }

  const instructions: string[] = [];

  // Sort domains to ensure deterministic order (e.g., Coding > AI)
  // We can prioritize specific domains if needed. For now, alphabetical is stable.
  const sortedDomains = [...domains].sort();

  for (const domain of sortedDomains) {
    const instruction = PERSONAS[domain];
    if (instruction) {
      instructions.push(instruction.trim());
    }
  }

  if (instructions.length === 0) {
    return null;
  }

  return `
### ADAPTIVE PERSONA ACTIVE
${instructions.join("\n\n")}
`;
}
