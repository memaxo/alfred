import nlp from "compromise";
import type { KnowledgeEntry } from "../extractor";
import { fact, type Knowledge, knowledgeHash } from "../hypergraph";
import {
  cosine,
  embedTextSamples,
  getPatternCentroid,
  scoreToConfidence,
} from "./pattern-utils";

const MIN_SIMILARITY = 0.32;

export async function deriveDecisionFacts(
  text: string
): Promise<KnowledgeEntry[]> {
  const doc = nlp(text);
  const sentences = doc.sentences().out("array");
  if (!sentences.length) {
    return [];
  }

  const embeddings = await embedTextSamples(sentences);
  if (embeddings.length === 0) {
    return [];
  }

  const centroid = await getPatternCentroid("decision");
  const entries: KnowledgeEntry[] = [];
  const seen = new Set<string>();

  const insert = (item: Knowledge) => {
    const hash = knowledgeHash(item);
    if (!seen.has(hash)) {
      seen.add(hash);
      entries.push({ hash, data: item });
    }
  };

  embeddings.forEach((embedding, index) => {
    const sentence = sentences[index];
    if (!sentence) {
      return;
    }

    const similarity = cosine(embedding, centroid);
    if (similarity < MIN_SIMILARITY) {
      return;
    }

    const confidence = scoreToConfidence(similarity);
    insert(fact(`Decision: ${sentence.trim()}`, confidence, "inferred"));
  });

  return entries;
}
