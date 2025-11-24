import nlp from "compromise";
import {
  fact,
  insight,
  knowledgeHash,
  nodeFromHash,
  relation,
  type Knowledge,
} from "../hypergraph";
import type { KnowledgeEntry } from "../extractor";
import {
  cosine,
  embedTextSamples,
  getPatternCentroid,
  scoreToConfidence,
} from "./pattern-utils";

const MIN_SIMILARITY = 0.3;

export async function deriveCausalityFromText(
  text: string
): Promise<KnowledgeEntry[]> {
  const doc = nlp(text);
  const sentences = doc.sentences().out("array");
  const candidates: Array<{ cause: string; effect: string; evidence: string }>
    = [];

  for (const sentence of sentences) {
    const clauseDoc = nlp(sentence);
    const clauses = clauseDoc.clauses().out("array");
    if (clauses.length < 2) {
      continue;
    }

    for (let i = 0; i < clauses.length - 1; i += 1) {
      const cause = clauses[i]?.trim();
      const effect = clauses[i + 1]?.trim();
      if (!cause || !effect) {
        continue;
      }
      candidates.push({ cause, effect, evidence: sentence });
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  const embeddings = await embedTextSamples(
    candidates.map((candidate) => `${candidate.cause} -> ${candidate.effect}`)
  );

  if (embeddings.length === 0) {
    return [];
  }

  const centroid = await getPatternCentroid("causal");
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

    const similarity = cosine(embedding, centroid);
    if (similarity < MIN_SIMILARITY) {
      return;
    }

    const confidence = scoreToConfidence(similarity);
    const causeNode = insert(fact(candidate.cause, confidence, "inferred"));
    const effectNode = insert(fact(candidate.effect, confidence, "inferred"));

    insert(relation(causeNode, effectNode, "causes", confidence));
    insert(
      insight(
        [causeNode, effectNode],
        `${candidate.cause} causes ${candidate.effect}`,
        confidence
      )
    );
  });

  return entries;
}
