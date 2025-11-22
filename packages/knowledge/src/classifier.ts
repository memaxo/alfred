import { embed } from "@alfred/rag";
import { DOMAINS, type Domain } from "./taxonomy.js";

/**
 * Vector Classifier
 * Classifies text into domains using semantic vector similarity.
 */
export class VectorClassifier {
  private readonly centroids: Map<Domain, number[]> = new Map();
  private initialized = false;

  /**
   * Initialize the classifier by computing centroids for all domains.
   * This should be called once at startup or lazily on first use.
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const domains = Object.keys(DOMAINS) as Domain[];

    // Compute centroids sequentially to avoid overloading the embedding model
    for (const domain of domains) {
      const description = DOMAINS[domain].description;
      try {
        const vector = await embed(description);
        this.centroids.set(domain, vector);
      } catch (_error) {}
    }

    this.initialized = true;
  }

  /**
   * Classify text into domains based on vector similarity.
   * Returns a list of matching domains.
   * @param text The text to classify
   * @param threshold Similarity threshold (0-1)
   */
  async classify(text: string, threshold = 0.65): Promise<Domain[]> {
    if (!this.initialized) {
      await this.init();
    }

    let inputVector: number[];
    try {
      inputVector = await embed(text);
    } catch {
      // If embedding fails, fallback to empty result (safeguard)
      return [];
    }

    const results: Domain[] = [];

    for (const [domain, centroid] of this.centroids.entries()) {
      const similarity = cosineSimilarity(inputVector, centroid);
      if (similarity >= threshold) {
        results.push(domain);
      }
    }

    return results;
  }
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Singleton instance
export const classifier = new VectorClassifier();
