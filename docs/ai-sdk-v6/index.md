AI SDK by Vercel

Copy markdown

# AI SDK

The AI SDK is the TypeScript toolkit designed to help developers build AI-powered applications and agents with React, Next.js, Vue, Svelte, Node.js, and more.

## Why use the AI SDK?

Integrating large language models (LLMs) into applications is complicated and heavily dependent on the specific model provider you use.

The AI SDK standardizes integrating artificial intelligence (AI) models across supported providers. This enables developers to focus on building great AI applications, not waste time on technical details.

For example, here’s how you can generate text with various models using the AI SDK:

xAI

OpenAI

Anthropic

Google

Custom

import { generateText } from "ai"

import { xai } from "@ai-sdk/xai"

const { text } = await generateText({

model: xai("grok-4"),

prompt: "What is love?"

})

Love is a universal emotion that is characterized by feelings of affection, attachment, and warmth towards someone or something. It is a complex and multifaceted experience that can take many different forms, including romantic love, familial love, platonic love, and self-love.

The AI SDK has two main libraries:

  * **AI SDK Core:** A unified API for generating text, structured objects, tool calls, and building agents with LLMs.
  * **AI SDK UI:** A set of framework-agnostic hooks for quickly building chat and generative user interface.

## Model Providers

The AI SDK supports multiple model providers.

xAI Grok

Image InputImage GenerationObject GenerationTool UsageTool Streaming

OpenAI

Image InputImage GenerationObject GenerationTool UsageTool Streaming

Azure

Image InputObject GenerationTool UsageTool Streaming

Anthropic

Image InputObject GenerationTool UsageTool Streaming

Amazon Bedrock

Image InputImage GenerationObject GenerationTool UsageTool Streaming

Groq

Image InputObject GenerationTool UsageTool Streaming

Fal AI

Image Generation

DeepInfra

Image InputObject GenerationTool UsageTool Streaming

Google Generative AI

Image InputObject GenerationTool UsageTool Streaming

Google Vertex AI

Image InputImage GenerationObject GenerationTool UsageTool Streaming

Mistral

Image InputObject GenerationTool UsageTool Streaming

Together.ai

Object GenerationTool UsageTool Streaming

Cohere

Tool UsageTool Streaming

Fireworks

Image GenerationObject GenerationTool UsageTool Streaming

DeepSeek

Object GenerationTool UsageTool Streaming

Cerebras

Object GenerationTool UsageTool Streaming

Perplexity

Luma AI

Image Generation

Baseten

Object GenerationTool Usage

## Templates

We've built some templates that include AI SDK integrations for different use cases, providers, and frameworks. You can use these templates to get started with your AI-powered application.

### Starter Kits

Chatbot Starter Template

Uses the AI SDK and Next.js. Features persistence, multi-modal chat, and more.

Internal Knowledge Base (RAG)

Uses AI SDK Language Model Middleware for RAG and enforcing guardrails.

Multi-Modal Chat

Uses Next.js and AI SDK useChat hook for multi-modal message chat interface.

Semantic Image Search

An AI semantic image search app template built with Next.js, AI SDK, and Postgres.

Natural Language PostgreSQL

Query PostgreSQL using natural language with AI SDK and GPT-4o.

### Feature Exploration

Feature Flags Example

AI SDK with Next.js, Feature Flags, and Edge Config for dynamic model switching.

Chatbot with Telemetry

AI SDK chatbot with OpenTelemetry support.

Structured Object Streaming

Uses AI SDK useObject hook to stream structured object generation.

Multi-Step Tools

Uses AI SDK streamText function to handle multiple tool steps automatically.

### Frameworks

Next.js OpenAI Starter

Uses OpenAI GPT-4, AI SDK, and Next.js.

Nuxt OpenAI Starter

Uses OpenAI GPT-4, AI SDK, and Nuxt.js.

SvelteKit OpenAI Starter

Uses OpenAI GPT-4, AI SDK, and SvelteKit.

Solid OpenAI Starter

Uses OpenAI GPT-4, AI SDK, and Solid.

### Generative UI

Gemini Chatbot

Uses Google Gemini, AI SDK, and Next.js.

Generative UI with RSC (experimental)

Uses Next.js, AI SDK, and streamUI to create generative UIs with React Server Components.

### Security

Bot Protection

Uses Kasada, OpenAI GPT-4, AI SDK, and Next.js.

Rate Limiting

Uses Vercel KV, OpenAI GPT-4, AI SDK, and Next.js.

## Join our Community

If you have questions about anything related to the AI SDK, you're always welcome to ask our community on GitHub Discussions.

## `llms.txt` (for Cursor, Windsurf, Copilot, Claude etc.)

You can access the entire AI SDK documentation in Markdown format at ai-sdk.dev/llms.txt. This can be used to ask any LLM (assuming it has a big enough context window) questions about the AI SDK based on the most up-to-date documentation.

### Example Usage

For instance, to prompt an LLM with questions about the AI SDK:

  1. Copy the documentation contents from ai-sdk.dev/llms.txt
  2. Use the following prompt format:

    
    
    Documentation:
    
    {paste documentation here}
    
    ---
    
    Based on the above documentation, answer the following:
    
    {your question}

Next

AI SDK 6 Beta