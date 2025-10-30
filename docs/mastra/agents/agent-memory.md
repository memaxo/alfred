---
title: Using Agent Memory | Agents | Mastra Docs
url: 
description: Documentation on how agents in Mastra use memory to store conversation history and contextual information.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/agents/agent-memory#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Agents](https://mastra.ai/en/docs/agents/overview "Agents") Agent Memory

Copy page

# Agent Memory

Agents in Mastra can leverage a powerful memory system to store conversation history, recall relevant information, and maintain persistent context across interactions. This allows agents to have more natural, stateful conversations.

## Enabling memory for an agent [Permalink for this section](https://mastra.ai/en/docs/agents/agent-memory\#enabling-memory-for-an-agent)

To enable memory, instantiate the `Memory` class and pass it to your agent’s configuration using the `memory` parameter. You also need to install the memory package and a storage adapter:

npmpnpmyarnbun

```nextra-code

npm install @mastra/memory@latest @mastra/libsql@latest
```

```nextra-code

pnpm add @mastra/memory@latest @mastra/libsql@latest
```

```nextra-code

yarn add @mastra/memory@latest @mastra/libsql@latest
```

```nextra-code

bun add @mastra/memory@latest @mastra/libsql@latest
```

src/mastra/agents/test-agent.ts

```nextra-code [counter-reset:line]

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { openai } from "@ai-sdk/openai";

export const testAgent = new Agent({
  name: "test-agent",
  instructions: "You are a helpful assistant with memory.",
  model: openai("gpt-4o"),
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:../../memory.db"
    })
  })
});
```

This basic setup uses the default settings. Visit the [Memory documentation](https://mastra.ai/en/docs/memory/overview) for more configuration info.

## Memory in agent calls [Permalink for this section](https://mastra.ai/en/docs/agents/agent-memory\#memory-in-agent-calls)

When calling `.generate()` or `.stream()`, include a `memory` object with both `resource` and `thread` to enable memory.

- `resource`: A stable identifier for the user or entity.
- `thread`: An ID that isolates a specific conversation or session.

These fields tell the agent where to store and retrieve context, enabling persistent, thread-aware memory across interactions.

```nextra-code

const response = await testAgent.generate("Remember my favorite color is blue.", {
  memory: {
    resource: "user_alice",
    thread: "preferences_thread",
  }
});
```

To recall information stored in memory, call the agent with the same `resource` and `thread` values used in the original interaction.

```nextra-code

const response = await testAgent.generate("What's my favorite color?", {
  memory: {
    resource: "user_alice",
    thread: "preferences_thread",
  }
});
```

## Memory with `RuntimeContext` [Permalink for this section](https://mastra.ai/en/docs/agents/agent-memory\#memory-with-runtimecontext)

You can configure memory dynamically using [RuntimeContext](https://mastra.ai/en/docs/agents/runtime-context), just like `instructions`, `models`, and `tools`. This gives you fine-grained control over memory behavior. For example, you can select different memory systems per user, enable features conditionally, or adapt configurations across environments.

### Agent configuration [Permalink for this section](https://mastra.ai/en/docs/agents/agent-memory\#agent-configuration)

src/mastra/agents/test-agent.ts

```nextra-code [counter-reset:line]

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { openai } from "@ai-sdk/openai";

const premiumMemory = new Memory({
 // ...
});

const standardMemory = new Memory({
  // ...
});

export const testAgent = new Agent({
  name: "test-agent",
  instructions: "You are a helpful assistant with tiered memory capabilities.",
  model: openai("gpt-4o"),
  memory: ({ runtimeContext }) => {
    const userTier = runtimeContext.get("userTier");
    return userTier === "premium" ? premiumMemory : standardMemory;
  }
});
```

### Agent usage [Permalink for this section](https://mastra.ai/en/docs/agents/agent-memory\#agent-usage)

Pass a configured `RuntimeContext` instance to an agent to enable conditional logic during execution. This allows the agent to adapt its behavior based on runtime values.

```nextra-code [counter-reset:line]

import { RuntimeContext } from "@mastra/core/runtime-context";

const testAgent = mastra.getAgent("testAgent");
const runtimeContext = new RuntimeContext();

runtimeContext.set("userTier", "premium");

const response = await testAgent.generate("Remember my favorite color is blue.", {
  memory: {
    resource: "user_alice",
    thread: { id: "preferences_thread" }
  },
  runtimeContext
});
```

## Async memory configuration [Permalink for this section](https://mastra.ai/en/docs/agents/agent-memory\#async-memory-configuration)

Memory can be configured asynchronously to support use cases like fetching user-specific settings from a database, validating access with Auth, or loading additional data from a remote service.

src/mastra/agents/test-agent.ts

```nextra-code [counter-reset:line]

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { openai } from "@ai-sdk/openai";

const premiumMemory = new Memory({
 // ...
});

const standardMemory = new Memory({
  // ...
});

export const testAgent = new Agent({
  name: "test-agent",
  instructions: "You are a helpful assistant with tiered memory capabilities.",
  model: openai("gpt-4o"),
  memory: async ({ runtimeContext }) => {
    const userId = runtimeContext.get("userId");

    // Example database lookup using `userId`
    const userTier = await query(`SELECT user_tier FROM users WHERE userId = $1`, [userId]);

    return userTier === "premium" ? premiumMemory : standardMemory;
  }
});
```

## Related [Permalink for this section](https://mastra.ai/en/docs/agents/agent-memory\#related)

- [Working Memory](https://mastra.ai/en/docs/memory/working-memory)
- [Semantic Recall](https://mastra.ai/en/docs/memory/semantic-recall)
- [Threads and Resources](https://mastra.ai/en/docs/memory/threads-and-resources)

[Using Tools](https://mastra.ai/en/docs/agents/using-tools "Using Tools") [Runtime Context](https://mastra.ai/en/docs/agents/runtime-context "Runtime Context")