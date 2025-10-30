---
title: Installing Mastra | Getting Started | Mastra Docs
url: 
description: Guide on installing Mastra and setting up the necessary prerequisites for running it with various LLM providers.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/getting-started/installation#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") Getting StartedInstallation

Copy page

# Install Mastra

To get started with Mastra, you’ll need access to a large language model (LLM). By default, Mastra is set up to work with [OpenAI](https://platform.openai.com/), so you’ll need an API key to begin.

Mastra also supports other LLM providers. For a full list of supported models and setup instructions, see [Model Providers](https://mastra.ai/docs/getting-started/model-providers).

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#prerequisites)

- Node.js `v20.0` or higher
- An API key from a supported [Model Provider](https://mastra.ai/docs/getting-started/model-providers)

## Install using the `create mastra` CLI [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#install-using-the-create-mastra-cli)

Our CLI is the fastest way to get started with Mastra. You can run `create mastra` anywhere on your machine.

## Start the CLI wizard [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#start-the-cli-wizard)

Run the following command to start the interactive setup:

npmyarnpnpmbun

```nextra-code

npx create-mastra@latest
```

```nextra-code

yarn dlx create-mastra@latest
```

```nextra-code

pnpm create mastra@latest
```

```nextra-code

bun create mastra@latest
```

**Install using CLI flags**

You can also run the Mastra CLI in non-interactive mode by passing all required flags, for example:

```nextra-code

npx create-mastra@latest --project-name hello-mastra --example --components tools,agents,workflows --llm openai
```

**Install with a template**

Start with a pre-built template that demonstrates specific use cases:

```nextra-code

npx create-mastra@latest --template template-name
```

> Browse available templates and learn more in [Templates](https://mastra.ai/docs/getting-started/templates).

For example, to create a text-to-SQL application:

```nextra-code

npx create-mastra@latest --template text-to-sql
```

> See the [create-mastra](https://mastra.ai/reference/cli/create-mastra) documentation for a full list of available CLI options.

### Add your API key [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#add-your-api-key)

Add your API key to the `.env` file:

.env

```nextra-code

OPENAI_API_KEY=<your-api-key>
```

> This example uses OpenAI. Each LLM provider uses a unique name. See [Model Capabilities](https://mastra.ai/docs/getting-started/model-capability) for more information.

### Launch the Mastra Development Server [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#launch-the-mastra-development-server)

You can now launch the [Mastra Development Server](https://mastra.ai/docs/server-db/local-dev-playground) and test your agent using the Mastra Playground.

npmyarnpnpmbunMastra CLI

```nextra-code

npm run dev
```

```nextra-code

yarn run dev
```

```nextra-code

pnpm run dev
```

```nextra-code

bun run dev
```

```nextra-code

mastra dev
```

## Install manually [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#install-manually)

The following steps will walk you through installing Mastra manually.

### Create a new project [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#create-a-new-project)

Create a new project and change directory:

```nextra-code

mkdir hello-mastra && cd hello-mastra
```

Initialize a TypeScript project including the `@mastra/core` package:

npmpnpmyarnbun

```nextra-code

npm init -y

npm install typescript tsx @types/node mastra@latest --save-dev

npm install @mastra/core@latest zod@^3 @ai-sdk/openai@^1
```

```nextra-code

pnpm init

pnpm add typescript tsx @types/node mastra@latest --save-dev

pnpm add @mastra/core@latest zod@^3 @ai-sdk/openai@^1
```

```nextra-code

yarn init -y

yarn add typescript tsx @types/node mastra@latest --dev

yarn add @mastra/core@latest zod@^3 @ai-sdk/openai@^1
```

```nextra-code

bun init -y

bun add typescript tsx @types/node mastra@latest --dev

bun add @mastra/core@latest zod@^3 @ai-sdk/openai@^1
```

Add the `dev` and `build` scripts to `package.json`:

package.json

```nextra-code

{
  "scripts": {
    // ...
    "dev": "mastra dev",
    "build": "mastra build"
  }
}
```

### Initialize TypeScript [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#initialize-typescript)

Create a `tsconfig.json` file:

```nextra-code

touch tsconfig.json
```

Add the following configuration:

Mastra requires `module` and `moduleResolution` values that support modern Node.js versions. Older settings like `CommonJS` or `node` are incompatible with Mastra’s packages and will cause resolution errors.

tsconfig.json

```nextra-code

{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "outDir": "dist"
  },
  "include": [\
    "src/**/*"\
  ]
}
```

> This TypeScript configuration is optimized for Mastra projects, using modern module resolution and strict type checking.

### Set up your API key [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#set-up-your-api-key)

Create `.env` file:

```nextra-code

touch .env
```

Add your API key:

.env

```nextra-code

OPENAI_API_KEY=<your-api-key>
```

> This example uses OpenAI. Each LLM provider uses a unique name. See [Model Capabilities](https://mastra.ai/docs/getting-started/model-capability) for more information.

### Create a Tool [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#create-a-tool)

Create a `weather-tool.ts` file:

```nextra-code

mkdir -p src/mastra/tools && touch src/mastra/tools/weather-tool.ts
```

Add the following code:

src/mastra/tools/weather-tool.ts

```nextra-code [counter-reset:line]

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

> See the full weatherTool example in [Giving an Agent a Tool](https://mastra.ai/examples/agents/using-a-tool).

### Create an Agent [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#create-an-agent)

Create a `weather-agent.ts` file:

```nextra-code

mkdir -p src/mastra/agents && touch src/mastra/agents/weather-agent.ts
```

Add the following code:

src/mastra/agents/weather-agent.ts

```nextra-code [counter-reset:line]

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

### Register the Agent [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#register-the-agent)

Create the Mastra entry point and register agent:

```nextra-code

touch src/mastra/index.ts
```

Add the following code:

src/mastra/index.ts

```nextra-code [counter-reset:line]

import { Mastra } from "@mastra/core/mastra";
import { weatherAgent } from "./agents/weather-agent";

export const mastra = new Mastra({
  agents: { weatherAgent }
});
```

You can now launch the [Mastra Development Server](https://mastra.ai/docs/server-db/local-dev-playground) and test your agent using the Mastra Playground.

## Add to an existing project [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#add-to-an-existing-project)

Mastra can be installed and integrated into a wide range of projects. Below are links to integration guides to help you get started:

- [Next.js](https://mastra.ai/docs/frameworks/web-frameworks/next-js)
- [Vite + React](https://mastra.ai/docs/frameworks/web-frameworks/vite-react)
- [Astro](https://mastra.ai/docs/frameworks/web-frameworks/astro)
- [Express](https://mastra.ai/docs/frameworks/servers/express)

### `mastra init` [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#mastra-init)

To install Mastra in an existing project, use the `mastra init` command.

> See [mastra init](https://mastra.ai/reference/cli/init) for more information.

## Next steps [Permalink for this section](https://mastra.ai/en/docs/getting-started/installation\#next-steps)

- [Local Development](https://mastra.ai/docs/server-db/local-dev-playground)
- [Deploy to Mastra Cloud](https://mastra.ai/docs/deployment/overview)

[Introduction](https://mastra.ai/en/docs "Introduction") [Project Structure](https://mastra.ai/en/docs/getting-started/project-structure "Project Structure")