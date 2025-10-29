import { ragRepo } from "@alfred/db";

/**
 * ALFRED RAG Document Processing
 */

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

export interface Chunk {
  content: string;
  embedding?: number[];
  order: number;
  metadata?: Record<string, unknown>;
}

function normalizeBaseUrl(raw?: string | null) {
  const base = raw?.trim();
  if (!base) {
    return "https://api.openai.com";
  }
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function splitSentences(paragraph: string) {
  const sentences = paragraph
    .split(/(?<=[.!?])\s+/u)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0);
  if (sentences.length === 0) {
    return [paragraph];
  }
  return sentences;
}

function pushBuffer(buffers: string[], buffer: string) {
  const trimmed = buffer.trim();
  if (trimmed.length > 0) {
    buffers.push(trimmed);
  }
}

export async function ingest(source: string, content: string): Promise<string> {
  if (!content || content.trim().length === 0) {
    throw new Error("rag_empty_content");
  }

  const document = await ragRepo.createDocument(source, `Doc @ ${new Date().toISOString()}`);
  const pieces = await chunk(content);

  if (pieces.length === 0) {
    return document.id;
  }

  const embeddings = await Promise.all(pieces.map(piece => embed(piece)));
  await ragRepo.addChunks(
    document.id,
    pieces.map((piece, index) => ({
      content: piece,
      order: index,
      embedding: embeddings[index],
      metadata: {
        source,
      },
    })),
  );

  return document.id;
}

export async function retrieve(query: string, k = 10, threshold = 0.7): Promise<Chunk[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const vector = await embed(query);
  const fetchLimit = Math.max(k, Math.min(k * 3, 60));
  const rows = await ragRepo.searchChunks(vector, fetchLimit, threshold);

  return rows.slice(0, k).map(row => {
    const rawMetadata = row.metadata;
    const metadata =
      rawMetadata && typeof rawMetadata === "object"
        ? (rawMetadata as Record<string, unknown>)
        : rawMetadata !== undefined
          ? { value: rawMetadata }
          : undefined;

    return {
      content: row.content,
      order: row.order ?? 0,
      metadata: {
        ...(metadata ?? {}),
        score: row.score,
        documentId: row.documentId,
      },
    };
  });
}

export async function chunk(content: string, maxChunkSize = 512): Promise<string[]> {
  const limit = Number.isFinite(maxChunkSize) && maxChunkSize > 0 ? Math.floor(maxChunkSize) : 512;
  const paragraphs = content
    .split(/\n{2,}/u)
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);

  if (paragraphs.length === 0) {
    const condensed = content.trim();
    return condensed.length === 0 ? [] : [condensed.slice(0, limit)];
  }

  const chunks: string[] = [];
  let buffer = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length <= limit) {
      const candidate = buffer.length > 0 ? `${buffer}\n\n${paragraph}` : paragraph;
      if (candidate.length <= limit) {
        buffer = candidate;
        continue;
      }
      pushBuffer(chunks, buffer);
      buffer = paragraph;
      continue;
    }

    // Paragraph is too large; flush existing buffer and split paragraph by sentences.
    pushBuffer(chunks, buffer);
    buffer = "";
    const sentences = splitSentences(paragraph);
    let sentenceBuffer = "";
    for (const sentence of sentences) {
      if (sentence.length > limit) {
        // Sentence still too large, fallback to hard split.
        const parts = sentence.match(new RegExp(`.{1,${limit}}`, "gu")) ?? [sentence];
        for (const part of parts) {
          pushBuffer(chunks, part);
        }
        sentenceBuffer = "";
        continue;
      }
      const candidate = sentenceBuffer.length > 0 ? `${sentenceBuffer} ${sentence}` : sentence;
      if (candidate.length <= limit) {
        sentenceBuffer = candidate;
        continue;
      }
      pushBuffer(chunks, sentenceBuffer);
      sentenceBuffer = sentence;
    }
    pushBuffer(chunks, sentenceBuffer);
  }

  pushBuffer(chunks, buffer);
  return chunks;
}

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("rag_missing_openai_key");
  }
  const baseUrl = normalizeBaseUrl(process.env.OPENAI_BASE_URL);
  const payload = {
    model: EMBEDDING_MODEL,
    input: text,
  };

  const response = await fetch(`${baseUrl}/v1/embeddings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`rag_embed_failed:${response.status}`);
  }

  const body = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
    error?: { message?: string };
  };

  const vector = body?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIM) {
    throw new Error("rag_embed_invalid_vector");
  }

  return vector.map(value => {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : 0;
  });
}
