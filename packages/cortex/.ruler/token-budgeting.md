# Token Budgeting Patterns

## Core Principle

MaxTokens limits response length. Calculate remaining tokens for history. Truncate history to fit budget.

## Rules

1. **MaxTokens setting.** Configure `maxTokens` in model config for response length limit. Never leave unbounded or rely on provider defaults.

2. **History token counting.** Count tokens in message history using tokenizer. Use provider-native tokenizer when available. Fall back to conservative estimate.

3. **Budget calculation.** Calculate remaining tokens: `maxTokens - estimatedResponse - systemPrompt`. Never exceed provider context window.

4. **History truncation.** Truncate oldest messages when history exceeds budget. Preserve system prompt and recent messages.

5. **Chunk-based truncation.** Remove complete messages (all parts) when truncating. Never truncate within a single message part.

6. **System prompt priority.** Always preserve system prompt. Truncate only conversation history and context messages.

7. **Token budget metrics.** Track `token_budget_used` and `token_budget_remaining` metrics. Monitor for budget exhaustion.

8. **Warning thresholds.** Log warning when remaining tokens < 1000. Fail gracefully when exceeding provider context limit.

## See Also

- `.ruler/15-ai-sdk-v6.md` for AI SDK v6 standards
