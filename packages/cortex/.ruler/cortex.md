# Cortex (Engine) Standards

1. **Model Abstraction.** Cortex provides the unified interface to LLMs. Use `generateText()` and `streamText()` from `@alfred/cortex`.

2. **Provider Registry.** Add new LLM providers through the central registry in `packages/cortex/src/providers`.
