---
title: Runtime Context | Agents | Mastra Docs
url: 
description: Learn how to use Mastra's RuntimeContext to provide dynamic, request-specific configuration to agents.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/agents/runtime-context#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Agents](https://mastra.ai/en/docs/agents/overview "Agents") Runtime Context

Copy page

# Runtime Context

Agents use `RuntimeContext` to access request-specific values sent alongside user messages. These values let a single agent change its behavior, functionality, model, tools, or memory usage based on the needs of each request.

![Agents Runtime Context](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fagents-runtime-context.32a600cb.jpg&w=3840&q=75)

## When to use `RuntimeContext` [Permalink for this section](https://mastra.ai/en/docs/agents/runtime-context\#when-to-use-runtimecontext)

Use `RuntimeContext` when an agent’s behavior should change based on the request or environment. For example, you might switch models or storage providers based on user details, or adjust instructions or tool selection based on the user’s language.

## Configuring agents with `RuntimeContext` [Permalink for this section](https://mastra.ai/en/docs/agents/runtime-context\#configuring-agents-with-runtimecontext)

You can access the `runtimeContext` argument from any of the agent’s supported parameters. These functions can be sync or `async`, allowing you to use context values to fetch data, apply logic, or adjust behavior at runtime.

src/dynamic-agent.ts

```nextra-code [counter-reset:line]

export const dynamicAgent = new Agent({
  name: "dynamic-agent",
  instructions: async ({ runtimeContext }) => {
    // ...
  },
  model: ({ runtimeContext }) => {
    // ...
  },
  tools: ({ runtimeContext }) => {
    // ...
  },
  memory: ({ runtimeContext }) => {
    // ...
  },
});
```

You can also use `runtimeContext` with other parameters like `agents`, `workflows`, `scorers`, `inputProcessors`, and `outputProcessors`.

> See [Agent](https://mastra.ai/en/reference/agents/agent) for a full list of configuration options.

## Setting values [Permalink for this section](https://mastra.ai/en/docs/agents/runtime-context\#setting-values)

To set variables in `runtimeContext`, create a new instance using `new RuntimeContext()` and call `.set()` to define the values you want to include.

The `.set()` method takes two arguments:

1. **key**: The name used to identify the value.
2. **value**: The data to associate with that key.

After setting the values, pass the `runtimeContext` to `.generate()` or `.stream()` to make them available to the agent.

src/test-dynamic-agent.ts

```nextra-code [counter-reset:line]

import { mastra } from "./mastra";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { UserTier } from "./mastra/agents/dynamic-agent"

const agent = mastra.getAgent("dynamicAgent");

const runtimeContext = new RuntimeContext<UserTier>();
runtimeContext.set("user-tier", "enterprise");

const response = await agent.generate("Help plan my day.", {
  runtimeContext
});
```

## Accessing values [Permalink for this section](https://mastra.ai/en/docs/agents/runtime-context\#accessing-values)

The example below accesses a `user-tier` value from `runtimeContext` to determine which model and instructions to use. The context is typed to provide safety and autocomplete when working with `.get()` and `.set()`.

src/mastra/agents/dynamic-agent.ts

```nextra-code [counter-reset:line]

import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { RuntimeContext } from "@mastra/core/runtime-context";

export type UserTier = {
  "user-tier": "enterprise" | "pro";
};

export const dynamicAgent = new Agent({
  name: "dynamic-agent",
  instructions: async ({ runtimeContext }: { runtimeContext: RuntimeContext<UserTier> }) => {
    const userTier = runtimeContext.get("user-tier");

    const result = await db.query("SELECT instructions FROM config WHERE tier = ?", [userTier]);

    return result[0].instructions;
  },
  model: ({ runtimeContext }: { runtimeContext: RuntimeContext<UserTier> }) => {
    const userTier = runtimeContext.get("user-tier");

    return userTier === "enterprise"
      ? openai("gpt-4o-mini")
      : openai("gpt-4.1-nano");
  }
});
```

For a complete implementation example that demonstrates all runtime context capabilities including dynamic model selection, tools, memory, input/output processors, and quality scoring based on user subscription tiers, see our [Runtime Context Example](https://mastra.ai/en/examples/agents/runtime-context).

## Related [Permalink for this section](https://mastra.ai/en/docs/agents/runtime-context\#related)

- [Runtime Context Example](https://mastra.ai/en/examples/agents/runtime-context)
- [Tool Runtime Context](https://mastra.ai/en/docs/tools-mcp/runtime-context)
- [Server Middleware Runtime Context](https://mastra.ai/en/docs/server-db/middleware)

[Agent Memory](https://mastra.ai/en/docs/agents/agent-memory "Agent Memory") [Guardrails](https://mastra.ai/en/docs/agents/guardrails "Guardrails")