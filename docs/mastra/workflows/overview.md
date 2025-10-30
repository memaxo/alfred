---
title: Handling Complex LLM Operations | Workflows | Mastra
url: 
description: Workflows in Mastra help you orchestrate complex sequences of tasks with features like branching, parallel execution, resource suspension, and more.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/workflows/overview#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") WorkflowsOverviewnew

Copy page

# Workflows overview

Workflows allow you to define and manage complex sequences of tasks by connecting them with clear, structured processes. Unlike a single agent, which operates independently, workflows enable you to orchestrate multiple steps with specific logic, tools, and external services. This approach provides more control and predictability, ensuring consistent results by allowing you to determine what tasks are performed and when they are completed.

![Workflows overview](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Fworkflows-overview.ca3dcd30.jpg&w=3840&q=75)

## When to use a workflow [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#when-to-use-a-workflow)

For example, you might want to perform a sequence of tasks:

1. Handle a user question like “Can I return my last order?”
2. Fetch user-specific data from a database using their `user_id`.
3. Check return eligibility via an external API or business logic.
4. Make a conditional decision (e.g. approve, deny, escalate) based on the data.
5. Generate a tailored response based on the outcome.

Each of these tasks is created as a **step** in a workflow, giving you fine-grained control over data flow, execution order, and side effects.

> **📹 Watch**: → An introduction to workflows, and how they compare to agents [YouTube (7 minutes)](https://youtu.be/0jg2g3sNvgw)

## Building workflows [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#building-workflows)

You create workflows by:

- Defining **steps** with `createStep`, specifying input/output schemas and business logic.
- Composing **steps** with `createWorkflow` to define the execution flow.
- Running **workflows** to execute the entire sequence, with built-in support for suspension, resumption, and streaming results.

This structure provides full type safety and runtime validation, ensuring data integrity across the entire workflow.

### Visual testing [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#visual-testing)

Use the [Playground](https://mastra.ai/en/docs/server-db/local-dev-playground#workflows) to visualize workflow execution in real time. It shows which steps are running, completed, or suspended.

## Getting started [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#getting-started)

To use workflows, install the required dependencies:

```nextra-code

npm install @mastra/core
```

Import the necessary functions from the `workflows` subpath:

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
```

### Create step [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#create-step)

Steps are the building blocks of workflows. Create a step using `createStep`:

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

const step1 = createStep({...});
```

> See [createStep](https://mastra.ai/en/reference/workflows/step) for more information.

### Create workflow [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#create-workflow)

Create a workflow using `createWorkflow` and complete it with `.commit()`.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  description: 'Test workflow',
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  })
})
  .then(step1)
  .commit();
```

> See [workflow](https://mastra.ai/en/reference/workflows/workflow) for more information.

#### Composing steps [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#composing-steps)

Workflow steps can be composed and executed sequentially using `.then()`.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  description: 'Test workflow',
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  })
})
  .then(step1)
  .then(step2)
  .commit();
```

> Steps can be composed using a number of different methods. See [Control Flow](https://mastra.ai/en/docs/workflows/control-flow) for more information.

#### Cloning steps [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#cloning-steps)

Workflow steps can be cloned using `cloneStep()`, and used with any workflow method.

src/mastra/workflows/test-workflow.ts

```nextra-code [counter-reset:line]

import { createWorkflow, createStep, cloneStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const clonedStep = cloneStep(step1, { id: "cloned-step" });
const step2 = createStep({...});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  description: 'Test workflow',
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  })
})
  .then(step1)
  .then(clonedStep)
  .then(step2)
  .commit();
```

## Register workflow [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#register-workflow)

Register a workflow using `workflows` in the main Mastra instance:

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";

import { testWorkflow } from "./workflows/test-workflow";

export const mastra = new Mastra({
  workflows: { testWorkflow },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:"
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info"
  })
});
```

## Testing workflows locally [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#testing-workflows-locally)

There are two ways to run and test workflows.

### Mastra Playground [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#mastra-playground)

With the Mastra Dev Server running you can run the workflow from the Mastra Playground by visiting [http://localhost:4111/workflows](http://localhost:4111/workflows) in your browser.

> For more information, see the [Local Dev Playground](https://mastra.ai/en/docs/server-db/local-dev-playground) documentation.

### Command line [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#command-line)

Create a workflow run instance using `createRunAsync` and `start`:

src/test-workflow.ts

```nextra-code [counter-reset:line]

import "dotenv/config";

import { mastra } from "./mastra";

const run = await mastra.getWorkflow("testWorkflow").createRunAsync();

const result = await run.start({
  inputData: {
    city: "London"
  }
});

console.log(result);

if (result.status === 'success') {
  console.log(result.result.output);
}
```

> see [createRunAsync](https://mastra.ai/en/reference/workflows/run) and [start](https://mastra.ai/en/reference/workflows/run-methods/start) for more information.

To trigger this workflow, run the following:

```nextra-code

npx tsx src/test-workflow.ts
```

### Run workflow results [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#run-workflow-results)

The result of running a workflow using either `start()` or `resume()` will look like one of the following, depending on the outcome.

#### Status success [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#status-success)

```nextra-code

{
  "status": "success",
  "steps": {
    // ...
    "step-1": {
      // ...
      "status": "success",
    }
  },
  "result": {
    "output": "London + step-1"
  }
}
```

- **status**: Shows the final state of the workflow execution, either: `success`, `suspended`, or `error`
- **steps**: Lists each step in the workflow, including inputs and outputs
- **status**: Shows the outcome of each individual step
- **result**: Includes the final output of the workflow, typed according to the `outputSchema`

#### Status suspended [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#status-suspended)

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

- **suspended**: An optional array listing any steps currently awaiting input before continuing

#### Status failed [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#status-failed)

```nextra-code

{
  "status": "failed",
  "steps": {
    // ...
    "step-1": {
      // ...
      "status": "failed",
      "error": "Test error",
    }
  },
  "error": "Test error"
}
```

- **error**: An optional field that includes the error message if the workflow fails

## Stream workflow [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#stream-workflow)

Similar to the run method shown above, workflows can also be streamed:

src/test-workflow.ts

```nextra-code [counter-reset:line]

import { mastra } from "./mastra";

const run = await mastra.getWorkflow("testWorkflow").createRunAsync();

const result = await run.stream({
  inputData: {
    city: "London"
  }
});

for await (const chunk of result.stream) {
  console.log(chunk);
}
```

> See [stream](https://mastra.ai/en/reference/workflows/run-methods/stream) for more information.

## Watch Workflow [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#watch-workflow)

A workflow can also be watched, allowing you to inspect each event that is emitted.

src/test-workflow.ts

```nextra-code [counter-reset:line]

import { mastra } from "./mastra";

const run = await mastra.getWorkflow("testWorkflow").createRunAsync();

run.watch((event) => {
  console.log(event);
});

const result = await run.start({
  inputData: {
    city: "London"
  }
});
```

> See [watch](https://mastra.ai/en/reference/workflows/run-methods/watch) for more information.

## Related [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#related)

- The [Workflow Guide](https://mastra.ai/en/guides/guide/ai-recruiter) in the Guides section is a tutorial that covers the main concepts.
- [Parallel Steps workflow example](https://mastra.ai/en/examples/workflows/parallel-steps)
- [Conditional Branching workflow example](https://mastra.ai/en/examples/workflows/conditional-branching)
- [Inngest workflow example](https://mastra.ai/en/examples/workflows/inngest-workflow)
- [Suspend and Resume workflow example](https://mastra.ai/en/examples/workflows/human-in-the-loop)

## Workflows (Legacy) [Permalink for this section](https://mastra.ai/en/docs/workflows/overview\#workflows-legacy)

For legacy workflow documentation, see [Workflows (Legacy)](https://mastra.ai/en/docs/workflows-legacy/overview).

[Adding Voice](https://mastra.ai/en/docs/agents/adding-voice "Adding Voice") [Control Flow](https://mastra.ai/en/docs/workflows/control-flow "Control Flow")