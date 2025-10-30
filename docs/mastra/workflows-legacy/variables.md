---
title: Data Mapping with Workflow (Legacy) Variables | Mastra Docs
url: 
description: Learn how to use workflow variables to map data between steps and create dynamic data flows in your Mastra workflows.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/workflows-legacy/variables#nextra-skip-nav)

Docs

Copy page

# Data Mapping with Workflow Variables

Workflow variables in Mastra provide a powerful mechanism for mapping data between steps, allowing you to create dynamic data flows and pass information from one step to another.

## Understanding Workflow Variables [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#understanding-workflow-variables)

In Mastra workflows, variables serve as a way to:

- Map data from trigger inputs to step inputs
- Pass outputs from one step to inputs of another step
- Access nested properties within step outputs
- Create more flexible and reusable workflow steps

## Using Variables for Data Mapping [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#using-variables-for-data-mapping)

### Basic Variable Mapping [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#basic-variable-mapping)

You can map data between steps using the `variables` property when adding a step to your workflow:

src/mastra/workflows/index.ts

```nextra-code [counter-reset:line]

import { LegacyStep, LegacyWorkflow } from "@mastra/core/workflows/legacy";

const workflow = new LegacyWorkflow({
  name: "data-mapping-workflow",
  triggerSchema: z.object({
    inputData: z.string(),
  }),
});

workflow
  .step(step1, {
    variables: {
      // Map trigger data to step input
      inputData: { step: "trigger", path: "inputData" },
    },
  })
  .then(step2, {
    variables: {
      // Map output from step1 to input for step2
      previousValue: { step: step1, path: "outputField" },
    },
  })
  .commit();

// Register the workflow with Mastra
export const mastra = new Mastra({
  legacy_workflows: { workflow },
});
```

### Accessing Nested Properties [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#accessing-nested-properties)

You can access nested properties using dot notation in the `path` field:

src/mastra/workflows/index.ts

```nextra-code [counter-reset:line]

workflow
  .step(step1)
  .then(step2, {
    variables: {
      // Access a nested property from step1's output
      nestedValue: { step: step1, path: "nested.deeply.value" },
    },
  })
  .commit();
```

### Mapping Entire Objects [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#mapping-entire-objects)

You can map an entire object by using `.` as the path:

src/mastra/workflows/index.ts

```nextra-code [counter-reset:line]

workflow
  .step(step1, {
    variables: {
      // Map the entire trigger data object
      triggerData: { step: "trigger", path: "." },
    },
  })
  .commit();
```

### Variables in Loops [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#variables-in-loops)

Variables can also be passed to `while` and `until` loops. This is useful for passing data between iterations or from outside steps:

src/mastra/workflows/loop-variables.ts

```nextra-code [counter-reset:line]

// Step that increments a counter
const incrementStep = new LegacyStep({
  id: "increment",
  inputSchema: z.object({
    // Previous value from last iteration
    prevValue: z.number().optional(),
  }),
  outputSchema: z.object({
    // Updated counter value
    updatedCounter: z.number(),
  }),
  execute: async ({ context }) => {
    const { prevValue = 0 } = context.inputData;
    return { updatedCounter: prevValue + 1 };
  },
});

const workflow = new LegacyWorkflow({
  name: "counter",
});

workflow.step(incrementStep).while(
  async ({ context }) => {
    // Continue while counter is less than 10
    const result = context.getStepResult(incrementStep);
    return (result?.updatedCounter ?? 0) < 10;
  },
  incrementStep,
  {
    // Pass previous value to next iteration
    prevValue: {
      step: incrementStep,
      path: "updatedCounter",
    },
  },
);
```

## Variable Resolution [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#variable-resolution)

When a workflow executes, Mastra resolves variables at runtime by:

1. Identifying the source step specified in the `step` property
2. Retrieving the output from that step
3. Navigating to the specified property using the `path`
4. Injecting the resolved value into the target step’s context as the `inputData` property

## Examples [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#examples)

### Mapping from Trigger Data [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#mapping-from-trigger-data)

This example shows how to map data from the workflow trigger to a step:

src/mastra/workflows/trigger-mapping.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core";
import { LegacyStep, LegacyWorkflow } from "@mastra/core/workflows/legacy";
import { z } from "zod";

// Define a step that needs user input
const processUserInput = new LegacyStep({
  id: "processUserInput",
  execute: async ({ context }) => {
    // The inputData will be available in context because of the variable mapping
    const { inputData } = context.inputData;

    return {
      processedData: `Processed: ${inputData}`,
    };
  },
});

// Create the workflow
const workflow = new LegacyWorkflow({
  name: "trigger-mapping",
  triggerSchema: z.object({
    inputData: z.string(),
  }),
});

// Map the trigger data to the step
workflow
  .step(processUserInput, {
    variables: {
      inputData: { step: "trigger", path: "inputData" },
    },
  })
  .commit();

// Register the workflow with Mastra
export const mastra = new Mastra({
  legacy_workflows: { workflow },
});
```

### Mapping Between Steps [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#mapping-between-steps)

This example demonstrates mapping data from one step to another:

src/mastra/workflows/step-mapping.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core";
import { LegacyStep, LegacyWorkflow } from "@mastra/core/workflows/legacy";
import { z } from "zod";

// Step 1: Generate data
const generateData = new LegacyStep({
  id: "generateData",
  outputSchema: z.object({
    nested: z.object({
      value: z.string(),
    }),
  }),
  execute: async () => {
    return {
      nested: {
        value: "step1-data",
      },
    };
  },
});

// Step 2: Process the data from step 1
const processData = new LegacyStep({
  id: "processData",
  inputSchema: z.object({
    previousValue: z.string(),
  }),
  execute: async ({ context }) => {
    // previousValue will be available because of the variable mapping
    const { previousValue } = context.inputData;

    return {
      result: `Processed: ${previousValue}`,
    };
  },
});

// Create the workflow
const workflow = new LegacyWorkflow({
  name: "step-mapping",
});

// Map data from step1 to step2
workflow
  .step(generateData)
  .then(processData, {
    variables: {
      // Map the nested.value property from generateData's output
      previousValue: { step: generateData, path: "nested.value" },
    },
  })
  .commit();

// Register the workflow with Mastra
export const mastra = new Mastra({
  legacy_workflows: { workflow },
});
```

## Type Safety [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#type-safety)

Mastra provides type safety for variable mappings when using TypeScript:

src/mastra/workflows/type-safe.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core";
import { LegacyStep, LegacyWorkflow } from "@mastra/core/workflows/legacy";
import { z } from "zod";

// Define schemas for better type safety
const triggerSchema = z.object({
  inputValue: z.string(),
});

type TriggerType = z.infer<typeof triggerSchema>;

// Step with typed context
const step1 = new LegacyStep({
  id: "step1",
  outputSchema: z.object({
    nested: z.object({
      value: z.string(),
    }),
  }),
  execute: async ({ context }) => {
    // TypeScript knows the shape of triggerData
    const triggerData = context.getStepResult<TriggerType>("trigger");

    return {
      nested: {
        value: `processed-${triggerData?.inputValue}`,
      },
    };
  },
});

// Create the workflow with the schema
const workflow = new LegacyWorkflow({
  name: "type-safe-workflow",
  triggerSchema,
});

workflow.step(step1).commit();

// Register the workflow with Mastra
export const mastra = new Mastra({
  legacy_workflows: { workflow },
});
```

## Best Practices [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#best-practices)

1. **Validate Inputs and Outputs**: Use `inputSchema` and `outputSchema` to ensure data consistency.

2. **Keep Mappings Simple**: Avoid overly complex nested paths when possible.

3. **Consider Default Values**: Handle cases where mapped data might be undefined.


## Comparison with Direct Context Access [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/variables\#comparison-with-direct-context-access)

While you can access previous step results directly via `context.steps`, using variable mappings offers several advantages:

| Feature | Variable Mapping | Direct Context Access |
| --- | --- | --- |
| Clarity | Explicit data dependencies | Implicit dependencies |
| Reusability | Steps can be reused with different mappings | Steps are tightly coupled |
| Type Safety | Better TypeScript integration | Requires manual type assertions |

[Installation](https://mastra.ai/en/docs/getting-started/installation "Installation")