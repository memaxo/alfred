---
title: Chunking and Embedding Documents | RAG | Mastra Docs
url: 
description: Guide on chunking and embedding documents in Mastra for efficient processing and retrieval.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/rag/chunking-and-embedding#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [RAG](https://mastra.ai/en/docs/rag/overview "RAG") Chunking and Embedding

Copy page

## Chunking and Embedding Documents [Permalink for this section](https://mastra.ai/en/docs/rag/chunking-and-embedding\#chunking-and-embedding-documents)

Before processing, create a MDocument instance from your content. You can initialize it from various formats:

```nextra-code [counter-reset:line]

const docFromText = MDocument.fromText("Your plain text content...");
const docFromHTML = MDocument.fromHTML("<html>Your HTML content...</html>");
const docFromMarkdown = MDocument.fromMarkdown("# Your Markdown content...");
const docFromJSON = MDocument.fromJSON(`{ "key": "value" }`);
```

## Step 1: Document Processing [Permalink for this section](https://mastra.ai/en/docs/rag/chunking-and-embedding\#step-1-document-processing)

Use `chunk` to split documents into manageable pieces. Mastra supports multiple chunking strategies optimized for different document types:

- `recursive`: Smart splitting based on content structure
- `character`: Simple character-based splits
- `token`: Token-aware splitting
- `markdown`: Markdown-aware splitting
- `semantic-markdown`: Markdown splitting based on related header families
- `html`: HTML structure-aware splitting
- `json`: JSON structure-aware splitting
- `latex`: LaTeX structure-aware splitting
- `sentence`: Sentence-aware splitting

**Note:** Each strategy accepts different parameters optimized for its chunking approach.

Here’s an example of how to use the `recursive` strategy:

```nextra-code [counter-reset:line]

const chunks = await doc.chunk({
  strategy: "recursive",
  maxSize: 512,
  overlap: 50,
  separators: ["\n"],
  extract: {
    metadata: true, // Optionally extract metadata
  },
});
```

For text where preserving sentence structure is important, here’s an example of how to use the `sentence` strategy:

```nextra-code [counter-reset:line]

const chunks = await doc.chunk({
  strategy: "sentence",
  maxSize: 450,
  minSize: 50,
  overlap: 0,
  sentenceEnders: ["."],
  keepSeparator: true,
});
```

For markdown documents where preserving the semantic relationships between sections is important, here’s an example of how to use the `semantic-markdown` strategy:

```nextra-code [counter-reset:line]

const chunks = await doc.chunk({
  strategy: "semantic-markdown",
  joinThreshold: 500,
  modelName: "gpt-3.5-turbo",
});
```

**Note:** Metadata extraction may use LLM calls, so ensure your API key is set.

We go deeper into chunking strategies in our [chunk documentation](https://mastra.ai/reference/rag/chunk).

## Step 2: Embedding Generation [Permalink for this section](https://mastra.ai/en/docs/rag/chunking-and-embedding\#step-2-embedding-generation)

Transform chunks into embeddings using your preferred provider. Mastra supports many embedding providers, including OpenAI and Cohere:

### Using OpenAI [Permalink for this section](https://mastra.ai/en/docs/rag/chunking-and-embedding\#using-openai)

```nextra-code [counter-reset:line]

import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

const { embeddings } = await embedMany({
  model: openai.embedding("text-embedding-3-small"),
  values: chunks.map((chunk) => chunk.text),
});
```

### Using Cohere [Permalink for this section](https://mastra.ai/en/docs/rag/chunking-and-embedding\#using-cohere)

```nextra-code [counter-reset:line]

import { cohere } from "@ai-sdk/cohere";
import { embedMany } from "ai";

const { embeddings } = await embedMany({
  model: cohere.embedding("embed-english-v3.0"),
  values: chunks.map((chunk) => chunk.text),
});
```

The embedding functions return vectors, arrays of numbers representing the semantic meaning of your text, ready for similarity searches in your vector database.

### Configuring Embedding Dimensions [Permalink for this section](https://mastra.ai/en/docs/rag/chunking-and-embedding\#configuring-embedding-dimensions)

Embedding models typically output vectors with a fixed number of dimensions (e.g., 1536 for OpenAI’s `text-embedding-3-small`).
Some models support reducing this dimensionality, which can help:

- Decrease storage requirements in vector databases
- Reduce computational costs for similarity searches

Here are some supported models:

OpenAI (text-embedding-3 models):

```nextra-code

const { embeddings } = await embedMany({
  model: openai.embedding("text-embedding-3-small", {
    dimensions: 256, // Only supported in text-embedding-3 and later
  }),
  values: chunks.map((chunk) => chunk.text),
});
```

Google (text-embedding-004):

```nextra-code

const { embeddings } = await embedMany({
  model: google.textEmbeddingModel("text-embedding-004", {
    outputDimensionality: 256, // Truncates excessive values from the end
  }),
  values: chunks.map((chunk) => chunk.text),
});
```

### Vector Database Compatibility [Permalink for this section](https://mastra.ai/en/docs/rag/chunking-and-embedding\#vector-database-compatibility)

When storing embeddings, the vector database index must be configured to match the output size of your embedding model. If the dimensions do not match, you may get errors or data corruption.

## Example: Complete Pipeline [Permalink for this section](https://mastra.ai/en/docs/rag/chunking-and-embedding\#example-complete-pipeline)

Here’s an example showing document processing and embedding generation with both providers:

```nextra-code [counter-reset:line]

import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { cohere } from "@ai-sdk/cohere";

import { MDocument } from "@mastra/rag";

// Initialize document
const doc = MDocument.fromText(`
  Climate change poses significant challenges to global agriculture.
  Rising temperatures and changing precipitation patterns affect crop yields.
`);

// Create chunks
const chunks = await doc.chunk({
  strategy: "recursive",
  maxSize: 256,
  overlap: 50,
});

// Generate embeddings with OpenAI
const { embeddings: openAIEmbeddings } = await embedMany({
  model: openai.embedding("text-embedding-3-small"),
  values: chunks.map((chunk) => chunk.text),
});

// OR

// Generate embeddings with Cohere
const { embeddings: cohereEmbeddings } = await embedMany({
  model: cohere.embedding("embed-english-v3.0"),
  values: chunks.map((chunk) => chunk.text),
});

// Store embeddings in your vector database
await vectorStore.upsert({
  indexName: "embeddings",
  vectors: embeddings,
});
```

For more examples of different chunking strategies and embedding configurations, see:

- [Adjust Chunk Size](https://mastra.ai/reference/rag/chunk#adjust-chunk-size)
- [Adjust Chunk Delimiters](https://mastra.ai/reference/rag/chunk#adjust-chunk-delimiters)
- [Embed Text with Cohere](https://mastra.ai/reference/rag/embeddings#using-cohere)

For more details on vector databases and embeddings, see:

- [Vector Databases](https://mastra.ai/en/docs/rag/vector-databases)
- [Embedding API Reference](https://mastra.ai/reference/rag/embeddings)

[Overview](https://mastra.ai/en/docs/rag/overview "Overview") [Vector Databases](https://mastra.ai/en/docs/rag/vector-databases "Vector Databases")