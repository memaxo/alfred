---
title: Memory Threads and Resources | Memory | Mastra Docs
url: 
description: Learn how Mastra's memory system works with working memory, conversation history, and semantic recall.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/memory/threads-and-resources#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Memory](https://mastra.ai/en/docs/memory/overview "Memory") Threads and Resources

Copy page

# Memory threads and resources

Mastra organizes memory into threads, which are records that group related interactions, using two identifiers:

1. **`thread`**: A globally unique ID representing the conversation (e.g., `support_123`). Must be unique across all resources.
2. **`resource`**: The user or entity that owns the thread (e.g., `user_123`, `org_456`).

The `resource` is especially important for [resource-scoped memory](https://mastra.ai/en/docs/memory/working-memory#resource-scoped-memory), which allows memory to persist across all threads associated with the same user or entity.

```nextra-code [counter-reset:line]

const stream = await agent.stream("message for agent", {
  memory: {
    thread: "user-123",
    resource: "test-123"
  }
});
```

Even with memory configured, agents won’t store or recall information unless both `thread` and `resource` are provided.

> Mastra Playground sets `thread` and `resource` IDs automatically. In your own application, you must provide them manually as part of each `.generate()` or `.stream()` call.

### Thread title generation [Permalink for this section](https://mastra.ai/en/docs/memory/threads-and-resources\#thread-title-generation)

Mastra can automatically generate descriptive thread titles based on the user’s first message. Enable this by setting `generateTitle` to `true`. This improves organization and makes it easier to display conversations in your UI.

```nextra-code [counter-reset:line]

export const testAgent = new Agent({
  memory: new Memory({
    options: {
      threads: {
        generateTitle: true,
      }
    },
  })
});
```

> Title generation runs asynchronously after the agent responds and does not affect response time. See the [full configuration reference](https://mastra.ai/en/reference/memory/Memory#thread-title-generation) for details and examples.

#### Optimizing title generation [Permalink for this section](https://mastra.ai/en/docs/memory/threads-and-resources\#optimizing-title-generation)

Titles are generated using your agent’s model by default. To optimize cost or behavior, provide a smaller `model` and custom `instructions`. This keeps title generation separate from main conversation logic.

```nextra-code [counter-reset:line]

export const testAgent = new Agent({
  // ...
  memory: new Memory({
    options: {
      threads: {
        generateTitle: {
          model: openai("gpt-4.1-nano"),
          instructions: "Generate a concise title based on the user's first message",
        },
      },
    }
  })
});
```

#### Dynamic model selection and instructions [Permalink for this section](https://mastra.ai/en/docs/memory/threads-and-resources\#dynamic-model-selection-and-instructions)

You can configure thread title generation dynamically by passing functions to `model` and `instructions`. These functions receive the `runtimeContext` object, allowing you to adapt title generation based on user-specific values.

```nextra-code [counter-reset:line]

export const testAgent = new Agent({
  // ...
  memory: new Memory({
    options: {
      threads: {
        generateTitle: {
          model: ({ runtimeContext }) => {
            const userTier = runtimeContext.get("userTier");
            return userTier === "premium" ? openai("gpt-4.1") : openai("gpt-4.1-nano");
          },
          instructions: ({ runtimeContext }) => {
            const language = runtimeContext.get("userLanguage") || "English";
            return `Generate a concise, engaging title in ${language} based on the user's first message.`;
          }
        }
      }
    }
  })
});
```

[Overview](https://mastra.ai/en/docs/memory/overview "Overview") [Working Memory](https://mastra.ai/en/docs/memory/working-memory "Working Memory")