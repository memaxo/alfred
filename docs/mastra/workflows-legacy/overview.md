---
title: Handling Complex LLM Operations | Workflows (Legacy) | Mastra
url: 
description: Workflows in Mastra help you orchestrate complex sequences of operations with features like branching, parallel execution, resource suspension, and more.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/workflows-legacy/overview#nextra-skip-nav)

Docs

Copy page

# Handling Complex LLM Operations with Workflows (Legacy)

All the legacy workflow documentation is available on the links below.

- [Steps](https://mastra.ai/docs/workflows-legacy/steps)
- [Control Flow](https://mastra.ai/docs/workflows-legacy/control-flow)
- [Variables](https://mastra.ai/docs/workflows-legacy/variables)
- [Suspend & Resume](https://mastra.ai/docs/workflows-legacy/suspend-and-resume)
- [Dynamic Workflows](https://mastra.ai/docs/workflows-legacy/dynamic-workflows)
- [Error Handling](https://mastra.ai/docs/workflows-legacy/error-handling)
- [Nested Workflows](https://mastra.ai/docs/workflows-legacy/nested-workflows)
- [Runtime/Dynamic Variables](https://mastra.ai/docs/workflows-legacy/runtime-variables)

Workflows in Mastra help you orchestrate complex sequences of operations with features like branching, parallel execution, resource suspension, and more.

## When to use workflows [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#when-to-use-workflows)

Most AI applications need more than a single call to a language model. You may want to run multiple steps, conditionally skip certain paths, or even pause execution altogether until you receive user input. Sometimes your agent tool calling is not accurate enough.

Mastra’s workflow system provides:

- A standardized way to define steps and link them together.
- Support for both simple (linear) and advanced (branching, parallel) paths.
- Debugging and observability features to track each workflow run.

## Example [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#example)

To create a workflow, you define one or more steps, link them, and then commit the workflow before starting it.

### Breaking Down the Workflow (Legacy) [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#breaking-down-the-workflow-legacy)

Let’s examine each part of the workflow creation process:

#### 1\. Creating the Workflow [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#1-creating-the-workflow)

Here’s how you define a workflow in Mastra. The `name` field determines the workflow’s API endpoint ( `/workflows/$NAME/`), while the `triggerSchema` defines the structure of the workflow’s trigger data:

src/mastra/workflow/index.ts

```nextra-code

import { LegacyStep, LegacyWorkflow } from "@mastra/core/workflows/legacy";

const myWorkflow = new LegacyWorkflow({
  name: "my-workflow",
  triggerSchema: z.object({
    inputValue: z.number(),
  }),
});
```

#### 2\. Defining Steps [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#2-defining-steps)

Now, we’ll define the workflow’s steps. Each step can have its own input and output schemas. Here, `stepOne` doubles an input value, and `stepTwo` increments that result if `stepOne` was successful. (To keep things simple, we aren’t making any LLM calls in this example):

src/mastra/workflow/index.ts

```nextra-code

const stepOne = new LegacyStep({
  id: "stepOne",
  outputSchema: z.object({
    doubledValue: z.number(),
  }),
  execute: async ({ context }) => {
    const doubledValue = context.triggerData.inputValue * 2;
    return { doubledValue };
  },
});

const stepTwo = new LegacyStep({
  id: "stepTwo",
  execute: async ({ context }) => {
    const doubledValue = context.getStepResult(stepOne)?.doubledValue;
    if (!doubledValue) {
      return { incrementedValue: 0 };
    }
    return {
      incrementedValue: doubledValue + 1,
    };
  },
});
```

#### 3\. Linking Steps [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#3-linking-steps)

Now, let’s create the control flow, and “commit” (finalize the workflow). In this case, `stepOne` runs first and is followed by `stepTwo`.

src/mastra/workflow/index.ts

```nextra-code

myWorkflow.step(stepOne).then(stepTwo).commit();
```

### Register the Workflow [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#register-the-workflow)

Register your workflow with Mastra to enable logging and telemetry:

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  legacy_workflows: { myWorkflow },
});
```

The workflow can also have the mastra instance injected into the context in the case where you need to create dynamic workflows:

src/mastra/workflow/index.ts

```nextra-code

import { Mastra } from "@mastra/core";
import { LegacyWorkflow } from "@mastra/core/workflows/legacy";

const mastra = new Mastra();

const myWorkflow = new LegacyWorkflow({
  name: "my-workflow",
  mastra,
});
```

### Executing the Workflow [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#executing-the-workflow)

Execute your workflow programmatically or via API:

src/mastra/run-workflow.ts

```nextra-code [counter-reset:line]

import { mastra } from "./index";

// Get the workflow
const myWorkflow = mastra.legacy_getWorkflow("myWorkflow");
const { runId, start } = myWorkflow.createRun();

// Start the workflow execution
await start({ triggerData: { inputValue: 45 } });
```

Or use the API (requires running `mastra dev`):

// Create workflow run

```nextra-code

curl --location 'http://localhost:4111/api/workflows/myWorkflow/start-async' \
     --header 'Content-Type: application/json' \
     --data '{
       "inputValue": 45
     }'
```

This example shows the essentials: define your workflow, add steps, commit the workflow, then execute it.

## Defining Steps [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#defining-steps)

The basic building block of a workflow [is a step](https://mastra.ai/en/docs/workflows-legacy/steps). Steps are defined using schemas for inputs and outputs, and can fetch prior step results.

## Control Flow [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#control-flow)

Workflows let you define a [control flow](https://mastra.ai/en/docs/workflows-legacy/control-flow) to chain steps together in with parallel steps, branching paths, and more.

## Workflow Variables [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#workflow-variables)

When you need to map data between steps or create dynamic data flows, [workflow variables](https://mastra.ai/en/docs/workflows-legacy/variables) provide a powerful mechanism for passing information from one step to another and accessing nested properties within step outputs.

## Suspend and Resume [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#suspend-and-resume)

When you need to pause execution for external data, user input, or asynchronous events, Mastra [supports suspension at any step](https://mastra.ai/en/docs/workflows-legacy/suspend-and-resume), persisting the state of the workflow so you can resume it later.

## Observability and Debugging [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#observability-and-debugging)

Mastra workflows automatically [log the input and output of each step within a workflow run](https://mastra.ai/en/reference/observability/otel-config), allowing you to send this data to your preferred logging, telemetry, or observability tools.

You can:

- Track the status of each step (e.g., `success`, `error`, or `suspended`).
- Store run-specific metadata for analysis.
- Integrate with third-party observability platforms like Datadog or New Relic by forwarding logs.

## More Resources [Permalink for this section](https://mastra.ai/en/docs/workflows-legacy/overview\#more-resources)

- [Sequential Steps workflow example](https://mastra.ai/en/examples/workflows_legacy/sequential-steps)
- [Parallel Steps workflow example](https://mastra.ai/en/examples/workflows_legacy/parallel-steps)
- [Branching Paths workflow example](https://mastra.ai/en/examples/workflows_legacy/branching-paths)
- [Workflow Variables example](https://mastra.ai/en/examples/workflows_legacy/workflow-variables)
- [Cyclical Dependencies workflow example](https://mastra.ai/en/examples/workflows_legacy/cyclical-dependencies)
- [Suspend and Resume workflow example](https://mastra.ai/en/examples/workflows_legacy/suspend-and-resume)

[Installation](https://mastra.ai/en/docs/getting-started/installation "Installation")