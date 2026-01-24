AI SDK RSCOverview

Copy markdown

# AI SDK RSC

AI SDK RSC is currently experimental. We recommend using AI SDK UI for production. For guidance on migrating from RSC to UI, see our migration guide.

The `@ai-sdk/rsc` package is compatible with frameworks that support React Server Components.

React Server Components (RSC) allow you to write UI that can be rendered on the server and streamed to the client. RSCs enable Server Actions , a new way to call server-side code directly from the client just like any other function with end-to-end type-safety. This combination opens the door to a new way of building AI applications, allowing the large language model (LLM) to generate and stream UI directly from the server to the client.

## AI SDK RSC Functions

AI SDK RSC has various functions designed to help you build AI-native applications with React Server Components. These functions:

1. Provide abstractions for building Generative UI applications.
   - `streamUI`: calls a model and allows it to respond with React Server Components.
   - `useUIState`: returns the current UI state and a function to update the UI State (like React's `useState`). UI State is the visual representation of the AI state.
   - `useAIState`: returns the current AI state and a function to update the AI State (like React's `useState`). The AI state is intended to contain context and information shared with the AI model, such as system messages, function responses, and other relevant data.
   - `useActions`: provides access to your Server Actions from the client. This is particularly useful for building interfaces that require user interactions with the server.
   - `createAI`: creates a client-server context provider that can be used to wrap parts of your application tree to easily manage both UI and AI states of your application.
2. Make it simple to work with streamable values between the server and client.
   - `createStreamableValue`: creates a stream that sends values from the server to the client. The value can be any serializable data.
   - `readStreamableValue`: reads a streamable value from the client that was originally created using `createStreamableValue`.
   - `createStreamableUI`: creates a stream that sends UI from the server to the client.
   - `useStreamableValue`: accepts a streamable value created using `createStreamableValue` and returns the current value, error, and pending state.

## Templates

Check out the following templates to see AI SDK RSC in action.

Gemini Chatbot

Uses Google Gemini, AI SDK, and Next.js.

Generative UI with RSC (experimental)

Uses Next.js, AI SDK, and streamUI to create generative UIs with React Server Components.

## API Reference

Please check out the AI SDK RSC API Reference for more details on each function.

Previous

AI SDK RSC

Next

Streaming React Components
