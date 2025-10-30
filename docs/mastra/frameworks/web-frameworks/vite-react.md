---
title: Getting Started with Mastra and Vite/React | Mastra Guides
url: 
description: A step-by-step guide to integrating Mastra with Vite and React.
language: en
---
[Skip to Content](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") [Frameworks](https://mastra.ai/en/docs/frameworks/agentic-uis "Frameworks") Web FrameworksWith Vite/React

Copy page

# Integrate Mastra in your Vite/React project

Mastra integrates with Vite, making it easy to:

- Build flexible APIs to serve AI-powered features
- Simplify deployment with a unified codebase for frontend and backend
- Take advantage of Mastra’s Client SDK

Use this guide to scaffold and integrate Mastra with your Vite/React project.

This guide assumes you’re using Vite/React with React Router v7 at the root of
your project, e.g., `app`.

## Install Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#install-mastra)

Install the required Mastra packages:

npmyarnpnpmbun

### npm

```nextra-code

npm install mastra@latest @mastra/core@latest @mastra/libsql@latest @mastra/client-js@latest
```

### yarn

```nextra-code

yarn add mastra@latest @mastra/core@latest @mastra/libsql@latest @mastra/client-js@latest
```

### pnpm

```nextra-code

pnpm add mastra@latest @mastra/core@latest @mastra/libsql@latest @mastra/client-js@latest
```

### bun

```nextra-code

bun add mastra@latest @mastra/core@latest @mastra/libsql@latest @mastra/client-js@latest
```

## Integrate Mastra [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#integrate-mastra)

To integrate Mastra into your project, you have two options:

### 1\. Use the One-Liner [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#1-use-the-one-liner)

Run the following command to quickly scaffold the default Weather agent with sensible defaults:

```nextra-code

npx mastra@latest init --dir . --components agents,tools --example --llm openai
```

> See [mastra init](https://mastra.ai/reference/cli/init) for more information.

### 2\. Use the Interactive CLI [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#2-use-the-interactive-cli)

If you prefer to customize the setup, run the `init` command and choose from the options when prompted:

```nextra-code

npx mastra@latest init
```

By default, `mastra init` suggests `src` as the install location. If you’re using Vite/React at the root of your project (e.g., `app`, not `src/app`), enter `.` when prompted:

Add the `dev` and `build` scripts to `package.json`:

appsrc/app

### app

package.json

```nextra-code

{
  "scripts": {
    ...
    "dev:mastra": "mastra dev --dir mastra",
    "build:mastra": "mastra build --dir mastra"
  }
}
```

### src/app

package.json

```nextra-code

{
  "scripts": {
    ...
    "dev:mastra": "mastra dev --dir src/mastra",
    "build:mastra": "mastra build --dir src/mastra"
  }
}
```

## Configure TypeScript [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#configure-typescript)

Modify the `tsconfig.json` file in your project root:

tsconfig.json

```nextra-code

{
  ...
  "exclude": ["dist", ".mastra"]
}
```

## Set Up API Keys [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#set-up-api-keys)

.env

```nextra-code

OPENAI_API_KEY=<your-api-key>
```

> Each LLM provider uses a different env var. See [Model Capabilities](https://mastra.ai/docs/getting-started/model-capability) for more information.

## Update .gitignore [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#update-gitignore)

Add `.mastra` to your `.gitignore` file:

.gitignore

```nextra-code

.mastra
```

## Start the Mastra Dev Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#start-the-mastra-dev-server)

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

## Start Vite Dev Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#start-vite-dev-server)

With the Mastra Dev Server running, you can start your Vite app in the usual way.

## Create Mastra Client [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#create-mastra-client)

Create a new directory and file. Then add the example code:

```nextra-code

mkdir lib
touch lib/mastra.ts
```

lib/mastra.ts

```nextra-code [counter-reset:line]

import { MastraClient } from "@mastra/client-js";

export const mastraClient = new MastraClient({
  baseUrl: import.meta.env.VITE_MASTRA_API_URL || "http://localhost:4111",
});
```

## Create Test Route Config [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#create-test-route-config)

Add new `route` to the config:

app/routes.ts

```nextra-code [counter-reset:line]

import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [\
  index("routes/home.tsx"),\
  route("test", "routes/test.tsx"),\
] satisfies RouteConfig;
```

## Create Test Route [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#create-test-route)

Create a new Route, and add the example code:

```nextra-code

touch app/routes/test.tsx
```

app/routes/test.tsx

```nextra-code [counter-reset:line]

import { useState } from "react";
import { mastraClient } from "../../lib/mastra";

export default function Test() {
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const city = formData.get("city")?.toString();
    const agent = mastraClient.getAgent("weatherAgent");

    const response = await agent.generate({
      messages: [{ role: "user", content: `What's the weather like in ${city}?` }]
    });

    setResult(response.text);
  }

  return (
    <>
      <h1>Test</h1>
      <form onSubmit={handleSubmit}>
        <input name="city" placeholder="Enter city" required />
        <button type="submit">Get Weather</button>
      </form>
      {result && <pre>{result}</pre>}
    </>
  );
}
```

> You can now navigate to `/test` in your browser to try it out.

Submitting **London** as the city would return a result similar to:

```nextra-code

The current weather in London is partly cloudy with a temperature of 19.3°C, feeling like 17.4°C. The humidity is at 53%, and there is a wind speed of 15.9 km/h, with gusts up to 38.5 km/h.
```

## Next steps [Permalink for this section](https://mastra.ai/en/docs/frameworks/web-frameworks/vite-react\#next-steps)

- [Monorepo Deployment](https://mastra.ai/en/docs/deployment/monorepo)

[With Express](https://mastra.ai/en/docs/frameworks/servers/express "With Express") [With Next.js](https://mastra.ai/en/docs/frameworks/web-frameworks/next-js "With Next.js")