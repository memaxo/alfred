Getting StartedNavigating the Library

Copy markdown

# Navigating the Library

The AI SDK is a powerful toolkit for building AI applications. This page will help you pick the right tools for your requirements.

Let’s start with a quick overview of the AI SDK, which is comprised of three parts:

  * **AI SDK Core:** A unified, provider agnostic API for generating text, structured objects, and tool calls with LLMs.
  * **AI SDK UI:** A set of framework-agnostic hooks for building chat and generative user interfaces.
  * AI SDK RSC: Stream generative user interfaces with React Server Components (RSC). Development is currently experimental and we recommend using AI SDK UI.

## Choosing the Right Tool for Your Environment

When deciding which part of the AI SDK to use, your first consideration should be the environment and existing stack you are working with. Different components of the SDK are tailored to specific frameworks and environments.

Library| Purpose| Environment Compatibility  
---|---|---  
AI SDK Core| Call any LLM with unified API (e.g. generateText and generateObject)| Any JS environment (e.g. Node.js, Deno, Browser)  
AI SDK UI| Build streaming chat and generative UIs (e.g. useChat)| React & Next.js, Vue & Nuxt, Svelte & SvelteKit  
AI SDK RSC| Stream generative UIs from Server to Client (e.g. streamUI). Development is currently experimental and we recommend using AI SDK UI.| Any framework that supports React Server Components (e.g. Next.js)  
  
## Environment Compatibility

These tools have been designed to work seamlessly with each other and it's likely that you will be using them together. Let's look at how you could decide which libraries to use based on your application environment, existing stack, and requirements.

The following table outlines AI SDK compatibility based on environment:

Environment| AI SDK Core| AI SDK UI| AI SDK RSC  
---|---|---|---  
None / Node.js / Deno| | |   
Vue / Nuxt| | |   
Svelte / SvelteKit| | |   
Next.js Pages Router| | |   
Next.js App Router| | |   
  
## When to use AI SDK UI

AI SDK UI provides a set of framework-agnostic hooks for quickly building **production-ready AI-native applications**. It offers:

  * Full support for streaming chat and client-side generative UI
  * Utilities for handling common AI interaction patterns (i.e. chat, completion, assistant)
  * Production-tested reliability and performance
  * Compatibility across popular frameworks

## AI SDK UI Framework Compatibility

AI SDK UI supports the following frameworks: React, Svelte, and Vue.js. Here is a comparison of the supported functions across these frameworks:

Function| React| Svelte| Vue.js  
---|---|---|---  
useChat| | |   
useChat tool calling| | |   
useCompletion| | |   
useObject| | |   
  
Contributions are welcome to implement missing features for non-React frameworks.

## When to use AI SDK RSC

AI SDK RSC is currently experimental. We recommend using AI SDK UI for production. For guidance on migrating from RSC to UI, see our migration guide.

React Server Components (RSCs) provide a new approach to building React applications that allow components to render on the server, fetch data directly, and stream the results to the client, reducing bundle size and improving performance. They also introduce a new way to call server-side functions from anywhere in your application called Server Actions.

AI SDK RSC provides a number of utilities that allow you to stream values and UI directly from the server to the client. However, **it's important to be aware of current limitations** :

  * **Cancellation** : currently, it is not possible to abort a stream using Server Actions. This will be improved in future releases of React and Next.js.
  * **Increased Data Transfer** : using `createStreamableUI` can lead to quadratic data transfer (quadratic to the length of generated text). You can avoid this using  `createStreamableValue` instead, and rendering the component client-side.
  * **Re-mounting Issue During Streaming** : when using `createStreamableUI`, components re-mount on `.done()`, causing flickering.

Given these limitations, **we recommend usingAI SDK UI for production applications**.

Previous

Getting Started

Next

Next.js App Router