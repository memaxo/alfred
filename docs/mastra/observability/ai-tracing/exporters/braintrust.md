---
title: Braintrust Exporter | AI Tracing | Observability | Mastra Docs
url: 
description: Send AI traces to Braintrust for evaluation and monitoring
language: en
---
[Skip to Content](https://mastra.ai/en/docs/observability/ai-tracing/exporters/braintrust#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Observability](https://mastra.ai/en/docs/observability/overview "Observability") [AI Tracing](https://mastra.ai/en/docs/observability/ai-tracing/overview "AI Tracing") [Exporters](https://mastra.ai/en/docs/observability/ai-tracing/exporters/default "Exporters") Braintrust

Copy page

# Braintrust Exporter

[Braintrust](https://www.braintrust.dev/) is an evaluation and monitoring platform that helps you measure and improve LLM application quality. The Braintrust exporter sends your AI traces to Braintrust, enabling systematic evaluation, scoring, and experimentation.

## When to Use Braintrust [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/braintrust\#when-to-use-braintrust)

Braintrust excels at:

- **Evaluation workflows** \- Systematic quality measurement
- **Experiment tracking** \- Compare model versions and prompts
- **Dataset management** \- Curate test cases and golden datasets
- **Regression testing** \- Ensure improvements don’t break existing functionality
- **Team collaboration** \- Share experiments and insights

## Installation [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/braintrust\#installation)

npmpnpmyarnbun

```nextra-code

npm install @mastra/braintrust
```

```nextra-code

pnpm add @mastra/braintrust
```

```nextra-code

yarn add @mastra/braintrust
```

```nextra-code

bun add @mastra/braintrust
```

## Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/braintrust\#configuration)

### Prerequisites [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/braintrust\#prerequisites)

1. **Braintrust Account**: Sign up at [braintrust.dev](https://www.braintrust.dev/)
2. **Project**: Create or select a project for your traces
3. **API Key**: Generate in Braintrust Settings → API Keys
4. **Environment Variables**: Set your credentials:

.env

```nextra-code

BRAINTRUST_API_KEY=sk-xxxxxxxxxxxxxxxx
BRAINTRUST_PROJECT_NAME=my-project  # Optional, defaults to 'mastra-tracing'
```

### Basic Setup [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/braintrust\#basic-setup)

src/mastra/index.ts

```nextra-code

import { Mastra } from "@mastra/core";
import { BraintrustExporter } from "@mastra/braintrust";

export const mastra = new Mastra({
  observability: {
    configs: {
      braintrust: {
        serviceName: 'my-service',
        exporters: [\
          new BraintrustExporter({\
            apiKey: process.env.BRAINTRUST_API_KEY,\
            projectName: process.env.BRAINTRUST_PROJECT_NAME,\
          }),\
        ],
      },
    },
  },
});
```

### Complete Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/braintrust\#complete-configuration)

```nextra-code

new BraintrustExporter({
  // Required
  apiKey: process.env.BRAINTRUST_API_KEY!,

  // Optional settings
  projectName: 'my-project',          // Default: 'mastra-tracing'
  endpoint: 'https://api.braintrust.dev',  // Custom endpoint if needed
  logLevel: 'info',                   // Diagnostic logging: debug | info | warn | error
})
```

## Related [Permalink for this section](https://mastra.ai/en/docs/observability/ai-tracing/exporters/braintrust\#related)

- [AI Tracing Overview](https://mastra.ai/docs/observability/ai-tracing/overview)
- [Braintrust Documentation](https://www.braintrust.dev/docs)

[Cloud](https://mastra.ai/en/docs/observability/ai-tracing/exporters/cloud "Cloud") [Langfuse](https://mastra.ai/en/docs/observability/ai-tracing/exporters/langfuse "Langfuse")