---
title: Logging | Mastra Observability Documentation
url: 
description: Learn how to use logging in Mastra to monitor execution, capture application behavior, and improve the accuracy of AI applications.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/observability/logging#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Observability](https://mastra.ai/en/docs/observability/overview "Observability") Logging

Copy page

# Logging

Mastra’s logging system captures function execution, input data, and output responses in a structured format.

When deploying to Mastra Cloud, logs are shown on the [Logs](https://mastra.ai/en/docs/mastra-cloud/observability) page. In self-hosted or custom environments, logs can be directed to files or external services depending on the configured transports.

## PinoLogger [Permalink for this section](https://mastra.ai/en/docs/observability/logging\#pinologger)

When [initializing a new Mastra project](https://mastra.ai/en/docs/getting-started/installation) using the CLI, `PinoLogger` is included by default.

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';

export const mastra = new Mastra({
  // ...
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```

> See the [PinoLogger](https://mastra.ai/en/reference/observability/logger) API reference for all available configuration options.

## Logging from workflows and tools [Permalink for this section](https://mastra.ai/en/docs/observability/logging\#logging-from-workflows-and-tools)

Mastra provides access to a logger instance via the `mastra.getLogger()` method, available inside both workflow steps and tools. The logger supports standard severity levels: `debug`, `info`, `warn`, and `error`.

### Logging from workflow steps [Permalink for this section](https://mastra.ai/en/docs/observability/logging\#logging-from-workflow-steps)

Within a workflow step, access the logger via the `mastra` parameter inside the `execute` function. This allows you to log messages relevant to the step’s execution.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  //...
  execute: async ({ mastra }) => {

    const logger = mastra.getLogger();
    logger.info("workflow info log");

    return {
      output: ""
    };
  }
});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

### Logging from tools [Permalink for this section](https://mastra.ai/en/docs/observability/logging\#logging-from-tools)

Similarly, tools have access to the logger instance via the `mastra` parameter. Use this to log tool specific activity during execution.

src/mastra/tools/test-tool.ts

```nextra-code [counter-reset:line]

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const testTool = createTool({
  // ...
  execute: async ({ mastra }) => {

    const logger = mastra?.getLogger();
    logger?.info("tool info log");

    return {
      output: ""
    };
  }
});
```

## Logging with additional data [Permalink for this section](https://mastra.ai/en/docs/observability/logging\#logging-with-additional-data)

Logger methods accept an optional second argument for additional data. This can be any value, such as an object, string, or number.

In this example, the log message includes an object with a key of `agent` and a value of the `testAgent` instance.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  //...
  execute: async ({ mastra }) => {

    const testAgent = mastra.getAgent("testAgent");

    const logger = mastra.getLogger();
    logger.info("workflow info log", { agent: testAgent });

    return {
      output: ""
    };
  }
});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

[Overview](https://mastra.ai/en/docs/observability/overview "Overview") [Overview](https://mastra.ai/en/docs/observability/ai-tracing/overview "Overview")