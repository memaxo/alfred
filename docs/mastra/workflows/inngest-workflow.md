---
title: Inngest Workflows | Workflows | Mastra Docs
url: 
description: Inngest workflow allows you to run Mastra workflows with Inngest
language: en
---
[Skip to Content](https://mastra.ai/en/docs/workflows/inngest-workflow#nextra-skip-nav)

Loading...

[Docs](https://mastra.ai/en/docs "Docs") [Workflows](https://mastra.ai/en/docs/workflows/overview "Workflows") Inngest Workflowexp.

Copy page

# Inngest Workflow

[Inngest](https://www.inngest.com/docs) is a developer platform for building and running background workflows, without managing infrastructure.

## How Inngest Works with Mastra [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#how-inngest-works-with-mastra)

Inngest and Mastra integrate by aligning their workflow models: Inngest organizes logic into functions composed of steps, and Mastra workflows defined using `createWorkflow` and `createStep` map directly onto this paradigm. Each Mastra workflow becomes an Inngest function with a unique identifier, and each step within the workflow maps to an Inngest step.

The `serve` function bridges the two systems by registering Mastra workflows as Inngest functions and setting up the necessary event handlers for execution and monitoring.

When an event triggers a workflow, Inngest executes it step by step, memoizing each step’s result. This means if a workflow is retried or resumed, completed steps are skipped, ensuring efficient and reliable execution. Control flow primitives in Mastra, such as loops, conditionals, and nested workflows are seamlessly translated into the same Inngest’s function/step model, preserving advanced workflow features like composition, branching, and suspension.

Real-time monitoring, suspend/resume, and step-level observability are enabled via Inngest’s publish-subscribe system and dashboard. As each step executes, its state and output are tracked using Mastra storage and can be resumed as needed.

## Setup [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#setup)

```nextra-code

npm install @mastra/inngest @mastra/core @mastra/deployer
```

## Building an Inngest Workflow [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#building-an-inngest-workflow)

This guide walks through creating a workflow with Inngest and Mastra, demonstrating a counter application that increments a value until it reaches 10.

### Inngest Initialization [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#inngest-initialization)

Initialize the Inngest integration to obtain Mastra-compatible workflow helpers. The createWorkflow and createStep functions are used to create workflow and step objects that are compatible with Mastra and inngest.

In development

src/mastra/inngest/index.ts

```nextra-code [counter-reset:line]

import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime";

export const inngest = new Inngest({
  id: "mastra",
  baseUrl:"http://localhost:8288",
  isDev: true,
  middleware: [realtimeMiddleware()],
});
```

In production

src/mastra/inngest/index.ts

```nextra-code [counter-reset:line]

import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime";

export const inngest = new Inngest({
  id: "mastra",
  middleware: [realtimeMiddleware()],
});
```

### Creating Steps [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#creating-steps)

Define the individual steps that will compose your workflow:

src/mastra/workflows/index.ts

```nextra-code [counter-reset:line]

import { z } from "zod";
import { inngest } from "../inngest";
import { init } from "@mastra/inngest";

// Initialize Inngest with Mastra, pointing to your local Inngest server
const { createWorkflow, createStep } = init(inngest);

// Step: Increment the counter value
const incrementStep = createStep({
  id: "increment",
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    return { value: inputData.value + 1 };
  },
});
```

### Creating the Workflow [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#creating-the-workflow)

Compose the steps into a workflow using the `dountil` loop pattern. The createWorkflow function creates a function on inngest server that is invocable.

src/mastra/workflows/index.ts

```nextra-code [counter-reset:line]

// workflow that is registered as a function on inngest server
const workflow = createWorkflow({
  id: "increment-workflow",
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
}).then(incrementStep);

workflow.commit();

export { workflow as incrementWorkflow };
```

### Configuring the Mastra Instance and Executing the Workflow [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#configuring-the-mastra-instance-and-executing-the-workflow)

Register the workflow with Mastra and configure the Inngest API endpoint:

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { serve as inngestServe } from "@mastra/inngest";
import { incrementWorkflow } from "./workflows";
import { inngest } from "./inngest";
import { PinoLogger } from "@mastra/loggers";

// Configure Mastra with the workflow and Inngest API endpoint
export const mastra = new Mastra({
  workflows: {
    incrementWorkflow,
  },
  server: {
    // The server configuration is required to allow local docker container can connect to the mastra server
    host: "0.0.0.0",
    apiRoutes: [\
      // This API route is used to register the Mastra workflow (inngest function) on the inngest server\
      {\
        path: "/api/inngest",\
        method: "ALL",\
        createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),\
        // The inngestServe function integrates Mastra workflows with Inngest by:\
        // 1. Creating Inngest functions for each workflow with unique IDs (workflow.${workflowId})\
        // 2. Setting up event handlers that:\
        //    - Generate unique run IDs for each workflow execution\
        //    - Create an InngestExecutionEngine to manage step execution\
        //    - Handle workflow state persistence and real-time updates\
        // 3. Establishing a publish-subscribe system for real-time monitoring\
        //    through the workflow:${workflowId}:${runId} channel\
        //\
        // Optional: You can also pass additional Inngest functions to serve alongside workflows:\
        // createHandler: async ({ mastra }) => inngestServe({\
        //   mastra,\
        //   inngest,\
        //   functions: [customFunction1, customFunction2] // User-defined Inngest functions\
        // }),\
      },\
    ],
  },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
```

### Running the Workflow locally [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#running-the-workflow-locally)

> **Prerequisites:**
>
> - Docker installed and running
> - Mastra project set up
> - Dependencies installed ( `npm install`)

1. Run `npx mastra dev` to start the Mastra server on local to serve the server on port 4111.
2. Start the Inngest Dev Server (via Docker)
In a new terminal, run:

```nextra-code

docker run --rm -p 8288:8288 \
  inngest/inngest \
  inngest dev -u http://host.docker.internal:4111/api/inngest
```

> **Note:** The URL after `-u` tells the Inngest dev server where to find your Mastra `/api/inngest` endpoint.

3. Open the Inngest Dashboard

- Visit [http://localhost:8288](http://localhost:8288/) in your browser.
- Go to the **Apps** section in the sidebar.
- You should see your Mastra workflow registered.
![Inngest Dashboard](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Finngest-apps-dashboard.51ffcb17.png&w=3840&q=75)

4. Invoke the Workflow

- Go to the **Functions** section in the sidebar.
- Select your Mastra workflow.
- Click **Invoke** and use the following input:

```nextra-code

{
  "data": {
    "inputData": {
      "value": 5
    }
  }
}
```

![Inngest Function](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Finngest-function-dashboard.3ed070e6.png&w=3840&q=75)

5. **Monitor the Workflow Execution**

- Go to the **Runs** tab in the sidebar.
- Click on the latest run to see step-by-step execution progress.
![Inngest Function Run](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Finngest-runs-dashboard.7b41fb02.png&w=3840&q=75)

### Running the Workflow in Production [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#running-the-workflow-in-production)

> **Prerequisites:**
>
> - Vercel account and Vercel CLI installed ( `npm i -g vercel`)
> - Inngest account
> - Vercel token (recommended: set as environment variable)

1. Add Vercel Deployer to Mastra instance

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { VercelDeployer } from "@mastra/deployer-vercel";

export const mastra = new Mastra({
  // ...other config
  deployer: new VercelDeployer({
    teamSlug: "your_team_slug",
    projectName: "your_project_name",
    // you can get your vercel token from the vercel dashboard by clicking on the user icon in the top right corner
    // and then clicking on "Account Settings" and then clicking on "Tokens" on the left sidebar.
    token: "your_vercel_token",
  }),
});
```

> **Note:** Set your Vercel token in your environment:
>
> ```nextra-code
>
> export VERCEL_TOKEN=your_vercel_token
> ```

2. Build the mastra instance

```nextra-code

npx mastra build
```

3. Deploy to Vercel

```nextra-code

cd .mastra/output
vercel --prod
```

> **Tip:** If you haven’t already, log in to Vercel CLI with `vercel login`.

4. Sync with Inngest Dashboard

- Go to the [Inngest dashboard](https://app.inngest.com/env/production/apps).
- Click **Sync new app with Vercel** and follow the instructions.
- You should see your Mastra workflow registered as an app.
![Inngest Dashboard](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Finngest-apps-dashboard-prod.ad274d10.png&w=3840&q=75)

5. Invoke the Workflow

- In the **Functions** section, select `workflow.increment-workflow`.
- Click **All actions** (top right) > **Invoke**.
- Provide the following input:

```nextra-code

{
  "data": {
    "inputData": {
      "value": 5
    }
  }
}
```

![Inngest Function Run](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Finngest-function-dashboard-prod.2d247fe2.png&w=3840&q=75)

6. Monitor Execution

- Go to the **Runs** tab.
- Click the latest run to see step-by-step execution progress.
![Inngest Function Run](https://mastra.ai/_next/image?url=%2Fdocs%2F_next%2Fstatic%2Fmedia%2Finngest-runs-dashboard-prod.6f48aed8.png&w=3840&q=75)

## Advanced Usage: Adding Custom Inngest Functions [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#advanced-usage-adding-custom-inngest-functions)

You can serve additional Inngest functions alongside your Mastra workflows by using the optional `functions` parameter in `inngestServe`.

### Creating Custom Functions [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#creating-custom-functions)

First, create your custom Inngest functions:

src/inngest/custom-functions.ts

```nextra-code [counter-reset:line]

import { inngest } from "./inngest";

// Define custom Inngest functions
export const customEmailFunction = inngest.createFunction(
  { id: 'send-welcome-email' },
  { event: 'user/registered' },
  async ({ event }) => {
    // Custom email logic here
    console.log(`Sending welcome email to ${event.data.email}`);
    return { status: 'email_sent' };
  }
);

export const customWebhookFunction = inngest.createFunction(
  { id: 'process-webhook' },
  { event: 'webhook/received' },
  async ({ event }) => {
    // Custom webhook processing
    console.log(`Processing webhook: ${event.data.type}`);
    return { processed: true };
  }
);
```

### Serving Custom Functions with Workflows [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#serving-custom-functions-with-workflows)

Update your Mastra configuration to include the custom functions:

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { serve as inngestServe } from "@mastra/inngest";
import { incrementWorkflow } from "./workflows";
import { inngest } from "./inngest";
import { customEmailFunction, customWebhookFunction } from "./inngest/custom-functions";

export const mastra = new Mastra({
  workflows: {
    incrementWorkflow,
  },
  server: {
    host: "0.0.0.0",
    apiRoutes: [\
      {\
        path: "/api/inngest",\
        method: "ALL",\
        createHandler: async ({ mastra }) => inngestServe({\
          mastra,\
          inngest,\
          functions: [customEmailFunction, customWebhookFunction] // Add your custom functions\
        }),\
      },\
    ],
  },
});
```

### Function Registration [Permalink for this section](https://mastra.ai/en/docs/workflows/inngest-workflow\#function-registration)

When you include custom functions:

1. **Mastra workflows** are automatically converted to Inngest functions with IDs like `workflow.${workflowId}`
2. **Custom functions** retain their specified IDs (e.g., `send-welcome-email`, `process-webhook`)
3. **All functions** are served together on the same `/api/inngest` endpoint

This allows you to combine Mastra’s workflow orchestration with your existing Inngest functions seamlessly.

[Agents and Tools](https://mastra.ai/en/docs/workflows/using-with-agents-and-tools "Agents and Tools") [Overview](https://mastra.ai/en/docs/workflows-legacy/overview "Overview")