---
title: Playground Tools and Features - Laminar documentation
url: 
language: en
---
[Skip to main content](https://docs.lmnr.ai/playground/tools#content-area)

[Laminar documentation home page![logo](https://mintcdn.com/laminarai/pCELL5UGvyOmmwBL/logo/logo.png?fit=max&auto=format&n=pCELL5UGvyOmmwBL&q=85&s=568416e0ece6e167d975769bcccddac6)](https://docs.lmnr.ai/)

Search...

Ctrl K

Search...

Navigation

Playground

Playground Tools and Features

[Documentation](https://docs.lmnr.ai/overview) [Guides](https://docs.lmnr.ai/guides/fastapi) [API Reference](https://docs.lmnr.ai/api-reference/introduction)

On this page

- [Tool Definition Structure](https://docs.lmnr.ai/playground/tools#tool-definition-structure)
- [Example Tool Configuration](https://docs.lmnr.ai/playground/tools#example-tool-configuration)

The Laminar Playground provides the ability to add tools to your LLM calls. The playground supports configuring custom tools that AI models can call during conversations.

## [​](https://docs.lmnr.ai/playground/tools\#tool-definition-structure)  Tool Definition Structure

![Laminar Playground Tools](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/playground/tools.png?fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=b0feb8531f8059d0388cb6d514f03a45)

Tools in the playground have the following structure:

- **JSON object** with keys as function names
- Each function contains two main entries:
  - **`description`** \- Clear explanation of what the function does
  - **`parameters`** \- JSON schema defining the input parameters structure
- **Tool choice** \- Controls when tools are used: `none`, `auto`, `required`, or specific function name

Learn more about tool choice options in the [AI SDK documentation](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#tool-choice).

## [​](https://docs.lmnr.ai/playground/tools\#example-tool-configuration)  Example Tool Configuration

Copy

```
{
  "searchDatabase": {
    "description": "Search for information in the company database",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query or keywords"
        },
        "category": {
          "type": "string",
          "enum": ["users", "orders", "products"],
          "description": "Database category to search"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of results to return",
          "default": 10
        }
      },
      "required": ["query", "category"]
    }
  }
}

```

[Playground from Span](https://docs.lmnr.ai/playground/playground-from-span) [History](https://docs.lmnr.ai/playground/history)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.

![Laminar Playground Tools](https://mintcdn.com/laminarai/W6ojRY5YjRjfXRin/images/playground/tools.png?w=840&fit=max&auto=format&n=W6ojRY5YjRjfXRin&q=85&s=0b97e3a6cb6e9dbee244530b4d1b4d98)