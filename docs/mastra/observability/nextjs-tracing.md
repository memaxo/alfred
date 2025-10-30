---
title: Next.js Tracing | Mastra Observability Documentation
url: 
description: Set up OpenTelemetry tracing for Next.js applications
language: en
---
[Skip to Content](https://mastra.ai/en/docs/observability/nextjs-tracing#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Observability](https://mastra.ai/en/docs/observability/overview "Observability") Next.js Tracing

Copy page

# Next.js Tracing

Next.js requires additional configuration to enable OpenTelemetry tracing.

### Step 1: Next.js Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/nextjs-tracing\#step-1-nextjs-configuration)

Start by enabling the instrumentation hook in your Next.js config:

next.config.ts

```nextra-code [counter-reset:line]

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true, // Not required in Next.js 15+
  },
};

export default nextConfig;
```

### Step 2: Mastra Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/nextjs-tracing\#step-2-mastra-configuration)

Configure your Mastra instance:

mastra.config.ts

```nextra-code

import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "your-project-name",
    enabled: true,
  },
});
```

### Step 3: Configure your providers [Permalink for this section](https://mastra.ai/en/docs/observability/nextjs-tracing\#step-3-configure-your-providers)

If you’re using Next.js, you have two options for setting up OpenTelemetry instrumentation:

#### Option 1: Using a Custom Exporter [Permalink for this section](https://mastra.ai/en/docs/observability/nextjs-tracing\#option-1-using-a-custom-exporter)

The default that will work across providers is to configure a custom exporter:

1. Install the required dependencies (example using Langfuse):

```nextra-code

npm install @opentelemetry/api langfuse-vercel
```

2. Create an instrumentation file:

instrumentation.ts

```nextra-code

import {
  NodeSDK,
  ATTR_SERVICE_NAME,
  resourceFromAttributes,
} from "@mastra/core/telemetry/otel-vendor";
import { LangfuseExporter } from "langfuse-vercel";

export function register() {
  const exporter = new LangfuseExporter({
    // ... Langfuse config
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "ai",
    }),
    traceExporter: exporter,
  });

  sdk.start();
}
```

#### Option 2: Using Vercel’s Otel Setup [Permalink for this section](https://mastra.ai/en/docs/observability/nextjs-tracing\#option-2-using-vercels-otel-setup)

If you’re deploying to Vercel, you can use their OpenTelemetry setup:

1. Install the required dependencies:

```nextra-code

npm install @opentelemetry/api @vercel/otel
```

2. Create an instrumentation file at the root of your project (or in the src folder if using one):

instrumentation.ts

```nextra-code

import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({ serviceName: "your-project-name" });
}
```

### Summary [Permalink for this section](https://mastra.ai/en/docs/observability/nextjs-tracing\#summary)

This setup will enable OpenTelemetry tracing for your Next.js application and Mastra operations.

For more details, see the documentation for:

- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- [Vercel OpenTelemetry](https://vercel.com/docs/observability/otel-overview/quickstart)

[OTEL Tracing](https://mastra.ai/en/docs/observability/otel-tracing "OTEL Tracing") [Textual Evals](https://mastra.ai/en/docs/evals/textual-evals "Textual Evals")