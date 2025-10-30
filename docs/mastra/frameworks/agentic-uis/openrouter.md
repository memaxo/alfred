---
title: Using with OpenRouter
url: 
description: Learn how to integrate OpenRouter with Mastra
language: en
---
[Skip to Content](https://mastra.ai/en/docs/frameworks/agentic-uis/openrouter#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") Frameworks [Agentic UIs](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk "Agentic UIs") With OpenRouter

Copy page

# Use OpenRouter with Mastra

Integrate OpenRouter with Mastra to leverage the numerous models available on OpenRouter.

## Initialize a Mastra Project [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/openrouter\#initialize-a-mastra-project)

The simplest way to get started with Mastra is to use the `mastra` CLI to initialize a new project:

```nextra-code

npx create-mastra@latest
```

You’ll be guided through prompts to set up your project. For this example, select:

- Name your project: my-mastra-openrouter-app
- Components: Agents (recommended)
- For default provider, select OpenAI (recommended) - we’ll configure OpenRouter manually later
- Optionally include example code

## Configure OpenRouter [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/openrouter\#configure-openrouter)

After creating your project with `create-mastra`, you’ll find a `.env` file in your project root.
Since we selected OpenAI during setup, we’ll configure OpenRouter manually:

.env

```nextra-code

OPENROUTER_API_KEY=
```

We remove the `@ai-sdk/openai` package from the project:

```nextra-code

npm uninstall @ai-sdk/openai
```

Then, we install the `@openrouter/ai-sdk-provider` package:

```nextra-code

npm install @openrouter/ai-sdk-provider
```

## Configure your Agent to use OpenRouter [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/openrouter\#configure-your-agent-to-use-openrouter)

We will now configure our agent to use OpenRouter.

src/mastra/agents/assistant.ts

```nextra-code [counter-reset:line]

import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
})

export const assistant = new Agent({
    name: "assistant",
    instructions: "You are a helpful assistant.",
    model: openrouter("anthropic/claude-sonnet-4"),
})
```

Make sure to register your agent to the Mastra instance:

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { assistant } from "./agents/assistant";

export const mastra = new Mastra({
    agents: { assistant }
})
```

## Run and Test your Agent [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/openrouter\#run-and-test-your-agent)

```nextra-code

npm run dev
```

This will start the Mastra development server.

You can now test your agent by visiting [http://localhost:4111](http://localhost:4111/) for the playground or via the Mastra API at [http://localhost:4111/api/agents/assistant/stream](http://localhost:4111/api/agents/assistant/stream).

## Advanced Configuration [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/openrouter\#advanced-configuration)

For more control over your OpenRouter requests, you can pass additional configuration options.

### Provider-wide options: [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/openrouter\#provider-wide-options)

You can pass provider-wide options to the OpenRouter provider:

src/mastra/agents/assistant.ts

```nextra-code [counter-reset:line]

import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    extraBody: {
        reasoning: {
            max_tokens: 10,
        }
    }
})

export const assistant = new Agent({
    name: "assistant",
    instructions: "You are a helpful assistant.",
    model: openrouter("anthropic/claude-sonnet-4"),
})
```

### Model-specific options: [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/openrouter\#model-specific-options)

You can pass model-specific options to the OpenRouter provider:

src/mastra/agents/assistant.ts

```nextra-code [counter-reset:line]

import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
})

export const assistant = new Agent({
    name: "assistant",
    instructions: "You are a helpful assistant.",
    model: openrouter("anthropic/claude-sonnet-4", {
        extraBody: {
            reasoning: {
                max_tokens: 10,
            }
        }
    }),
})
```

### Provider-specific options: [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/openrouter\#provider-specific-options)

You can pass provider-specific options to the OpenRouter provider:

```nextra-code [counter-reset:line]

// Get a response with provider-specific options
const response = await assistant.generate([\
  {\
    role: 'system',\
    content:\
      'You are Chef Michel, a culinary expert specializing in ketogenic (keto) diet...',\
    providerOptions: {\
      // Provider-specific options - key can be 'anthropic' or 'openrouter'\
      anthropic: {\
        cacheControl: { type: 'ephemeral' },\
      },\
    },\
  },\
  {\
    role: 'user',\
    content: 'Can you suggest a keto breakfast?',\
  },\
]);
```

[With Cedar-OS](https://mastra.ai/en/docs/frameworks/agentic-uis/cedar-os "With Cedar-OS") [With Express](https://mastra.ai/en/docs/frameworks/servers/express "With Express")