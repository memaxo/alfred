---
title: RAG (Retrieval-Augmented Generation) in Mastra | Mastra Docs
url: 
description: Overview of Retrieval-Augmented Generation (RAG) in Mastra, detailing its capabilities for enhancing LLM outputs with relevant context.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/rag/overview#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") RAGOverview

Copy page

# RAG (Retrieval-Augmented Generation) in Mastra

RAG in Mastra helps you enhance LLM outputs by incorporating relevant context from your own data sources, improving accuracy and grounding responses in real information.

Mastra’s RAG system provides:

- Standardized APIs to process and embed documents
- Support for multiple vector stores
- Chunking and embedding strategies for optimal retrieval
- Observability for tracking embedding and retrieval performance

## Example [Permalink for this section](https://mastra.ai/en/docs/rag/overview\#example)

To implement RAG, you process your documents into chunks, create embeddings, store them in a vector database, and then retrieve relevant context at query time.

```nextra-code [counter-reset:line]

import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { PgVector } from "@mastra/pg";
import { MDocument } from "@mastra/rag";
import { z } from "zod";

// 1. Initialize document
const doc = MDocument.fromText(`Your document text here...`);

// 2. Create chunks
const chunks = await doc.chunk({
  strategy: "recursive",
  size: 512,
  overlap: 50,
});

// 3. Generate embeddings; we need to pass the text of each chunk
const { embeddings } = await embedMany({
  values: chunks.map((chunk) => chunk.text),
  model: openai.embedding("text-embedding-3-small"),
});

// 4. Store in vector database
const pgVector = new PgVector({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
});
await pgVector.upsert({
  indexName: "embeddings",
  vectors: embeddings,
}); // using an index name of 'embeddings'

// 5. Query similar chunks
const results = await pgVector.query({
  indexName: "embeddings",
  queryVector: queryVector,
  topK: 3,
}); // queryVector is the embedding of the query

console.log("Similar chunks:", results);
```

This example shows the essentials: initialize a document, create chunks, generate embeddings, store them, and query for similar content.

## Document Processing [Permalink for this section](https://mastra.ai/en/docs/rag/overview\#document-processing)

The basic building block of RAG is document processing. Documents can be chunked using various strategies (recursive, sliding window, etc.) and enriched with metadata. See the [chunking and embedding doc](https://mastra.ai/en/docs/rag/chunking-and-embedding).

## Vector Storage [Permalink for this section](https://mastra.ai/en/docs/rag/overview\#vector-storage)

Mastra supports multiple vector stores for embedding persistence and similarity search, including pgvector, Pinecone, Qdrant, and MongoDB. See the [vector database doc](https://mastra.ai/en/docs/rag/vector-databases).

## Observability and Debugging [Permalink for this section](https://mastra.ai/en/docs/rag/overview\#observability-and-debugging)

Mastra’s RAG system includes observability features to help you optimize your retrieval pipeline:

- Track embedding generation performance and costs
- Monitor chunk quality and retrieval relevance
- Analyze query patterns and cache hit rates
- Export metrics to your observability platform

See the [OTel Configuration](https://mastra.ai/en/reference/observability/otel-config) page for more details.

## More resources [Permalink for this section](https://mastra.ai/en/docs/rag/overview\#more-resources)

- [Chain of Thought RAG Example](https://mastra.ai/en/examples/rag/usage/cot-rag)
- [All RAG Examples](https://mastra.ai/en/examples/) (including different chunking strategies, embedding models, and vector stores)

[Memory Processors](https://mastra.ai/en/docs/memory/memory-processors "Memory Processors") [Chunking and Embedding](https://mastra.ai/en/docs/rag/chunking-and-embedding "Chunking and Embedding")