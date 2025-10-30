---
title: Getting started with Mastra and Express | Mastra Guides
url: 
description: A step-by-step guide to integrating Mastra with an Express backend.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/frameworks/servers/express#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Frameworks](https://mastra.ai/en/docs/frameworks/agentic-uis "Frameworks") ServersWith Express

Copy page

# Integrate Mastra in your Express project

Mastra integrates with Express, making it easy to:

- Build flexible APIs to serve AI-powered features
- Maintain full control over your server logic and routing
- Scale your backend independently of your frontend

Express can invoke Mastra directly so you don’t need to run a Mastra server alongside your Express server.

In this guide you’ll learn how to install the necessary Mastra dependencies, create an example agent, and invoke Mastra from an Express API route.

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/frameworks/servers/express\#prerequisites)

- An existing Express app set up with TypeScript
- Node.js `v20.0` or higher
- An API key from a supported [Model Provider](https://mastra.ai/docs/getting-started/model-providers)

## Adding Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/servers/express\#adding-mastra)

First, install the necessary Mastra dependencies to run an Agent. This guide uses OpenAI as its model but you can use any supported [model provider](https://mastra.ai/docs/getting-started/model-providers).

```nextra-code

npm install mastra@latest @mastra/core@latest @mastra/libsql@latest zod@^3.0.0 @ai-sdk/openai@^1.0.0
```

If not existent yet, create an `.env` file and add your OpenAI API key:

.env

```nextra-code

OPENAI_API_KEY=<your-api-key>
```

Each LLM provider uses a different env var. See [Model Capabilities](https://mastra.ai/docs/getting-started/model-capability) for more information.

Create a Mastra configuration file at `src/mastra/index.ts`:

src/mastra/index.ts

```nextra-code

import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({});
```

Create a `weatherTool` that the `weatherAgent` will use at `src/mastra/tools/weather-tool.ts`. It returns a placeholder value inside the `execute()` function (you’d put your API calls in here).

src/mastra/tools/weather-tool.ts

```nextra-code

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const weatherTool = createTool({
  id: "get-weather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City name")
  }),
  outputSchema: z.object({
    output: z.string()
  }),
  execute: async () => {
    return {
      output: "The weather is sunny"
    };
  }
});
```

Add a `weatherAgent` at `src/mastra/agents/weather-agent.ts`:

src/mastra/agents/weather-agent.ts

```nextra-code

import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { weatherTool } from "../tools/weather-tool";

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn’t in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative

      Use the weatherTool to fetch current weather data.
`,
  model: openai('gpt-4o-mini'),
  tools: { weatherTool }
});
```

Lastly, add the `weatherAgent` to `src/mastra/index.ts`:

src/mastra/index.ts

```nextra-code

import { Mastra } from '@mastra/core/mastra';
import { weatherAgent } from './agents/weather-agent';

export const mastra = new Mastra({
  agents: { weatherAgent },
});

```

Now you’re done with setting up the Mastra boilerplate code and are ready to integrate it into your Express routes.

## Using Mastra with Express [Permalink for this section](https://mastra.ai/en/docs/frameworks/servers/express\#using-mastra-with-express)

Create an `/api/weather` endpoint that expects a `city` query parameter. The `city` parameter will be passed to the `weatherAgent` when asking it through a prompt.

You might have a file like this in your existing project:

src/server.ts

```nextra-code

import express, { Request, Response } from 'express';

const app = express();
const port = 3456;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, world!');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
```

Adding the `/api/weather` endpoint looks like this:

src/server.ts

```nextra-code

import express, { Request, Response } from 'express';
import { mastra } from "./mastra"

const app = express();
const port = 3456;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, world!');
});

app.get("/api/weather", async (req: Request, res: Response) => {
  const { city } = req.query as { city?: string };

  if (!city) {
    return res.status(400).send("Missing 'city' query parameter");
  }

  const agent = mastra.getAgent("weatherAgent");

  try {
    const result = await agent.generate(`What's the weather like in ${city}?`);
    res.send(result.text);
  } catch (error) {
    console.error("Agent error:", error);
    res.status(500).send("An error occurred while processing your request");
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
```

By importing the `src/mastra/index.ts` file you can use methods like [`.getAgent()`](https://mastra.ai/reference/agents/getAgent) to get programmatic access. With [`.generate()`](https://mastra.ai/reference/agents/generate) you then can interact with the respective agent.

Read the [Agent reference docs](https://mastra.ai/reference/agents/agent) to learn more.

Start your Express server and visit the `/api/weather` endpoint. For example:

```nextra-code

http://localhost:3456/api/weather?city=London
```

You should get a response back similar to this:

```nextra-code

The weather in London is currently sunny. If you need more details like humidity, wind conditions, or precipitation, just let me know!
```

## Running the Agent Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/servers/express\#running-the-agent-server)

In production it’s not necessary to run Mastra alongside your Express server. But for development Mastra offers a [Local Development Environment](https://mastra.ai/docs/server-db/local-dev-playground) which you can use to improve and debug your agent.

Add a script to your `package.json`:

package.json

```nextra-code

{
  "scripts": {
    "mastra:dev": "mastra dev"
  },
}
```

Start the Mastra playground:

```nextra-code

npm run mastra:dev
```

[With OpenRouter](https://mastra.ai/en/docs/frameworks/agentic-uis/openrouter "With OpenRouter") [With Vite/React](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react "With Vite/React")