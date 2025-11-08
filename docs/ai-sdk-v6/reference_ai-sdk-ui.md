ReferenceAI SDK UI

Copy markdown

# AI SDK UI

AI SDK UI is designed to help you build interactive chat, completion, and assistant applications with ease. It is framework-agnostic toolkit, streamlining the integration of advanced AI functionalities into your applications.

AI SDK UI contains the following hooks:

useChat

Use a hook to interact with language models in a chat interface.

useCompletion

Use a hook to interact with language models in a completion interface.

useObject

Use a hook for consuming a streamed JSON objects.

convertToModelMessages

Convert useChat messages to ModelMessages for AI functions.

pruneMessages

Prunes model messages from a list of model messages.

createUIMessageStream

Create a UI message stream to stream additional data to the client.

createUIMessageStreamResponse

Create a response object to stream UI messages to the client.

pipeUIMessageStreamToResponse

Pipe a UI message stream to a Node.js ServerResponse object.

readUIMessageStream

Transform a stream of UIMessageChunk objects into an AsyncIterableStream of UIMessage objects.

## UI Framework Support

AI SDK UI supports the following frameworks: React, Svelte, and Vue.js. Here is a comparison of the supported functions across these frameworks:

Function| React| Svelte| Vue.js  
---|---|---|---  
useChat| |  Chat|   
useCompletion| |  Completion|   
useObject| |  StructuredObject|   
  
Contributions are welcome to implement missing features for non-React frameworks.

Previous

createIdGenerator

Next

useChat