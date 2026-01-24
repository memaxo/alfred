FoundationsTools

Copy markdown

# Tools

While large language models (LLMs) have incredible generation capabilities, they struggle with discrete tasks (e.g. mathematics) and interacting with the outside world (e.g. getting the weather).

Tools are actions that an LLM can invoke. The results of these actions can be reported back to the LLM to be considered in the next response.

For example, when you ask an LLM for the "weather in London", and there is a weather tool available, it could call a tool with London as the argument. The tool would then fetch the weather data and return it to the LLM. The LLM can then use this information in its response.

## What is a tool?

A tool is an object that can be called by the model to perform a specific task. You can use tools with `generateText` and `streamText` by passing one or more tools to the `tools` parameter.

A tool consists of three properties:

- **`description`** : An optional description of the tool that can influence when the tool is picked.
- **`inputSchema`** : A Zod schema or a JSON schema that defines the input required for the tool to run. The schema is consumed by the LLM, and also used to validate the LLM tool calls.
- **`execute`** : An optional async function that is called with the arguments from the tool call.

`streamUI` uses UI generator tools with a `generate` function that can return React components.

If the LLM decides to use a tool, it will generate a tool call. Tools with an `execute` function are run automatically when these calls are generated. The output of the tool calls are returned using tool result objects.

You can automatically pass tool results back to the LLM using multi-step calls with `streamText` and `generateText`.

## Schemas

Schemas are used to define the parameters for tools and to validate the tool calls.

The AI SDK supports both raw JSON schemas (using the `jsonSchema` function) and Zod schemas (either directly or using the `zodSchema` function).

Zod is a popular TypeScript schema validation library. You can install it with:

pnpm

npm

yarn

bun

    pnpm add zod

You can then specify a Zod schema, for example:

    import z from 'zod';




    const recipeSchema = z.object({

      recipe: z.object({

        name: z.string(),

        ingredients: z.array(

          z.object({

            name: z.string(),

            amount: z.string(),

          }),

        ),

        steps: z.array(z.string()),

      }),

    });

You can also use schemas for structured output generation with `generateObject` and `streamObject`.

## Toolkits

When you work with tools, you typically need a mix of application specific tools and general purpose tools. There are several providers that offer pre-built tools as **toolkits** that you can use out of the box:

- **agentic** \- A collection of 20+ tools. Most tools connect to access external APIs such as Exa or E2B.
- **browserbase** \- Browser tool that runs a headless browser
- **browserless** \- Browser automation service with AI integration - self hosted or cloud based
- **Stripe agent tools** \- Tools for interacting with Stripe.
- **StackOne ToolSet** \- Agentic integrations for hundreds of enterprise SaaS
- **Toolhouse** \- AI function-calling in 3 lines of code for over 25 different actions.
- **Agent Tools** \- A collection of tools for agents.
- **AI Tool Maker** \- A CLI utility to generate AI SDK tools from OpenAPI specs.
- **Composio** \- Composio provides 250+ tools like GitHub, Gmail, Salesforce and more.
- **Interlify** \- Convert APIs into tools so that AI can connect to your backend in minutes.
- **JigsawStack** \- JigsawStack provides over 30+ small custom fine tuned models available for specific uses.
- **Pipedream** \- Pipedream Connect provides a developer toolkit that lets you easily add 3,000+ integrations to your app or AI agent.
- **AI Tools Registry** \- A Shadcn compatible tool definitions and components registry for the AI SDK.
- **DeepAgent** \- A powerful suite of 50+ AI tools and integrations, seamlessly connecting with APIs like Tavily, E2B, Airtable and more to build enterprise-ready AI agents.
- **Smithery** \- Smithery provides an open marketplace of 6K+ MCPs, including Browserbase and Exa.

Do you have open source tools or tool libraries that are compatible with the AI SDK? Please file a pull request to add them to this list.

## Learn more

The AI SDK Core Tool Calling and Agents documentation has more information about tools and tool calling.

Previous

Prompts

Next

Streaming
