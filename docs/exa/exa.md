# Context (Exa Code)

> Get relevant code snippets and examples from open source libraries and repositories. Search through code repositories to find contextual examples that help developers understand how specific libraries, frameworks, or programming concepts are implemented in practice.

<Card title="Get your Exa API key" icon="key" horizontal href="https://dashboard.exa.ai/api-keys" />

## Overview

The Context API (also called **Exa Code**) is a powerful tool for coding agents that need fast, efficient web context. It searches over billions of GitHub repos, docs pages, Stack Overflow posts, and more to find the perfect, token-efficient context that agents need to code correctly.

This endpoint helps eliminate hallucinations in coding agents by providing real, working code examples from the open source community.

## Usage in Alfred

Alfred’s orchestrator now prefers Exa for web search whenever `EXA_API_KEY` is present. The web tool keeps the policy scope `web.read` and automatically falls back to DuckDuckGo if Exa is unavailable or errors. Default live crawl options ensure the planning flow always acts on fresh content, and top results flow into the context bundle with snippets for downstream ranking.

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXA_API_KEY` | Required API key for Exa requests | _none_ |
| `EXA_BASE_URL` | Override Exa API base URL | `https://api.exa.ai` |
| `EXA_TIMEOUT_MS` | Upper bound for Exa request duration | `20000` |
| `ORCH_WEB_PROVIDER` | Optional override for orchestrator search provider (`exa`, `ddg`, `serpapi`, `tavily`) | auto (uses `exa` when the API key is set) |

The orchestrator submits search requests with `livecrawl: "always"`, lightweight highlights, and concise summaries. High-confidence links can later be re-fetched with Exa’s contents endpoint to attach richer context without exposing API credentials to the UI.

## Example Use Cases

The Context API excels at finding practical code examples for:

- **Framework usage**: "use Exa search in python and make sure content is always livecrawled"
- **API syntax**: "use correct syntax for vercel ai sdk to call gpt-5 nano asking it how are you"
- **Development setup**: "how to set up a reproducible Nix Rust development environment"
- **Library implementation**: "React hooks for state management examples"
- **Best practices**: "authentication patterns in NextJS applications"

**Basic Code Search**

```bash theme={null}
curl -X POST 'https://api.exa.ai/context' \
  -H 'x-api-key: YOUR-EXA-API-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "how to use React hooks for state management",
    "tokensNum": 5000
  }'
```

**Example Response:**

````json theme={null}
{
  "requestId": "81c4198a1d6794503b52134fd77159e2",
  "query": "how to use React hooks for state management",
  "response": "## State Management with useState Hook in React\n\nhttps://www.geeksforgeeks.org/reactjs/state-management-with-usestate-hook-in-react/\n\n```\nimport React, {\n  useState\n} from 'react';\n\nfunction InputField() {\n  const [name, setName] = useState('');\n\n  const handleChange = (event) => {\n    setName(event.target.value);\n  }\n\n  return (\n    <div>\n      Name:\n      <input onChange={handleChange} />\n      Entered name: {name}\n    </div>\n  );\n}\n\nexport default InputField;\n```\n\n## Basic useState Example\n\n```\nimport { useState } from 'react';\n\nfunction Example() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div>\n      <p>You clicked {count} times</p>\n      <button onClick={() => setCount(count + 1)}>\n        Click me\n      </button>\n    </div>\n  );\n}\n```\n\n## Custom Hook for Counter State Management\n\n```\nimport { useState } from \"react\";\n\nconst useCounter = () => {\n  const [count, setCount] = useState(0);\n\n  const increment = () => {\n    setCount((prevCount) => prevCount + 1);\n  };\n\n  const decrement = () => {\n    setCount((prevCount) => prevCount - 1);\n  };\n\n  return { count, increment, decrement };\n};\n\nexport default useCounter;\n```\n\n...(response continues with more code examples)",
  "resultsCount": 502,
  "costDollars": "{\"total\":1,\"search\":{\"neural\":1}}",
  "searchTime": 3112.290825000033,
  "outputTokens": 4805
}
````

**Library Usage Examples**

```bash theme={null}
curl -X POST 'https://api.exa.ai/context' \
  -H 'x-api-key: YOUR-EXA-API-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "pandas dataframe filtering and groupby operations",
    "tokensNum": "dynamic"
  }'
```

**Framework Setup and Configuration**

```bash theme={null}
curl -X POST 'https://api.exa.ai/context' \
  -H 'x-api-key: YOUR-EXA-API-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Next.js 14 app router with TypeScript configuration",
    "tokensNum": "dynamic"
  }'
```

## Response Format

The API returns a JSON response with the following structure:

```json theme={null}
{
  "requestId": "req_12345",
  "query": "how to use React hooks for state management",
  "response": "// Formatted code snippets and contextual examples\n...",
  "resultsCount": 15,
  "costDollars": "0.0025",
  "searchTime": 1.234,
  "outputTokens": 1247
}
```

## Parameters

### `query` (required)

- **Type**: `string`
- **Description**: Search query to find relevant code snippets
- **Example**: `"how to use React hooks for state management"`
- **Min Length**: 1 character
- **Max Length**: 2000 characters

### `tokensNum` (optional)

- **Type**: `string | integer`
- **Default**: `"dynamic"`
- **Description**: Token limit for the response
- **Options**:
  - `"dynamic"`: Automatically determine optimal response length
  - `50-100000`: Specific number of tokens to return (5000 is good default for most queries, and use 10000 when 5k doesn't provide enough context)

**Token Management**

- Use `"dynamic"` for most queries to get optimal, token-efficient responses
- Specify exact token counts when you need precise output length control
- Higher token counts return more comprehensive examples but cost more

## Integration Examples

**Using with Python**

```python theme={null}
import requests

def get_code_context(query, tokens="dynamic"):
    response = requests.post(
        "https://api.exa.ai/context",
        headers={
            "Content-Type": "application/json",
            "x-api-key": "YOUR_API_KEY"
        },
        json={
            "query": query,
            "tokensNum": tokens
        }
    )

    result = response.json()
    return result["response"]

# Example usage
context = get_code_context("Express.js middleware for authentication")
print(context)
```

**Using with JavaScript/Node.js**

```javascript theme={null}
async function getCodeContext(query, tokensNum = "dynamic") {
  const response = await fetch("https://api.exa.ai/context", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "YOUR_API_KEY",
    },
    body: JSON.stringify({
      query,
      tokensNum,
    }),
  });

  const result = await response.json();
  return result.response;
}

// Example usage
const context = await getCodeContext("Svelte component lifecycle methods");
console.log(context);
```

## About Exa Code

Vibe coding should never have a bad vibe. `exa-code` is a huge step towards coding agents that never hallucinate.

When your coding agent makes a search query, `exa-code` searches over billions of GitHub repos, docs pages, Stack Overflow posts, and more, to find the perfect, token-efficient context that the agent needs to code correctly. It's powered by the Exa search engine.

## Use with MCP

You can also use `exa-code` through the [Exa MCP server](https://docs.exa.ai/reference/exa-mcp) for seamless integration with AI coding assistants like Claude, Cursor, and other MCP-compatible clients.

The MCP integration provides the same powerful code context search capabilities directly within your development environment without needing to make direct API calls.

# Vercel AI SDK

Learn how to build a web agent with Vercel AI SDK and Exa. Create intelligent agents that can search the web for up-to-date information and provide contextual responses.

**[View the guide in Vercel AI SDK docs →](https://ai-sdk.dev/cookbook/node/web-search-agent#exa)**

## Web Search Tool Implementation

Here's how to create a web search tool using Exa with Vercel AI SDK:

```javascript theme={null}
import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import Exa from "exa-js";

export const exa = new Exa(process.env.EXA_API_KEY);

export const webSearch = tool({
  description: "Search the web for up-to-date information",
  parameters: z.object({
    query: z.string().min(1).max(100).describe("The search query"),
  }),
  execute: async ({ query }) => {
    const { results } = await exa.searchAndContents(query, {
      livecrawl: "always",
      numResults: 3,
    });
    return results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.text.slice(0, 1000), // take just the first 1000 characters
      publishedDate: result.publishedDate,
    }));
  },
});

const { text } = await generateText({
  model: openai("gpt-4o-mini"), // can be any model that supports tools
  prompt: "What happened in San Francisco last week?",
  tools: {
    webSearch,
  },
  maxSteps: 2,
});
```

For detailed instructions on building web agents with Vercel AI SDK and Exa, visit the [Vercel AI SDK documentation](https://ai-sdk.dev/cookbook/node/web-search-agent#exa).

# Create a task

> Create an asynchronous research task that explores the web, gathers sources, synthesizes findings, and returns results with citations. Can be used to generate:

1. Structured JSON matching an `outputSchema` you provide.
2. A detailed markdown report when no schema is provided.

The API responds immediately with a `researchId` for polling completion status. For more details, see [Exa Research](/reference/exa-research).

Alternatively, you can use the OpenAI compatible [chat completions interface](/reference/chat-completions#research).

## OpenAPI

```yaml post /research/v1
paths:
  path: /research/v1
  method: post
  servers:
    - url: https://api.exa.ai/research/v1/
      description: Production
  request:
    security: []
    parameters:
      path: {}
      query: {}
      header: {}
      cookie: {}
    body:
      application/json:
        schemaArray:
          - type: object
            properties:
              model:
                allOf:
                  - default: exa-research
                    type:
                      - string
                    enum:
                      - exa-research-fast
                      - exa-research
                      - exa-research-pro
                    description: >-
                      Research model to use. exa-research is faster and cheaper,
                      while exa-research-pro provides more thorough analysis and
                      stronger reasoning.
              instructions:
                allOf:
                  - type:
                      - string
                    maxLength: 4096
                    description: >-
                      Instructions for what you would like research on. A good
                      prompt clearly defines what information you want to find,
                      how research should be conducted, and what the output
                      should look like.
              outputSchema:
                allOf:
                  - type:
                      - object
                    additionalProperties: {}
                    description: >-
                      JSON Schema to enforce structured output. When provided,
                      the research output will be validated against this schema
                      and returned as parsed JSON.
            required: true
            refIdentifier: "#/components/schemas/ResearchCreateRequestDtoClass"
            examples:
              - model: exa-research
                instructions: What species of ant are similar to honeypot ants?
            requiredProperties:
              - instructions
            example:
              model: exa-research
              instructions: What species of ant are similar to honeypot ants?
        examples:
          example:
            value:
              model: exa-research
              instructions: What species of ant are similar to honeypot ants?
  response:
    "201":
      application/json:
        schemaArray:
          - type: object
            properties:
              researchId:
                allOf:
                  - type:
                      - string
                    description: >-
                      Unique identifier for tracking and retrieving this
                      research request
              createdAt:
                allOf:
                  - type:
                      - number
                    description: >-
                      When the research was created (Unix timestamp in
                      milliseconds)
              model:
                allOf:
                  - default: exa-research
                    type:
                      - string
                    enum:
                      - exa-research-fast
                      - exa-research
                      - exa-research-pro
                    description: The model used for this research request
              instructions:
                allOf:
                  - type:
                      - string
                    description: The original research instructions provided
              outputSchema:
                allOf:
                  - type:
                      - object
                    additionalProperties: {}
                    description: The JSON Schema used to validate the output, if provided
              status:
                allOf:
                  - type:
                      - string
                    enum:
                      - pending
            title: Pending
            refIdentifier: "#/components/schemas/ResearchDtoClass"
            examples: &ref_1
              - &ref_0
                researchId: 01jszdfs0052sg4jc552sg4jc5
                model: exa-research
                instructions: What species of ant are similar to honeypot ants?
                status: running
              - researchId: 01jszdfs0052sg4jc552sg4jc5
                model: exa-research
                instructions: What species of ant are similar to honeypot ants?
                status: completed
                output: Melophorus bagoti
            requiredProperties:
              - researchId
              - createdAt
              - instructions
              - status
            example: *ref_0
          - type: object
            properties:
              researchId:
                allOf:
                  - type:
                      - string
                    description: >-
                      Unique identifier for tracking and retrieving this
                      research request
              createdAt:
                allOf:
                  - type:
                      - number
                    description: >-
                      When the research was created (Unix timestamp in
                      milliseconds)
              model:
                allOf:
                  - default: exa-research
                    type:
                      - string
                    enum:
                      - exa-research-fast
                      - exa-research
                      - exa-research-pro
                    description: The model used for this research request
              instructions:
                allOf:
                  - type:
                      - string
                    description: The original research instructions provided
              outputSchema:
                allOf:
                  - type:
                      - object
                    additionalProperties: {}
                    description: The JSON Schema used to validate the output, if provided
              status:
                allOf:
                  - type:
                      - string
                    enum:
                      - running
              events:
                allOf:
                  - type:
                      - array
                    items:
                      $ref: "#/components/schemas/ResearchEventDtoClass"
                    description: >-
                      Real-time log of operations as research progresses. Poll
                      this endpoint or use ?stream=true for live updates.
            title: Running
            refIdentifier: "#/components/schemas/ResearchDtoClass"
            examples: *ref_1
            requiredProperties:
              - researchId
              - createdAt
              - instructions
              - status
            example: *ref_0
          - type: object
            properties:
              researchId:
                allOf:
                  - type:
                      - string
                    description: >-
                      Unique identifier for tracking and retrieving this
                      research request
              createdAt:
                allOf:
                  - type:
                      - number
                    description: >-
                      When the research was created (Unix timestamp in
                      milliseconds)
              model:
                allOf:
                  - default: exa-research
                    type:
                      - string
                    enum:
                      - exa-research-fast
                      - exa-research
                      - exa-research-pro
                    description: The model used for this research request
              instructions:
                allOf:
                  - type:
                      - string
                    description: The original research instructions provided
              outputSchema:
                allOf:
                  - type:
                      - object
                    additionalProperties: {}
                    description: The JSON Schema used to validate the output, if provided
              status:
                allOf:
                  - type:
                      - string
                    enum:
                      - completed
              events:
                allOf:
                  - type:
                      - array
                    items:
                      $ref: "#/components/schemas/ResearchEventDtoClass"
                    description: >-
                      Detailed log of all operations performed during research.
                      Use ?events=true to include this field for debugging or
                      monitoring progress.
              output:
                allOf:
                  - type:
                      - object
                    properties:
                      content:
                        type:
                          - string
                        description: >-
                          The complete research output as text. If outputSchema
                          was provided, this is a JSON string.
                      parsed:
                        type:
                          - object
                        additionalProperties: {}
                        description: >-
                          Structured JSON object matching your outputSchema.
                          Only present when outputSchema was provided and the
                          output successfully validated.
                    required:
                      - content
                    description: >-
                      The final research results, containing both raw text and
                      parsed JSON if outputSchema was provided
              costDollars:
                allOf:
                  - type:
                      - object
                    properties:
                      total:
                        type:
                          - number
                        description: Total cost in USD for this research request
                      numSearches:
                        type:
                          - number
                        description: >-
                          Count of web searches performed. Each search query
                          counts as one search.
                      numPages:
                        type:
                          - number
                        description: >-
                          Count of web pages fully crawled and processed. Only
                          pages that were read in detail are counted.
                      reasoningTokens:
                        type:
                          - number
                        description: >-
                          Total AI tokens used for reasoning, planning, and
                          generating the final output
                    required:
                      - total
                      - numSearches
                      - numPages
                      - reasoningTokens
                    description: Detailed cost breakdown for billing purposes
              finishedAt:
                allOf:
                  - type:
                      - number
                    description: >-
                      When the research completed (Unix timestamp in
                      milliseconds)
            title: Completed
            refIdentifier: "#/components/schemas/ResearchDtoClass"
            examples: *ref_1
            requiredProperties:
              - researchId
              - createdAt
              - instructions
              - status
              - output
              - costDollars
              - finishedAt
            example: *ref_0
          - type: object
            properties:
              researchId:
                allOf:
                  - type:
                      - string
                    description: >-
                      Unique identifier for tracking and retrieving this
                      research request
              createdAt:
                allOf:
                  - type:
                      - number
                    description: >-
                      When the research was created (Unix timestamp in
                      milliseconds)
              model:
                allOf:
                  - default: exa-research
                    type:
                      - string
                    enum:
                      - exa-research-fast
                      - exa-research
                      - exa-research-pro
                    description: The model used for this research request
              instructions:
                allOf:
                  - type:
                      - string
                    description: The original research instructions provided
              outputSchema:
                allOf:
                  - type:
                      - object
                    additionalProperties: {}
                    description: The JSON Schema used to validate the output, if provided
              status:
                allOf:
                  - type:
                      - string
                    enum:
                      - canceled
              events:
                allOf:
                  - type:
                      - array
                    items:
                      $ref: "#/components/schemas/ResearchEventDtoClass"
                    description: >-
                      Detailed log of all operations performed during research.
                      Use ?events=true to include this field for debugging or
                      monitoring progress.
              finishedAt:
                allOf:
                  - type:
                      - number
                    description: >-
                      When the research was canceled (Unix timestamp in
                      milliseconds)
            title: Canceled
            refIdentifier: "#/components/schemas/ResearchDtoClass"
            examples: *ref_1
            requiredProperties:
              - researchId
              - createdAt
              - instructions
              - status
              - finishedAt
            example: *ref_0
          - type: object
            properties:
              researchId:
                allOf:
                  - type:
                      - string
                    description: >-
                      Unique identifier for tracking and retrieving this
                      research request
              createdAt:
                allOf:
                  - type:
                      - number
                    description: >-
                      When the research was created (Unix timestamp in
                      milliseconds)
              model:
                allOf:
                  - default: exa-research
                    type:
                      - string
                    enum:
                      - exa-research-fast
                      - exa-research
                      - exa-research-pro
                    description: The model used for this research request
              instructions:
                allOf:
                  - type:
                      - string
                    description: The original research instructions provided
              outputSchema:
                allOf:
                  - type:
                      - object
                    additionalProperties: {}
                    description: The JSON Schema used to validate the output, if provided
              status:
                allOf:
                  - type:
                      - string
                    enum:
                      - failed
              events:
                allOf:
                  - type:
                      - array
                    items:
                      $ref: "#/components/schemas/ResearchEventDtoClass"
                    description: >-
                      Detailed log of all operations performed during research.
                      Use ?events=true to include this field for debugging or
                      monitoring progress.
              error:
                allOf:
                  - type:
                      - string
                    description: Human-readable error message explaining what went wrong.
              finishedAt:
                allOf:
                  - type:
                      - number
                    description: When the research failed (Unix timestamp in milliseconds)
            title: Failed
            refIdentifier: "#/components/schemas/ResearchDtoClass"
            examples: *ref_1
            requiredProperties:
              - researchId
              - createdAt
              - instructions
              - status
              - error
              - finishedAt
            example: *ref_0
        examples:
          example:
            value:
              researchId: 01jszdfs0052sg4jc552sg4jc5
              model: exa-research
              instructions: What species of ant are similar to honeypot ants?
              status: running
        description: Research request created
  deprecated: false
  type: path
components:
  schemas:
    ResearchEventDtoClass:
      oneOf:
        - discriminator:
            propertyName: eventType
          oneOf:
            - type:
                - object
              properties:
                eventType:
                  type:
                    - string
                  enum:
                    - research-definition
                instructions:
                  type:
                    - string
                  description: The complete research instructions as provided
                outputSchema:
                  type:
                    - object
                  additionalProperties: {}
                  description: The JSON Schema that will validate the final output
                createdAt:
                  type:
                    - number
                  description: When this event occurred (Unix timestamp in milliseconds)
                researchId:
                  type:
                    - string
                  description: The research request this event belongs to
              required:
                - eventType
                - instructions
                - createdAt
                - researchId
              title: Research Definition
            - type:
                - object
              properties:
                eventType:
                  type:
                    - string
                  enum:
                    - research-output
                output:
                  discriminator:
                    propertyName: outputType
                  oneOf:
                    - type:
                        - object
                      properties:
                        outputType:
                          type:
                            - string
                          enum:
                            - completed
                        costDollars:
                          type:
                            - object
                          properties:
                            total:
                              type:
                                - number
                              description: Total cost in USD for this research request
                            numSearches:
                              type:
                                - number
                              description: >-
                                Count of web searches performed. Each search
                                query counts as one search.
                            numPages:
                              type:
                                - number
                              description: >-
                                Count of web pages fully crawled and processed.
                                Only pages that were read in detail are counted.
                            reasoningTokens:
                              type:
                                - number
                              description: >-
                                Total AI tokens used for reasoning, planning,
                                and generating the final output
                          required:
                            - total
                            - numSearches
                            - numPages
                            - reasoningTokens
                        content:
                          type:
                            - string
                          description: >-
                            The complete research output as text. If
                            outputSchema was provided, this is a JSON string.
                        parsed:
                          type:
                            - object
                          additionalProperties: {}
                          description: >-
                            Structured JSON object matching your outputSchema.
                            Only present when outputSchema was provided and the
                            output successfully validated.
                      required:
                        - outputType
                        - costDollars
                        - content
                      title: Completed
                    - type:
                        - object
                      properties:
                        outputType:
                          type:
                            - string
                          enum:
                            - failed
                        error:
                          type:
                            - string
                          description: >-
                            Detailed error message explaining why the research
                            failed
                      required:
                        - outputType
                        - error
                      title: Failed
                  description: >-
                    The final research result, either successful with data or
                    failed with error
                createdAt:
                  type:
                    - number
                  description: When this event occurred (Unix timestamp in milliseconds)
                researchId:
                  type:
                    - string
                  description: The research request this event belongs to
              required:
                - eventType
                - output
                - createdAt
                - researchId
              title: Research Output
        - discriminator:
            propertyName: eventType
          oneOf:
            - type:
                - object
              properties:
                eventType:
                  type:
                    - string
                  enum:
                    - plan-definition
                planId:
                  type:
                    - string
                  description: Identifier for this planning cycle
                createdAt:
                  type:
                    - number
                  description: When this event occurred (Unix timestamp in milliseconds)
                researchId:
                  type:
                    - string
                  description: The research request this event belongs to
              required:
                - eventType
                - planId
                - createdAt
                - researchId
              title: Plan Definition
            - type:
                - object
              properties:
                eventType:
                  type:
                    - string
                  enum:
                    - plan-operation
                planId:
                  type:
                    - string
                  description: Which plan this operation belongs to
                operationId:
                  type:
                    - string
                  description: Unique identifier for this specific operation
                data:
                  discriminator:
                    propertyName: type
                  oneOf:
                    - type:
                        - object
                      properties:
                        type:
                          type:
                            - string
                          enum:
                            - think
                        content:
                          type:
                            - string
                          description: The AI's reasoning process and decision-making steps
                      required:
                        - type
                        - content
                      title: Think
                    - type:
                        - object
                      properties:
                        type:
                          type:
                            - string
                          enum:
                            - search
                        searchType:
                          type:
                            - string
                          enum:
                            - neural
                            - keyword
                            - auto
                            - fast
                          description: >-
                            Search algorithm used (neural for semantic search,
                            keyword for exact matches)
                        goal:
                          type:
                            - string
                          description: What the AI is trying to find with this search
                        query:
                          type:
                            - string
                          description: The exact search query sent to the search engine
                        results:
                          type:
                            - array
                          items:
                            type:
                              - object
                            properties:
                              url:
                                type:
                                  - string
                            required:
                              - url
                          description: URLs returned by the search, ranked by relevance
                        pageTokens:
                          type:
                            - number
                          description: Token cost for processing search result snippets
                      required:
                        - type
                        - searchType
                        - query
                        - results
                        - pageTokens
                      title: Search
                    - type:
                        - object
                      properties:
                        type:
                          type:
                            - string
                          enum:
                            - crawl
                        goal:
                          type:
                            - string
                          description: What information the AI expects to find on this page
                        result:
                          type:
                            - object
                          properties:
                            url:
                              type:
                                - string
                          required:
                            - url
                          description: The specific page that was crawled
                        pageTokens:
                          type:
                            - number
                          description: Token cost for processing the full page content
                      required:
                        - type
                        - result
                        - pageTokens
                      title: Crawl
                  description: The actual operation performed (think, search, or crawl)
                createdAt:
                  type:
                    - number
                  description: When this event occurred (Unix timestamp in milliseconds)
                researchId:
                  type:
                    - string
                  description: The research request this event belongs to
              required:
                - eventType
                - planId
                - operationId
                - data
                - createdAt
                - researchId
              title: Plan Operation
            - type:
                - object
              properties:
                eventType:
                  type:
                    - string
                  enum:
                    - plan-output
                planId:
                  type:
                    - string
                  description: Which plan is producing this output
                output:
                  discriminator:
                    propertyName: outputType
                  oneOf:
                    - type:
                        - object
                      properties:
                        outputType:
                          type:
                            - string
                          enum:
                            - tasks
                        reasoning:
                          type:
                            - string
                          description: Why these specific tasks were chosen
                        tasksInstructions:
                          type:
                            - array
                          items:
                            type:
                              - string
                          description: >-
                            List of task instructions that will be executed in
                            parallel
                      required:
                        - outputType
                        - reasoning
                        - tasksInstructions
                      title: Tasks
                    - type:
                        - object
                      properties:
                        outputType:
                          type:
                            - string
                          enum:
                            - stop
                        reasoning:
                          type:
                            - string
                          description: Why the AI decided to stop researching
                      required:
                        - outputType
                        - reasoning
                      title: Stop
                  description: >-
                    The plan's decision: either generate tasks or stop
                    researching
                createdAt:
                  type:
                    - number
                  description: When this event occurred (Unix timestamp in milliseconds)
                researchId:
                  type:
                    - string
                  description: The research request this event belongs to
              required:
                - eventType
                - planId
                - output
                - createdAt
                - researchId
              title: Plan Output
        - discriminator:
            propertyName: eventType
          oneOf:
            - type:
                - object
              properties:
                eventType:
                  type:
                    - string
                  enum:
                    - task-definition
                planId:
                  type:
                    - string
                  description: The plan that generated this task
                taskId:
                  type:
                    - string
                  description: Identifier for tracking this specific task
                instructions:
                  type:
                    - string
                  description: What this task should accomplish
                createdAt:
                  type:
                    - number
                  description: When this event occurred (Unix timestamp in milliseconds)
                researchId:
                  type:
                    - string
                  description: The research request this event belongs to
              required:
                - eventType
                - planId
                - taskId
                - instructions
                - createdAt
                - researchId
              title: Task Definition
            - type:
                - object
              properties:
                eventType:
                  type:
                    - string
                  enum:
                    - task-operation
                planId:
                  type:
                    - string
                  description: The plan that owns this task
                taskId:
                  type:
                    - string
                  description: Which task is performing this operation
                operationId:
                  type:
                    - string
                  description: Unique identifier for this specific operation
                data:
                  discriminator:
                    propertyName: type
                  oneOf:
                    - type:
                        - object
                      properties:
                        type:
                          type:
                            - string
                          enum:
                            - think
                        content:
                          type:
                            - string
                          description: The AI's reasoning process and decision-making steps
                      required:
                        - type
                        - content
                      title: Think
                    - type:
                        - object
                      properties:
                        type:
                          type:
                            - string
                          enum:
                            - search
                        searchType:
                          type:
                            - string
                          enum:
                            - neural
                            - keyword
                            - auto
                            - fast
                          description: >-
                            Search algorithm used (neural for semantic search,
                            keyword for exact matches)
                        goal:
                          type:
                            - string
                          description: What the AI is trying to find with this search
                        query:
                          type:
                            - string
                          description: The exact search query sent to the search engine
                        results:
                          type:
                            - array
                          items:
                            type:
                              - object
                            properties:
                              url:
                                type:
                                  - string
                            required:
                              - url
                          description: URLs returned by the search, ranked by relevance
                        pageTokens:
                          type:
                            - number
                          description: Token cost for processing search result snippets
                      required:
                        - type
                        - searchType
                        - query
                        - results
                        - pageTokens
                      title: Search
                    - type:
                        - object
                      properties:
                        type:
                          type:
                            - string
                          enum:
                            - crawl
                        goal:
                          type:
                            - string
                          description: What information the AI expects to find on this page
                        result:
                          type:
                            - object
                          properties:
                            url:
                              type:
                                - string
                          required:
                            - url
                          description: The specific page that was crawled
                        pageTokens:
                          type:
                            - number
                          description: Token cost for processing the full page content
                      required:
                        - type
                        - result
                        - pageTokens
                      title: Crawl
                  description: The actual operation performed within this task
                createdAt:
                  type:
                    - number
                  description: When this event occurred (Unix timestamp in milliseconds)
                researchId:
                  type:
                    - string
                  description: The research request this event belongs to
              required:
                - eventType
                - planId
                - taskId
                - operationId
                - data
                - createdAt
                - researchId
              title: Task Operation
            - type:
                - object
              properties:
                eventType:
                  type:
                    - string
                  enum:
                    - task-output
                planId:
                  type:
                    - string
                  description: The plan that owns this task
                taskId:
                  type:
                    - string
                  description: Which task produced this output
                output:
                  type:
                    - object
                  properties:
                    outputType:
                      type:
                        - string
                      enum:
                        - completed
                    content:
                      type:
                        - string
                      description: The information gathered by this task
                  required:
                    - outputType
                    - content
                  description: The successful completion result of this task
                createdAt:
                  type:
                    - number
                  description: When this event occurred (Unix timestamp in milliseconds)
                researchId:
                  type:
                    - string
                  description: The research request this event belongs to
              required:
                - eventType
                - planId
                - taskId
                - output
                - createdAt
                - researchId
              title: Task Output
```

# Search

> The search endpoint lets you intelligently search the web and extract contents from the results.

By default, it automatically chooses between traditional keyword search and Exa's embeddings-based model, to find the most relevant results for your query.

## OpenAPI

`````yaml post /search
paths:
  path: /search
  method: post
  servers:
    - url: https://api.exa.ai
  request:
    security:
      - title: apikey
        parameters:
          query: {}
          header:
            x-api-key:
              type: apiKey
              description: >-
                API key can be provided either via x-api-key header or
                Authorization header with Bearer scheme
          cookie: {}
    parameters:
      path: {}
      query: {}
      header: {}
      cookie: {}
    body:
      application/json:
        schemaArray:
          - type: object
            properties:
              query:
                allOf:
                  - type: string
                    example: Latest developments in LLM capabilities
                    default: Latest developments in LLM capabilities
                    description: The query string for the search.
              type:
                allOf:
                  - type: string
                    enum:
                      - keyword
                      - neural
                      - fast
                      - auto
                    description: >-
                      The type of search. Neural uses an embeddings-based model,
                      keyword is google-like SERP, and auto (default)
                      intelligently combines the two. Fast uses streamlined
                      versions of the neural and keyword models.
                    example: auto
                    default: auto
              category:
                allOf:
                  - type: string
                    enum:
                      - company
                      - research paper
                      - news
                      - pdf
                      - github
                      - tweet
                      - personal site
                      - linkedin profile
                      - financial report
                    description: A data category to focus on.
                    example: research paper
              userLocation:
                allOf:
                  - type: string
                    description: The two-letter ISO country code of the user, e.g. US.
                    example: US
              numResults:
                allOf:
                  - type: integer
                    maximum: 100
                    default: 10
                    description: >
                      Number of results to return. Limits vary by search type:

                      - With "keyword": max 10 results

                      - With "neural": max 100 results


                      If you want to increase the num results beyond these
                      limits, contact sales (hello@exa.ai)
                    example: 10
              includeDomains:
                allOf:
                  - type: array
                    items:
                      type: string
                    description: >-
                      List of domains to include in the search. If specified,
                      results will only come from these domains.
                    example:
                      - arxiv.org
                      - paperswithcode.com
              excludeDomains:
                allOf:
                  - type: array
                    items:
                      type: string
                    description: >-
                      List of domains to exclude from search results. If
                      specified, no results will be returned from these domains.
              startCrawlDate:
                allOf:
                  - type: string
                    format: date-time
                    description: >-
                      Crawl date refers to the date that Exa discovered a link.
                      Results will include links that were crawled after this
                      date. Must be specified in ISO 8601 format.
                    example: '2023-01-01T00:00:00.000Z'
              endCrawlDate:
                allOf:
                  - type: string
                    format: date-time
                    description: >-
                      Crawl date refers to the date that Exa discovered a link.
                      Results will include links that were crawled before this
                      date. Must be specified in ISO 8601 format.
                    example: '2023-12-31T00:00:00.000Z'
              startPublishedDate:
                allOf:
                  - type: string
                    format: date-time
                    description: >-
                      Only links with a published date after this will be
                      returned. Must be specified in ISO 8601 format.
                    example: '2023-01-01T00:00:00.000Z'
              endPublishedDate:
                allOf:
                  - type: string
                    format: date-time
                    description: >-
                      Only links with a published date before this will be
                      returned. Must be specified in ISO 8601 format.
                    example: '2023-12-31T00:00:00.000Z'
              includeText:
                allOf:
                  - type: array
                    items:
                      type: string
                    description: >-
                      List of strings that must be present in webpage text of
                      results. Currently, only 1 string is supported, of up to 5
                      words.
                    example:
                      - large language model
              excludeText:
                allOf:
                  - type: array
                    items:
                      type: string
                    description: >-
                      List of strings that must not be present in webpage text
                      of results. Currently, only 1 string is supported, of up
                      to 5 words. Checks from the first 1000 words of the
                      webpage text.
                    example:
                      - course
              context:
                allOf:
                  - oneOf:
                      - type: boolean
                        description: >-
                          Formats the search results into a context string ready
                          for LLMs.
                        example: true
                      - type: object
                        description: >-
                          Formats the search results into a context string ready
                          for LLMs.
                        properties:
                          maxCharacters:
                            type: integer
                            description: Maximum character limit.
                            example: 10000
              moderation:
                allOf:
                  - type: boolean
                    default: false
                    description: >-
                      Enable content moderation to filter unsafe content from
                      search results.
                    example: true
              contents:
                allOf:
                  - $ref: '#/components/schemas/ContentsRequest'
            required: true
            refIdentifier: '#/components/schemas/CommonRequest'
            requiredProperties:
              - query
        examples:
          example:
            value:
              query: Latest developments in LLM capabilities
              type: auto
              category: research paper
              userLocation: US
              numResults: 10
              includeDomains:
                - arxiv.org
                - paperswithcode.com
              excludeDomains:
                - <string>
              startCrawlDate: '2023-01-01T00:00:00.000Z'
              endCrawlDate: '2023-12-31T00:00:00.000Z'
              startPublishedDate: '2023-01-01T00:00:00.000Z'
              endPublishedDate: '2023-12-31T00:00:00.000Z'
              includeText:
                - large language model
              excludeText:
                - course
              context: true
              moderation: true
              contents:
                text: true
                highlights:
                  numSentences: 1
                  highlightsPerUrl: 1
                  query: Key advancements
                summary:
                  query: Main developments
                  schema:
                    $schema: http://json-schema.org/draft-07/schema#
                    title: Title
                    type: object
                    properties:
                      Property 1:
                        type: string
                        description: Description
                      Property 2:
                        type: string
                        enum:
                          - option 1
                          - option 2
                          - option 3
                        description: Description
                    required:
                      - Property 1
                livecrawl: always
                livecrawlTimeout: 1000
                subpages: 1
                subpageTarget: sources
                extras:
                  links: 1
                  imageLinks: 1
                context: true
    codeSamples:
      - label: Simple search and contents
        lang: bash
        source: |
          curl -X POST 'https://api.exa.ai/search' \
            -H 'x-api-key: YOUR-EXA-API-KEY' \
            -H 'Content-Type: application/json' \
            -d '{
              "query": "Latest research in LLMs",
              "text": true
            }'
      - label: Simple search and contents
        lang: python
        source: |
          # pip install exa-py
          from exa_py import Exa
          exa = Exa('YOUR_EXA_API_KEY')

          results = exa.search_and_contents(
              "Latest research in LLMs",
              text=True
          )

          print(results)
      - label: Simple search and contents
        lang: javascript
        source: |
          // npm install exa-js
          import Exa from 'exa-js';
          const exa = new Exa('YOUR_EXA_API_KEY');

          const results = await exa.searchAndContents(
              'Latest research in LLMs',
              { text: true }
          );

          console.log(results);
      - label: Simple search and contents
        lang: php
        source: ''
      - label: Simple search and contents
        lang: go
        source: ''
      - label: Simple search and contents
        lang: java
        source: ''
      - label: Advanced search with filters
        lang: bash
        source: |
          curl --request POST \
            --url https://api.exa.ai/search \
            --header 'x-api-key: <token>' \
            --header 'Content-Type: application/json' \
            --data '{
            "query": "Latest research in LLMs",
            "type": "auto",
            "category": "research paper",
            "numResults": 10,
            "moderation": true,
            "contents": {
              "text": true,
              "summary": {
                "query": "Main developments"
              },
              "subpages": 1,
              "subpageTarget": "sources",
              "extras": {
                "links": 1,
                "imageLinks": 1
              }
            }
          }'
      - label: Advanced search with filters
        lang: python
        source: |
          # pip install exa-py
          from exa_py import Exa
          exa = Exa('YOUR_EXA_API_KEY')

          results = exa.search_and_contents(
              "Latest research in LLMs",
              type="auto",
              category="research paper",
              num_results=10,
              moderation=True,
              text=True,
              summary={
                  "query": "Main developments"
              },
              subpages=1,
              subpage_target="sources",
              extras={
                  "links": 1,
                  "image_links": 1
              }
          )

          print(results)
      - label: Advanced search with filters
        lang: javascript
        source: >
          // npm install exa-js

          import Exa from 'exa-js';

          const exa = new Exa('YOUR_EXA_API_KEY');


          const results = await exa.searchAndContents('Latest research in LLMs',
          {
              type: 'auto',
              category: 'research paper',
              numResults: 10,
              moderation: true,
              contents: {
                  text: true,
                  summary: {
                      query: 'Main developments'
                  },
                  subpages: 1,
                  subpageTarget: 'sources',
                  extras: {
                      links: 1,
                      imageLinks: 1
                  }
              }
          });


          console.log(results);
      - label: Advanced search with filters
        lang: php
        source: ''
      - label: Advanced search with filters
        lang: go
        source: ''
      - label: Advanced search with filters
        lang: java
        source: ''
  response:
    '200':
      application/json:
        schemaArray:
          - type: object
            properties:
              requestId:
                allOf:
                  - type: string
                    description: Unique identifier for the request
                    example: b5947044c4b78efa9552a7c89b306d95
              resolvedSearchType:
                allOf:
                  - type: string
                    enum:
                      - neural
                      - keyword
                    description: The search type that was actually used for this request
                    example: neural
              results:
                allOf:
                  - type: array
                    description: >-
                      A list of search results containing title, URL, published
                      date, and author.
                    items:
                      $ref: '#/components/schemas/ResultWithContent'
              searchType:
                allOf:
                  - type: string
                    enum:
                      - neural
                      - keyword
                    description: >-
                      For auto searches, indicates which search type was
                      selected.
                    example: auto
              context:
                allOf:
                  - type: string
                    description: A formatted string of the search results ready for LLMs.
              costDollars:
                allOf:
                  - $ref: '#/components/schemas/CostDollars'
        examples:
          example:
            value:
              requestId: b5947044c4b78efa9552a7c89b306d95
              resolvedSearchType: neural
              results:
                - title: A Comprehensive Overview of Large Language Models
                  url: https://arxiv.org/pdf/2307.06435.pdf
                  publishedDate: '2023-11-16T01:36:32.547Z'
                  author: >-
                    Humza  Naveed, University of Engineering and Technology
                    (UET), Lahore, Pakistan
                  id: https://arxiv.org/abs/2307.06435
                  image: https://arxiv.org/pdf/2307.06435.pdf/page_1.png
                  favicon: https://arxiv.org/favicon.ico
                  text: >-
                    Abstract Large Language Models (LLMs) have recently
                    demonstrated remarkable capabilities...
                  highlights:
                    - Such requirements have limited their adoption...
                  highlightScores:
                    - 0.4600165784358978
                  summary: >-
                    This overview paper on Large Language Models (LLMs)
                    highlights key developments...
                  subpages:
                    - id: https://arxiv.org/abs/2303.17580
                      url: https://arxiv.org/pdf/2303.17580.pdf
                      title: >-
                        HuggingGPT: Solving AI Tasks with ChatGPT and its
                        Friends in Hugging Face
                      author: >-
                        Yongliang  Shen, Microsoft Research Asia, Kaitao  Song,
                        Microsoft Research Asia, Xu  Tan, Microsoft Research
                        Asia, Dongsheng  Li, Microsoft Research Asia, Weiming
                        Lu, Microsoft Research Asia, Yueting  Zhuang, Microsoft
                        Research Asia, yzhuang@zju.edu.cn, Zhejiang  University,
                        Microsoft Research Asia, Microsoft  Research, Microsoft
                        Research Asia
                      publishedDate: '2023-11-16T01:36:20.486Z'
                      text: >-
                        HuggingGPT: Solving AI Tasks with ChatGPT and its
                        Friends in Hugging Face Date Published: 2023-05-25
                        Authors: Yongliang Shen, Microsoft Research Asia Kaitao
                        Song, Microsoft Research Asia Xu Tan, Microsoft Research
                        Asia Dongsheng Li, Microsoft Research Asia Weiming Lu,
                        Microsoft Research Asia Yueting Zhuang, Microsoft
                        Research Asia, yzhuang@zju.edu.cn Zhejiang University,
                        Microsoft Research Asia Microsoft Research, Microsoft
                        Research Asia Abstract Solving complicated AI tasks with
                        different domains and modalities is a key step toward
                        artificial general intelligence. While there are
                        abundant AI models available for different domains and
                        modalities, they cannot handle complicated AI tasks.
                        Considering large language models (LLMs) have exhibited
                        exceptional ability in language understanding,
                        generation, interaction, and reasoning, we advocate that
                        LLMs could act as a controller to manage existing AI
                        models to solve complicated AI tasks and language could
                        be a generic interface to empower t
                      summary: >-
                        HuggingGPT is a framework using ChatGPT as a central
                        controller to orchestrate various AI models from Hugging
                        Face to solve complex tasks. ChatGPT plans the task,
                        selects appropriate models based on their descriptions,
                        executes subtasks, and summarizes the results. This
                        approach addresses limitations of LLMs by allowing them
                        to handle multimodal data (vision, speech) and
                        coordinate multiple models for complex tasks, paving the
                        way for more advanced AI systems.
                      highlights:
                        - >-
                          2) Recently, some researchers started to investigate
                          the integration of using tools or models in LLMs  .
                      highlightScores:
                        - 0.32679107785224915
                  extras:
                    links: []
              searchType: auto
              context: <string>
              costDollars:
                total: 0.005
                breakDown:
                  - search: 0.005
                    contents: 0
                    breakdown:
                      keywordSearch: 0
                      neuralSearch: 0.005
                      contentText: 0
                      contentHighlight: 0
                      contentSummary: 0
                perRequestPrices:
                  neuralSearch_1_25_results: 0.005
                  neuralSearch_26_100_results: 0.025
                  neuralSearch_100_plus_results: 1
                  keywordSearch_1_100_results: 0.0025
                  keywordSearch_100_plus_results: 3
                perPagePrices:
                  contentText: 0.001
                  contentHighlight: 0.001
                  contentSummary: 0.001
        description: OK
  deprecated: false
  type: path
components:
  schemas:
    ContentsRequest:
      type: object
      properties:
        text:
          oneOf:
            - type: boolean
              title: Simple text retrieval
              description: >-
                If true, returns full page text with default settings. If false,
                disables text return.
            - type: object
              title: Advanced text options
              description: >-
                Advanced options for controlling text extraction. Use this when
                you need to limit text length or include HTML structure.
              properties:
                maxCharacters:
                  type: integer
                  description: >-
                    Maximum character limit for the full page text. Useful for
                    controlling response size and API costs.
                  example: 1000
                includeHtmlTags:
                  type: boolean
                  default: false
                  description: >-
                    Include HTML tags in the response, which can help LLMs
                    understand text structure and formatting.
                  example: false
        highlights:
          type: object
          description: Text snippets the LLM identifies as most relevant from each page.
          properties:
            numSentences:
              type: integer
              minimum: 1
              description: The number of sentences to return for each snippet.
              example: 1
            highlightsPerUrl:
              type: integer
              minimum: 1
              description: The number of snippets to return for each result.
              example: 1
            query:
              type: string
              description: Custom query to direct the LLM's selection of highlights.
              example: Key advancements
        summary:
          type: object
          description: Summary of the webpage
          properties:
            query:
              type: string
              description: Custom query for the LLM-generated summary.
              example: Main developments
            schema:
              type: object
              description: >
                JSON schema for structured output from summary.

                See https://json-schema.org/overview/what-is-jsonschema for JSON
                Schema documentation.
              example:
                $schema: http://json-schema.org/draft-07/schema#
                title: Title
                type: object
                properties:
                  Property 1:
                    type: string
                    description: Description
                  Property 2:
                    type: string
                    enum:
                      - option 1
                      - option 2
                      - option 3
                    description: Description
                required:
                  - Property 1
        livecrawl:
          type: string
          enum:
            - never
            - fallback
            - always
            - preferred
          description: >
            Options for livecrawling pages.

            'never': Disable livecrawling (default for neural search).

            'fallback': Livecrawl when cache is empty (default for keyword
            search).

            'always': Always livecrawl.

            'preferred': Always try to livecrawl, but fall back to cache if
            crawling fails.
          example: always
        livecrawlTimeout:
          type: integer
          default: 10000
          description: The timeout for livecrawling in milliseconds.
          example: 1000
        subpages:
          type: integer
          default: 0
          description: >-
            The number of subpages to crawl. The actual number crawled may be
            limited by system constraints.
          example: 1
        subpageTarget:
          oneOf:
            - type: string
            - type: array
              items:
                type: string
          description: >-
            Keyword to find specific subpages of search results. Can be a single
            string or an array of strings, comma delimited.
          example: sources
        extras:
          type: object
          description: Extra parameters to pass.
          properties:
            links:
              type: integer
              default: 0
              description: Number of URLs to return from each webpage.
              example: 1
            imageLinks:
              type: integer
              default: 0
              description: Number of images to return for each result.
              example: 1
        context:
          oneOf:
            - type: boolean
              description: Formats the search resutls into a context string ready for LLMs.
              example: true
            - type: object
              description: Formats the search resutls into a context string ready for LLMs.
              properties:
                maxCharacters:
                  type: integer
                  description: Maximum character limit.
                  example: 10000
    Result:
      type: object
      properties:
        title:
          type: string
          description: The title of the search result.
          example: A Comprehensive Overview of Large Language Models
        url:
          type: string
          format: uri
          description: The URL of the search result.
          example: https://arxiv.org/pdf/2307.06435.pdf
        publishedDate:
          type: string
          nullable: true
          description: >-
            An estimate of the creation date, from parsing HTML content. Format
            is YYYY-MM-DD.
          example: '2023-11-16T01:36:32.547Z'
        author:
          type: string
          nullable: true
          description: If available, the author of the content.
          example: >-
            Humza  Naveed, University of Engineering and Technology (UET),
            Lahore, Pakistan
        id:
          type: string
          description: The temporary ID for the document. Useful for /contents endpoint.
          example: https://arxiv.org/abs/2307.06435
        image:
          type: string
          format: uri
          description: The URL of an image associated with the search result, if available.
          example: https://arxiv.org/pdf/2307.06435.pdf/page_1.png
        favicon:
          type: string
          format: uri
          description: The URL of the favicon for the search result's domain.
          example: https://arxiv.org/favicon.ico
    ResultWithContent:
      allOf:
        - $ref: '#/components/schemas/Result'
        - type: object
          properties:
            text:
              type: string
              description: The full content text of the search result.
              example: >-
                Abstract Large Language Models (LLMs) have recently demonstrated
                remarkable capabilities...
            highlights:
              type: array
              items:
                type: string
              description: Array of highlights extracted from the search result content.
              example:
                - Such requirements have limited their adoption...
            highlightScores:
              type: array
              items:
                type: number
                format: float
              description: Array of cosine similarity scores for each highlighted
              example:
                - 0.4600165784358978
            summary:
              type: string
              description: Summary of the webpage
              example: >-
                This overview paper on Large Language Models (LLMs) highlights
                key developments...
            subpages:
              type: array
              items:
                $ref: '#/components/schemas/ResultWithContent'
              description: Array of subpages for the search result.
              example:
                - id: https://arxiv.org/abs/2303.17580
                  url: https://arxiv.org/pdf/2303.17580.pdf
                  title: >-
                    HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in
                    Hugging Face
                  author: >-
                    Yongliang  Shen, Microsoft Research Asia, Kaitao  Song,
                    Microsoft Research Asia, Xu  Tan, Microsoft Research Asia,
                    Dongsheng  Li, Microsoft Research Asia, Weiming  Lu,
                    Microsoft Research Asia, Yueting  Zhuang, Microsoft Research
                    Asia, yzhuang@zju.edu.cn, Zhejiang  University, Microsoft
                    Research Asia, Microsoft  Research, Microsoft Research Asia
                  publishedDate: '2023-11-16T01:36:20.486Z'
                  text: >-
                    HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in
                    Hugging Face Date Published: 2023-05-25 Authors: Yongliang
                    Shen, Microsoft Research Asia Kaitao Song, Microsoft
                    Research Asia Xu Tan, Microsoft Research Asia Dongsheng Li,
                    Microsoft Research Asia Weiming Lu, Microsoft Research Asia
                    Yueting Zhuang, Microsoft Research Asia, yzhuang@zju.edu.cn
                    Zhejiang University, Microsoft Research Asia Microsoft
                    Research, Microsoft Research Asia Abstract Solving
                    complicated AI tasks with different domains and modalities
                    is a key step toward artificial general intelligence. While
                    there are abundant AI models available for different domains
                    and modalities, they cannot handle complicated AI tasks.
                    Considering large language models (LLMs) have exhibited
                    exceptional ability in language understanding, generation,
                    interaction, and reasoning, we advocate that LLMs could act
                    as a controller to manage existing AI models to solve
                    complicated AI tasks and language could be a generic
                    interface to empower t
                  summary: >-
                    HuggingGPT is a framework using ChatGPT as a central
                    controller to orchestrate various AI models from Hugging
                    Face to solve complex tasks. ChatGPT plans the task, selects
                    appropriate models based on their descriptions, executes
                    subtasks, and summarizes the results. This approach
                    addresses limitations of LLMs by allowing them to handle
                    multimodal data (vision, speech) and coordinate multiple
                    models for complex tasks, paving the way for more advanced
                    AI systems.
                  highlights:
                    - >-
                      2) Recently, some researchers started to investigate the
                      integration of using tools or models in LLMs  .
                  highlightScores:
                    - 0.32679107785224915
            extras:
              type: object
              description: Results from extras.
              properties:
                links:
                  type: array
                  items:
                    type: string
                  description: Array of links from the search result.
                  example: []
    CostDollars:
      type: object
      properties:
        total:
          type: number
          format: float
          description: Total dollar cost for your request
          example: 0.005
        breakDown:
          type: array
          description: Breakdown of costs by operation type
          items:
            type: object
            properties:
              search:
                type: number
                format: float
                description: Cost of your search operations
                example: 0.005
              contents:
                type: number
                format: float
                description: Cost of your content operations
                example: 0
              breakdown:
                type: object
                properties:
                  keywordSearch:
                    type: number
                    format: float
                    description: Cost of your keyword search operations
                    example: 0
                  neuralSearch:
                    type: number
                    format: float
                    description: Cost of your neural search operations
                    example: 0.005
                  contentText:
                    type: number
                    format: float
                    description: Cost of your text content retrieval
                    example: 0
                  contentHighlight:
                    type: number
                    format: float
                    description: Cost of your highlight generation
                    example: 0
                  contentSummary:
                    type: number
                    format: float
                    description: Cost of your summary generation
                    example: 0
        perRequestPrices:
          type: object
          description: Standard price per request for different operations
          properties:
            neuralSearch_1_25_results:
              type: number
              format: float
              description: Standard price for neural search with 1-25 results
              example: 0.005
            neuralSearch_26_100_results:
              type: number
              format: float
              description: Standard price for neural search with 26-100 results
              example: 0.025
            neuralSearch_100_plus_results:
              type: number
              format: float
              description: Standard price for neural search with 100+ results
              example: 1
            keywordSearch_1_100_results:
              type: number
              format: float
              description: Standard price for keyword search with 1-100 results
              example: 0.0025
            keywordSearch_100_plus_results:
              type: number
              format: float
              description: Standard price for keyword search with 100+ results
              example: 3
        perPagePrices:
          type: object
          description: Standard price per page for different content operations
          properties:
            contentText:
              type: number
              format: float
              description: Standard price per page for text content
              example: 0.001
            contentHighlight:
              type: number
              format: float
              description: Standard price per page for highlights
              example: 0.001
            contentSummary:
              type: number
              format: float
              description: Standard price per page for summaries
              example: 0.001

````# Get contents

> Get the full page contents, summaries, and metadata for a list of URLs.

Returns instant results from our cache, with automatic live crawling as fallback for uncached pages.

## OpenAPI

````yaml post /contents
paths:
  path: /contents
  method: post
  servers:
    - url: https://api.exa.ai
  request:
    security:
      - title: apikey
        parameters:
          query: {}
          header:
            x-api-key:
              type: apiKey
              description: >-
                API key can be provided either via x-api-key header or
                Authorization header with Bearer scheme
          cookie: {}
    parameters:
      path: {}
      query: {}
      header: {}
      cookie: {}
    body:
      application/json:
        schemaArray:
          - type: object
            properties:
              urls:
                allOf:
                  - type: array
                    description: >-
                      Array of URLs to crawl (backwards compatible with 'ids'
                      parameter).
                    items:
                      type: string
                    example:
                      - https://arxiv.org/pdf/2307.06435
                    default:
                      - https://arxiv.org/pdf/2307.06435
              ids:
                allOf:
                  - type: array
                    deprecated: true
                    description: >-
                      Deprecated - use 'urls' instead. Array of document IDs
                      obtained from searches.
                    items:
                      type: string
                    example:
                      - https://arxiv.org/pdf/2307.06435
              text:
                allOf:
                  - oneOf:
                      - type: boolean
                        title: Simple text retrieval
                        description: >-
                          If true, returns full page text with default settings.
                          If false, disables text return.
                      - type: object
                        title: Advanced text options
                        description: >-
                          Advanced options for controlling text extraction. Use
                          this when you need to limit text length or include
                          HTML structure.
                        properties:
                          maxCharacters:
                            type: integer
                            description: >-
                              Maximum character limit for the full page text.
                              Useful for controlling response size and API
                              costs.
                            example: 1000
                          includeHtmlTags:
                            type: boolean
                            default: false
                            description: >-
                              Include HTML tags in the response, which can help
                              LLMs understand text structure and formatting.
                            example: false
              highlights:
                allOf:
                  - type: object
                    description: >-
                      Text snippets the LLM identifies as most relevant from
                      each page.
                    properties:
                      numSentences:
                        type: integer
                        minimum: 1
                        description: The number of sentences to return for each snippet.
                        example: 1
                      highlightsPerUrl:
                        type: integer
                        minimum: 1
                        description: The number of snippets to return for each result.
                        example: 1
                      query:
                        type: string
                        description: >-
                          Custom query to direct the LLM's selection of
                          highlights.
                        example: Key advancements
              summary:
                allOf:
                  - type: object
                    description: Summary of the webpage
                    properties:
                      query:
                        type: string
                        description: Custom query for the LLM-generated summary.
                        example: Main developments
                      schema:
                        type: object
                        description: >
                          JSON schema for structured output from summary.

                          See
                          https://json-schema.org/overview/what-is-jsonschema
                          for JSON Schema documentation.
                        example:
                          $schema: http://json-schema.org/draft-07/schema#
                          title: Title
                          type: object
                          properties:
                            Property 1:
                              type: string
                              description: Description
                            Property 2:
                              type: string
                              enum:
                                - option 1
                                - option 2
                                - option 3
                              description: Description
                          required:
                            - Property 1
              livecrawl:
                allOf:
                  - type: string
                    enum:
                      - never
                      - fallback
                      - always
                      - preferred
                    description: >
                      Options for livecrawling pages.

                      'never': Disable livecrawling (default for neural search).

                      'fallback': Livecrawl when cache is empty (default for
                      keyword search).

                      'always': Always livecrawl.

                      'preferred': Always try to livecrawl, but fall back to
                      cache if crawling fails.
                    example: always
              livecrawlTimeout:
                allOf:
                  - type: integer
                    default: 10000
                    description: The timeout for livecrawling in milliseconds.
                    example: 1000
              subpages:
                allOf:
                  - type: integer
                    default: 0
                    description: >-
                      The number of subpages to crawl. The actual number crawled
                      may be limited by system constraints.
                    example: 1
              subpageTarget:
                allOf:
                  - oneOf:
                      - type: string
                      - type: array
                        items:
                          type: string
                    description: >-
                      Keyword to find specific subpages of search results. Can
                      be a single string or an array of strings, comma
                      delimited.
                    example: sources
              extras:
                allOf:
                  - type: object
                    description: Extra parameters to pass.
                    properties:
                      links:
                        type: integer
                        default: 0
                        description: Number of URLs to return from each webpage.
                        example: 1
                      imageLinks:
                        type: integer
                        default: 0
                        description: Number of images to return for each result.
                        example: 1
              context:
                allOf:
                  - oneOf:
                      - type: boolean
                        description: >-
                          Formats the search resutls into a context string ready
                          for LLMs.
                        example: true
                      - type: object
                        description: >-
                          Formats the search resutls into a context string ready
                          for LLMs.
                        properties:
                          maxCharacters:
                            type: integer
                            description: Maximum character limit.
                            example: 10000
            required: true
            refIdentifier: '#/components/schemas/ContentsRequest'
            requiredProperties:
              - urls
        examples:
          example:
            value:
              urls:
                - https://arxiv.org/pdf/2307.06435
              ids:
                - https://arxiv.org/pdf/2307.06435
              text: true
              highlights:
                numSentences: 1
                highlightsPerUrl: 1
                query: Key advancements
              summary:
                query: Main developments
                schema:
                  $schema: http://json-schema.org/draft-07/schema#
                  title: Title
                  type: object
                  properties:
                    Property 1:
                      type: string
                      description: Description
                    Property 2:
                      type: string
                      enum:
                        - option 1
                        - option 2
                        - option 3
                      description: Description
                  required:
                    - Property 1
              livecrawl: always
              livecrawlTimeout: 1000
              subpages: 1
              subpageTarget: sources
              extras:
                links: 1
                imageLinks: 1
              context: true
    codeSamples:
      - label: Simple contents retrieval
        lang: bash
        source: |
          curl -X POST 'https://api.exa.ai/contents' \
            -H 'x-api-key: YOUR-EXA-API-KEY' \
            -H 'Content-Type: application/json' \
            -d '{
              "urls": ["https://arxiv.org/abs/2307.06435"],
              "text": true
            }'
      - label: Simple contents retrieval
        lang: python
        source: |
          # pip install exa-py
          from exa_py import Exa
          exa = Exa('YOUR_EXA_API_KEY')

          results = exa.get_contents(
              urls=["https://arxiv.org/abs/2307.06435"],
              text=True
          )

          print(results)
      - label: Simple contents retrieval
        lang: javascript
        source: |
          // npm install exa-js
          import Exa from 'exa-js';
          const exa = new Exa('YOUR_EXA_API_KEY');

          const results = await exa.getContents(
              ["https://arxiv.org/abs/2307.06435"],
              { text: true }
          );

          console.log(results);
      - label: Simple contents retrieval
        lang: php
        source: ''
      - label: Simple contents retrieval
        lang: go
        source: ''
      - label: Simple contents retrieval
        lang: java
        source: ''
      - label: Advanced contents retrieval
        lang: bash
        source: |
          curl --request POST \
            --url https://api.exa.ai/contents \
            --header 'x-api-key: YOUR-EXA-API-KEY' \
            --header 'Content-Type: application/json' \
            --data '{
              "urls": ["https://arxiv.org/abs/2307.06435"],
              "text": {
                "maxCharacters": 1000,
                "includeHtmlTags": false
              },
              "highlights": {
                "numSentences": 3,
                "highlightsPerUrl": 2,
                "query": "Key findings"
              },
              "summary": {
                "query": "Main research contributions"
              },
              "subpages": 1,
              "subpageTarget": "references",
              "extras": {
                "links": 2,
                "imageLinks": 1
              }
            }'
      - label: Advanced contents retrieval
        lang: python
        source: |
          # pip install exa-py
          from exa_py import Exa
          exa = Exa('YOUR_EXA_API_KEY')

          results = exa.get_contents(
              urls=["https://arxiv.org/abs/2307.06435"],
              text={
                  "maxCharacters": 1000,
                  "includeHtmlTags": False
              },
              highlights={
                  "numSentences": 3,
                  "highlightsPerUrl": 2,
                  "query": "Key findings"
              },
              summary={
                  "query": "Main research contributions"
              },
              subpages=1,
              subpage_target="references",
              extras={
                  "links": 2,
                  "image_links": 1
              }
          )

          print(results)
      - label: Advanced contents retrieval
        lang: javascript
        source: |
          // npm install exa-js
          import Exa from 'exa-js';
          const exa = new Exa('YOUR_EXA_API_KEY');

          const results = await exa.getContents(
              ["https://arxiv.org/abs/2307.06435"],
              {
                  text: {
                      maxCharacters: 1000,
                      includeHtmlTags: false
                  },
                  highlights: {
                      numSentences: 3,
                      highlightsPerUrl: 2,
                      query: "Key findings"
                  },
                  summary: {
                      query: "Main research contributions"
                  },
                  subpages: 1,
                  subpageTarget: "references",
                  extras: {
                      links: 2,
                      imageLinks: 1
                  }
              }
          );

          console.log(results);
  response:
    '200':
      application/json:
        schemaArray:
          - type: object
            properties:
              requestId:
                allOf:
                  - type: string
                    description: Unique identifier for the request
                    example: e492118ccdedcba5088bfc4357a8a125
              results:
                allOf:
                  - type: array
                    items:
                      $ref: '#/components/schemas/ResultWithContent'
              context:
                allOf:
                  - type: string
                    description: A formatted string of the search results ready for LLMs.
              statuses:
                allOf:
                  - type: array
                    description: Status information for each requested URL
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                          description: The URL that was requested
                          example: https://example.com
                        status:
                          type: string
                          enum:
                            - success
                            - error
                          description: Status of the content fetch operation
                          example: success
                        error:
                          type: object
                          nullable: true
                          description: Error details, only present when status is "error"
                          properties:
                            tag:
                              type: string
                              enum:
                                - CRAWL_NOT_FOUND
                                - CRAWL_TIMEOUT
                                - CRAWL_LIVECRAWL_TIMEOUT
                                - SOURCE_NOT_AVAILABLE
                                - CRAWL_UNKNOWN_ERROR
                              description: Specific error type
                              example: CRAWL_NOT_FOUND
                            httpStatusCode:
                              type: integer
                              nullable: true
                              description: The corresponding HTTP status code
                              example: 404
              costDollars:
                allOf:
                  - $ref: '#/components/schemas/CostDollars'
        examples:
          example:
            value:
              requestId: e492118ccdedcba5088bfc4357a8a125
              results:
                - title: A Comprehensive Overview of Large Language Models
                  url: https://arxiv.org/pdf/2307.06435.pdf
                  publishedDate: '2023-11-16T01:36:32.547Z'
                  author: >-
                    Humza  Naveed, University of Engineering and Technology
                    (UET), Lahore, Pakistan
                  id: https://arxiv.org/abs/2307.06435
                  image: https://arxiv.org/pdf/2307.06435.pdf/page_1.png
                  favicon: https://arxiv.org/favicon.ico
                  text: >-
                    Abstract Large Language Models (LLMs) have recently
                    demonstrated remarkable capabilities...
                  highlights:
                    - Such requirements have limited their adoption...
                  highlightScores:
                    - 0.4600165784358978
                  summary: >-
                    This overview paper on Large Language Models (LLMs)
                    highlights key developments...
                  subpages:
                    - id: https://arxiv.org/abs/2303.17580
                      url: https://arxiv.org/pdf/2303.17580.pdf
                      title: >-
                        HuggingGPT: Solving AI Tasks with ChatGPT and its
                        Friends in Hugging Face
                      author: >-
                        Yongliang  Shen, Microsoft Research Asia, Kaitao  Song,
                        Microsoft Research Asia, Xu  Tan, Microsoft Research
                        Asia, Dongsheng  Li, Microsoft Research Asia, Weiming
                        Lu, Microsoft Research Asia, Yueting  Zhuang, Microsoft
                        Research Asia, yzhuang@zju.edu.cn, Zhejiang  University,
                        Microsoft Research Asia, Microsoft  Research, Microsoft
                        Research Asia
                      publishedDate: '2023-11-16T01:36:20.486Z'
                      text: >-
                        HuggingGPT: Solving AI Tasks with ChatGPT and its
                        Friends in Hugging Face Date Published: 2023-05-25
                        Authors: Yongliang Shen, Microsoft Research Asia Kaitao
                        Song, Microsoft Research Asia Xu Tan, Microsoft Research
                        Asia Dongsheng Li, Microsoft Research Asia Weiming Lu,
                        Microsoft Research Asia Yueting Zhuang, Microsoft
                        Research Asia, yzhuang@zju.edu.cn Zhejiang University,
                        Microsoft Research Asia Microsoft Research, Microsoft
                        Research Asia Abstract Solving complicated AI tasks with
                        different domains and modalities is a key step toward
                        artificial general intelligence. While there are
                        abundant AI models available for different domains and
                        modalities, they cannot handle complicated AI tasks.
                        Considering large language models (LLMs) have exhibited
                        exceptional ability in language understanding,
                        generation, interaction, and reasoning, we advocate that
                        LLMs could act as a controller to manage existing AI
                        models to solve complicated AI tasks and language could
                        be a generic interface to empower t
                      summary: >-
                        HuggingGPT is a framework using ChatGPT as a central
                        controller to orchestrate various AI models from Hugging
                        Face to solve complex tasks. ChatGPT plans the task,
                        selects appropriate models based on their descriptions,
                        executes subtasks, and summarizes the results. This
                        approach addresses limitations of LLMs by allowing them
                        to handle multimodal data (vision, speech) and
                        coordinate multiple models for complex tasks, paving the
                        way for more advanced AI systems.
                      highlights:
                        - >-
                          2) Recently, some researchers started to investigate
                          the integration of using tools or models in LLMs  .
                      highlightScores:
                        - 0.32679107785224915
                  extras:
                    links: []
              context: <string>
              statuses:
                - id: https://example.com
                  status: success
                  error:
                    tag: CRAWL_NOT_FOUND
                    httpStatusCode: 404
              costDollars:
                total: 0.005
                breakDown:
                  - search: 0.005
                    contents: 0
                    breakdown:
                      keywordSearch: 0
                      neuralSearch: 0.005
                      contentText: 0
                      contentHighlight: 0
                      contentSummary: 0
                perRequestPrices:
                  neuralSearch_1_25_results: 0.005
                  neuralSearch_26_100_results: 0.025
                  neuralSearch_100_plus_results: 1
                  keywordSearch_1_100_results: 0.0025
                  keywordSearch_100_plus_results: 3
                perPagePrices:
                  contentText: 0.001
                  contentHighlight: 0.001
                  contentSummary: 0.001
        description: OK
  deprecated: false
  type: path
components:
  schemas:
    Result:
      type: object
      properties:
        title:
          type: string
          description: The title of the search result.
          example: A Comprehensive Overview of Large Language Models
        url:
          type: string
          format: uri
          description: The URL of the search result.
          example: https://arxiv.org/pdf/2307.06435.pdf
        publishedDate:
          type: string
          nullable: true
          description: >-
            An estimate of the creation date, from parsing HTML content. Format
            is YYYY-MM-DD.
          example: '2023-11-16T01:36:32.547Z'
        author:
          type: string
          nullable: true
          description: If available, the author of the content.
          example: >-
            Humza  Naveed, University of Engineering and Technology (UET),
            Lahore, Pakistan
        id:
          type: string
          description: The temporary ID for the document. Useful for /contents endpoint.
          example: https://arxiv.org/abs/2307.06435
        image:
          type: string
          format: uri
          description: The URL of an image associated with the search result, if available.
          example: https://arxiv.org/pdf/2307.06435.pdf/page_1.png
        favicon:
          type: string
          format: uri
          description: The URL of the favicon for the search result's domain.
          example: https://arxiv.org/favicon.ico
    ResultWithContent:
      allOf:
        - $ref: '#/components/schemas/Result'
        - type: object
          properties:
            text:
              type: string
              description: The full content text of the search result.
              example: >-
                Abstract Large Language Models (LLMs) have recently demonstrated
                remarkable capabilities...
            highlights:
              type: array
              items:
                type: string
              description: Array of highlights extracted from the search result content.
              example:
                - Such requirements have limited their adoption...
            highlightScores:
              type: array
              items:
                type: number
                format: float
              description: Array of cosine similarity scores for each highlighted
              example:
                - 0.4600165784358978
            summary:
              type: string
              description: Summary of the webpage
              example: >-
                This overview paper on Large Language Models (LLMs) highlights
                key developments...
            subpages:
              type: array
              items:
                $ref: '#/components/schemas/ResultWithContent'
              description: Array of subpages for the search result.
              example:
                - id: https://arxiv.org/abs/2303.17580
                  url: https://arxiv.org/pdf/2303.17580.pdf
                  title: >-
                    HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in
                    Hugging Face
                  author: >-
                    Yongliang  Shen, Microsoft Research Asia, Kaitao  Song,
                    Microsoft Research Asia, Xu  Tan, Microsoft Research Asia,
                    Dongsheng  Li, Microsoft Research Asia, Weiming  Lu,
                    Microsoft Research Asia, Yueting  Zhuang, Microsoft Research
                    Asia, yzhuang@zju.edu.cn, Zhejiang  University, Microsoft
                    Research Asia, Microsoft  Research, Microsoft Research Asia
                  publishedDate: '2023-11-16T01:36:20.486Z'
                  text: >-
                    HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in
                    Hugging Face Date Published: 2023-05-25 Authors: Yongliang
                    Shen, Microsoft Research Asia Kaitao Song, Microsoft
                    Research Asia Xu Tan, Microsoft Research Asia Dongsheng Li,
                    Microsoft Research Asia Weiming Lu, Microsoft Research Asia
                    Yueting Zhuang, Microsoft Research Asia, yzhuang@zju.edu.cn
                    Zhejiang University, Microsoft Research Asia Microsoft
                    Research, Microsoft Research Asia Abstract Solving
                    complicated AI tasks with different domains and modalities
                    is a key step toward artificial general intelligence. While
                    there are abundant AI models available for different domains
                    and modalities, they cannot handle complicated AI tasks.
                    Considering large language models (LLMs) have exhibited
                    exceptional ability in language understanding, generation,
                    interaction, and reasoning, we advocate that LLMs could act
                    as a controller to manage existing AI models to solve
                    complicated AI tasks and language could be a generic
                    interface to empower t
                  summary: >-
                    HuggingGPT is a framework using ChatGPT as a central
                    controller to orchestrate various AI models from Hugging
                    Face to solve complex tasks. ChatGPT plans the task, selects
                    appropriate models based on their descriptions, executes
                    subtasks, and summarizes the results. This approach
                    addresses limitations of LLMs by allowing them to handle
                    multimodal data (vision, speech) and coordinate multiple
                    models for complex tasks, paving the way for more advanced
                    AI systems.
                  highlights:
                    - >-
                      2) Recently, some researchers started to investigate the
                      integration of using tools or models in LLMs  .
                  highlightScores:
                    - 0.32679107785224915
            extras:
              type: object
              description: Results from extras.
              properties:
                links:
                  type: array
                  items:
                    type: string
                  description: Array of links from the search result.
                  example: []
    CostDollars:
      type: object
      properties:
        total:
          type: number
          format: float
          description: Total dollar cost for your request
          example: 0.005
        breakDown:
          type: array
          description: Breakdown of costs by operation type
          items:
            type: object
            properties:
              search:
                type: number
                format: float
                description: Cost of your search operations
                example: 0.005
              contents:
                type: number
                format: float
                description: Cost of your content operations
                example: 0
              breakdown:
                type: object
                properties:
                  keywordSearch:
                    type: number
                    format: float
                    description: Cost of your keyword search operations
                    example: 0
                  neuralSearch:
                    type: number
                    format: float
                    description: Cost of your neural search operations
                    example: 0.005
                  contentText:
                    type: number
                    format: float
                    description: Cost of your text content retrieval
                    example: 0
                  contentHighlight:
                    type: number
                    format: float
                    description: Cost of your highlight generation
                    example: 0
                  contentSummary:
                    type: number
                    format: float
                    description: Cost of your summary generation
                    example: 0
        perRequestPrices:
          type: object
          description: Standard price per request for different operations
          properties:
            neuralSearch_1_25_results:
              type: number
              format: float
              description: Standard price for neural search with 1-25 results
              example: 0.005
            neuralSearch_26_100_results:
              type: number
              format: float
              description: Standard price for neural search with 26-100 results
              example: 0.025
            neuralSearch_100_plus_results:
              type: number
              format: float
              description: Standard price for neural search with 100+ results
              example: 1
            keywordSearch_1_100_results:
              type: number
              format: float
              description: Standard price for keyword search with 1-100 results
              example: 0.0025
            keywordSearch_100_plus_results:
              type: number
              format: float
              description: Standard price for keyword search with 100+ results
              example: 3
        perPagePrices:
          type: object
          description: Standard price per page for different content operations
          properties:
            contentText:
              type: number
              format: float
              description: Standard price per page for text content
              example: 0.001
            contentHighlight:
              type: number
              format: float
              description: Standard price per page for highlights
              example: 0.001
            contentSummary:
              type: number
              format: float
              description: Standard price per page for summaries
              example: 0.001

````# Find similar links

> Find similar links to the link provided and optionally return the contents of the pages.

## OpenAPI

````yaml post /findSimilar
paths:
  path: /findSimilar
  method: post
  servers:
    - url: https://api.exa.ai
  request:
    security:
      - title: apikey
        parameters:
          query: {}
          header:
            x-api-key:
              type: apiKey
              description: >-
                API key can be provided either via x-api-key header or
                Authorization header with Bearer scheme
          cookie: {}
    parameters:
      path: {}
      query: {}
      header: {}
      cookie: {}
    body:
      application/json:
        schemaArray:
          - type: object
            properties:
              url:
                allOf:
                  - type: string
                    example: https://arxiv.org/abs/2307.06435
                    default: https://arxiv.org/abs/2307.06435
                    description: The url for which you would like to find similar links.
              numResults:
                allOf:
                  - type: integer
                    maximum: 100
                    default: 10
                    description: >
                      Number of results to return. Limits vary by search type:

                      - With "keyword": max 10 results

                      - With "neural": max 100 results


                      If you want to increase the num results beyond these
                      limits, contact sales (hello@exa.ai)
                    example: 10
              includeDomains:
                allOf:
                  - type: array
                    items:
                      type: string
                    description: >-
                      List of domains to include in the search. If specified,
                      results will only come from these domains.
                    example:
                      - arxiv.org
                      - paperswithcode.com
              excludeDomains:
                allOf:
                  - type: array
                    items:
                      type: string
                    description: >-
                      List of domains to exclude from search results. If
                      specified, no results will be returned from these domains.
              startCrawlDate:
                allOf:
                  - type: string
                    format: date-time
                    description: >-
                      Crawl date refers to the date that Exa discovered a link.
                      Results will include links that were crawled after this
                      date. Must be specified in ISO 8601 format.
                    example: '2023-01-01T00:00:00.000Z'
              endCrawlDate:
                allOf:
                  - type: string
                    format: date-time
                    description: >-
                      Crawl date refers to the date that Exa discovered a link.
                      Results will include links that were crawled before this
                      date. Must be specified in ISO 8601 format.
                    example: '2023-12-31T00:00:00.000Z'
              startPublishedDate:
                allOf:
                  - type: string
                    format: date-time
                    description: >-
                      Only links with a published date after this will be
                      returned. Must be specified in ISO 8601 format.
                    example: '2023-01-01T00:00:00.000Z'
              endPublishedDate:
                allOf:
                  - type: string
                    format: date-time
                    description: >-
                      Only links with a published date before this will be
                      returned. Must be specified in ISO 8601 format.
                    example: '2023-12-31T00:00:00.000Z'
              includeText:
                allOf:
                  - type: array
                    items:
                      type: string
                    description: >-
                      List of strings that must be present in webpage text of
                      results. Currently, only 1 string is supported, of up to 5
                      words.
                    example:
                      - large language model
              excludeText:
                allOf:
                  - type: array
                    items:
                      type: string
                    description: >-
                      List of strings that must not be present in webpage text
                      of results. Currently, only 1 string is supported, of up
                      to 5 words. Checks from the first 1000 words of the
                      webpage text.
                    example:
                      - course
              context:
                allOf:
                  - oneOf:
                      - type: boolean
                        description: >-
                          Formats the search results into a context string ready
                          for LLMs.
                        example: true
                      - type: object
                        description: >-
                          Formats the search results into a context string ready
                          for LLMs.
                        properties:
                          maxCharacters:
                            type: integer
                            description: Maximum character limit.
                            example: 10000
              moderation:
                allOf:
                  - type: boolean
                    default: false
                    description: >-
                      Enable content moderation to filter unsafe content from
                      search results.
                    example: true
              contents:
                allOf:
                  - $ref: '#/components/schemas/ContentsRequest'
            required: true
            refIdentifier: '#/components/schemas/CommonRequest'
            requiredProperties:
              - url
        examples:
          example:
            value:
              url: https://arxiv.org/abs/2307.06435
              numResults: 10
              includeDomains:
                - arxiv.org
                - paperswithcode.com
              excludeDomains:
                - <string>
              startCrawlDate: '2023-01-01T00:00:00.000Z'
              endCrawlDate: '2023-12-31T00:00:00.000Z'
              startPublishedDate: '2023-01-01T00:00:00.000Z'
              endPublishedDate: '2023-12-31T00:00:00.000Z'
              includeText:
                - large language model
              excludeText:
                - course
              context: true
              moderation: true
              contents:
                text: true
                highlights:
                  numSentences: 1
                  highlightsPerUrl: 1
                  query: Key advancements
                summary:
                  query: Main developments
                  schema:
                    $schema: http://json-schema.org/draft-07/schema#
                    title: Title
                    type: object
                    properties:
                      Property 1:
                        type: string
                        description: Description
                      Property 2:
                        type: string
                        enum:
                          - option 1
                          - option 2
                          - option 3
                        description: Description
                    required:
                      - Property 1
                livecrawl: always
                livecrawlTimeout: 1000
                subpages: 1
                subpageTarget: sources
                extras:
                  links: 1
                  imageLinks: 1
                context: true
    codeSamples:
      - label: Find similar links
        lang: bash
        source: |
          curl -X POST 'https://api.exa.ai/findSimilar' \
            -H 'x-api-key: YOUR-EXA-API-KEY' \
            -H 'Content-Type: application/json' \
            -d '{
              "url": "https://arxiv.org/abs/2307.06435",
              "text": true
            }'
      - label: Find similar links
        lang: python
        source: |
          # pip install exa-py
          from exa_py import Exa
          exa = Exa('YOUR_EXA_API_KEY')

          results = exa.find_similar_and_contents(
              url="https://arxiv.org/abs/2307.06435",
              text=True
          )

          print(results)
      - label: Find similar links
        lang: javascript
        source: |
          // npm install exa-js
          import Exa from 'exa-js';
          const exa = new Exa('YOUR_EXA_API_KEY');

          const results = await exa.findSimilarAndContents(
              'https://arxiv.org/abs/2307.06435',
              { text: true }
          );

          console.log(results);
      - label: Find similar links
        lang: php
        source: ''
      - label: Find similar links
        lang: go
        source: ''
      - label: Find similar links
        lang: java
        source: ''
  response:
    '200':
      application/json:
        schemaArray:
          - type: object
            properties:
              requestId:
                allOf:
                  - type: string
                    description: Unique identifier for the request
                    example: c6958155d5c89ffa0663b7c90c407396
              context:
                allOf:
                  - type: string
                    description: A formatted string of the search results ready for LLMs.
              results:
                allOf:
                  - type: array
                    description: >-
                      A list of search results containing title, URL, published
                      date, and author.
                    items:
                      $ref: '#/components/schemas/ResultWithContent'
              costDollars:
                allOf:
                  - $ref: '#/components/schemas/CostDollars'
        examples:
          example:
            value:
              requestId: c6958155d5c89ffa0663b7c90c407396
              context: <string>
              results:
                - title: A Comprehensive Overview of Large Language Models
                  url: https://arxiv.org/pdf/2307.06435.pdf
                  publishedDate: '2023-11-16T01:36:32.547Z'
                  author: >-
                    Humza  Naveed, University of Engineering and Technology
                    (UET), Lahore, Pakistan
                  id: https://arxiv.org/abs/2307.06435
                  image: https://arxiv.org/pdf/2307.06435.pdf/page_1.png
                  favicon: https://arxiv.org/favicon.ico
                  text: >-
                    Abstract Large Language Models (LLMs) have recently
                    demonstrated remarkable capabilities...
                  highlights:
                    - Such requirements have limited their adoption...
                  highlightScores:
                    - 0.4600165784358978
                  summary: >-
                    This overview paper on Large Language Models (LLMs)
                    highlights key developments...
                  subpages:
                    - id: https://arxiv.org/abs/2303.17580
                      url: https://arxiv.org/pdf/2303.17580.pdf
                      title: >-
                        HuggingGPT: Solving AI Tasks with ChatGPT and its
                        Friends in Hugging Face
                      author: >-
                        Yongliang  Shen, Microsoft Research Asia, Kaitao  Song,
                        Microsoft Research Asia, Xu  Tan, Microsoft Research
                        Asia, Dongsheng  Li, Microsoft Research Asia, Weiming
                        Lu, Microsoft Research Asia, Yueting  Zhuang, Microsoft
                        Research Asia, yzhuang@zju.edu.cn, Zhejiang  University,
                        Microsoft Research Asia, Microsoft  Research, Microsoft
                        Research Asia
                      publishedDate: '2023-11-16T01:36:20.486Z'
                      text: >-
                        HuggingGPT: Solving AI Tasks with ChatGPT and its
                        Friends in Hugging Face Date Published: 2023-05-25
                        Authors: Yongliang Shen, Microsoft Research Asia Kaitao
                        Song, Microsoft Research Asia Xu Tan, Microsoft Research
                        Asia Dongsheng Li, Microsoft Research Asia Weiming Lu,
                        Microsoft Research Asia Yueting Zhuang, Microsoft
                        Research Asia, yzhuang@zju.edu.cn Zhejiang University,
                        Microsoft Research Asia Microsoft Research, Microsoft
                        Research Asia Abstract Solving complicated AI tasks with
                        different domains and modalities is a key step toward
                        artificial general intelligence. While there are
                        abundant AI models available for different domains and
                        modalities, they cannot handle complicated AI tasks.
                        Considering large language models (LLMs) have exhibited
                        exceptional ability in language understanding,
                        generation, interaction, and reasoning, we advocate that
                        LLMs could act as a controller to manage existing AI
                        models to solve complicated AI tasks and language could
                        be a generic interface to empower t
                      summary: >-
                        HuggingGPT is a framework using ChatGPT as a central
                        controller to orchestrate various AI models from Hugging
                        Face to solve complex tasks. ChatGPT plans the task,
                        selects appropriate models based on their descriptions,
                        executes subtasks, and summarizes the results. This
                        approach addresses limitations of LLMs by allowing them
                        to handle multimodal data (vision, speech) and
                        coordinate multiple models for complex tasks, paving the
                        way for more advanced AI systems.
                      highlights:
                        - >-
                          2) Recently, some researchers started to investigate
                          the integration of using tools or models in LLMs  .
                      highlightScores:
                        - 0.32679107785224915
                  extras:
                    links: []
              costDollars:
                total: 0.005
                breakDown:
                  - search: 0.005
                    contents: 0
                    breakdown:
                      keywordSearch: 0
                      neuralSearch: 0.005
                      contentText: 0
                      contentHighlight: 0
                      contentSummary: 0
                perRequestPrices:
                  neuralSearch_1_25_results: 0.005
                  neuralSearch_26_100_results: 0.025
                  neuralSearch_100_plus_results: 1
                  keywordSearch_1_100_results: 0.0025
                  keywordSearch_100_plus_results: 3
                perPagePrices:
                  contentText: 0.001
                  contentHighlight: 0.001
                  contentSummary: 0.001
        description: OK
  deprecated: false
  type: path
components:
  schemas:
    ContentsRequest:
      type: object
      properties:
        text:
          oneOf:
            - type: boolean
              title: Simple text retrieval
              description: >-
                If true, returns full page text with default settings. If false,
                disables text return.
            - type: object
              title: Advanced text options
              description: >-
                Advanced options for controlling text extraction. Use this when
                you need to limit text length or include HTML structure.
              properties:
                maxCharacters:
                  type: integer
                  description: >-
                    Maximum character limit for the full page text. Useful for
                    controlling response size and API costs.
                  example: 1000
                includeHtmlTags:
                  type: boolean
                  default: false
                  description: >-
                    Include HTML tags in the response, which can help LLMs
                    understand text structure and formatting.
                  example: false
        highlights:
          type: object
          description: Text snippets the LLM identifies as most relevant from each page.
          properties:
            numSentences:
              type: integer
              minimum: 1
              description: The number of sentences to return for each snippet.
              example: 1
            highlightsPerUrl:
              type: integer
              minimum: 1
              description: The number of snippets to return for each result.
              example: 1
            query:
              type: string
              description: Custom query to direct the LLM's selection of highlights.
              example: Key advancements
        summary:
          type: object
          description: Summary of the webpage
          properties:
            query:
              type: string
              description: Custom query for the LLM-generated summary.
              example: Main developments
            schema:
              type: object
              description: >
                JSON schema for structured output from summary.

                See https://json-schema.org/overview/what-is-jsonschema for JSON
                Schema documentation.
              example:
                $schema: http://json-schema.org/draft-07/schema#
                title: Title
                type: object
                properties:
                  Property 1:
                    type: string
                    description: Description
                  Property 2:
                    type: string
                    enum:
                      - option 1
                      - option 2
                      - option 3
                    description: Description
                required:
                  - Property 1
        livecrawl:
          type: string
          enum:
            - never
            - fallback
            - always
            - preferred
          description: >
            Options for livecrawling pages.

            'never': Disable livecrawling (default for neural search).

            'fallback': Livecrawl when cache is empty (default for keyword
            search).

            'always': Always livecrawl.

            'preferred': Always try to livecrawl, but fall back to cache if
            crawling fails.
          example: always
        livecrawlTimeout:
          type: integer
          default: 10000
          description: The timeout for livecrawling in milliseconds.
          example: 1000
        subpages:
          type: integer
          default: 0
          description: >-
            The number of subpages to crawl. The actual number crawled may be
            limited by system constraints.
          example: 1
        subpageTarget:
          oneOf:
            - type: string
            - type: array
              items:
                type: string
          description: >-
            Keyword to find specific subpages of search results. Can be a single
            string or an array of strings, comma delimited.
          example: sources
        extras:
          type: object
          description: Extra parameters to pass.
          properties:
            links:
              type: integer
              default: 0
              description: Number of URLs to return from each webpage.
              example: 1
            imageLinks:
              type: integer
              default: 0
              description: Number of images to return for each result.
              example: 1
        context:
          oneOf:
            - type: boolean
              description: Formats the search resutls into a context string ready for LLMs.
              example: true
            - type: object
              description: Formats the search resutls into a context string ready for LLMs.
              properties:
                maxCharacters:
                  type: integer
                  description: Maximum character limit.
                  example: 10000
    Result:
      type: object
      properties:
        title:
          type: string
          description: The title of the search result.
          example: A Comprehensive Overview of Large Language Models
        url:
          type: string
          format: uri
          description: The URL of the search result.
          example: https://arxiv.org/pdf/2307.06435.pdf
        publishedDate:
          type: string
          nullable: true
          description: >-
            An estimate of the creation date, from parsing HTML content. Format
            is YYYY-MM-DD.
          example: '2023-11-16T01:36:32.547Z'
        author:
          type: string
          nullable: true
          description: If available, the author of the content.
          example: >-
            Humza  Naveed, University of Engineering and Technology (UET),
            Lahore, Pakistan
        id:
          type: string
          description: The temporary ID for the document. Useful for /contents endpoint.
          example: https://arxiv.org/abs/2307.06435
        image:
          type: string
          format: uri
          description: The URL of an image associated with the search result, if available.
          example: https://arxiv.org/pdf/2307.06435.pdf/page_1.png
        favicon:
          type: string
          format: uri
          description: The URL of the favicon for the search result's domain.
          example: https://arxiv.org/favicon.ico
    ResultWithContent:
      allOf:
        - $ref: '#/components/schemas/Result'
        - type: object
          properties:
            text:
              type: string
              description: The full content text of the search result.
              example: >-
                Abstract Large Language Models (LLMs) have recently demonstrated
                remarkable capabilities...
            highlights:
              type: array
              items:
                type: string
              description: Array of highlights extracted from the search result content.
              example:
                - Such requirements have limited their adoption...
            highlightScores:
              type: array
              items:
                type: number
                format: float
              description: Array of cosine similarity scores for each highlighted
              example:
                - 0.4600165784358978
            summary:
              type: string
              description: Summary of the webpage
              example: >-
                This overview paper on Large Language Models (LLMs) highlights
                key developments...
            subpages:
              type: array
              items:
                $ref: '#/components/schemas/ResultWithContent'
              description: Array of subpages for the search result.
              example:
                - id: https://arxiv.org/abs/2303.17580
                  url: https://arxiv.org/pdf/2303.17580.pdf
                  title: >-
                    HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in
                    Hugging Face
                  author: >-
                    Yongliang  Shen, Microsoft Research Asia, Kaitao  Song,
                    Microsoft Research Asia, Xu  Tan, Microsoft Research Asia,
                    Dongsheng  Li, Microsoft Research Asia, Weiming  Lu,
                    Microsoft Research Asia, Yueting  Zhuang, Microsoft Research
                    Asia, yzhuang@zju.edu.cn, Zhejiang  University, Microsoft
                    Research Asia, Microsoft  Research, Microsoft Research Asia
                  publishedDate: '2023-11-16T01:36:20.486Z'
                  text: >-
                    HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in
                    Hugging Face Date Published: 2023-05-25 Authors: Yongliang
                    Shen, Microsoft Research Asia Kaitao Song, Microsoft
                    Research Asia Xu Tan, Microsoft Research Asia Dongsheng Li,
                    Microsoft Research Asia Weiming Lu, Microsoft Research Asia
                    Yueting Zhuang, Microsoft Research Asia, yzhuang@zju.edu.cn
                    Zhejiang University, Microsoft Research Asia Microsoft
                    Research, Microsoft Research Asia Abstract Solving
                    complicated AI tasks with different domains and modalities
                    is a key step toward artificial general intelligence. While
                    there are abundant AI models available for different domains
                    and modalities, they cannot handle complicated AI tasks.
                    Considering large language models (LLMs) have exhibited
                    exceptional ability in language understanding, generation,
                    interaction, and reasoning, we advocate that LLMs could act
                    as a controller to manage existing AI models to solve
                    complicated AI tasks and language could be a generic
                    interface to empower t
                  summary: >-
                    HuggingGPT is a framework using ChatGPT as a central
                    controller to orchestrate various AI models from Hugging
                    Face to solve complex tasks. ChatGPT plans the task, selects
                    appropriate models based on their descriptions, executes
                    subtasks, and summarizes the results. This approach
                    addresses limitations of LLMs by allowing them to handle
                    multimodal data (vision, speech) and coordinate multiple
                    models for complex tasks, paving the way for more advanced
                    AI systems.
                  highlights:
                    - >-
                      2) Recently, some researchers started to investigate the
                      integration of using tools or models in LLMs  .
                  highlightScores:
                    - 0.32679107785224915
            extras:
              type: object
              description: Results from extras.
              properties:
                links:
                  type: array
                  items:
                    type: string
                  description: Array of links from the search result.
                  example: []
    CostDollars:
      type: object
      properties:
        total:
          type: number
          format: float
          description: Total dollar cost for your request
          example: 0.005
        breakDown:
          type: array
          description: Breakdown of costs by operation type
          items:
            type: object
            properties:
              search:
                type: number
                format: float
                description: Cost of your search operations
                example: 0.005
              contents:
                type: number
                format: float
                description: Cost of your content operations
                example: 0
              breakdown:
                type: object
                properties:
                  keywordSearch:
                    type: number
                    format: float
                    description: Cost of your keyword search operations
                    example: 0
                  neuralSearch:
                    type: number
                    format: float
                    description: Cost of your neural search operations
                    example: 0.005
                  contentText:
                    type: number
                    format: float
                    description: Cost of your text content retrieval
                    example: 0
                  contentHighlight:
                    type: number
                    format: float
                    description: Cost of your highlight generation
                    example: 0
                  contentSummary:
                    type: number
                    format: float
                    description: Cost of your summary generation
                    example: 0
        perRequestPrices:
          type: object
          description: Standard price per request for different operations
          properties:
            neuralSearch_1_25_results:
              type: number
              format: float
              description: Standard price for neural search with 1-25 results
              example: 0.005
            neuralSearch_26_100_results:
              type: number
              format: float
              description: Standard price for neural search with 26-100 results
              example: 0.025
            neuralSearch_100_plus_results:
              type: number
              format: float
              description: Standard price for neural search with 100+ results
              example: 1
            keywordSearch_1_100_results:
              type: number
              format: float
              description: Standard price for keyword search with 1-100 results
              example: 0.0025
            keywordSearch_100_plus_results:
              type: number
              format: float
              description: Standard price for keyword search with 100+ results
              example: 3
        perPagePrices:
          type: object
          description: Standard price per page for different content operations
          properties:
            contentText:
              type: number
              format: float
              description: Standard price per page for text content
              example: 0.001
            contentHighlight:
              type: number
              format: float
              description: Standard price per page for highlights
              example: 0.001
            contentSummary:
              type: number
              format: float
              description: Standard price per page for summaries
              example: 0.001

````# Answer

> Get an LLM answer to a question informed by Exa search results. `/answer` performs an Exa search and uses an LLM to generate either:
1. A direct answer for specific queries. (i.e. "What is the capital of France?" would return "Paris")
2. A detailed summary with citations for open-ended queries (i.e. "What is the state of ai in healthcare?" would return a summary with citations to relevant sources)

The response includes both the generated answer and the sources used to create it. The endpoint also supports streaming (as `stream=True`), which will return tokens as they are generated.

Alternatively, you can use the OpenAI compatible [chat completions interface](https://docs.exa.ai/reference/chat-completions#answer).


## OpenAPI

````yaml post /answer
paths:
  path: /answer
  method: post
  servers:
    - url: https://api.exa.ai
  request:
    security:
      - title: apikey
        parameters:
          query: {}
          header:
            x-api-key:
              type: apiKey
              description: >-
                API key can be provided either via x-api-key header or
                Authorization header with Bearer scheme
          cookie: {}
    parameters:
      path: {}
      query: {}
      header: {}
      cookie: {}
    body:
      application/json:
        schemaArray:
          - type: object
            properties:
              query:
                allOf:
                  - type: string
                    description: The question or query to answer.
                    example: What is the latest valuation of SpaceX?
                    default: What is the latest valuation of SpaceX?
                    minLength: 1
              stream:
                allOf:
                  - type: boolean
                    default: false
                    description: >-
                      If true, the response is returned as a server-sent events
                      (SSS) stream.
              text:
                allOf:
                  - type: boolean
                    default: false
                    description: >-
                      If true, the response includes full text content in the
                      search results
            required: true
            requiredProperties:
              - query
        examples:
          example:
            value:
              query: What is the latest valuation of SpaceX?
              stream: false
              text: false
    codeSamples:
      - label: Simple answer
        lang: bash
        source: |
          curl -X POST 'https://api.exa.ai/answer' \
            -H 'x-api-key: YOUR-EXA-API-KEY' \
            -H 'Content-Type: application/json' \
            -d '{
              "query": "What is the latest valuation of SpaceX?",
              "text": true
            }'
      - label: Simple answer
        lang: python
        source: |
          # pip install exa-py
          from exa_py import Exa
          exa = Exa('YOUR_EXA_API_KEY')

          result = exa.answer(
              "What is the latest valuation of SpaceX?",
              text=True
          )

          print(result)
      - label: Simple answer
        lang: javascript
        source: |
          // npm install exa-js
          import Exa from 'exa-js';
          const exa = new Exa('YOUR_EXA_API_KEY');

          const result = await exa.answer(
              'What is the latest valuation of SpaceX?',
              { text: true }
          );

          console.log(result);
      - label: Simple answer
        lang: php
        source: ''
      - label: Simple answer
        lang: go
        source: ''
      - label: Simple answer
        lang: java
        source: ''
  response:
    '200':
      application/json:
        schemaArray:
          - type: object
            properties:
              answer:
                allOf:
                  - type: string
                    description: The generated answer based on search results.
                    example: $350 billion.
              citations:
                allOf:
                  - type: array
                    description: Search results used to generate the answer.
                    items:
                      $ref: '#/components/schemas/AnswerCitation'
              costDollars:
                allOf:
                  - $ref: '#/components/schemas/CostDollars'
            refIdentifier: '#/components/schemas/AnswerResult'
        examples:
          example:
            value:
              answer: $350 billion.
              citations:
                - id: >-
                    https://www.theguardian.com/science/2024/dec/11/spacex-valued-at-350bn-as-company-agrees-to-buy-shares-from-employees
                  url: >-
                    https://www.theguardian.com/science/2024/dec/11/spacex-valued-at-350bn-as-company-agrees-to-buy-shares-from-employees
                  title: >-
                    SpaceX valued at $350bn as company agrees to buy shares from
                    ...
                  author: Dan Milmon
                  publishedDate: '2023-11-16T01:36:32.547Z'
                  text: >-
                    SpaceX valued at $350bn as company agrees to buy shares from
                    ...
                  image: >-
                    https://i.guim.co.uk/img/media/7cfee7e84b24b73c97a079c402642a333ad31e77/0_380_6176_3706/master/6176.jpg?width=1200&height=630&quality=85&auto=format&fit=crop&overlay-align=bottom%2Cleft&overlay-width=100p&overlay-base64=L2ltZy9zdGF0aWMvb3ZlcmxheXMvdGctZGVmYXVsdC5wbmc&enable=upscale&s=71ebb2fbf458c185229d02d380c01530
                  favicon: >-
                    https://assets.guim.co.uk/static/frontend/icons/homescreen/apple-touch-icon.svg
              costDollars:
                total: 0.005
                breakDown:
                  - search: 0.005
                    contents: 0
                    breakdown:
                      keywordSearch: 0
                      neuralSearch: 0.005
                      contentText: 0
                      contentHighlight: 0
                      contentSummary: 0
                perRequestPrices:
                  neuralSearch_1_25_results: 0.005
                  neuralSearch_26_100_results: 0.025
                  neuralSearch_100_plus_results: 1
                  keywordSearch_1_100_results: 0.0025
                  keywordSearch_100_plus_results: 3
                perPagePrices:
                  contentText: 0.001
                  contentHighlight: 0.001
                  contentSummary: 0.001
        description: OK
      text/event-stream:
        schemaArray:
          - type: object
            properties:
              answer:
                allOf:
                  - type: string
                    description: Partial answer chunk when streaming is enabled.
              citations:
                allOf:
                  - type: array
                    items:
                      $ref: '#/components/schemas/AnswerCitation'
        examples:
          example:
            value:
              answer: <string>
              citations:
                - id: >-
                    https://www.theguardian.com/science/2024/dec/11/spacex-valued-at-350bn-as-company-agrees-to-buy-shares-from-employees
                  url: >-
                    https://www.theguardian.com/science/2024/dec/11/spacex-valued-at-350bn-as-company-agrees-to-buy-shares-from-employees
                  title: >-
                    SpaceX valued at $350bn as company agrees to buy shares from
                    ...
                  author: Dan Milmon
                  publishedDate: '2023-11-16T01:36:32.547Z'
                  text: >-
                    SpaceX valued at $350bn as company agrees to buy shares from
                    ...
                  image: >-
                    https://i.guim.co.uk/img/media/7cfee7e84b24b73c97a079c402642a333ad31e77/0_380_6176_3706/master/6176.jpg?width=1200&height=630&quality=85&auto=format&fit=crop&overlay-align=bottom%2Cleft&overlay-width=100p&overlay-base64=L2ltZy9zdGF0aWMvb3ZlcmxheXMvdGctZGVmYXVsdC5wbmc&enable=upscale&s=71ebb2fbf458c185229d02d380c01530
                  favicon: >-
                    https://assets.guim.co.uk/static/frontend/icons/homescreen/apple-touch-icon.svg
        description: OK
  deprecated: false
  type: path
components:
  schemas:
    AnswerCitation:
      type: object
      properties:
        id:
          type: string
          description: The temporary ID for the document.
          example: >-
            https://www.theguardian.com/science/2024/dec/11/spacex-valued-at-350bn-as-company-agrees-to-buy-shares-from-employees
        url:
          type: string
          format: uri
          description: The URL of the search result.
          example: >-
            https://www.theguardian.com/science/2024/dec/11/spacex-valued-at-350bn-as-company-agrees-to-buy-shares-from-employees
        title:
          type: string
          description: The title of the search result.
          example: SpaceX valued at $350bn as company agrees to buy shares from ...
        author:
          type: string
          nullable: true
          description: If available, the author of the content.
          example: Dan Milmon
        publishedDate:
          type: string
          nullable: true
          description: >-
            An estimate of the creation date, from parsing HTML content. Format
            is YYYY-MM-DD.
          example: '2023-11-16T01:36:32.547Z'
        text:
          type: string
          description: >-
            The full text content of each source. Only present when includeText
            is enabled.
          example: SpaceX valued at $350bn as company agrees to buy shares from ...
        image:
          type: string
          format: uri
          description: >-
            The URL of the image associated with the search result, if
            available.
          example: >-
            https://i.guim.co.uk/img/media/7cfee7e84b24b73c97a079c402642a333ad31e77/0_380_6176_3706/master/6176.jpg?width=1200&height=630&quality=85&auto=format&fit=crop&overlay-align=bottom%2Cleft&overlay-width=100p&overlay-base64=L2ltZy9zdGF0aWMvb3ZlcmxheXMvdGctZGVmYXVsdC5wbmc&enable=upscale&s=71ebb2fbf458c185229d02d380c01530
        favicon:
          type: string
          format: uri
          description: The URL of the favicon for the search result's domain, if available.
          example: >-
            https://assets.guim.co.uk/static/frontend/icons/homescreen/apple-touch-icon.svg
    CostDollars:
      type: object
      properties:
        total:
          type: number
          format: float
          description: Total dollar cost for your request
          example: 0.005
        breakDown:
          type: array
          description: Breakdown of costs by operation type
          items:
            type: object
            properties:
              search:
                type: number
                format: float
                description: Cost of your search operations
                example: 0.005
              contents:
                type: number
                format: float
                description: Cost of your content operations
                example: 0
              breakdown:
                type: object
                properties:
                  keywordSearch:
                    type: number
                    format: float
                    description: Cost of your keyword search operations
                    example: 0
                  neuralSearch:
                    type: number
                    format: float
                    description: Cost of your neural search operations
                    example: 0.005
                  contentText:
                    type: number
                    format: float
                    description: Cost of your text content retrieval
                    example: 0
                  contentHighlight:
                    type: number
                    format: float
                    description: Cost of your highlight generation
                    example: 0
                  contentSummary:
                    type: number
                    format: float
                    description: Cost of your summary generation
                    example: 0
        perRequestPrices:
          type: object
          description: Standard price per request for different operations
          properties:
            neuralSearch_1_25_results:
              type: number
              format: float
              description: Standard price for neural search with 1-25 results
              example: 0.005
            neuralSearch_26_100_results:
              type: number
              format: float
              description: Standard price for neural search with 26-100 results
              example: 0.025
            neuralSearch_100_plus_results:
              type: number
              format: float
              description: Standard price for neural search with 100+ results
              example: 1
            keywordSearch_1_100_results:
              type: number
              format: float
              description: Standard price for keyword search with 1-100 results
              example: 0.0025
            keywordSearch_100_plus_results:
              type: number
              format: float
              description: Standard price for keyword search with 100+ results
              example: 3
        perPagePrices:
          type: object
          description: Standard price per page for different content operations
          properties:
            contentText:
              type: number
              format: float
              description: Standard price per page for text content
              example: 0.001
            contentHighlight:
              type: number
              format: float
              description: Standard price per page for highlights
              example: 0.001
            contentSummary:
              type: number
              format: float
              description: Standard price per page for summaries
              example: 0.001

`````

# Context (Exa Code)

> Get relevant code snippets and examples from open source libraries and repositories. Search through code repositories to find contextual examples that help developers understand how specific libraries, frameworks, or programming concepts are implemented in practice.

<Card title="Get your Exa API key" icon="key" horizontal href="https://dashboard.exa.ai/api-keys" />

## Overview

The Context API (also called **Exa Code**) is a powerful tool for coding agents that need fast, efficient web context. It searches over billions of GitHub repos, docs pages, Stack Overflow posts, and more to find the perfect, token-efficient context that agents need to code correctly.

This endpoint helps eliminate hallucinations in coding agents by providing real, working code examples from the open source community.

## Example Use Cases

The Context API excels at finding practical code examples for:

- **Framework usage**: "use Exa search in python and make sure content is always livecrawled"
- **API syntax**: "use correct syntax for vercel ai sdk to call gpt-5 nano asking it how are you"
- **Development setup**: "how to set up a reproducible Nix Rust development environment"
- **Library implementation**: "React hooks for state management examples"
- **Best practices**: "authentication patterns in NextJS applications"

**Basic Code Search**

```bash theme={null}
curl -X POST 'https://api.exa.ai/context' \
  -H 'x-api-key: YOUR-EXA-API-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "how to use React hooks for state management",
    "tokensNum": 5000
  }'
```

**Example Response:**

````json theme={null}
{
  "requestId": "81c4198a1d6794503b52134fd77159e2",
  "query": "how to use React hooks for state management",
  "response": "## State Management with useState Hook in React\n\nhttps://www.geeksforgeeks.org/reactjs/state-management-with-usestate-hook-in-react/\n\n```\nimport React, {\n  useState\n} from 'react';\n\nfunction InputField() {\n  const [name, setName] = useState('');\n\n  const handleChange = (event) => {\n    setName(event.target.value);\n  }\n\n  return (\n    <div>\n      Name:\n      <input onChange={handleChange} />\n      Entered name: {name}\n    </div>\n  );\n}\n\nexport default InputField;\n```\n\n## Basic useState Example\n\n```\nimport { useState } from 'react';\n\nfunction Example() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div>\n      <p>You clicked {count} times</p>\n      <button onClick={() => setCount(count + 1)}>\n        Click me\n      </button>\n    </div>\n  );\n}\n```\n\n## Custom Hook for Counter State Management\n\n```\nimport { useState } from \"react\";\n\nconst useCounter = () => {\n  const [count, setCount] = useState(0);\n\n  const increment = () => {\n    setCount((prevCount) => prevCount + 1);\n  };\n\n  const decrement = () => {\n    setCount((prevCount) => prevCount - 1);\n  };\n\n  return { count, increment, decrement };\n};\n\nexport default useCounter;\n```\n\n...(response continues with more code examples)",
  "resultsCount": 502,
  "costDollars": "{\"total\":1,\"search\":{\"neural\":1}}",
  "searchTime": 3112.290825000033,
  "outputTokens": 4805
}
````

**Library Usage Examples**

```bash theme={null}
curl -X POST 'https://api.exa.ai/context' \
  -H 'x-api-key: YOUR-EXA-API-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "pandas dataframe filtering and groupby operations",
    "tokensNum": "dynamic"
  }'
```

**Framework Setup and Configuration**

```bash theme={null}
curl -X POST 'https://api.exa.ai/context' \
  -H 'x-api-key: YOUR-EXA-API-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Next.js 14 app router with TypeScript configuration",
    "tokensNum": "dynamic"
  }'
```

## Response Format

The API returns a JSON response with the following structure:

```json theme={null}
{
  "requestId": "req_12345",
  "query": "how to use React hooks for state management",
  "response": "// Formatted code snippets and contextual examples\n...",
  "resultsCount": 15,
  "costDollars": "0.0025",
  "searchTime": 1.234,
  "outputTokens": 1247
}
```

## Parameters

### `query` (required)

- **Type**: `string`
- **Description**: Search query to find relevant code snippets
- **Example**: `"how to use React hooks for state management"`
- **Min Length**: 1 character
- **Max Length**: 2000 characters

### `tokensNum` (optional)

- **Type**: `string | integer`
- **Default**: `"dynamic"`
- **Description**: Token limit for the response
- **Options**:
  - `"dynamic"`: Automatically determine optimal response length
  - `50-100000`: Specific number of tokens to return (5000 is good default for most queries, and use 10000 when 5k doesn't provide enough context)

**Token Management**

- Use `"dynamic"` for most queries to get optimal, token-efficient responses
- Specify exact token counts when you need precise output length control
- Higher token counts return more comprehensive examples but cost more

## Integration Examples

**Using with Python**

```python theme={null}
import requests

def get_code_context(query, tokens="dynamic"):
    response = requests.post(
        "https://api.exa.ai/context",
        headers={
            "Content-Type": "application/json",
            "x-api-key": "YOUR_API_KEY"
        },
        json={
            "query": query,
            "tokensNum": tokens
        }
    )

    result = response.json()
    return result["response"]

# Example usage
context = get_code_context("Express.js middleware for authentication")
print(context)
```

**Using with JavaScript/Node.js**

```javascript theme={null}
async function getCodeContext(query, tokensNum = "dynamic") {
  const response = await fetch("https://api.exa.ai/context", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "YOUR_API_KEY",
    },
    body: JSON.stringify({
      query,
      tokensNum,
    }),
  });

  const result = await response.json();
  return result.response;
}

// Example usage
const context = await getCodeContext("Svelte component lifecycle methods");
console.log(context);
```

## About Exa Code

Vibe coding should never have a bad vibe. `exa-code` is a huge step towards coding agents that never hallucinate.

When your coding agent makes a search query, `exa-code` searches over billions of GitHub repos, docs pages, Stack Overflow posts, and more, to find the perfect, token-efficient context that the agent needs to code correctly. It's powered by the Exa search engine.

## Use with MCP

You can also use `exa-code` through the [Exa MCP server](https://docs.exa.ai/reference/exa-mcp) for seamless integration with AI coding assistants like Claude, Cursor, and other MCP-compatible clients.

The MCP integration provides the same powerful code context search capabilities directly within your development environment without needing to make direct API calls.

# Exa Research

> Automate in-depth web research with structured output support.

## How It Works

The Research API is an **asynchronous, multi-step pipeline** that transforms open-ended questions into grounded reports. You provide natural-language instructions (e.g. _"Compare the hardware roadmaps of the top GPU manufacturers"_) and an optional JSON Schema describing the output you want.

Under the hood, Exa agents perform multiple steps:

1. **Planning** – Your natural-language `instructions` are parsed by an LLM that decomposes the task into one or more research steps.

2. **Searching** – Specialized search agents issue semantic and keyword queries to Exa's search engine, continuously expanding and refining the result set until they can fulfil the request.

3. **Reasoning & synthesis** – Reasoning models combine facts across sources and return structured JSON (if you provide `outputSchema`) or a detailed markdown report.

Because tasks are **asynchronous**, you submit a request and immediately receive a `researchId`. You can [poll the request](/reference/research/get-a-task) until it is complete or failed, or [list all tasks](/reference/research/list-tasks) to monitor progress in bulk.

## Best Practices

- **Be explicit** – Clear, scoped instructions lead to faster tasks and higher-quality answers. You should describe (1) what information you want (2) how the agent should find that information and (3) how the agent should compose it's final report.
- **Keep schemas small** – 1-5 root fields is the sweet spot. If you need more, create multiple tasks.
- **Use enums** – Tight schema constraints improve accuracy and reduce hallucinations.

## Models

The Research API offers two advanced agentic researcher models that break down your instructions, search the web, extract and reason over facts, and return structured answers with citations.

- **exa-research** (default) adapts to the difficulty of the task, using more or less compute for individual steps. Recommended for most use cases.
- **exa-research-pro** maximizes quality by using the highest reasoning capability for every step. Recommended for the most complex, multi-step research tasks.

Here are typical completion times for each model:

| Model            | p50 (seconds) | p90 (seconds) |
| ---------------- | ------------- | ------------- |
| exa-research     | 45            | 90            |
| exa-research-pro | 90            | 180           |

## Pricing

The Research API now uses **variable usage-based pricing**. You are billed based on how much work and reasoning the research agent does.

<Note>You are ONLY charged for tasks that complete successfully.</Note>

| Operation            | exa-research      | exa-research-pro   | Notes                                                |
| -------------------- | ----------------- | ------------------ | ---------------------------------------------------- |
| **Search**           | \$5/1k searches   | \$5/1k searches    | Each unique search query issued by the agent         |
| **Page read**        | \$5/1k pages read | \$10/1k pages read | One "page" = 1,000 tokens from the web               |
| **Reasoning tokens** | \$5/1M tokens     | \$5/1M tokens      | Specific LLM tokens used for reasoning and synthesis |

**Example:**\
A research task with `exa-research` that performs 6 searches, reads 20 pages of content, and uses 1,000 reasoning tokens would cost:

$$
\begin{array}{rl}
& \$0.03 \text{ (6 searches × \$5/1000)} \\
+ & \$0.10 \text{ (20 pages × \$5/1000)} \\
+ & \$0.005 \text{ (1{,}000 reasoning tokens × \$5/1{,}000{,}000)} \\
\hline
& \$0.135
\end{array}
$$

For `exa-research-pro`, the same task would cost:

$$
\begin{array}{rl}
& \$0.03 \text{ (6 searches × \$5/1000)} \\
+ & \$0.20 \text{ (20 pages × \$10/1000)} \\
+ & \$0.005 \text{ (1{,}000 reasoning tokens × \$5/1{,}000{,}000)} \\
\hline
& \$0.235
\end{array}
$$

## Examples

### Competitive Landscape Table

Compare the current flagship GPUs from NVIDIA, AMD, and Intel and extract pricing, TDP, and release date.

<CodeGroup>
  ```python Python theme={null}
  import os
  from exa_py import Exa

exa = Exa(os.environ["EXA_API_KEY"])

instructions = "Compare the current flagship GPUs from NVIDIA, AMD and Intel. Return a table of model name, MSRP USD, TDP watts, and launch date. Include citations for each cell."
schema = {
"type": "object",
"required": ["gpus"],
"properties": {
"gpus": {
"type": "array",
"items": {
"type": "object",
"required": ["manufacturer", "model", "msrpUsd", "tdpWatts", "launchDate"],
"properties": {
"manufacturer": {"type": "string"},
"model": {"type": "string"},
"msrpUsd": {"type": "number"},
"tdpWatts": {"type": "integer"},
"launchDate": {"type": "string"}
}
}
}
},
"additionalProperties": False
}

research = exa.research.create(
model="exa-research",
instructions=instructions,
output_schema=schema
)

# Poll until completion

result = exa.research.poll_until_finished(research.researchId)
print(result)

````

```javascript JavaScript theme={null}
import Exa, { ResearchModel } from "exa-js";

const exa = new Exa(process.env.EXA_API_KEY);

async function compareGPUs() {
  const research = await exa.research.create({
    model: ResearchModel.exa_research,
    instructions:
      "Compare the current flagship GPUs from NVIDIA, AMD and Intel. Return a table of model name, MSRP USD, TDP watts, and launch date. Include citations for each cell.",
    outputSchema: {
      type: "object",
      required: ["gpus"],
      properties: {
        gpus: {
          type: "array",
          items: {
            type: "object",
            required: [
              "manufacturer",
              "model",
              "msrpUsd",
              "tdpWatts",
              "launchDate",
            ],
            properties: {
              manufacturer: { type: "string" },
              model: { type: "string" },
              msrpUsd: { type: "number" },
              tdpWatts: { type: "integer" },
              launchDate: { type: "string" },
            },
          },
        },
      },
      additionalProperties: false,
    },
  });

  // Poll until completion
  const result = await exa.research.pollUntilFinished(research.researchId);
  console.log("Research result:", result);
}

compareGPUs();
````

```bash Curl theme={null}
curl -X POST https://api.exa.ai/research/v1 \
  -H "x-api-key: $EXA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instructions": "Compare the current flagship GPUs from NVIDIA, AMD and Intel. Return a table of model name, MSRP USD, TDP watts, and launch date. Include citations for each cell.",
    "outputSchema": {
      "type": "object",
      "required": ["gpus"],
      "properties": {
        "gpus": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["manufacturer", "model", "msrpUsd", "tdpWatts", "launchDate"],
            "properties": {
              "manufacturer": {"type": "string"},
              "model": {"type": "string"},
              "msrpUsd": {"type": "number"},
              "tdpWatts": {"type": "integer"},
              "launchDate": {"type": "string"}
            }
          }
        }
      },
      "additionalProperties": false
    }
  }'
```

</CodeGroup>

### Market Size Estimate

Estimate the total global market size (USD) for battery recycling in 2030 with a clear methodology.

<CodeGroup>
  ```python Python theme={null}
  import os
  from exa_py import Exa

exa = Exa(os.environ["EXA_API_KEY"])

instructions = "Estimate the global market size for battery recycling in 2030. Provide reasoning steps and cite sources."
schema = {
"type": "object",
"required": ["estimateUsd", "methodology"],
"properties": {
"estimateUsd": {"type": "number"},
"methodology": {"type": "string"}
},
"additionalProperties": False
}

research = exa.research.create(
model="exa-research",
instructions=instructions,
output_schema=schema
)

# Poll until completion

result = exa.research.poll_until_finished(research.researchId)
print(result)

````

```javascript JavaScript theme={null}
import Exa, { ResearchModel } from "exa-js";

const exa = new Exa(process.env.EXA_API_KEY);

async function estimateMarketSize() {
  const research = await exa.research.create({
    model: ResearchModel.exa_research,
    instructions:
      "Estimate the global market size for battery recycling in 2030. Provide reasoning steps and cite sources.",
    outputSchema: {
      type: "object",
      required: ["estimateUsd", "methodology"],
      properties: {
        estimateUsd: { type: "number" },
        methodology: { type: "string" },
      },
      additionalProperties: false,
    },
  });

  // Poll until completion
  const result = await exa.research.pollUntilFinished(research.researchId);
  console.log("Research result:", result);
}

estimateMarketSize();
````

```bash Curl theme={null}
curl -X POST https://api.exa.ai/research/v1 \
  -H "x-api-key: $EXA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instructions": "Estimate the global market size for battery recycling in 2030. Provide reasoning steps and cite sources.",
    "outputSchema": {
      "type": "object",
      "required": ["estimateUsd", "methodology"],
      "properties": {
        "estimateUsd": {"type": "number"},
        "methodology": {"type": "string"}
      },
      "additionalProperties": false
    }
  }'
```

</CodeGroup>

### Timeline of Key Events

Build a timeline of major OpenAI product releases from 2015 – 2023.

<CodeGroup>
  ```python Python theme={null}
  import os
  from exa_py import Exa

exa = Exa(os.environ["EXA_API_KEY"])

instructions = "Create a chronological timeline (year, month, brief description) of major OpenAI product releases from 2015 to 2023."
schema = {
"type": "object",
"required": ["events"],
"properties": {
"events": {
"type": "array",
"items": {
"type": "object",
"required": ["date", "description"],
"properties": {
"date": {"type": "string"},
"description": {"type": "string"}
}
}
}
},
"additionalProperties": False
}

research = exa.research.create(
model="exa-research",
instructions=instructions,
output_schema=schema
)

# Poll until completion

result = exa.research.poll_until_finished(research.researchId)
print(result)

````

```javascript JavaScript theme={null}
import Exa, { ResearchModel } from "exa-js";

const exa = new Exa(process.env.EXA_API_KEY);

async function createTimeline() {
  const research = await exa.research.create({
    model: ResearchModel.exa_research,
    instructions:
      "Create a chronological timeline (year, month, brief description) of major OpenAI product releases from 2015 to 2023.",
    outputSchema: {
      type: "object",
      required: ["events"],
      properties: {
        events: {
          type: "array",
          items: {
            type: "object",
            required: ["date", "description"],
            properties: {
              date: { type: "string" },
              description: { type: "string" },
            },
          },
        },
      },
      additionalProperties: false,
    },
  });

  // Poll until completion
  const result = await exa.research.pollUntilFinished(research.researchId);
  console.log("Research result:", result);
}

createTimeline();
````

```bash Curl theme={null}
curl -X POST https://api.exa.ai/research/v1 \
  -H "x-api-key: $EXA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instructions": "Create a chronological timeline (year, month, brief description) of major OpenAI product releases from 2015 to 2023.",
    "outputSchema": {
      "type": "object",
      "required": ["events"],
      "properties": {
        "events": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["date", "description"],
            "properties": {
              "date": {"type": "string"},
              "description": {"type": "string"}
            }
          }
        }
      },
      "additionalProperties": false
    }
  }'
```

</CodeGroup>

## FAQs

<AccordionGroup>
  <Accordion title="Who is the Research API for?">
    Product teams, analysts, researchers, and anyone who needs **structured answers** that require reading multiple web sources — without having to build their own search + scraping + LLM pipeline.
  </Accordion>

  <Accordion title="How is this different from the /answer endpoint?">
    `/answer` is designed for **single-shot Q\&A**. The Research API handles
    **long-running, multi-step investigations**. It's suitable for tasks that
    require complex reasoning over web data.
  </Accordion>

  <Accordion title="How long do tasks take?">
    Tasks generally complete in 20–40 seconds. Simple tasks that can be solved
    with few searches complete faster, while complex schema's targeting niche
    subjects may take longer.
  </Accordion>

  <Accordion title="What are best practices for writing instructions?">
    Be explicit about the objective and any constraints - Specify the **time
    range** or **types of sources** to consult if important - Use imperative verbs
    ("Compare", "List", "Summarize") - Keep it under 4096 characters
  </Accordion>

  <Accordion title="How large can my output schema be?">
    You must have ≤ 8 root fields. It must not be more than 5 fields deep.
  </Accordion>

  <Accordion title="What happens if my schema validation fails?">
    If your schema is not valid, an error will surface *before the task is
    created* with a message about what is invalid. You will not be charged for
    such requests.
  </Accordion>
</AccordionGroup>
# Error Codes

> Reference for common error codes used by the Exa API

## API errors

| Code                        | Overview                                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400 - Bad Request           | **Cause:** Invalid request parameters, malformed JSON, missing required fields<br />**Solution:** Check request body format, validate parameters, ensure API key is correctly formatted |
| 401 - Unauthorized          | **Cause:** Missing or invalid API key<br />**Solution:** Verify your API key is correct and active, ensure proper authentication headers                                                |
| 403 - Forbidden             | **Cause:** Valid API key but insufficient permissions or rate limit exceeded<br />**Solution:** Check feature access permissions or implement rate limiting                             |
| 404 - Not Found             | **Cause:** Resource not found (e.g., Webset, task, or URL doesn't exist)<br />**Solution:** Verify the resource identifier exists and is accessible                                     |
| 409 - Conflict              | **Cause:** Resource already exists (e.g., Webset with same externalId)<br />**Solution:** Use a different identifier or update the existing resource                                    |
| 429 - Too Many Requests     | **Cause:** Rate limit exceeded<br />**Solution:** Implement exponential backoff and reduce request rate                                                                                 |
| 500 - Internal Server Error | **Cause:** Issue on our servers<br />**Solution:** Retry your request after a brief wait and contact us if the issue persists                                                           |
| 502 - Bad Gateway           | **Cause:** Upstream server issue<br />**Solution:** Retry the request after a brief delay                                                                                               |
| 503 - Service Unavailable   | **Cause:** Service temporarily down<br />**Solution:** Retry after delay, check for maintenance announcements                                                                           |

## Error Response Structure

All error responses include a `requestId` field and `error` message:

```json theme={null}
{
  "requestId": "67207943fab9832d162b5317f4cca830",
  "error": "Invalid request body | Validation error: Invalid enum value. Expected 'never' | 'always' | 'fallback' | 'auto' | 'preferred' | 'fallback1.6', received 'alwayss' at \"livecrawl\""
}
```

<Note>
  Include the `requestId` when contacting support for faster troubleshooting.
</Note>

When using the `/contents` endpoint, specific errors are returned in the `statuses` field rather than HTTP error codes. This allows for granular error handling when fetching multiple URLs.

```json theme={null}
{
  "results": [...],
  "statuses": [
    {
      "id": "https://example.com",
      "status": "error",
      "error": {
        "tag": "CRAWL_NOT_FOUND",
        "httpStatusCode": 404
      }
    }
  ]
}
```

| Tag                       | HTTP Code | Description                              | How to Handle                                                      |
| ------------------------- | --------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `CRAWL_NOT_FOUND`         | `404`     | Content not found at the specified URL   | Verify the URL is correct and accessible                           |
| `CRAWL_TIMEOUT`           | `408`     | Request timed out while fetching content | Retry the request or increase timeout if available                 |
| `CRAWL_LIVECRAWL_TIMEOUT` | `408`     | Live crawl operation timed out           | Try again with `livecrawl: "fallback"` or `livecrawl: "never"`     |
| `SOURCE_NOT_AVAILABLE`    | `403`     | Access forbidden or source unavailable   | Check if the source requires authentication or is behind a paywall |
| `CRAWL_UNKNOWN_ERROR`     | `500+`    | Other crawling errors                    | Retry the request; contact support if persistent                   |

## Getting Help

If you encounter persistent errors or need clarification on error codes:

- Check the [Rate Limits](/reference/rate-limits) page for current limits
- Review the [API Reference](/reference/search) for parameter requirements
- Contact support at [hello@exa.ai](mailto:hello@exa.ai) with error details and request IDs
