# LLM-First Classification

## Core Principle

Heuristic lists are a maintenance trap for complex decision logic. When agents face tree-like classification, routing, or identification tasks, prefer lightweight LLM calls over hand-coded conditionals. A 120B model at 3000 tok/s with minimal context outperforms a 500-line switch statement and adapts without code changes.

## Rules

1. **No heuristic lists for complex classification.** If a decision requires >5 branches, pattern matching on multiple fields, or "magic" constants, replace it with a prompted classification call. Heuristic lists rot; prompts evolve.

2. **Default model: `gpt-oss-120b` via Cerebras.** Use `gpt-oss-120b` (OpenAI GPT OSS 120B) as the default classification model. At ~3000 tok/s, $0.35/M input tokens, and native structured output support, it handles most classification tasks with sub-100ms latency.

3. **Model hierarchy for classification:**
   - **Default:** `gpt-oss-120b` via Cerebras (~3000 tok/s, structured outputs, tool calling)
   - **Lighter tasks:** `gpt-oss-20b` for simpler binary/ternary classification
   - **Local/offline:** Nvidia Nemotron or Ollama-hosted models when data cannot leave the machine
   - **Fallback:** Simple heuristic (<5 branches) only when inference is unavailable

4. **Structured output always.** Classification calls must use `generateObject` with a Zod schema, not free-text parsing. `gpt-oss-120b` natively supports structured outputs—use this capability.

5. **Minimize token use.** Classification prompts should include only the decision context needed—avoid stuffing unrelated data. Use `reasoning_effort: "low"` when the classification is straightforward.

6. **Prompt templates are code.** Store classification prompts in dedicated `.prompt.ts` files alongside the calling code. Version them, test them, review them like code.

7. **Fallback heuristics allowed.** A simple (<5 branch) heuristic fallback for when inference is unavailable is acceptable, but it must be clearly marked as degraded behavior and logged.

8. **Model registry pattern.** Use a model registry (`@alfred/cortex` or similar) to resolve model selection by task type. Never hardcode model names in business logic—reference task types that resolve to models.

9. **Measure classification quality.** Log classification inputs, outputs, and confidence. Track accuracy over time. A heuristic might beat a bad prompt—verify before shipping.

10. **Anti-pattern: nested if-else forests.** Any file with >3 levels of nested conditionals for classification/routing is a candidate for LLM replacement. Flag in code review.

11. **Tool call awareness.** `gpt-oss-120b` may call tools not directly specified due to its training. When using tool calling for classification, monitor for non-approved tools and include guidance to use only provided tools.

## Reference Implementations

- **Classification utility:** `packages/plan/src/classify/index.ts` — Shared `classify()` and `classifyBatch()` functions
- **Intent classification:** `packages/plan/src/intent/classify.ts` — Uses `classify()` with schema and heuristic fallback
- **Phase grouping:** `packages/plan/src/generate/group.ts` — Uses `classifyBatch()` for batch assignment
- **Path classification:** `packages/plan/src/classify/path.ts` — Canonical path bucketing with batch LLM support
- **Tool routing:** `packages/agent/src/routing/intent.ts` — Intent-based tool catalog selection
