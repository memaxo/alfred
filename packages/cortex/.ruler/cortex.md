# Cortex (Engine) Standards

1. **Model Abstraction.** Cortex provides the unified interface to LLMs. Use `generateText()` and `streamText()` from `@alfred/cortex`.

2. **Model Selection.** Use KaLM-Embedding-Gemma3-12B-2511 with MRL truncation to 1024 dimensions for embeddings.

3. **Prompt Influence.** Fetch user-scoped heuristics first, then prepend similar past executions (repo-scoped) to enriched prompts.

4. **Provider Registry.** Add new LLM providers through the central registry in `packages/cortex/src/providers`.
