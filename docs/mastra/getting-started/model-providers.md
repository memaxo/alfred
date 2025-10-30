---
title: Model Providers | Getting Started | Mastra Docs
url: 
description: Learn how to configure and use different model providers with Mastra.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/getting-started/model-providers#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Getting Started](https://mastra.ai/en/docs/getting-started/installation "Getting Started") Model Providers

Copy page

# Model Providers

Mastra’s unified model router gives you access to 541+ models from 38 providers with a single API. Switch between models and providers without changing your code. Automatic environment variable detection handles authentication, while TypeScript provides full autocomplete for every model.

## Quick Start [Permalink for this section](https://mastra.ai/en/docs/getting-started/model-providers\#quick-start)

Simply use the `provider/model` string pattern:

src/mastra/agents/weather-agent.ts

```nextra-code [counter-reset:line]

import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "WeatherAgent",
  instructions: "You are a helpful weather assistant",
  model: "openai/gpt-4o"
});

const result = await agent.generate("What is the weather like?");
```

## Browse Providers [Permalink for this section](https://mastra.ai/en/docs/getting-started/model-providers\#browse-providers)

**[→ View all 38 providers and 7 gateways](https://mastra.ai/en/models)**

Explore our complete catalog with logos, model counts, and documentation for each provider.

## Configuration [Permalink for this section](https://mastra.ai/en/docs/getting-started/model-providers\#configuration)

Models automatically detect API keys from environment variables.

## AI SDK Compatibility [Permalink for this section](https://mastra.ai/en/docs/getting-started/model-providers\#ai-sdk-compatibility)

While Mastra provides built-in support for 541+ models, you can also use [Vercel AI SDK](https://sdk.vercel.ai/providers/ai-sdk-providers) model providers for additional flexibility:

```nextra-code

import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core";

const agent = new Agent({
  name: "AISDKAgent",
  model: openai("gpt-4-turbo")  // AI SDK model provider
});
```

**Recommendation**: Use Mastra’s built-in model router ( `"provider/model"` strings) for simplicity. Use AI SDK providers only when you need specific features not available in the built-in providers.

## Learn More [Permalink for this section](https://mastra.ai/en/docs/getting-started/model-providers\#learn-more)

- [📚 Browse All Model Providers](https://mastra.ai/en/models) \- Complete list with examples
- [🚀 Agent Documentation](https://mastra.ai/en/reference/agents/agent) \- Using models with agents
- [⚙️ Environment Variables](https://mastra.ai/en/docs/getting-started/installation#add-your-api-key) \- Configuration guide
- [🔧 Tool Configuration](https://mastra.ai/en/docs/agents/using-tools-and-mcp#adding-tools-to-an-agent) \- Adding tools to agents

[MCP Docs Server](https://mastra.ai/en/docs/getting-started/mcp-docs-server "MCP Docs Server") [Templates](https://mastra.ai/en/docs/getting-started/templates "Templates")