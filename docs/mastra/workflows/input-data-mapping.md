---
title: Input Data Mapping with Workflow | Mastra Docs
url: 
description: Learn how to use workflow input mapping to create more dynamic data flows in your Mastra workflows.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/workflows/input-data-mapping#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Workflows](https://mastra.ai/en/docs/workflows/overview "Workflows") Input Data Mapping

Copy page

# Input Data Mapping

Input data mapping allows explicit mapping of values for the inputs of the next step. These values can come from a number of sources:

- The outputs of a previous step
- The runtime context
- A constant value
- The initial input of the workflow

## Mapping with `.map()` [Permalink for this section](https://mastra.ai/en/docs/workflows/input-data-mapping\#mapping-with-map)

In this example the `output` from `step1` is transformed to match the `inputSchema` required for the `step2`. The value from `step1` is available using the `inputData` parameter of the `.map` function.

![Mapping with .map()](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fworkflows-data-mapping-map.9107cb59.jpg&w=3840&q=75)

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

const step1 = createStep({...});
const step2 = createStep({...});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .map(async ({ inputData }) => {
    const { value } = inputData;
    return {
      output: `new ${value}`
    };
  })
  .then(step2)
  .commit();
```

## Using `inputData` [Permalink for this section](https://mastra.ai/en/docs/workflows/input-data-mapping\#using-inputdata)

Use `inputData` to access the full output of the previous step:

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

  .then(step1)
  .map(({ inputData }) => {
    console.log(inputData);
  })
```

## Using `getStepResult()` [Permalink for this section](https://mastra.ai/en/docs/workflows/input-data-mapping\#using-getstepresult)

Use `getStepResult` to access the full output of a specific step by referencing the step’s instance:

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

  .then(step1)
  .map(async ({ getStepResult }) => {
    console.log(getStepResult(step1));
  })
```

## Using `getInitData()` [Permalink for this section](https://mastra.ai/en/docs/workflows/input-data-mapping\#using-getinitdata)

Use `getInitData` to access the initial input data provided to the workflow:

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

  .then(step1)
  .map(async ({ getInitData }) => {
      console.log(getInitData());
  })
```

## Using `mapVariable()` [Permalink for this section](https://mastra.ai/en/docs/workflows/input-data-mapping\#using-mapvariable)

To use `mapVariable` import the necessary function from the workflows module:

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { mapVariable } from "@mastra/core/workflows";
```

### Renaming step with `mapVariable()` [Permalink for this section](https://mastra.ai/en/docs/workflows/input-data-mapping\#renaming-step-with-mapvariable)

You can rename step outputs using the object syntax in `.map()`. In the example below, the `value` output from `step1` is renamed to `details`:

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

  .then(step1)
  .map({
    details: mapVariable({
      step: step,
      path: "value"
    })
  })
```

### Renaming workflows with `mapVariable()` [Permalink for this section](https://mastra.ai/en/docs/workflows/input-data-mapping\#renaming-workflows-with-mapvariable)

You can rename workflow outputs by using **referential composition**. This involves passing the workflow instance as the `initData`.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

export const testWorkflow = createWorkflow({...});

testWorkflow
  .then(step1)
  .map({
    details: mapVariable({
      initData: testWorkflow,
      path: "value"
    })
  })
```

[Error Handling](https://mastra.ai/en/docs/workflows/error-handling "Error Handling") [Agents and Tools](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools "Agents and Tools")