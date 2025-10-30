---
title: Branching, Merging, Conditions | Workflows | Mastra Docs
url: 
description: Control flow in Mastra workflows allows you to manage branching, merging, and conditions to construct workflows that meet your logic requirements.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/workflows/control-flow#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Workflows](https://mastra.ai/en/docs/workflows/overview "Workflows") Control Flow

Copy page

# Control Flow

When you build a workflow, you typically break down operations into smaller tasks that can be linked and reused. **Steps** provide a structured way to manage these tasks by defining inputs, outputs, and execution logic.

- If the schemas match, the `outputSchema` from each step is automatically passed to the `inputSchema` of the next step.
- If the schemas don’t match, use [Input data mapping](https://mastra.ai/en/docs/workflows/input-data-mapping) to transform the `outputSchema` into the expected `inputSchema`.

## Chaining steps with `.then()` [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#chaining-steps-with-then)

Chain steps to execute sequentially using `.then()`:

![Chaining steps with .then()](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fworkflows-control-flow-then.cb5ac627.jpg&w=3840&q=75)

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .then(step2)
  .commit();
```

This does what you’d expect: it executes `step1`, then it executes `step2`.

## Simultaneous steps with `.parallel()` [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#simultaneous-steps-with-parallel)

Execute steps simultaneously using `.parallel()`:

![Concurrent steps with .parallel()](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fworkflows-control-flow-parallel.375e729f.jpg&w=3840&q=75)

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});
const step3 = createStep({...});

export const testWorkflow = createWorkflow({...})
  .parallel([step1, step2])
  .then(step3)
  .commit();
```

This executes `step1` and `step2` concurrently, then continues to `step3` after both complete.

> See [Parallel Execution with Steps](https://mastra.ai/en/examples/workflows/parallel-steps) for more information.

> 📹 Watch: How to run steps in parallel and optimize your Mastra workflow → [YouTube (3 minutes)](https://youtu.be/GQJxve5Hki4)

## Conditional logic with `.branch()` [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#conditional-logic-with-branch)

Execute steps conditionally using `.branch()`:

![Conditional branching with .branch()](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fworkflows-control-flow-branch.8d77a837.jpg&w=3840&q=75)

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const lessThanStep = createStep({...});
const greaterThanStep = createStep({...});

export const testWorkflow = createWorkflow({...})
  .branch([\
    [async ({ inputData: { value } }) => value <= 10, lessThanStep],\
    [async ({ inputData: { value } }) => value > 10, greaterThanStep]\
  ])
  .commit();
```

Branch conditions are evaluated sequentially, but steps with matching conditions are executed in parallel.

> See [Workflow with Conditional Branching](https://mastra.ai/en/examples/workflows/conditional-branching) for more information.

## Looping steps [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#looping-steps)

Workflows support two types of loops. When looping a step, or any step-compatible construct like a nested workflow, the initial `inputData` is sourced from the output of the previous step.

To ensure compatibility, the loop’s initial input must either match the shape of the previous step’s output, or be explicitly transformed using the `map` function.

- Match the shape of the previous step’s output, or
- Be explicitly transformed using the `map` function.

### Repeating with `.dowhile()` [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#repeating-with-dowhile)

Executes step repeatedly while a condition is true.

![Repeating with .dowhile()](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fworkflows-control-flow-dowhile.a4736779.jpg&w=3840&q=75)

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const counterStep = createStep({...});

export const testWorkflow = createWorkflow({...})
  .dowhile(counterStep, async ({ inputData: { number } }) => number < 10)
  .commit();
```

### Repeating with `.dountil()` [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#repeating-with-dountil)

Executes step repeatedly until a condition becomes true.

![Repeating with .dountil()](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fworkflows-control-flow-dountil.53f587be.jpg&w=3840&q=75)

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const counterStep = createStep({...});

export const testWorkflow = createWorkflow({...})
  .dountil(counterStep, async ({ inputData: { number } }) => number > 10)
  .commit();
```

### Loop management [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#loop-management)

Loop conditions can be implemented in different ways depending on how you want the loop to end. Common patterns include checking values returned in `inputData`, setting a maximum number of iterations, or aborting execution when a limit is reached.

#### Conditional loops [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#conditional-loops)

The `inputData` for a loop step is the output of a previous step. Use the values in `inputData` to determine whether the loop should continue or stop.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const counterStep = createStep({...});

export const testWorkflow = createWorkflow({...})
.dountil(nestedWorkflowStep, async ({ inputData: { userResponse } }) => userResponse === "yes")
.commit();
```

#### Limiting loops [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#limiting-loops)

The `iterationCount` tracks how many times the loop step has run. You can use this to limit the number of iterations and prevent infinite loops. Combine it with `inputData` values to stop the loop after a set number of attempts.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const counterStep = createStep({...});

export const testWorkflow = createWorkflow({...})
.dountil(nestedWorkflowStep, async ({ inputData: { userResponse, iterationCount } }) => userResponse === "yes" || iterationCount >= 10)
.commit();
```

#### Aborting loops [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#aborting-loops)

Use `iterationCount` to limit how many times a loop runs. If the count exceeds your threshold, throw an error to fail the step and stop the workflow.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const counterStep = createStep({...});

export const testWorkflow = createWorkflow({...})
.dountil(nestedWorkflowStep, async ({ inputData: { userResponse, iterationCount } }) => {
  if (iterationCount >= 10) {
    throw new Error("Maximum iterations reached");
  }
  return userResponse === "yes";
})
.commit();
```

### Repeating with `.foreach()` [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#repeating-with-foreach)

Sequentially executes the same step for each item from the `inputSchema`.

![Repeating with .foreach()](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fworkflows-control-flow-foreach.cc1e9292.jpg&w=3840&q=75)

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const mapStep = createStep({...});

export const testWorkflow = createWorkflow({...})
  .foreach(mapStep)
  .commit();
```

#### Setting concurrency limits [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#setting-concurrency-limits)

Use `concurrency` to execute steps in parallel with a limit on the number of concurrent executions.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const mapStep = createStep({...})

export const testWorkflow = createWorkflow({...})
  .foreach(mapStep, { concurrency: 2 })
  .commit();
```

## Using a nested workflow [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#using-a-nested-workflow)

Use a nested workflow as a step by passing it to `.then()`. This runs each of its steps in sequence as part of the parent workflow.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

export const nestedWorkflow = createWorkflow({...})

export const testWorkflow = createWorkflow({...})
  .then(nestedWorkflow)
  .commit();
```

## Cloning a workflow [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#cloning-a-workflow)

Use `cloneWorkflow` to duplicate an existing workflow. This lets you reuse its structure while overriding parameters like `id`.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep, cloneWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const parentWorkflow = createWorkflow({...})
const clonedWorkflow = cloneWorkflow(parentWorkflow, { id: "cloned-workflow" });

export const testWorkflow = createWorkflow({...})
  .then(step1)
  .then(clonedWorkflow)
  .commit();
```

## Example Run Instance [Permalink for this section](https://mastra.ai/en/docs/workflows/control-flow\#example-run-instance)

The following example demonstrates how to start a run with multiple inputs. Each input will pass through the `mapStep` sequentially.

src/test-workflow.ts

```nextra-code [counter-reset:line]

import { mastra } from "./mastra";

const run = await mastra.getWorkflow("testWorkflow").createRunAsync();

const result = await run.start({
  inputData: [{ number: 10 }, { number: 100 }, { number: 200 }]
});
```

To execute this run from your terminal:

```nextra-code

npx tsx src/test-workflow.ts
```

[Overviewnew](https://mastra.ai/en/docs/workflows/overview "Overview") [Suspend & Resume](https://mastra.ai/en/docs/workflows/suspend-and-resume "Suspend & Resume")