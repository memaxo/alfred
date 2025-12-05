import type { Knowledge } from "./hypergraph.js";
import { fact, knowledgeHash, nodeFromHash, relation } from "./hypergraph.js";

/**
 * Seed confidence for bootstrap ontology nodes.
 * Low confidence (0.5) allows learned knowledge to override seeds
 * when learned confidence exceeds LEARNED_OVERRIDE_THRESHOLD (0.8).
 */
export const SEED_CONFIDENCE = 0.5;

/**
 * Ontology Anchors
 * These are the immutable "Platonic Ideals" of the system.
 * The graph topology uses these as roots for classification.
 */
export const ANCHORS = {
  Coding: "concept:coding",
  Security: "concept:security",
  Politics: "concept:politics",
  AI: "concept:ai",
  News: "concept:news",
} as const;

export type RiskAnchor = {
  label: string;
  id: string;
  level: "low" | "medium" | "high";
  description: string;
};

export type PatternAnchor = {
  label: string;
  id: string;
  pattern: "causal" | "decision" | "alternative";
  description: string;
};

export const RISK_ANCHORS: RiskAnchor[] = [
  {
    label: "Concept:HighRisk",
    id: "concept:highrisk",
    level: "high",
    description:
      "Actions that permanently delete data, spend money, change production systems, or expose private information beyond Alfred's owner.",
  },
  {
    label: "Concept:MediumRisk",
    id: "concept:mediumrisk",
    level: "medium",
    description:
      "Operations that edit files, send messages, or call APIs that can be reverted but still impact the outside world without immediate approval.",
  },
  {
    label: "Concept:LowRisk",
    id: "concept:lowrisk",
    level: "low",
    description:
      "Pure analysis, read-only exploration, drafts, or local experiments that cannot affect external systems or finances.",
  },
];

export const PATTERN_ANCHORS: PatternAnchor[] = [
  {
    label: "Pattern:Causal",
    id: "pattern:causal",
    pattern: "causal",
    description:
      "Text that describes a cause leading to an effect, e.g. 'because', 'therefore', explicit trigger-response structures.",
  },
  {
    label: "Pattern:Decision",
    id: "pattern:decision",
    pattern: "decision",
    description:
      "Statements that weigh options or announce a choice, often referencing criteria, trade-offs, or selected plans.",
  },
  {
    label: "Pattern:Alternative",
    id: "pattern:alternative",
    pattern: "alternative",
    description:
      "Language that contrasts multiple approaches, highlights 'instead', 'on the other hand', or proposes backups.",
  },
];

const ALL_ANCHORS = [
  ...Object.entries(ANCHORS).map(([label, id]) => ({
    label,
    id,
  })),
  ...RISK_ANCHORS.map((anchor) => ({ label: anchor.label, id: anchor.id })),
  ...PATTERN_ANCHORS.map((anchor) => ({ label: anchor.label, id: anchor.id })),
];

type OntologyTriple = [string, string, string]; // [Subject, Relation, Object]

/**
 * Minimal Seed Ontology
 * Provides just enough structure for "Emergence" to start working.
 * Users/Agents add to this graph over time.
 */
const SEED_DATA: OntologyTriple[] = [
  // Coding
  ["Frontend", "related_to", "Coding"],
  ["Backend", "related_to", "Coding"],
  ["Database", "related_to", "Coding"],
  ["DevOps", "related_to", "Coding"],
  ["Algorithm", "related_to", "Coding"],

  // Specific Tech (Bootstrap examples)
  ["React", "is_a", "Frontend"],
  ["TypeScript", "is_a", "Frontend"],
  ["Node.js", "is_a", "Backend"],
  ["Postgres", "is_a", "Database"],
  ["Docker", "is_a", "DevOps"],
  ["Rust", "is_a", "Backend"],

  // Security
  ["Vulnerability", "related_to", "Security"],
  ["Encryption", "related_to", "Security"],
  ["Authentication", "related_to", "Security"],
  ["CVE", "is_a", "Vulnerability"],
  ["XSS", "is_a", "Vulnerability"],

  // AI
  ["Machine Learning", "related_to", "AI"],
  ["LLM", "is_a", "Machine Learning"],
  ["Transformer", "is_a", "Machine Learning"],
  ["RAG", "related_to", "AI"],

  // Safety / Risk Anchors
  ["Safety", "related_to", "Security"],
  ["Risk", "related_to", "Safety"],
  ["Concept:HighRisk", "is_a", "Risk"],
  ["Concept:MediumRisk", "is_a", "Risk"],
  ["Concept:LowRisk", "is_a", "Risk"],

  // Pattern Anchors
  ["Knowledge", "related_to", "AI"],
  ["Pattern", "related_to", "Knowledge"],
  ["Pattern:Causal", "is_a", "Pattern"],
  ["Pattern:Decision", "is_a", "Pattern"],
  ["Pattern:Alternative", "is_a", "Pattern"],
];

export function getOntologyKnowledge(): { hash: string; data: Knowledge }[] {
  const list: { hash: string; data: Knowledge }[] = [];

  // 1. Create Anchor Nodes
  // Uses SEED_CONFIDENCE (0.5) to allow learned knowledge to override
  for (const anchor of ALL_ANCHORS) {
    const k = fact(anchor.label, SEED_CONFIDENCE, "ontology");
    // Force the ID/Hash to match our convention if we could,
    // but Hypergraph is content-addressed.
    // For ontology, we might just let them generate their own hashes
    // and look them up by label "Coding" etc.
    // Actually, to make ANCHORS useful, we need to find the node by Label.
    list.push({ hash: knowledgeHash(k), data: k });
  }

  // 2. Create Triples
  // Uses SEED_CONFIDENCE (0.5) to allow learned knowledge to override
  for (const [sub, rel, obj] of SEED_DATA) {
    const s = fact(sub, SEED_CONFIDENCE, "ontology");
    const o = fact(obj, SEED_CONFIDENCE, "ontology");
    const sHash = knowledgeHash(s);
    const oHash = knowledgeHash(o);

    list.push({ hash: sHash, data: s });
    list.push({ hash: oHash, data: o });

    const r = relation(
      nodeFromHash(sHash),
      nodeFromHash(oHash),
      rel,
      SEED_CONFIDENCE
    );
    list.push({ hash: knowledgeHash(r), data: r });
  }

  return list;
}
