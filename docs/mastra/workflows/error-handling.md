---
title: Error Handling in Workflows | Workflows | Mastra Docs
url: 
description: Learn how to handle errors in Mastra workflows using step retries, conditional branching, and monitoring.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/workflows/error-handling#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Workflows](https://mastra.ai/en/docs/workflows/overview "Workflows") Error Handling

Copy page

# Error Handling

Mastra provides a built-in retry mechanism for workflows or steps that fail due to transient errors. This is particularly useful for steps that interact with external services or resources that might experience temporary unavailability.

## Workflow-level using `retryConfig` [Permalink for this section](https://mastra.ai/en/docs/workflows/error-handling\#workflow-level-using-retryconfig)

You can configure retries at the workflow level, which applies to all steps in the workflow:

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});

export const testWorkflow = createWorkflow({
  // ...
  retryConfig: {
    attempts: 5,
    delay: 2000
  }
})
  .then(step1)
  .commit();
```

## Step-level using `retries` [Permalink for this section](https://mastra.ai/en/docs/workflows/error-handling\#step-level-using-retries)

You can configure retries for individual steps using the `retries` property. This overrides the workflow-level retry configuration for that specific step:

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  // ...
  execute: async () => {
    const response = await // ...

    if (!response.ok) {
      throw new Error('Error');
    }

    return {
      value: ""
    };
  },
  retries: 3
});
```

## Conditional branching [Permalink for this section](https://mastra.ai/en/docs/workflows/error-handling\#conditional-branching)

You can create alternative workflow paths based on the success or failure of previous steps using conditional logic:

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  // ...
  execute: async () => {
    try {
      const response = await // ...

      if (!response.ok) {
        throw new Error('error');
      }

      return {
        status: "ok"
      };
    } catch (error) {
      return {
        status: "error"
      };
    }
  }
});

const step2 = createStep({...});
const fallback = createStep({...});

export const testWorkflow = createWorkflow({
  // ...
})
  .then(step1)
  .branch([\
    [async ({ inputData: { status } }) => status === "ok", step2],\
    [async ({ inputData: { status } }) => status === "error", fallback]\
  ])
  .commit();
```

## Check previous step results [Permalink for this section](https://mastra.ai/en/docs/workflows/error-handling\#check-previous-step-results)

Use `getStepResult()` to inspect a previous step’s results.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});

const step2 = createStep({
  // ...
  execute: async ({ getStepResult }) => {

    const step1Result = getStepResult(step1);

    return {
      value: ""
    };
  }
});
```

## Exiting early with `bail()` [Permalink for this section](https://mastra.ai/en/docs/workflows/error-handling\#exiting-early-with-bail)

Use `bail()` in a step to exit early with a successful result. This returns the provided payload as the step output and ends workflow execution.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  id: 'step1',
  execute: async ({ bail }) => {
    return bail({ result: 'bailed' });
  },
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

## Exiting early with `Error()` [Permalink for this section](https://mastra.ai/en/docs/workflows/error-handling\#exiting-early-with-error)

Use `throw new Error()` in a step to exit with an error.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  id: 'step1',
  execute: async () => {
    throw new Error('error');
  },
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ result: z.string() }),
});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .commit();
```

## Monitor errors with `watch()` [Permalink for this section](https://mastra.ai/en/docs/workflows/error-handling\#monitor-errors-with-watch)

You can monitor workflows for errors using the `watch` method:

src/test-workflow.ts

```nextra-code [counter-reset:line]

import { mastra } from "../src/mastra";

const workflow = mastra.getWorkflow("testWorkflow");
const run = await workflow.createRunAsync();

run.watch((event) => {
  const {
    payload: { currentStep }
  } = event;

  console.log(currentStep?.payload?.status);
});

```

## Monitor errors with `stream()`

You can monitor workflows for errors using `stream`:

src/test-workflow.ts

```nextra-code [counter-reset:line]

import { mastra } from "../src/mastra";

const workflow = mastra.getWorkflow("testWorkflow");

const run = await workflow.createRunAsync();

const stream = await run.stream({
  inputData: {
    value: "initial data"
  }
});

for await (const chunk of stream.stream) {
  console.log(chunk.payload.output.stats);
}

```

## Related [Permalink for this section](https://mastra.ai/en/docs/workflows/error-handling\#related)

- [Control Flow](https://mastra.ai/en/docs/workflows/control-flow)
- [Conditional Branching](https://mastra.ai/en/docs/workflows/control-flow#conditional-logic-with-branch)
- [Running Workflows](https://mastra.ai/en/examples/workflows/running-workflows)

[Sleep & Events](https://mastra.ai/en/docs/workflows/pausing-execution "Sleep & Events") [Input Data Mapping](https://mastra.ai/en/docs/workflows/input-data-mapping "Input Data Mapping")