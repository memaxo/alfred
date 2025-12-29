# Provider Registry Patterns

## Core Principle

LLM providers registered in central registry. Model selection via config. Fallback for reliability. Never raw HTTP to LLM APIs.

## Rules

1. **Provider registration.** Register LLM providers in `packages/cortex/src/providers`. Each provider exports create function returning `LanguageModel` from `ai` package.

2. **Model selection.** Use KaLM-Embedding-Gemma3-12B-2511 for embeddings with 1024 dimensions. Use MRL truncation for storage efficiency.

3. **AI SDK usage.** Never call OpenAI or other providers via raw HTTP. Use `generateText`, `streamText`, `generateObject`, `streamObject` from `ai` package.

4. **Provider registry pattern.** Create provider registry that maps config names to provider instances. Support default provider fallback.

5. **Prompt enhancement.** Fetch user-scoped heuristics first. Prepend similar past executions (repo-scoped). Enhance prompts with project conventions.

6. **Embedding consistency.** Always use `EMBEDDING_DIM` from `@alfred/embed` for dimension validation. Never hardcode dimension values.

7. **Fallback strategy.** Configure fallback providers in provider registry. Implement exponential backoff for provider failures.

8. **Model capabilities.** Match tool calling and structured output to model capabilities. Use `generateObject`/`streamObject` for structured outputs.

## See Also

- `.ruler/15-ai-sdk-v6.md` for AI SDK v6 standards
- `.ruler/28-embeddings.md` for embedding standards
