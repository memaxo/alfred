---
title: Suspend & Resume Workflows | Human-in-the-Loop | Mastra Docs
url: 
description: Suspend and resume in Mastra workflows allows you to pause execution while waiting for external input or resources.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/workflows/suspend-and-resume#nextra-skip-nav)

Loading...

[Docs](https://mastra.ai/en/docs "Docs") [Workflows](https://mastra.ai/en/docs/workflows/overview "Workflows") Suspend & Resume

Copy page

# Suspend & Resume

Workflows can be paused at any step, with their current state persisted as a snapshot in storage. Execution can then be resumed from this saved snapshot when ready. Persisting the snapshot ensures the workflow state is maintained across sessions, deployments, and server restarts, essential for workflows that may remain suspended while awaiting external input or resources.

Common scenarios for suspending workflows include:

- Waiting for human approval or input
- Pausing until external API resources become available
- Collecting additional data needed for later steps
- Rate limiting or throttling expensive operations
- Handling event-driven processes with external triggers

> **New to suspend and resume?** Watch these official video tutorials:
>
> - **[Mastering Human-in-the-Loop with Suspend & Resume](https://youtu.be/aORuNG8Tq_k)** \- Learn how to suspend workflows and accept user inputs
> - **[Building Multi-Turn Chat Interfaces with React](https://youtu.be/UMVm8YZwlxc)** \- Implement multi-turn human-involved interactions with a React chat interface

## Workflow status types [Permalink for this section](https://mastra.ai/en/docs/workflows/suspend-and-resume\#workflow-status-types)

When running a workflow, its `status` can be one of the following:

- `running` \- The workflow is currently running
- `suspended` \- The workflow is suspended
- `success` \- The workflow has completed
- `failed` \- The workflow has failed

## Suspending a workflow with `suspend()` [Permalink for this section](https://mastra.ai/en/docs/workflows/suspend-and-resume\#suspending-a-workflow-with-suspend)

To pause execution at a specific step until user input is received, use the `⁠suspend` function to temporarily halt the workflow, allowing it to resume only when the necessary data is provided.

![Suspending a workflow with suspend()](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fworkflows-suspend-resume-suspend.af7dfe3b.jpg&w=3840&q=75)

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

const step1 = createStep({
  id: "step-1",
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  }),
  resumeSchema: z.object({
    city: z.string()
  }),
  execute: async ({ resumeData, suspend }) => {
    const { city } = resumeData ?? {};

    if (!city) {
      return await suspend({});
    }

    return { output: "" };
  }
});

export const testWorkflow = createWorkflow({
  // ...
})
  .then(step1)
  .commit();
```

> For more details, check out the [Suspend workflow example](https://mastra.ai/en/examples/workflows/human-in-the-loop#suspend-workflow).

### Identifying suspended steps [Permalink for this section](https://mastra.ai/en/docs/workflows/suspend-and-resume\#identifying-suspended-steps)

To resume a suspended workflow, inspect the `suspended` array in the result to determine which step needs input:

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { mastra } from "./mastra";

const run = await mastra.getWorkflow("testWorkflow").createRunAsync();

const result = await run.start({
  inputData: {
    city: "London"
  }
});

console.log(JSON.stringify(result, null, 2));

if (result.status === "suspended") {
  const resumedResult = await run.resume({
    step: result.suspended[0],
    resumeData: {
      city: "Berlin"
    }
  });
}
```

In this case, the logic resumes the first step listed in the `suspended` array. A `step` can also be defined using it’s `id`, for example: ‘step-1’.

```nextra-code

{
  "status": "suspended",
  "steps": {
    // ...
    "step-1": {
      // ...
      "status": "suspended",
    }
  },
  "suspended": [\
    [\
      "step-1"\
    ]\
  ]
}
```

> See [Run Workflow Results](https://mastra.ai/en/docs/workflows/overview#run-workflow-results) for more details.

## Providing user feedback with suspend [Permalink for this section](https://mastra.ai/en/docs/workflows/suspend-and-resume\#providing-user-feedback-with-suspend)

When a workflow is suspended, feedback can be surfaced to the user through the `suspendSchema`. Include a reason in the `suspend` payload to explain why the workflow paused.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({
  id: "step-1",
  inputSchema: z.object({
    value: z.string()
  }),
  resumeSchema: z.object({
    confirm: z.boolean()
  }),
  suspendSchema: z.object({
    reason: z.string()
  }),
  outputSchema: z.object({
    value: z.string()
  }),
  execute: async ({ resumeData, suspend }) => {
    const { confirm } = resumeData ?? {};

    if (!confirm) {
      return await suspend({
        reason: "Confirm to continue"
      });
    }

    return { value: "" };
  }
});

export const testWorkflow = createWorkflow({
  // ...
})
  .then(step1)
  .commit();

```

In this case, the reason provided explains that the user must confirm to continue.

```nextra-code

{
  "step-1": {
    // ...
    "status": "suspended",
    "suspendPayload": {
      "reason": "Confirm to continue"
    },
  }
}
```

> See [Run Workflow Results](https://mastra.ai/en/docs/workflows/overview#run-workflow-results) for more details.

## Resuming a workflow with `resume()` [Permalink for this section](https://mastra.ai/en/docs/workflows/suspend-and-resume\#resuming-a-workflow-with-resume)

A workflow can be resumed by calling `resume` and providing the required `resumeData`. You can either explicitly specify which step to resume from, or when exactly one step is suspended, omit the `step` parameter and the workflow will automatically resume that step.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { mastra } from "./mastra";

const run = await mastra.getWorkflow("testWorkflow").createRunAsync();

const result = await run.start({
   inputData: {
    city: "London"
  }
});

console.log(JSON.stringify(result, null, 2));

if (result.status === "suspended") {
  const resumedResult = await run.resume({
    step: 'step-1',
    resumeData: {
      city: "Berlin"
    }
  });

  console.log(JSON.stringify(resumedResult, null, 2));
}
```

You can also omit the `step` parameter when exactly one step is suspended:

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

const resumedResult = await run.resume({
  resumeData: {
    city: "Berlin"
  },
  // step parameter omitted - automatically resumes the single suspended step
});
```

### Resuming nested workflows [Permalink for this section](https://mastra.ai/en/docs/workflows/suspend-and-resume\#resuming-nested-workflows)

To resume a suspended nested workflow pass the workflow instance to the `step` parameter of the `resume` function.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

const dowhileWorkflow = createWorkflow({
  id: 'dowhile-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
})
  .dountil(
    createWorkflow({
      id: 'simple-resume-workflow',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      steps: [incrementStep, resumeStep],
    })
      .then(incrementStep)
      .then(resumeStep)
      .commit(),
    async ({ inputData }) => inputData.value >= 10,
  )
  .then(
    createStep({
      id: 'final',
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ value: z.number() }),
      execute: async ({ inputData }) => ({ value: inputData.value }),
    }),
  )
  .commit();

const run = await dowhileWorkflow.createRunAsync();
const result = await run.start({ inputData: { value: 0 } });

if (result.status === "suspended") {
  const resumedResult = await run.resume({
    resumeData: { value: 2 },
    step: ['simple-resume-workflow', 'resume'],
  });

  console.log(JSON.stringify(resumedResult, null, 2));
}
```

## Using `RuntimeContext` with suspend/resume [Permalink for this section](https://mastra.ai/en/docs/workflows/suspend-and-resume\#using-runtimecontext-with-suspendresume)

When using suspend/resume with `RuntimeContext`, you can create the instance yourself, and pass it to the `start` and `resume` functions.
`RuntimeContext` is not automatically shared on a workflow run.

src/mastra/workflows/test-workflow.tss

```nextra-code [counter-reset:line]

import { RuntimeContext } from "@mastra/core/di";
import { mastra } from "./mastra";

const runtimeContext = new RuntimeContext();
const run = await mastra.getWorkflow("testWorkflow").createRunAsync();

const result = await run.start({
  inputData: { suggestions: ["London", "Paris", "New York"] },
  runtimeContext
});

if (result.status === "suspended") {
  const resumedResult = await run.resume({
    step: 'step-1',
    resumeData: { city: "New York" },
    runtimeContext
  });
}
```

[Control Flow](https://mastra.ai/en/docs/workflows/control-flow "Control Flow") [Sleep & Events](https://mastra.ai/en/docs/workflows/pausing-execution "Sleep & Events")