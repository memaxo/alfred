---
title: LangSmith Exporter | AI Tracing | Observability | Mastra Docs
url: 
description: Send AI traces to LangSmith for LLM observability and evaluation
language: en
---
[Skip to Content](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langsmith#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Observability](https://mastra.ai/en/docs/observability/overview "Observability") [AI Tracing](https://mastra.ai/en/docs/observability/ai-tracing/overview "AI Tracing") [Exporters](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default "Exporters") LangSmithexp.

Copy page

# LangSmith Exporter

[LangSmith](https://smith.langchain.com/) is LangChain’s platform for monitoring and evaluating LLM applications. The LangSmith exporter sends your AI traces to LangSmith, providing insights into model performance, debugging capabilities, and evaluation workflows.

## When to Use LangSmith [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langsmith\#when-to-use-langsmith)

LangSmith is ideal when you need:

- **LangChain ecosystem integration** \- Native support for LangChain applications
- **Debugging and testing** \- Detailed trace visualization and replay
- **Evaluation pipelines** \- Built-in evaluation and dataset management
- **Prompt versioning** \- Track and compare prompt variations
- **Collaboration features** \- Team workspaces and shared projects

## Installation [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langsmith\#installation)

npmpnpmyarnbun

```nextra-code

npm install @mastra/langsmith
```

```nextra-code

pnpm add @mastra/langsmith
```

```nextra-code

yarn add @mastra/langsmith
```

```nextra-code

bun add @mastra/langsmith
```

## Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langsmith\#configuration)

### Prerequisites [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langsmith\#prerequisites)

1. **LangSmith Account**: Sign up at [smith.langchain.com](https://smith.langchain.com/)
2. **API Key**: Generate an API key in LangSmith Settings → API Keys
3. **Environment Variables**: Set your credentials

.env

```nextra-code

LANGSMITH_API_KEY=ls-xxxxxxxxxxxx
LANGSMITH_BASE_URL=https://api.smith.langchain.com  # Optional for self-hosted
```

### Basic Setup [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langsmith\#basic-setup)

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core";
import { LangSmithExporter } from "@mastra/langsmith";

export const mastra = new Mastra({
  observability: {
    configs: {
      langsmith: {
        serviceName: 'my-service',
        exporters: [\
          new LangSmithExporter({\
            apiKey: process.env.LANGSMITH_API_KEY,\
          }),\
        ],
      },
    },
  },
});
```

## Configuration Options [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langsmith\#configuration-options)

### Complete Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langsmith\#complete-configuration)

```nextra-code

new LangSmithExporter({
  // Required credentials
  apiKey: process.env.LANGSMITH_API_KEY!,

  // Optional settings
  apiUrl: process.env.LANGSMITH_BASE_URL,       // Default: https://api.smith.langchain.com
  callerOptions: {                              // HTTP client options
    timeout: 30000,                             // Request timeout in ms
    maxRetries: 3,                              // Retry attempts
  },
  logLevel: 'info',                             // Diagnostic logging: debug | info | warn | error

  // LangSmith-specific options
  hideInputs: false,                            // Hide input data in UI
  hideOutputs: false,                           // Hide output data in UI
})
```

## Related [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langsmith\#related)

- [AI Tracing Overview](https://mastra.ai/docs/observability/ai-tracing/overview)
- [LangSmith Documentation](https://docs.smith.langchain.com/)

[Langfuse](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse "Langfuse") [OpenTelemetryexp.](https://mastra.ai/en/docs/observability/ai-tracing/exporters/otel "OpenTelemetry")