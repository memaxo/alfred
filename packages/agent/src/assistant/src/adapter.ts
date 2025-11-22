import { extract } from "@alfred/knowledge/extractor";
import { findNearestConcept } from "@alfred/db/repo/graph";
import { embedMany } from "@alfred/rag";
import { ANCHORS } from "../../../../knowledge/src/ontology";

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

/**
 * Analyze the conversation context to determine the dominant domain.
 * Uses Graph Topology:
 * 1. Extract entities from recent messages.
 * 2. Find path from entities to Anchor Concepts in the Graph.
 */
export async function analyzeContext(
  messages: Array<{ role: string; content: string }>
): Promise<{ domains: string[]; paths: string[][] }> {
  // Aggregate the last 3 user messages to get current context
  const recentUserMessages = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join("\n");

  if (!recentUserMessages) {
    return { domains: [], paths: [] };
  }

  // 1. Extract entities using simple NLP
  const extraction = extract(recentUserMessages, "adapter-context");
  const entities = Array.from(extraction.entities);

  if (entities.length === 0) {
    return { domains: [], paths: [] };
  }

  // 2. Query the Graph for connection to Anchor Concepts
  // We check the first 5 entities to keep latency low
  const candidates = entities.slice(0, 5);
  const detectedConcepts = new Set<string>();
  const detectedPaths: string[][] = [];
  const targetConcepts = Object.keys(ANCHORS);

  // Generate embeddings for vector-native entity linking
  let embeddings: number[][] = [];
  try {
    embeddings = await embedMany(candidates);
  } catch (e) {
    console.warn("Failed to generate embeddings for entity linking", e);
    // Fallback to empty embeddings (will use string match)
    embeddings = new Array(candidates.length).fill(undefined);
  }

  // Parallelize graph queries
  await Promise.all(
    candidates.map(async (entity, i) => {
      try {
        const result: any = await findNearestConcept(
          entity || undefined,
          targetConcepts,
          3,
          "ontology",
          embeddings[i]
        );

        // Explicitly cast result.node to any to access label if needed, or just use string check
        if (result && result.node) {
          const node = result.node as any; // Escape hatch for now as types seem misaligned
          const nodeLabel = node.label || "unknown";
          detectedConcepts.add(nodeLabel);
          detectedPaths.push([entity, nodeLabel]);
        }
      } catch (e) {
        console.error("ADAPTER GRAPH QUERY ERROR:", e);
        // Ignore graph query errors (fail open)
      }
    })
  );

  return {
    domains: Array.from(detectedConcepts),
    paths: detectedPaths,
  };
}

/**
 * Get the persona instruction for the detected domains.
 * Merges instructions if multiple domains are detected.
 */
export function getPersonaInstruction(domains: string[]): string | null {
  if (domains.length === 0) {
    return null;
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
    return null;
  }

  return `
### ADAPTIVE PERSONA ACTIVE
${instructions.join("\n\n")}
`;
}
