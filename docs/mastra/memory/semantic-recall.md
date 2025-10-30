---
title: Semantic Recall | Memory | Mastra Docs
url: 
description: Learn how to use semantic recall in Mastra to retrieve relevant messages from past conversations using vector search and embeddings.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/memory/semantic-recall#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Memory](https://mastra.ai/en/docs/memory/overview "Memory") Semantic Recall

Copy page

# Semantic Recall

If you ask your friend what they did last weekend, they will search in their memory for events associated with “last weekend” and then tell you what they did. That’s sort of like how semantic recall works in Mastra.

> **📹 Watch**: What semantic recall is, how it works, and how to configure it in Mastra → [YouTube (5 minutes)](https://youtu.be/UVZtK8cK8xQ)

## How Semantic Recall Works [Permalink for this section](https://mastra.ai/en/docs/memory/semantic-recall\#how-semantic-recall-works)

Semantic recall is RAG-based search that helps agents maintain context across longer interactions when messages are no longer within [recent conversation history](https://mastra.ai/en/docs/memory/overview#conversation-history).

It uses vector embeddings of messages for similarity search, integrates with various vector stores, and has configurable context windows around retrieved messages.

![Diagram showing Mastra Memory semantic recall](https://mastra.ai/image/semantic-recall.png)

When it’s enabled, new messages are used to query a vector DB for semantically similar messages.

After getting a response from the LLM, all new messages (user, assistant, and tool calls/results) are inserted into the vector DB to be recalled in later interactions.

## Quick Start [Permalink for this section](https://mastra.ai/en/docs/memory/semantic-recall\#quick-start)

Semantic recall is enabled by default, so if you give your agent memory it will be included:

```nextra-code

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "SupportAgent",
  instructions: "You are a helpful support agent.",
  model: openai("gpt-4o"),
  memory: new Memory(),
});
```

## Recall configuration [Permalink for this section](https://mastra.ai/en/docs/memory/semantic-recall\#recall-configuration)

The three main parameters that control semantic recall behavior are:

1. **topK**: How many semantically similar messages to retrieve
2. **messageRange**: How much surrounding context to include with each match
3. **scope**: Whether to search within the current thread or across all threads owned by a resource. Using `scope: 'resource'` allows the agent to recall information from any of the user’s past conversations.

```nextra-code

const agent = new Agent({
  memory: new Memory({
    options: {
      semanticRecall: {
        topK: 3, // Retrieve 3 most similar messages
        messageRange: 2, // Include 2 messages before and after each match
        scope: 'resource', // Search across all threads for this user
      },
    },
  }),
});
```

Note: currently, `scope: 'resource'` for semantic recall is supported by the following storage adapters: LibSQL, Postgres, and Upstash.

### Storage configuration [Permalink for this section](https://mastra.ai/en/docs/memory/semantic-recall\#storage-configuration)

Semantic recall relies on a [storage and vector db](https://mastra.ai/reference/memory/Memory#parameters) to store messages and their embeddings.

```nextra-code

import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";

const agent = new Agent({
  memory: new Memory({
    // this is the default storage db if omitted
    storage: new LibSQLStore({
      url: "file:./local.db",
    }),
    // this is the default vector db if omitted
    vector: new LibSQLVector({
      connectionUrl: "file:./local.db",
    }),
  }),
});
```

**Storage/vector code Examples**:

- [LibSQL](https://mastra.ai/examples/memory/memory-with-libsql)
- [Postgres](https://mastra.ai/examples/memory/memory-with-pg)
- [Upstash](https://mastra.ai/examples/memory/memory-with-upstash)

### Embedder configuration [Permalink for this section](https://mastra.ai/en/docs/memory/semantic-recall\#embedder-configuration)

Semantic recall relies on an [embedding model](https://mastra.ai/reference/memory/Memory#embedder) to convert messages into embeddings. You can specify any [embedding model](https://sdk.vercel.ai/docs/ai-sdk-core/embeddings) compatible with the AI SDK.

To use FastEmbed (a local embedding model), install `@mastra/fastembed`:

npmpnpmyarnbun

```nextra-code

npm install @mastra/fastembed
```

```nextra-code

pnpm add @mastra/fastembed
```

```nextra-code

yarn add @mastra/fastembed
```

```nextra-code

bun add @mastra/fastembed
```

Then configure it in your memory:

```nextra-code

import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";
import { fastembed } from "@mastra/fastembed";

const agent = new Agent({
  memory: new Memory({
    // ... other memory options
    embedder: fastembed,
  }),
});
```

Alternatively, use a different provider like OpenAI:

```nextra-code

import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  memory: new Memory({
    // ... other memory options
    embedder: openai.embedding("text-embedding-3-small"),
  }),
});
```

### PostgreSQL Index Optimization [Permalink for this section](https://mastra.ai/en/docs/memory/semantic-recall\#postgresql-index-optimization)

When using PostgreSQL as your vector store, you can optimize semantic recall performance by configuring the vector index. This is particularly important for large-scale deployments with thousands of messages.

PostgreSQL supports both IVFFlat and HNSW indexes. By default, Mastra creates an IVFFlat index, but HNSW indexes typically provide better performance, especially with OpenAI embeddings which use inner product distance.

```nextra-code

import { Memory } from "@mastra/memory";
import { PgStore, PgVector } from "@mastra/pg";

const agent = new Agent({
  memory: new Memory({
    storage: new PgStore({
      connectionString: process.env.DATABASE_URL,
    }),
    vector: new PgVector({
      connectionString: process.env.DATABASE_URL,
    }),
    options: {
      semanticRecall: {
        topK: 5,
        messageRange: 2,
        indexConfig: {
          type: 'hnsw',           // Use HNSW for better performance
          metric: 'dotproduct',   // Best for OpenAI embeddings
          m: 16,                  // Number of bi-directional links (default: 16)
          efConstruction: 64,    // Size of candidate list during construction (default: 64)
        },
      },
    },
  }),
});
```

For detailed information about index configuration options and performance tuning, see the [PgVector configuration guide](https://mastra.ai/reference/vectors/pg#index-configuration-guide).

### Disabling [Permalink for this section](https://mastra.ai/en/docs/memory/semantic-recall\#disabling)

There is a performance impact to using semantic recall. New messages are converted into embeddings and used to query a vector database before new messages are sent to the LLM.

Semantic recall is enabled by default but can be disabled when not needed:

```nextra-code

const agent = new Agent({
  memory: new Memory({
    options: {
      semanticRecall: false,
    },
  }),
});
```

You might want to disable semantic recall in scenarios like:

- When conversation history provide sufficient context for the current conversation.
- In performance-sensitive applications, like realtime two-way audio, where the added latency of creating embeddings and running vector queries is noticeable.

## Viewing Recalled Messages [Permalink for this section](https://mastra.ai/en/docs/memory/semantic-recall\#viewing-recalled-messages)

When tracing is enabled, any messages retrieved via semantic recall will appear in the agent’s trace output, alongside recent conversation history (if configured).

For more info on viewing message traces, see [Viewing Retrieved Messages](https://mastra.ai/en/docs/memory/overview#viewing-retrieved-messages).

[Conversation History](https://mastra.ai/en/docs/memory/conversation-history "Conversation History") [Memory Processors](https://mastra.ai/en/docs/memory/memory-processors "Memory Processors")