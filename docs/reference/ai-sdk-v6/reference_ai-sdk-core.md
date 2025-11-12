ReferenceAI SDK Core

Copy markdown

# AI SDK Core

AI SDK Core is a set of functions that allow you to interact with language models and other AI models. These functions are designed to be easy-to-use and flexible, allowing you to generate text, structured data, and embeddings from language models and other AI models.

AI SDK Core contains the following main functions:

generateText()

Generate text and call tools from a language model.

streamText()

Stream text and call tools from a language model.

generateObject()

Generate structured data from a language model.

streamObject()

Stream structured data from a language model.

embed()

Generate an embedding for a single value using an embedding model.

embedMany()

Generate embeddings for several values using an embedding model (batch embedding).

experimental_generateImage()

Generate images based on a given prompt using an image model.

experimental_transcribe()

Generate a transcript from an audio file.

experimental_generateSpeech()

Generate speech audio from text.

It also contains the following helper functions:

tool()

Type inference helper function for tools.

experimental_createMCPClient()

Creates a client for connecting to MCP servers.

jsonSchema()

Creates AI SDK compatible JSON schema objects.

zodSchema()

Creates AI SDK compatible Zod schema objects.

createProviderRegistry()

Creates a registry for using models from multiple providers.

cosineSimilarity()

Calculates the cosine similarity between two vectors, e.g. embeddings.

simulateReadableStream()

Creates a ReadableStream that emits values with configurable delays.

wrapLanguageModel()

Wraps a language model with middleware.

extractReasoningMiddleware()

Extracts reasoning from the generated text and exposes it as a `reasoning` property on the result.

simulateStreamingMiddleware()

Simulates streaming behavior with responses from non-streaming language models.

defaultSettingsMiddleware()

Applies default settings to a language model.

smoothStream()

Smooths text streaming output.

generateId()

Helper function for generating unique IDs

createIdGenerator()

Creates an ID generator

Previous

Reference

Next

generateText