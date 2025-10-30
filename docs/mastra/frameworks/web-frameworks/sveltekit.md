---
title: Getting Started with Mastra and SvelteKit | Mastra Guides
url: 
description: A step-by-step guide to integrating Mastra with SvelteKit.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Frameworks](https://mastra.ai/en/docs/frameworks/agentic-uis "Frameworks") [Web Frameworks](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react "Web Frameworks") With SvelteKit

Copy page

# Integrate Mastra in your SvelteKit project

Mastra integrates with SvelteKit, making it easy to:

- Build flexible APIs to serve AI-powered features
- Simplify deployment with a unified codebase for frontend and backend
- Take advantage of SvelteKit’s built-in [Actions](https://kit.svelte.dev/docs/form-actions) or [Server Endpoints](https://svelte.dev/docs/kit/routing#server) for efficient server-client workflows

Use this guide to scaffold and integrate Mastra with your SvelteKit project.

ActionsServer Endpoints

### Actions

## Install Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#install-mastra)

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

## Integrate Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#integrate-mastra)

To integrate Mastra into your project, you have two options:

### 1\. Use the One-Liner [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#1-use-the-one-liner)

Run the following command to quickly scaffold the default Weather agent with sensible defaults:

```nextra-code

npx mastra@latest init --default
```

> See [mastra init](https://mastra.ai/reference/cli/init) for more information.

### 2\. Use the Interactive CLI [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#2-use-the-interactive-cli)

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

## Configure TypeScript [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#configure-typescript)

Modify the `tsconfig.json` file in your project root:

tsconfig.json

```nextra-code

{
  ...
  "exclude": ["dist", ".mastra"]
}
```

## Set Up API Key [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#set-up-api-key)

The `VITE_` prefix is required for environment variables to be accessible in the Vite environment, that SvelteKit uses.
[Read more about Vite environment variables](https://vite.dev/guide/env-and-mode.html#env-variables).

.env

```nextra-code

VITE_OPENAI_API_KEY=<your-api-key>
```

## Update .gitignore [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#update-gitignore)

Add `.mastra` to your `.gitignore` file:

.gitignore

```nextra-code

.mastra
```

## Update the Mastra Agent [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#update-the-mastra-agent)

src/mastra/agents/weather-agent.ts

```nextra-code

- import { openai } from "@ai-sdk/openai";
+ import { createOpenAI } from "@ai-sdk/openai";

+ const openai = createOpenAI({
+   apiKey: import.meta.env?.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
+   compatibility: "strict"
+ });
```

By reading env vars from both `import.meta.env` and `process.env`, we ensure that the API key is available in both the SvelteKit dev server and the Mastra Dev Server.

> More configuration details are available in the AI SDK docs. See [Provider Instance](https://ai-sdk.dev/providers/ai-sdk-providers/openai#provider-instance) for more information.

## Start the Mastra Dev Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#start-the-mastra-dev-server)

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

## Start SvelteKit Dev Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#start-sveltekit-dev-server)

With the Mastra Dev Server running, you can start your SvelteKit site in the usual way.

## Create Test Directory [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#create-test-directory)

```nextra-code

mkdir src/routes/test
```

### Create Test Action [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#create-test-action)

Create a new Action, and add the example code:

```nextra-code

touch src/routes/test/+page.server.ts
```

src/routes/test/+page.server.ts

```nextra-code [counter-reset:line]

import type { Actions } from './$types';
import { mastra } from '../../mastra';

export const actions = {
	default: async (event) => {
		const city = (await event.request.formData()).get('city')!.toString();
		const agent = mastra.getAgent('weatherAgent');

		const result = await agent.generate(`What's the weather like in ${city}?`);
		return { result: result.text };
	}
} satisfies Actions;

```

### Create Test Page [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#create-test-page)

Create a new Page file, and add the example code:

```nextra-code

touch src/routes/test/+page.svelte
```

src/routes/test/+page.svelte

```nextra-code [counter-reset:line]

<script lang="ts">
	import type { PageProps } from './$types';
	let { form }: PageProps = $props();
</script>

<h1>Test</h1>

<form method="POST">
	<input name="city" placeholder="Enter city" required />
	<button type="submit">Get Weather</button>
</form>

{#if form?.result}
	<pre>{form.result}</pre>
{/if}

```

> You can now navigate to `/test` in your browser to try it out.

Submitting **London** as the city would return a result similar to:

```nextra-code

The current weather in London is as follows:

- **Temperature:** 16°C (feels like 13.8°C)
- **Humidity:** 62%
- **Wind Speed:** 12.6 km/h
- **Wind Gusts:** 32.4 km/h
- **Conditions:** Overcast

If you need more details or information about a different location, feel free to ask!
```

### Server Endpoints

## Install Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#install-mastra-1)

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

## Integrate Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#integrate-mastra-1)

To integrate Mastra into your project, you have two options:

### 1\. Use the One-Liner [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#1-use-the-one-liner-1)

Run the following command to quickly scaffold the default Weather agent with sensible defaults:

```nextra-code

npx mastra@latest init --default
```

> See [mastra init](https://mastra.ai/reference/cli/init) for more information.

### 2\. Use the Interactive CLI [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#2-use-the-interactive-cli-1)

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

## Configure TypeScript [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#configure-typescript-1)

Modify the `tsconfig.json` file in your project root:

tsconfig.json

```nextra-code

{
  ...
  "exclude": ["dist", ".mastra"]
}
```

## Set Up API Key [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#set-up-api-key-1)

The `VITE_` prefix is required for environment variables to be accessible in the Vite environment, that SvelteKit uses.
[Read more about Vite environment variables](https://vite.dev/guide/env-and-mode.html#env-variables).

.env

```nextra-code

VITE_OPENAI_API_KEY=<your-api-key>
```

## Update .gitignore [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#update-gitignore-1)

Add `.mastra` to your `.gitignore` file:

.gitignore

```nextra-code

.mastra
```

## Update the Mastra Agent [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#update-the-mastra-agent-1)

src/mastra/agents/weather-agent.ts

```nextra-code

- import { openai } from "@ai-sdk/openai";
+ import { createOpenAI } from "@ai-sdk/openai";

+ const openai = createOpenAI({
+   apiKey: import.meta.env?.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
+   compatibility: "strict"
+ });
```

By reading env vars from both `import.meta.env` and `process.env`, we ensure that the API key is available in both the SvelteKit dev server and the Mastra Dev Server.

> More configuration details are available in the AI SDK docs. See [Provider Instance](https://ai-sdk.dev/providers/ai-sdk-providers/openai#provider-instance) for more information.

## Start the Mastra Dev Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#start-the-mastra-dev-server-1)

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

## Start SvelteKit Dev Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#start-sveltekit-dev-server-1)

With the Mastra Dev Server running, you can start your SvelteKit site in the usual way.

## Create API Directory [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#create-api-directory)

```nextra-code

mkdir src/routes/weather-api
```

### Create Test Endpoint [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#create-test-endpoint)

Create a new Endpoint, and add the example code:

```nextra-code

touch src/routes/weather-api/+server.ts
```

src/routes/weather-api/+server.ts

```nextra-code [counter-reset:line]

import { json } from '@sveltejs/kit';
import { mastra } from '../../mastra';

export async function POST({ request }) {
	const { city } = await request.json();

	const response = await mastra
		.getAgent('weatherAgent')
		.generate(`What's the weather like in ${city}?`);

	return json({ result: response.text });
}

```

### Create Test Page [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/sveltekit\#create-test-page-1)

Create a new Page, and add the example code:

```nextra-code

touch src/routes/weather-api-test/+page.svelte
```

src/routes/weather-api-test/+page.svelte

```nextra-code [counter-reset:line]

<script lang="ts">
	let result = $state<string | null>(null);
	async function handleFormSubmit(event: Event) {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const city = formData.get('city')?.toString();
		if (city) {
			const response = await fetch('/weather-api', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ city })
			});
			const data = await response.json();
			result = data.result;
		}
	}
</script>

<h1>Test</h1>
<form method="POST" onsubmit={handleFormSubmit}>
	<input name="city" placeholder="Enter city" required />
	<button type="submit">Get Weather</button>
</form>

{#if result}
	<pre>{result}</pre>
{/if}
```

> You can now navigate to `/weather-api-test` in your browser to try it out.

Submitting **London** as the city would return a result similar to:

```nextra-code

The current weather in London is as follows:

- **Temperature:** 16.1°C (feels like 14.2°C)
- **Humidity:** 64%
- **Wind Speed:** 11.9 km/h
- **Wind Gusts:** 30.6 km/h
- **Conditions:** Overcast

If you need more details or information about a different location, feel free to ask!
```

## Next steps

- [Monorepo Deployment](https://mastra.ai/en/docs/deployment/monorepo)

[With Astro](https://mastra.ai/en/docs/frameworks/web-frameworks/astro "With Astro") [Contributing Templates](https://mastra.ai/en/docs/community/contributing-templates "Contributing Templates")