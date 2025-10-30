---
title: Langfuse Exporter | AI Tracing | Observability | Mastra Docs
url: 
description: Send AI traces to Langfuse for LLM observability and analytics
language: en
---
[Skip to Content](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Observability](https://mastra.ai/en/docs/observability/overview "Observability") [AI Tracing](https://mastra.ai/en/docs/observability/ai-tracing/overview "AI Tracing") [Exporters](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default "Exporters") Langfuse

Copy page

# Langfuse Exporter

[Langfuse](https://langfuse.com/) is an open-source observability platform specifically designed for LLM applications. The Langfuse exporter sends your AI traces to Langfuse, providing detailed insights into model performance, token usage, and conversation flows.

## When to Use Langfuse [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse\#when-to-use-langfuse)

Langfuse is ideal when you need:

- **LLM-specific analytics** \- Token usage, costs, latency breakdown
- **Conversation tracking** \- Session-based trace grouping
- **Quality scoring** \- Manual and automated evaluation scores
- **Model comparison** \- A/B testing and version comparisons
- **Self-hosted option** \- Deploy on your own infrastructure

## Installation [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse\#installation)

npmpnpmyarnbun

```nextra-code

npm install @mastra/langfuse
```

```nextra-code

pnpm add @mastra/langfuse
```

```nextra-code

yarn add @mastra/langfuse
```

```nextra-code

bun add @mastra/langfuse
```

## Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse\#configuration)

### Prerequisites [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse\#prerequisites)

1. **Langfuse Account**: Sign up at [cloud.langfuse.com](https://cloud.langfuse.com/) or deploy self-hosted
2. **API Keys**: Create public/secret key pair in Langfuse Settings → API Keys
3. **Environment Variables**: Set your credentials

.env

```nextra-code

LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxxxxxx
LANGFUSE_BASE_URL=https://cloud.langfuse.com  # Or your self-hosted URL
```

### Basic Setup [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse\#basic-setup)

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core";
import { LangfuseExporter } from "@mastra/langfuse";

export const mastra = new Mastra({
  observability: {
    configs: {
      langfuse: {
        serviceName: 'my-service',
        exporters: [\
          new LangfuseExporter({\
            publicKey: process.env.LANGFUSE_PUBLIC_KEY!,\
            secretKey: process.env.LANGFUSE_SECRET_KEY!,\
            baseUrl: process.env.LANGFUSE_BASE_URL,\
            options: {\
              environment: process.env.NODE_ENV,\
            },\
          }),\
        ],
      },
    },
  },
});
```

## Configuration Options [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse\#configuration-options)

### Realtime vs Batch Mode [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse\#realtime-vs-batch-mode)

The Langfuse exporter supports two modes for sending traces:

#### Realtime Mode (Development) [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse\#realtime-mode-development)

Traces appear immediately in Langfuse dashboard, ideal for debugging:

```nextra-code

new LangfuseExporter({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  realtime: true,  // Flush after each event
})
```

#### Batch Mode (Production) [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse\#batch-mode-production)

Better performance with automatic batching:

```nextra-code

new LangfuseExporter({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  realtime: false,  // Default - batch traces
})
```

### Complete Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse\#complete-configuration)

```nextra-code

new LangfuseExporter({
  // Required credentials
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,

  // Optional settings
  baseUrl: process.env.LANGFUSE_BASE_URL,     // Default: https://cloud.langfuse.com
  realtime: process.env.NODE_ENV === 'development',  // Dynamic mode selection
  logLevel: 'info',  // Diagnostic logging: debug | info | warn | error

  // Langfuse-specific options
  options: {
    environment: process.env.NODE_ENV,        // Shows in UI for filtering
    version: process.env.APP_VERSION,         // Track different versions
    release: process.env.GIT_COMMIT,          // Git commit hash
  },
})
```

## Related [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse\#related)

- [AI Tracing Overview](https://mastra.ai/docs/observability/ai-tracing/overview)
- [Langfuse Documentation](https://langfuse.com/docs)

[Braintrust](https://mastra.ai/en/docs/observability/ai-tracing/exporters/braintrust "Braintrust") [LangSmithexp.](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langsmith "LangSmith")