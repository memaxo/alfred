---
title: Conversation History | Memory | Mastra Docs
url: 
description: Learn how to configure conversation history in Mastra to store recent messages from the current conversation.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/memory/conversation-history#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Memory](https://mastra.ai/en/docs/memory/overview "Memory") Conversation History

Copy page

# Conversation History

Conversation history is the simplest kind of memory. It is a list of messages from the current conversation.

By default, each request includes the last 10 messages from the current memory thread, giving the agent short-term conversational context. This limit can be increased using the `lastMessages` parameter.

You can increase this limit by passing the `lastMessages` parameter to the `Memory` instance.

```nextra-code [counter-reset:line]

export const testAgent = new Agent({
  // ...
  memory: new Memory({
    options: {
      lastMessages: 100
    },
  })
});
```

[Working Memory](https://mastra.ai/en/docs/memory/working-memory "Working Memory") [Semantic Recall](https://mastra.ai/en/docs/memory/semantic-recall "Semantic Recall")