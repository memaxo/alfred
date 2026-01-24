AI SDK CoreLanguageModelV3Middleware

Copy markdown

# `LanguageModelV3Middleware`

Language model middleware is an experimental feature.

Language model middleware provides a way to enhance the behavior of language models by intercepting and modifying the calls to the language model. It can be used to add features like guardrails, RAG, caching, and logging in a language model agnostic way.

See Language Model Middleware for more information.

## Import

    import { LanguageModelV3Middleware } from "ai"

## API Signature

### transformParams:

({ type: "generate" | "stream", params: LanguageModelV3CallOptions }) => Promise

Transforms the parameters before they are passed to the language model.

### wrapGenerate:

({ doGenerate: DoGenerateFunction, params: LanguageModelV3CallOptions, model: LanguageModelV3 }) => Promise

Wraps the generate operation of the language model.

### wrapStream:

({ doStream: DoStreamFunction, params: LanguageModelV3CallOptions, model: LanguageModelV3 }) => Promise

Wraps the stream operation of the language model.

Previous

wrapLanguageModel

Next

extractReasoningMiddleware
