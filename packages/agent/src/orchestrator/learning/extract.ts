/**
 * Knowledge helpers — ontology seeding and domain correction.
 *
 * Run-level learning extraction has been replaced by LLM-driven synthesis
 * in ReflectionObserver (packages/pipeline/src/observers/reflect.ts).
 */
import { upsertEdges, upsertNodes } from "@alfred/db/repo/graph/index";
import { type Knowledge, knowledgeHash } from "@alfred/knowledge/hypergraph";
import {
  getOntologyKnowledge,
  SEED_CONFIDENCE,
} from "@alfred/knowledge/ontology";
import { logger } from "@alfred/logger";
import { embedMany } from "@alfred/rag";
import { createHash } from "node:crypto";

/**
 * Seed the ontology graph with base knowledge nodes and edges.
 */
export async function seedOntology() {
  logger.debug("learning_worker_seeding_ontology");
  const knowledge = getOntologyKnowledge();
  const nodes = knowledge.filter((k) => k.data._ !== "relation");
  const edges = knowledge.filter((k) => k.data._ === "relation");

  const nodeMap = await upsertNodes(
    nodes.map((k) => ({
      resource: "ontology",
      hash: k.hash,
      kind: k.data._,
      label:
        k.data._ === "fact"
          ? k.data.content
          : k.data._ === "insight"
            ? k.data.conclusion
            : "unknown",
      properties: { confidence: SEED_CONFIDENCE, source: "seed" },
    }))
  );

  const edgeSeeds = edges
    .map((k) => {
      const rel = k.data as {
        from: unknown;
        to: unknown;
        kind: string;
        weight?: number;
      };
      const fromHash = knowledgeHash(rel.from as Knowledge);
      const toHash = knowledgeHash(rel.to as Knowledge);
      const fromNode = nodeMap.get(`ontology:${fromHash}`);
      const toNode = nodeMap.get(`ontology:${toHash}`);

      if (!(fromNode && toNode)) {
        return null;
      }

      return {
        resource: "ontology",
        hash: k.hash,
        fromId: fromNode.id,
        toId: toNode.id,
        kind: rel.kind,
        weight: rel.weight ?? SEED_CONFIDENCE,
        metadata: { source: "seed" },
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (edgeSeeds.length > 0) {
    await upsertEdges(edgeSeeds);
  }
}

/**
 * Learn domain classification from user correction.
 */
export async function learnDomainCorrection(
  text: string,
  correctDomain: string,
  incorrectDomain?: string
): Promise<void> {
  logger.info("learning_worker_domain_correction", {
    textLength: text.length,
    correctDomain,
    incorrectDomain,
  });

  try {
    const embeddings = await embedMany([text]);
    const embedding = embeddings.at(0);
    const hashInput = `domain:${text.slice(0, 500)}:${correctDomain}`;
    const hash = createHash("sha256").update(hashInput).digest("hex");

    await upsertNodes([
      {
        resource: "user",
        hash,
        kind: "domain_association",
        label: text.slice(0, 200),
        properties: {
          domain: correctDomain,
          confidence: 0.9,
          source: "correction",
          correctedFrom: incorrectDomain ?? null,
          correctedAt: new Date().toISOString(),
        },
        embedding,
      },
    ]);

    if (incorrectDomain) {
      logger.debug("learning_worker_incorrect_domain_noted", {
        incorrectDomain,
      });
    }

    logger.info("learning_worker_domain_correction_complete", {
      correctDomain,
      hash,
    });
  } catch (error) {
    logger.error("learning_worker_domain_correction_failed", {
      error: error instanceof Error ? error.message : String(error),
      correctDomain,
    });
    throw error;
  }
}
