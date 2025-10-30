---
title: OTEL Tracing | Mastra Observability Documentation
url: 
description: Set up OpenTelemetry tracing for Mastra applications
language: en
---
[Skip to Content](https://mastra.ai/en/docs/observability/otel-tracing#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Observability](https://mastra.ai/en/docs/observability/overview "Observability") OTEL Tracing

Copy page

# OTEL Tracing

Mastra supports the OpenTelemetry Protocol (OTLP) for tracing and monitoring your application. When telemetry is enabled, Mastra automatically traces all core primitives including agent operations, LLM interactions, tool executions, integration calls, workflow runs, and database operations. Your telemetry data can then be exported to any OTEL collector.

### Basic Configuration [Permalink for this section](https://mastra.ai/en/docs/observability/otel-tracing\#basic-configuration)

Here’s a simple example of enabling telemetry:

mastra.config.ts

```nextra-code [counter-reset:line]

export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "my-app",
    enabled: true,
    sampling: {
      type: "always_on",
    },
    export: {
      type: "otlp",
      endpoint: "http://localhost:4318", // SigNoz local endpoint
    },
  },
});
```

### Configuration Options [Permalink for this section](https://mastra.ai/en/docs/observability/otel-tracing\#configuration-options)

The telemetry config accepts these properties:

```nextra-code

type OtelConfig = {
  // Name to identify your service in traces (optional)
  serviceName?: string;

  // Enable/disable telemetry (defaults to true)
  enabled?: boolean;

  // Control how many traces are sampled
  sampling?: {
    type: "ratio" | "always_on" | "always_off" | "parent_based";
    probability?: number; // For ratio sampling
    root?: {
      probability: number; // For parent_based sampling
    };
  };

  // Where to send telemetry data
  export?: {
    type: "otlp" | "console";
    endpoint?: string;
    headers?: Record<string, string>;
  };
};
```

See the [OtelConfig reference documentation](https://mastra.ai/en/reference/observability/otel-config) for more details.

### Environment Variables [Permalink for this section](https://mastra.ai/en/docs/observability/otel-tracing\#environment-variables)

You can configure the OTLP endpoint and headers through environment variables:

.env

```nextra-code

OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_HEADERS=x-api-key=your-api-key
```

Then in your config:

mastra.config.ts

```nextra-code [counter-reset:line]

export const mastra = new Mastra({
  // ... other config
  telemetry: {
    serviceName: "my-app",
    enabled: true,
    export: {
      type: "otlp",
      // endpoint and headers will be picked up from env vars
    },
  },
});
```

### Example: SigNoz Integration [Permalink for this section](https://mastra.ai/en/docs/observability/otel-tracing\#example-signoz-integration)

Here’s what a traced agent interaction looks like in [SigNoz](https://signoz.io/):

![Agent interaction trace showing spans, LLM calls, and tool executions](https://mastra.ai/image/signoz-telemetry-demo.png)

### Other Supported Providers [Permalink for this section](https://mastra.ai/en/docs/observability/otel-tracing\#other-supported-providers)

For a complete list of supported observability providers and their configuration details, see the [Observability Providers reference](https://mastra.ai/en/reference/observability/providers/).

### Custom Instrumentation files [Permalink for this section](https://mastra.ai/en/docs/observability/otel-tracing\#custom-instrumentation-files)

You can define custom instrumentation files in your Mastra project by placing them in the `/mastra` folder. Mastra automatically detects and bundles these files instead of using the default instrumentation.

#### Supported File Types [Permalink for this section](https://mastra.ai/en/docs/observability/otel-tracing\#supported-file-types)

Mastra looks for instrumentation files with these extensions:

- `instrumentation.js`
- `instrumentation.ts`
- `instrumentation.mjs`

#### Example [Permalink for this section](https://mastra.ai/en/docs/observability/otel-tracing\#example)

/mastra/instrumentation.ts

```nextra-code [counter-reset:line]

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

When Mastra finds a custom instrumentation file, it automatically replaces the default instrumentation and bundles it during the build process.

### Tracing Outside Mastra Server Environment [Permalink for this section](https://mastra.ai/en/docs/observability/otel-tracing\#tracing-outside-mastra-server-environment)

When using `mastra start` or `mastra dev` commands, Mastra automatically provisions and loads the necessary instrumentation files for tracing. However, when using Mastra as a dependency in your own application (outside the Mastra server environment), you’ll need to manually provide the instrumentation file.

To enable tracing in this case:

1. Enable Mastra telemetry in your configuration:

```nextra-code

export const mastra = new Mastra({
  telemetry: {
    enabled: true,
  },
});
```

2. Create an instrumentation file in your project (e.g., `instrumentation.mjs`):

```nextra-code

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

3. Add OpenTelemetry environment variables:

```nextra-code

OTEL_EXPORTER_OTLP_ENDPOINT=https://api.braintrust.dev/otel
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <Your API Key>, x-bt-parent=project_name:<Your Project Name>"
```

4. Run the OpenTelemetry SDK before your application:

```nextra-code

node --import=./instrumentation.mjs --import=@opentelemetry/instrumentation/hook.mjs src/index.js
```

### Next.js-specific Tracing steps [Permalink for this section](https://mastra.ai/en/docs/observability/otel-tracing\#nextjs-specific-tracing-steps)

If you’re using Next.js, you have three additional configuration steps:

1. Enable the instrumentation hook in `next.config.ts`
2. Configure Mastra telemetry settings
3. Set up an OpenTelemetry exporter

For implementation details, see the [Next.js Tracing](https://mastra.ai/en/docs/observability/nextjs-tracing) guide.

[SensitiveDataFilter](https://mastra.ai/en/docs/observability/ai-tracing/processors/sensitive-data-filter "SensitiveDataFilter") [Overview](https://mastra.ai/en/docs/evals/overview "Overview")