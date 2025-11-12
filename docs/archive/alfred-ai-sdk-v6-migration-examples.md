# AI SDK v6 Migration Examples

## Example 1: Embeddings Migration

### Before (packages/rag/src/doc.ts)

```typescript
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
```

### After (AI SDK v6)

```typescript
import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const EMBEDDING_MODEL = "text-embedding-3-small";

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("rag_missing_openai_key");
  }

  const { embedding } = await embed({
    model: openai.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  });

  return embedding;
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("rag_missing_openai_key");
  }

  const { embeddings } = await embedMany({
    model: openai.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  });

  return embeddings;
}
```

### Updated ingest() function

```typescript
export async function ingest(source: string, content: string): Promise<string> {
  if (!content || content.trim().length === 0) {
    throw new Error("rag_empty_content");
  }

  const document = await ragRepo.createDocument(source, `Doc @ ${new Date().toISOString()}`);
  const pieces = await chunk(content);

  if (pieces.length === 0) {
    return document.id;
  }

  // Use embedMany for batch optimization
  const { embeddings } = await embedMany(pieces);

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
```

---

## Example 2: Reranking Migration

### Before (packages/rag/src/rerank.ts)

```typescript
export async function rerank({
  query,
  documents,
  topN = 10,
  model = "rerank-english-v3.0",
}: RerankOptions): Promise<RerankResult[]> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    return documents.slice(0, topN).map((doc, index) => ({
      id: doc.id,
      text: doc.text,
      score: 1.0 - index * 0.01,
      index,
    }));
  }

  const baseUrl = process.env.COHERE_BASE_URL ?? "https://api.cohere.ai";
  const response = await fetch(`${baseUrl}/v1/rerank`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      query,
      documents: documents.map(doc => doc.text),
      top_n: topN,
      return_documents: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`cohere_rerank_failed:${response.status}`);
  }

  const body = (await response.json()) as {
    results?: Array<{ index: number; relevance_score: number }>;
    error?: { message?: string };
  };

  if (body.error) {
    throw new Error(`cohere_rerank_error:${body.error.message ?? "unknown"}`);
  }

  const results = body.results ?? [];
  return results.map(result => {
    const doc = documents[result.index];
    if (!doc) {
      throw new Error(`cohere_rerank_invalid_index:${result.index}`);
    }
    return {
      id: doc.id,
      text: doc.text,
      score: result.relevance_score,
      index: result.index,
    };
  });
}
```

### After (AI SDK v6)

```typescript
import { rerank } from "ai";
import { cohere } from "@ai-sdk/cohere";

export type RerankOptions = {
  query: string;
  documents: Array<{ id: string; text: string }>;
  topN?: number;
  model?: "rerank-v3.5" | "rerank-english-v3.0" | "rerank-multilingual-v3.0";
};

export type RerankResult = {
  id: string;
  text: string;
  score: number;
  index: number;
};

export async function rerank({
  query,
  documents,
  topN = 10,
  model = "rerank-v3.5",
}: RerankOptions): Promise<RerankResult[]> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    // Fallback: return original order if Cohere not configured
    return documents.slice(0, topN).map((doc, index) => ({
      id: doc.id,
      text: doc.text,
      score: 1.0 - index * 0.01,
      index,
    }));
  }

  try {
    const { ranking } = await rerank({
      model: cohere.reranking(model),
      documents: documents.map(doc => doc.text),
      query,
      topN,
      maxRetries: 2, // AI SDK handles retries automatically
    });

    return ranking.map((item) => {
      const doc = documents[item.originalIndex];
      if (!doc) {
        throw new Error(`rerank_invalid_index:${item.originalIndex}`);
      }
      return {
        id: doc.id,
        text: item.document,
        score: item.score,
        index: item.originalIndex,
      };
    });
  } catch (error) {
    // Fallback on error
    console.error("Reranking failed:", error);
    return documents.slice(0, topN).map((doc, index) => ({
      id: doc.id,
      text: doc.text,
      score: 1.0 - index * 0.01,
      index,
    }));
  }
}
```

---

## Example 3: TanStack Start Server Function

### Before (HTTP Handler)

```typescript
// apps/web/src/routes/api/ai/$.ts
export const Route = createFileRoute("/api/ai/$")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { messages }: { messages: UIMessage[] } = await request.json();
          const result = streamText({
            model: google("gemini-2.5-flash"),
            messages: convertToModelMessages(messages),
          });
          return result.toUIMessageStreamResponse();
        } catch (error) {
          console.error("AI API error:", error);
          return new Response(
            JSON.stringify({ error: "Failed to process AI request" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});
```

### After (Server Function with Type Safety)

```typescript
// apps/web/src/routes/api/ai/$.ts
import { createFileRoute } from "@tanstack/react-router";
import { google } from "@ai-sdk/google";
import { streamText, type UIMessage, convertToCoreMessages } from "ai";
import { z } from "zod";

const aiRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })),
});

export const Route = createFileRoute("/api/ai/$")({
  // Server function for type-safe server/client boundary
  action: async ({ request }) => {
    try {
      const body = await request.json();
      const { messages } = aiRequestSchema.parse(body);
      
      const result = streamText({
        model: google("gemini-2.5-flash"),
        messages: convertToCoreMessages(messages as UIMessage[]),
      });
      
      return result.toUIMessageStreamResponse();
    } catch (error) {
      console.error("AI API error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to process AI request" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
  
  // Keep HTTP handler for backward compatibility if needed
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Delegate to action
        return Route.options.action({ request } as any);
      },
    },
  },
});
```

---

## Example 4: Hybrid Search with Reranking

### Integration in packages/db/src/repo/rag.ts

```typescript
import { rerank } from "@alfred/rag/rerank";

export async function searchChunksHybrid({
  embedding,
  query,
  limit = 10,
  threshold = 0.7,
  documentId,
  denseWeight = 0.7,
  sparseWeight = 0.3,
  efSearch = 40,
  useReranking = false, // New option
}: HybridSearchOptions & { useReranking?: boolean }): Promise<ChunkSearchResult[]> {
  // ... existing hybrid search logic ...
  
  const results = await hybridQuery.execute();
  const initialResults = results.rows as Array<ChunkSearchResult>;
  
  // Apply reranking if enabled
  if (useReranking && initialResults.length > 0) {
    const reranked = await rerank({
      query,
      documents: initialResults.map((r, idx) => ({
        id: r.id,
        text: r.content,
      })),
      topN: limit,
    });
    
    // Merge rerank scores with hybrid scores
    return reranked.map((item) => {
      const original = initialResults[item.index];
      return {
        ...original,
        score: original.score * 0.7 + item.score * 0.3, // Weighted fusion
      };
    });
  }
  
  return initialResults.slice(0, limit);
}
```

---

## Example 5: Batch Embeddings in Ingest

### Optimized ingest() with embedMany()

```typescript
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

export async function ingest(source: string, content: string): Promise<string> {
  if (!content || content.trim().length === 0) {
    throw new Error("rag_empty_content");
  }

  const document = await ragRepo.createDocument(source, `Doc @ ${new Date().toISOString()}`);
  const pieces = await chunk(content);

  if (pieces.length === 0) {
    return document.id;
  }

  // Batch embedding with AI SDK v6
  // embedMany() optimizes batch requests internally
  const { embeddings } = await embedMany({
    model: openai.textEmbeddingModel("text-embedding-3-small"),
    values: pieces,
  });

  // Validate embeddings match chunks
  if (embeddings.length !== pieces.length) {
    throw new Error("rag_embed_mismatch");
  }

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
```

---

## Migration Checklist

### Phase 1: Dependencies
- [ ] Update `package.json` catalog: `"ai": "^6.0.0-beta.x"`
- [ ] Add `@ai-sdk/cohere`: `"@ai-sdk/cohere": "^2.0.0"`
- [ ] Run `bun install`
- [ ] Verify no breaking changes in existing code

### Phase 2: Embeddings
- [ ] Update `packages/rag/src/doc.ts` `embed()` function
- [ ] Add `embedMany()` function
- [ ] Update `ingest()` to use `embedMany()`
- [ ] Update tests
- [ ] Remove manual OpenAI API code

### Phase 3: Reranking
- [ ] Update `packages/rag/src/rerank.ts` to use AI SDK v6
- [ ] Update `packages/rag/package.json` to include `@ai-sdk/cohere`
- [ ] Update tests
- [ ] Remove manual Cohere API code

### Phase 4: Integration
- [ ] Integrate reranking into hybrid search
- [ ] Update RAG documentation
- [ ] Test end-to-end RAG pipeline

### Phase 5: TanStack Start (Optional)
- [ ] Convert API routes to server functions
- [ ] Add type-safe schemas
- [ ] Test SSR/hydration

