import { logger } from "@alfred/logger";
import { embedMany } from "@alfred/rag";
import type {
  ResponseFormat,
  ResponseTone,
  ResponseVerbosity,
} from "@alfred/type/preference";

const SAMPLE_LIMIT = 12;

const VERBOSITY_PROTOTYPES: Record<ResponseVerbosity, string[]> = {
  minimal: [
    "Respond in one crisp sentence that highlights the outcome without context.",
    "Keep answers ultra short, acknowledging only the key fact requested.",
  ],
  concise: [
    "Deliver a brief summary with 2 sentences that capture the essentials.",
    "Use tight, business-style updates that cover what matters and nothing else.",
  ],
  detailed: [
    "Offer a structured explanation with supporting points and clarifications.",
    "Expand on the reasoning, trade-offs, and next actions with numbered bullets.",
  ],
  verbose: [
    "Write a narrative walkthrough that covers history, context, and implications.",
    "Provide exhaustive detail, citing examples and edge cases along the way.",
  ],
};

const TONE_PROTOTYPES: Record<ResponseTone, string[]> = {
  formal: [
    "Adopt precise, courteous business prose with complete sentences and no slang.",
    "Communicate like an executive briefing with neutral, objective phrasing.",
  ],
  casual: [
    "Sound relaxed and conversational, using contractions and approachable energy.",
    "Write like a peer-to-peer chat with warmth and light humor.",
  ],
  technical: [
    "Explain in engineering language, referencing APIs, latency, and architecture.",
    "Use low-level terminology, assumptions, and measurements for expert readers.",
  ],
  friendly: [
    "Lead with empathy, encouragement, and positive reinforcement.",
    "Balance clarity with warmth, making the reader feel supported.",
  ],
};

const FORMAT_PROTOTYPES: Record<ResponseFormat, string[]> = {
  bullet: [
    "Summaries should be bullet lists with short fragments per line.",
    "Provide checklist-style responses, each bullet starting with an action verb.",
  ],
  paragraph: [
    "Write full paragraphs with flowing sentences and natural transitions.",
    "Compose in narrative form without headings or hard breaks.",
  ],
  structured: [
    "Organize output with headings, subheadings, and labeled sections.",
    "Return markdown sections (Overview, Risks, Next Steps) with concise bullets inside.",
  ],
  narrative: [
    "Tell a story or analogy that guides the reader through the situation.",
    "Use descriptive language that paints a mental image of the scenario.",
  ],
};

export type PreferenceScores = {
  verbosity?: Array<{ label: ResponseVerbosity; score: number }>;
  tone?: Array<{ label: ResponseTone; score: number }>;
  format?: Array<{ label: ResponseFormat; score: number }>;
};

type PreferenceCentroids = {
  verbosity: Map<ResponseVerbosity, Float32Array>;
  tone: Map<ResponseTone, Float32Array>;
  format: Map<ResponseFormat, Float32Array>;
};

let centroidPromise: Promise<PreferenceCentroids> | null = null;

function normalizeVector(vector: number[]): Float32Array {
  let magnitude = 0;
  for (const value of vector) {
    magnitude += value * value;
  }
  magnitude = Math.sqrt(magnitude) || 1;
  return Float32Array.from(vector.map((value) => value / magnitude));
}

function averageVectors(vectors: number[][]): Float32Array | null {
  if (!vectors.length) {
    return null;
  }
  const length = vectors[0]?.length ?? 0;
  if (length === 0) {
    return null;
  }
  const acc = new Array<number>(length).fill(0);
  for (const vector of vectors) {
    if (!vector) continue;
    for (let i = 0; i < length; i += 1) {
      acc[i] += vector[i] ?? 0;
    }
  }
  return normalizeVector(acc.map((value) => value / vectors.length));
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i]! * b[i]!;
  }
  return dot;
}

async function getPreferenceCentroids(): Promise<PreferenceCentroids> {
  if (!centroidPromise) {
    centroidPromise = (async () => {
      const centroidMap: PreferenceCentroids = {
        verbosity: new Map(),
        tone: new Map(),
        format: new Map(),
      };

      const prototypeTexts = [
        ...Object.values(VERBOSITY_PROTOTYPES).flat(),
        ...Object.values(TONE_PROTOTYPES).flat(),
        ...Object.values(FORMAT_PROTOTYPES).flat(),
      ];

      const embeddings = await embedMany(prototypeTexts);
      let cursor = 0;

      const attach = <T extends string>(
        entries: Record<T, string[]>,
        target: Map<T, Float32Array>
      ) => {
        for (const [label, samples] of Object.entries(entries) as [
          T,
          string[],
        ][]) {
          const vectors = samples
            .map(() => embeddings[cursor++]!)
            .filter(Boolean);
          const centroid = averageVectors(vectors);
          if (centroid) {
            target.set(label, centroid);
          }
        }
      };

      attach(VERBOSITY_PROTOTYPES, centroidMap.verbosity);
      attach(TONE_PROTOTYPES, centroidMap.tone);
      attach(FORMAT_PROTOTYPES, centroidMap.format);

      return centroidMap;
    })().catch((error) => {
      centroidPromise = null;
      throw error;
    });
  }

  return centroidPromise;
}

async function embedSamples(samples: string[]): Promise<Float32Array | null> {
  const sanitized = samples
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .slice(-SAMPLE_LIMIT);

  if (!sanitized.length) {
    return null;
  }

  try {
    const embeddings = await embedMany(sanitized);
    return averageVectors(embeddings);
  } catch (error) {
    logger.warn("preference_semantic_embed_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function rankScores<T extends string>(
  vector: Float32Array,
  centroids: Map<T, Float32Array>
): Array<{ label: T; score: number }> {
  return Array.from(centroids.entries())
    .map(([label, centroid]) => ({
      label,
      score: cosine(vector, centroid),
    }))
    .sort((a, b) => b.score - a.score);
}

export async function inferResponsePreferencesSemantic(
  samples: string[]
): Promise<PreferenceScores> {
  const embedding = await embedSamples(samples);
  if (!embedding) {
    return {};
  }

  let centroids: PreferenceCentroids;
  try {
    centroids = await getPreferenceCentroids();
  } catch (error) {
    logger.warn("preference_semantic_centroid_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }

  return {
    verbosity: rankScores(embedding, centroids.verbosity),
    tone: rankScores(embedding, centroids.tone),
    format: rankScores(embedding, centroids.format),
  };
}

export async function detectToneSemantic(
  text: string
): Promise<ResponseTone | null> {
  const scores = await inferResponsePreferencesSemantic([text]);
  const top = scores.tone?.[0];
  if (!top) {
    return null;
  }
  if (top.score < 0.2) {
    return null;
  }
  return top.label;
}

export async function buildPreferenceEmbedding(
  samples: string[]
): Promise<Float32Array | null> {
  return embedSamples(samples);
}

export async function computePreferenceScores(
  embedding: Float32Array
): Promise<PreferenceScores> {
  const centroids = await getPreferenceCentroids();
  return {
    verbosity: rankScores(embedding, centroids.verbosity),
    tone: rankScores(embedding, centroids.tone),
    format: rankScores(embedding, centroids.format),
  };
}
