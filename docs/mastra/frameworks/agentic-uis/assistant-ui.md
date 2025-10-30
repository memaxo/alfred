---
title: Using with Assistant UI
url: 
description: Learn how to integrate Assistant UI with Mastra
language: en
---
[Skip to Content](https://mastra.ai/en/docs/frameworks/agentic-uis/assistant-ui#nextra-skip-nav)

[Docs](https://mastra.ai/en/docs "Docs") Frameworks [Agentic UIs](https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk "Agentic UIs") With Assistant UI

Copy page

# Using with Assistant UI

[Assistant UI](https://assistant-ui.com/) is the TypeScript/React library for AI Chat.
Built on shadcn/ui and Tailwind CSS, it enables developers to create beautiful, enterprise-grade chat experiences in minutes.

For a full-stack integration approach where Mastra runs directly in your Next.js API routes, see the [Full-Stack Integration Guide](https://www.assistant-ui.com/docs/runtimes/mastra/full-stack-integration) on Assistant UI’s documentation site.

## Integration Guide [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/assistant-ui\#integration-guide)

Run Mastra as a standalone server and connect your Next.js frontend (with Assistant UI) to its API endpoints.

### Create Standalone Mastra Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/assistant-ui\#create-standalone-mastra-server)

Set up your directory structure. A possible directory structure could look like this:

- project-root
  - mastra-server
    - src
    - package.json
  - nextjs-frontend

Bootstrap your Mastra server:

```nextra-code

npx create-mastra@latest
```

This command will launch an interactive wizard to help you scaffold a new Mastra project, including prompting you for a project name and setting up basic configurations.
Follow the prompts to create your server project.

You now have a basic Mastra server project ready. You should have the following files and folders:

- src
  - mastra
    - index.ts
    - agents
      - weather-agent.ts
    - tools
      - weather-tool.ts
    - workflows
      - weather-workflow.ts

Ensure that you have set the appropriate environment variables for your LLM provider in the `.env` file.

### Run the Mastra Server [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/assistant-ui\#run-the-mastra-server)

Run the Mastra server using the following command:

```nextra-code

npm run dev
```

By default, the Mastra server will run on `http://localhost:4111`. Your `weatherAgent` should now be accessible via a POST request endpoint, typically `http://localhost:4111/api/agents/weatherAgent/stream`. Keep this server running for the next steps where we’ll set up the Assistant UI frontend to connect to it.

### Initialize Assistant UI [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/assistant-ui\#initialize-assistant-ui)

Create a new `assistant-ui` project with the following command.

```nextra-code

npx assistant-ui@latest create
```

For detailed setup instructions, including adding API keys, basic configuration, and manual setup steps, please refer to [assistant-ui’s official documentation](https://assistant-ui.com/docs).

### Configure Frontend API Endpoint [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/assistant-ui\#configure-frontend-api-endpoint)

The default Assistant UI setup configures the chat runtime to use a local API route ( `/api/chat`) within the Next.js project. Since our Mastra agent is running on a separate server, we need to update the frontend to point to that server’s endpoint.

Find the `useChatRuntime` hook in the `assistant-ui` project, typically at `app/assistant.tsx` and change the `api` property to the full URL of your Mastra agent’s stream endpoint:

app/assistant.tsx

```nextra-code [counter-reset:line]

import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";

const runtime = useChatRuntime({
  transport: new AssistantChatTransport({
    api: "MASTRA_ENDPOINT",
  }),
});
```

Now, the Assistant UI frontend will send chat requests directly to your running Mastra server.

### Run the Application [Permalink for this section](https://mastra.ai/en/docs/frameworks/agentic-uis/assistant-ui\#run-the-application)

You’re ready to connect the pieces! Make sure both the Mastra server and the Assistant UI frontend are running. Start the Next.js development server:

```nextra-code

npm run dev
```

You should now be able to chat with your agent in the browser.

Congratulations! You have successfully integrated Mastra with Assistant UI using a separate server approach. Your Assistant UI frontend now communicates with a standalone Mastra agent server.

[With CopilotKit](https://mastra.ai/en/docs/frameworks/agentic-uis/copilotkit "With CopilotKit") [With Cedar-OS](https://mastra.ai/en/docs/frameworks/agentic-uis/cedar-os "With Cedar-OS")