import { cosineSimilarity } from "@alfred/embed";
import nlp from "compromise";

import type { KnowledgeEntry } from "../extractor";

import {
  fact,
  type Knowledge,
  knowledgeHash,
  nodeFromHash,
  relation,
} from "../hypergraph";
import {
  embedTextSamples,
  getPatternCentroid,
  scoreToConfidence,
} from "./pattern-utils";

const MIN_SIMILARITY = 0.28;

export async function deriveAlternativeFacts(
  text: string
): Promise<KnowledgeEntry[]> {
  const doc = nlp(text);
  const sentences = doc.sentences().out("array");
  const candidates: { optionA: string; optionB: string }[] = [];

  for (const sentence of sentences) {
    const clauseDoc = nlp(sentence);
    const clauses = clauseDoc.clauses().out("array");
    if (clauses.length < 2) {
      continue;
    }

    for (let i = 0; i < clauses.length - 1; i += 1) {
      const first = clauses[i]?.trim();
      const second = clauses[i + 1]?.trim();
      if (first && second) {
        candidates.push({ optionA: first, optionB: second });
      }
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  const embeddings = await embedTextSamples(
    candidates.map(
      (candidate) => `${candidate.optionA} || ${candidate.optionB}`
    )
  );

  if (embeddings.length === 0) {
    return [];
  }

  const centroid = await getPatternCentroid("alternative");
  const entries: KnowledgeEntry[] = [];
  const seen = new Set<string>();

  const insert = (item: Knowledge) => {
    const hash = knowledgeHash(item);
    if (!seen.has(hash)) {
      seen.add(hash);
      entries.push({ hash, data: item });
    }
    return nodeFromHash(hash);
  };

  embeddings.forEach((embedding, index) => {
    const candidate = candidates[index];
    if (!candidate) {
      return;
    }

    const similarity = cosineSimilarity(embedding, centroid);
    if (similarity < MIN_SIMILARITY) {
      return;
    }

    const confidence = scoreToConfidence(similarity);
    const optionANode = insert(fact(candidate.optionA, confidence, "inferred"));
    const optionBNode = insert(fact(candidate.optionB, confidence, "inferred"));
    insert(relation(optionANode, optionBNode, "alternative_to", confidence));
  });

  return entries;
}
