---
title: Getting Started with Mastra and Astro | Mastra Guides
url: 
description: A step-by-step guide to integrating Mastra with Astro.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/frameworks/web-frameworks/astro#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Frameworks](https://mastra.ai/en/docs/frameworks/agentic-uis "Frameworks") [Web Frameworks](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react "Web Frameworks") With Astro

Copy page

# Integrate Mastra in your Astro project

Mastra integrates with Astro, making it easy to:

- Build flexible APIs to serve AI-powered features
- Simplify deployment with a unified codebase for frontend and backend
- Take advantage of Astro’s built-in [Actions](https://docs.astro.build/en/guides/actions/) or [Server Endpoints](https://docs.astro.build/en/guides/endpoints/#server-endpoints-api-routes) for efficient server-client workflows

Use this guide to scaffold and integrate Mastra with your Astro project.

ActionsServer Endpoints

### Actions

This guide assumes you’re using Astro’s Actions with React and the Vercel adapter.

## Install Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#install-mastra)

Install the required Mastra packages:

npmyarnpnpmbun

### npm

```nextra-code

npm install mastra@latest @mastra/core@latest @mastra/libsql@latest
```

### yarn

```nextra-code

yarn add mastra@latest @mastra/core@latest @mastra/libsql@latest
```

### pnpm

```nextra-code

pnpm add mastra@latest @mastra/core@latest @mastra/libsql@latest
```

### bun

```nextra-code

bun add mastra@latest @mastra/core@latest @mastra/libsql@latest
```

## Integrate Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#integrate-mastra)

To integrate Mastra into your project, you have two options:

### 1\. Use the One-Liner [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#1-use-the-one-liner)

Run the following command to quickly scaffold the default Weather agent with sensible defaults:

```nextra-code

npx mastra@latest init --default
```

> See [mastra init](https://mastra.ai/reference/cli/init) for more information.

### 2\. Use the Interactive CLI [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#2-use-the-interactive-cli)

If you prefer to customize the setup, run the `init` command and choose from the options when prompted:

```nextra-code

npx mastra@latest init
```

Add the `dev` and `build` scripts to `package.json`:

package.json

```nextra-code

{
  "scripts": {
    ...
    "dev:mastra": "mastra dev",
    "build:mastra": "mastra build"
  }
}
```

## Configure TypeScript [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#configure-typescript)

Modify the `tsconfig.json` file in your project root:

tsconfig.json

```nextra-code

{
  ...
  "exclude": ["dist", ".mastra"]
}
```

## Set Up API Key [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#set-up-api-key)

.env

```nextra-code

OPENAI_API_KEY=<your-api-key>
```

## Update .gitignore [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#update-gitignore)

Add `.mastra` and `.vercel` to your `.gitignore` file:

.gitignore

```nextra-code

.mastra
.vercel
```

## Update the Mastra Agent [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#update-the-mastra-agent)

Astro uses Vite, which accesses environment variables via `import.meta.env` rather than `process.env`. As a result, the model constructor must explicitly receive the `apiKey` from the Vite environment like this:

src/mastra/agents/weather-agent.ts

```nextra-code

- import { openai } from "@ai-sdk/openai";
+ import { createOpenAI } from "@ai-sdk/openai";

+ const openai = createOpenAI({
+   apiKey: import.meta.env?.OPENAI_API_KEY,
+   compatibility: "strict"
+ });
```

> More configuration details are available in the AI SDK docs. See [Provider Instance](https://ai-sdk.dev/providers/ai-sdk-providers/openai#provider-instance) for more information.

## Start the Mastra Dev Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#start-the-mastra-dev-server)

Start the Mastra Dev Server to expose your agents as REST endpoints:

npmCLI

### npm

```nextra-code

npm run dev:mastra
```

### CLI

```nextra-code

mastra dev:mastra
```

> Once running, your agents are available locally. See [Local Development Environment](https://mastra.ai/docs/server-db/local-dev-playground) for more information.

## Start Astro Dev Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#start-astro-dev-server)

With the Mastra Dev Server running, you can start your Astro site in the usual way.

## Create Actions Directory [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#create-actions-directory)

```nextra-code

mkdir src/actions
```

### Create Test Action [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#create-test-action)

Create a new Action, and add the example code:

```nextra-code

touch src/actions/index.ts
```

src/actions/index.ts

```nextra-code [counter-reset:line]

import { defineAction } from "astro:actions";
import { z } from "astro:schema";

import { mastra } from "../mastra";

export const server = {
  getWeatherInfo: defineAction({
    input: z.object({
      city: z.string()
    }),
    handler: async (input) => {
      const city = input.city;
      const agent = mastra.getAgent("weatherAgent");

      const result = await agent.generate(`What's the weather like in ${city}?`);

      return result.text;
    }
  })
};
```

### Create Test Form [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#create-test-form)

Create a new Form component, and add the example code:

```nextra-code

touch src/components/form.tsx
```

src/components/form.tsx

```nextra-code [counter-reset:line]

import { actions } from "astro:actions";
import { useState } from "react";

export const Form = () => {
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const city = formData.get("city")!.toString();
    const { data } = await actions.getWeatherInfo({ city });

    setResult(data || null);
  }

  return (
    <>
      <form action={handleSubmit}>
        <input name="city" placeholder="Enter city" required />
        <button type="submit">Get Weather</button>
      </form>
      {result && <pre>{result}</pre>}
    </>
  );
};
```

### Create Test Page [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#create-test-page)

Create a new Page, and add the example code:

```nextra-code

touch src/pages/test.astro
```

src/pages/test.astro

```nextra-code [counter-reset:line]

---
import { Form } from '../components/form'
---

<h1>Test</h1>
<Form client:load />
```

> You can now navigate to `/test` in your browser to try it out.

Submitting **London** as the city would return a result similar to:

```nextra-code

Agent response: The current weather in London is as follows:

- **Temperature:** 12.9°C (Feels like 9.7°C)
- **Humidity:** 63%
- **Wind Speed:** 14.7 km/h
- **Wind Gusts:** 32.4 km/h
- **Conditions:** Overcast

Let me know if you need more information!
```

### Server Endpoints

This guide assumes you’re using Astro’s Endpoints with React and the Vercel adapter, and your output is set to server.

## Prerequisites [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#prerequisites)

Before proceeding, ensure your Astro project is configured as follows:

- Astro React integration: [@astrojs/react](https://docs.astro.build/en/guides/integrations-guide/react/)
- Vercel adapter: [@astrojs/vercel](https://docs.astro.build/en/guides/integrations-guide/vercel/)
- `astro.config.mjs` is set to `output: "server"`

## Install Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#install-mastra-1)

Install the required Mastra packages:

npmyarnpnpmbun

### npm

```nextra-code

npm install mastra@latest @mastra/core@latest @mastra/libsql@latest
```

### yarn

```nextra-code

yarn add mastra@latest @mastra/core@latest @mastra/libsql@latest
```

### pnpm

```nextra-code

pnpm add mastra@latest @mastra/core@latest @mastra/libsql@latest
```

### bun

```nextra-code

bun add mastra@latest @mastra/core@latest @mastra/libsql@latest
```

## Integrate Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#integrate-mastra-1)

To integrate Mastra into your project, you have two options:

### 1\. Use the One-Liner [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#1-use-the-one-liner-1)

Run the following command to quickly scaffold the default Weather agent with sensible defaults:

```nextra-code

npx mastra@latest init --default
```

> See [mastra init](https://mastra.ai/reference/cli/init) for more information.

### 2\. Use the Interactive CLI [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#2-use-the-interactive-cli-1)

If you prefer to customize the setup, run the `init` command and choose from the options when prompted:

```nextra-code

npx mastra@latest init
```

Add the `dev` and `build` scripts to `package.json`:

package.json

```nextra-code

{
  "scripts": {
    ...
    "dev:mastra": "mastra dev",
    "build:mastra": "mastra build"
  }
}
```

## Configure TypeScript [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#configure-typescript-1)

Modify the `tsconfig.json` file in your project root:

tsconfig.json

```nextra-code

{
  ...
  "exclude": ["dist", ".mastra"]
}
```

## Set Up API Key [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#set-up-api-key-1)

.env

```nextra-code

OPENAI_API_KEY=<your-api-key>
```

## Update .gitignore [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#update-gitignore-1)

Add `.mastra` to your `.gitignore` file:

.gitignore

```nextra-code

.mastra
.vercel
```

## Update the Mastra Agent [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#update-the-mastra-agent-1)

Astro uses Vite, which accesses environment variables via `import.meta.env` rather than `process.env`. As a result, the model constructor must explicitly receive the `apiKey` from the Vite environment like this:

src/mastra/agents/weather-agent.ts

```nextra-code

- import { openai } from "@ai-sdk/openai";
+ import { createOpenAI } from "@ai-sdk/openai";

+ const openai = createOpenAI({
+   apiKey: import.meta.env?.OPENAI_API_KEY,
+   compatibility: "strict"
+ });
```

> More configuration details are available in the AI SDK docs. See [Provider Instance](https://ai-sdk.dev/providers/ai-sdk-providers/openai#provider-instance) for more information.

## Start the Mastra Dev Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#start-the-mastra-dev-server-1)

Start the Mastra Dev Server to expose your agents as REST endpoints:

npmCLI

### npm

```nextra-code

npm run dev:mastra
```

### CLI

```nextra-code

mastra dev:mastra
```

> Once running, your agents are available locally. See [Local Development Environment](https://mastra.ai/docs/server-db/local-dev-playground) for more information.

## Start Astro Dev Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#start-astro-dev-server-1)

With the Mastra Dev Server running, you can start your Astro site in the usual way.

## Create API Directory [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#create-api-directory)

```nextra-code

mkdir src/pages/api
```

### Create Test Endpoint [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#create-test-endpoint)

Create a new Endpoint, and add the example code:

```nextra-code

touch src/pages/api/test.ts
```

src/pages/api/test.ts

```nextra-code [counter-reset:line]

import type { APIRoute } from "astro";

import { mastra } from "../../mastra";

export const POST: APIRoute = async ({ request }) => {
  const { city } = await new Response(request.body).json();
  const agent = mastra.getAgent("weatherAgent");

  const result = await agent.generate(`What's the weather like in ${city}?`);

  return new Response(JSON.stringify(result.text));
};
```

### Create Test Form [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#create-test-form-1)

Create a new Form component, and add the example code:

```nextra-code

touch src/components/form.tsx
```

src/components/form.tsx

```nextra-code [counter-reset:line]

import { useState } from "react";

export const Form = () => {
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const city = formData.get("city")?.toString();

    const response = await fetch("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city })
    });

    const text = await response.json();
    setResult(text);
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <input name="city" placeholder="Enter city" required />
        <button type="submit">Get Weather</button>
      </form>
      {result && <pre>{result}</pre>}
    </>
  );
};
```

### Create Test Page [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#create-test-page-1)

Create a new Page, and add the example code:

```nextra-code

touch src/pages/test.astro
```

src/pages/test.astro

```nextra-code [counter-reset:line]

---
import { Form } from '../components/form'
---

<h1>Test</h1>
<Form client:load />
```

> You can now navigate to `/test` in your browser to try it out.

Submitting **London** as the city would return a result similar to:

```nextra-code

Agent response: The current weather in London is as follows:

- **Temperature:** 12.9°C (Feels like 9.7°C)
- **Humidity:** 63%
- **Wind Speed:** 14.7 km/h
- **Wind Gusts:** 32.4 km/h
- **Conditions:** Overcast

Let me know if you need more information!
```

## Next Steps [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/astro\#next-steps)

- [Deployment \| With Astro on Vercel](https://mastra.ai/docs/deployment/web-framework#with-astro-on-vercel)
- [Monorepo Deployment](https://mastra.ai/en/docs/deployment/monorepo)

[With Next.js](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js "With Next.js") [With SvelteKit](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit "With SvelteKit")