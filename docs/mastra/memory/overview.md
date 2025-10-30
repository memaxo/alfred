---
title: Memory Overview | Memory | Mastra Docs
url: 
description: Learn how Mastra's memory system works with working memory, conversation history, and semantic recall.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/memory/overview#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") MemoryOverview

Copy page

# Memory overview

Memory in Mastra helps agents manage context across conversations by condensing relevant information into the language model’s context window.

Mastra supports three types of memory: working memory, conversation history, and semantic recall. It uses a two-tier scoping system where memory can be isolated per conversation thread (thread-scoped) or shared across all conversations for the same user (resource-scoped).

Mastra’s memory system uses [storage providers](https://mastra.ai/en/docs/memory/overview#memory-storage-adapters) to persist conversation threads, messages, and working memory across application restarts.

## Getting started [Permalink for this section](https://mastra.ai/en/docs/memory/overview\#getting-started)

First install the required dependencies:

```nextra-code

npm install @mastra/core @mastra/memory @mastra/libsql
```

Then add a storage adapter to the main Mastra instance. Any agent with memory enabled will use this shared storage to store and recall interactions.

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";

export const mastra = new Mastra({
  // ...
  storage: new LibSQLStore({
    url: ":memory:"
  })
});
```

Now, enable memory by passing a `Memory` instance to the agent’s `memory` parameter:

src/mastra/agents/test-agent.ts

```nextra-code [counter-reset:line]

import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";

export const testAgent = new Agent({
  // ...
  memory: new Memory()
});
```

That memory instance has options you can configure for working memory, conversation history, and semantic recall.

## Different types of memory [Permalink for this section](https://mastra.ai/en/docs/memory/overview\#different-types-of-memory)

Mastra supports three types of memory: working memory, conversation history, and semantic recall.

[**Working memory**](https://mastra.ai/en/docs/memory/working-memory) stores persistent user-specific details such as names, preferences, goals, and other structured data. (Compare this to ChatGPT where you can ask it to tell you about yourself). This is implemented as a block of Markdown text that the agent is able to update over time (or alternately, as a Zod schema)

[**Conversation history**](https://mastra.ai/en/docs/memory/conversation-history) captures recent messages from the current conversation, providing short-term continuity and maintaining dialogue flow.

[**Semantic recall**](https://mastra.ai/en/docs/memory/semantic-recall) retrieves older messages from past conversations based on semantic relevance. Matches are retrieved using vector search and can include surrounding context for better comprehension.

Mastra combines all memory types into a single context window. If the total exceeds the model’s token limit, use [memory processors](https://mastra.ai/en/docs/memory/memory-processors) to trim or filter messages before sending them to the model.

## Scoping memory with threads and resources [Permalink for this section](https://mastra.ai/en/docs/memory/overview\#scoping-memory-with-threads-and-resources)

All memory types are [thread-scoped](https://mastra.ai/en/docs/memory/working-memory#thread-scoped-memory-default) by default, meaning they apply only to a single conversation. [Resource-scoped](https://mastra.ai/en/docs/memory/working-memory#resource-scoped-memory) configuration allows working memory and semantic recall to persist across all threads that use the same user or entity.

## Memory Storage Adapters [Permalink for this section](https://mastra.ai/en/docs/memory/overview\#memory-storage-adapters)

To persist and recall information between conversations, memory requires a storage adapter.

Supported options include [LibSQL](https://mastra.ai/examples/memory/memory-with-libsql), [Postgres](https://mastra.ai/examples/memory/memory-with-pg), and [Upstash](https://mastra.ai/examples/memory/memory-with-upstash)

We use LibSQL out of the box because it is file-based or in-memory, so it is easy to install and works well with the playground.

## Dedicated storage [Permalink for this section](https://mastra.ai/en/docs/memory/overview\#dedicated-storage)

Agents can be configured with their own dedicated storage, keeping tasks, conversations, and recalled information separate across agents.

### Adding storage to agents [Permalink for this section](https://mastra.ai/en/docs/memory/overview\#adding-storage-to-agents)

To assign dedicated storage to an agent, install and import the required dependency and pass a `storage` instance to the `Memory` constructor:

src/mastra/agents/test-agent.ts

```nextra-code [counter-reset:line]

import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";
import { LibSQLStore } from "@mastra/libsql";

export const testAgent = new Agent({
  // ...
  memory: new Memory({
    // ...
    storage: new LibSQLStore({
      url: "file:agent-memory.db"
    })
  // ...
  })
});
```

## Viewing retrieved messages [Permalink for this section](https://mastra.ai/en/docs/memory/overview\#viewing-retrieved-messages)

If tracing is enabled in your Mastra deployment and memory is configured either with `lastMessages` and/or `semanticRecall`, the agent’s trace output will show all messages retrieved for context—including both recent conversation history and messages recalled via semantic recall.

This is helpful for debugging, understanding agent decisions, and verifying that the agent is retrieving the right information for each request.

For more details on enabling and configuring tracing, see [Tracing](https://mastra.ai/en/docs/observability/tracing).

## Local development with LibSQL [Permalink for this section](https://mastra.ai/en/docs/memory/overview\#local-development-with-libsql)

For local development with `LibSQLStore`, you can inspect stored memory using the [SQLite Viewer](https://marketplace.visualstudio.com/items?itemName=qwtel.sqlite-viewer) extension in VS Code.

![SQLite Viewer](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fmemory-sqlite-viewer.55a404c7.jpg&w=3840&q=75)

## Next Steps [Permalink for this section](https://mastra.ai/en/docs/memory/overview\#next-steps)

Now that you understand the core concepts, continue to [semantic recall](https://mastra.ai/en/docs/memory/semantic-recall) to learn how to add RAG memory to your Mastra agents.

Alternatively you can visit the [configuration reference](https://mastra.ai/en/reference/memory/Memory) for available options.

[Advanced Usage](https://mastra.ai/en/docs/tools-mcp/advanced-usage "Advanced Usage") [Threads and Resources](https://mastra.ai/en/docs/memory/threads-and-resources "Threads and Resources")