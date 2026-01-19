# LLM-First Classification

ALFRED uses lightweight LLM calls for semantic classification tasks instead of hand-coded heuristics. This provides better accuracy and adaptability without code changes.

## What Gets Classified

ALFRED uses LLM classification for:

- **Intent classification**: Categorizing user requests (fix, feat, refactor, test, docs, etc.)
- **Phase grouping**: Organizing subtasks into workflow phases (setup, db, api, ui, test)
- **Path classification**: Bucketing file paths (backend, frontend, test, misc)
- **Domain classification**: Identifying knowledge domains (coding, business, science, etc.)
- **Relevance scoring**: Rating research source relevance to user intent

## Configuration

### Model Selection

By default, ALFRED uses Cerebras `gpt-oss-120b` for classification (3000 tok/s, $0.35/M tokens):

```bash
# Default in config/env.example
AI_MODEL_CLASSIFY=cerebras:gpt-oss-120b
```

You can override this to use any supported model:

```bash
# Use OpenAI for classification
AI_MODEL_CLASSIFY=openai:gpt-4o-mini

# Use OpenRouter
AI_MODEL_CLASSIFY=openrouter:anthropic/claude-3.5-haiku
```

### Offline Mode

To use heuristic fallbacks instead of LLM calls (useful for cost savings or offline operation):

```bash
ALFRED_CLASSIFY_OFFLINE=1
```

When enabled, all classification falls back to keyword-based heuristics automatically.

## Cost Optimization

Classification calls are designed to be lightweight:

- **Token budget**: ~100-300 tokens per classification
- **Batch support**: Multiple items classified in one call
- **Caching**: Future enhancement (not yet implemented)

### Typical Costs (Cerebras gpt-oss-120b)

- Single intent classification: ~$0.0001
- Batch phase grouping (10 items): ~$0.0003
- Per-workflow overhead: ~$0.001-0.002

### Fallback Triggers

Classification automatically falls back to heuristics when:

1. `ALFRED_CLASSIFY_OFFLINE=1` is set
2. LLM call fails after retries
3. No model is configured

## Observability

Classification metrics are exposed via `/api/metrics`:

```prometheus
# Latency tracking
alfred_classification_latency_seconds{type="intent", model="cerebras/gpt-oss-120b"}

# Fallback monitoring
alfred_classification_fallback_total{type="intent", reason="error"}

# Confidence distributions
alfred_classification_confidence{type="intent"}

# Total attempts
alfred_classification_total{type="intent", outcome="success"}

# Batch sizes
alfred_classification_batch_size{type="phase"}
```

Notes:
- `type` is a **stable classification kind**: `intent|phase|path|relevance|domain|other`
- `model` is the selected `modelKey` (for example: `cerebras/gpt-oss-120b`)

### Monitoring Recommendations

1. **Watch fallback rate**: High fallback rates indicate LLM failures
2. **Track latency p99**: Should be <500ms for most classifications
3. **Monitor confidence**: Low confidence suggests ambiguous inputs
4. **Cost tracking**: Use `alfred_classification_total` for usage estimates

## Development

### Adding New Classifications

Follow the LLM-first pattern documented in `.ruler/55-llm-first-classification.md`:

1. Define Zod schema for structured output
2. Build classification prompt
3. Implement heuristic fallback
4. Use `classify()` utility from `@alfred/plan/classify`
5. Add tests for both LLM and fallback paths

### Example

```typescript
import { classify } from "@alfred/plan/classify";
import { getClassificationModel } from "@alfred/agent/selector";
import { z } from "zod";

const prioritySchema = z.object({
  priority: z.enum(["urgent", "high", "medium", "low"]),
  confidence: z.number(),
});

async function classifyTaskPriority(description: string) {
  const model = getClassificationModel();
  
  return classify(
    prioritySchema,
    `Classify the priority of this task: "${description}"`,
    {
      model,
      modelKey: "cerebras/gpt-oss-120b",
      metricType: "other",
      fallback: () => ({
        priority: "medium", // Safe default
        confidence: 0.5,
      }),
    }
  );
}
```

## Troubleshooting

### High Fallback Rate

Check:
1. `CEREBRAS_API_KEY` is set correctly
2. API quota is not exceeded
3. Network connectivity to Cerebras API

### Slow Classification

Check:
1. Model selection (Cerebras is fastest)
2. Network latency to API endpoint
3. Token budget (keep prompts under 300 tokens)

### Incorrect Classifications

1. Check confidence scores in metrics
2. Review classification prompts (enable debug logging)
3. Consider fine-tuning heuristic fallbacks
4. Try a more capable model (e.g., `gpt-4o-mini`)

## Related Documentation

- **Rule**: `.ruler/55-llm-first-classification.md` - Development guidelines
- **ExecPlan**: `docs/execplans/llm-first-classification-refactor.md` - Implementation details
- **Metrics**: `packages/metrics/src/classification.ts` - Metric definitions
