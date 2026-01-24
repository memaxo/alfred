# @alfred/summarize

Intelligent text summarization using LongCodeZip-inspired techniques.

## Features

- **Two-stage hierarchical compression**: Coarse-grained (function/section level) + fine-grained (block/line level)
- **AMI (Approximated Mutual Information)**: Perplexity-based relevance scoring that measures how much context helps predict an instruction
- **Entropy-based semantic chunking**: Identify natural content boundaries using perplexity spikes
- **Automatic fallback**: Heuristic summarization when Python is unavailable

## Installation

```bash
bun add @alfred/summarize
```

### Python Dependencies (Optional)

For the full LongCodeZip backend:

```bash
cd packages/summarize
uv sync
```

## Usage

### Basic Summarization

```typescript
import { summarize } from "@alfred/summarize";

const result = await summarize("Long document text...", {
  targetRatio: 0.3, // Compress to 30% of original
  instruction: "Focus on technical concepts",
});

console.log(result.text); // Compressed text
console.log(result.compressionRatio); // Achieved ratio
console.log(result.metadata.method); // "longcodezip" or "heuristic"
```

### Semantic Chunking

```typescript
import { chunk } from "@alfred/summarize";

const result = await chunk("Text to split into semantic chunks...", {
  method: "std", // Spike detection method: std, robust_std, iqr, mad
  k: 0.2, // Threshold multiplier
});

console.log(result.chunks); // Array of semantic chunks
console.log(result.perplexities); // Perplexity values
console.log(result.spikeIndices); // Where boundaries were detected
```

### Context Relevance (AMI)

```typescript
import { ami } from "@alfred/summarize";

const result = await ami("Context about authentication...", {
  instruction: "How does auth work?",
});

console.log(result.score); // Positive = relevant, negative = may confuse
```

### Process Management

```typescript
import {
  initialize,
  shutdown,
  getHealth,
  isPythonAvailable,
} from "@alfred/summarize";

// Check if Python backend is available
if (isPythonAvailable()) {
  // Pre-initialize for faster first call
  await initialize({
    modelName: "Qwen/Qwen2.5-Coder-0.5B-Instruct",
    device: "auto", // auto, cpu, cuda, mps
  });
}

// Check health
const health = getHealth();
console.log(health?.status); // idle, busy, error

// Clean up when done
await shutdown();
```

## How It Works

### LongCodeZip Algorithm

Based on the [LongCodeZip paper](https://arxiv.org/abs/2510.00446):

1. **Coarse-grained compression**: Split text into function/section chunks, rank by AMI, select within token budget
2. **Fine-grained compression**: Within each chunk, use perplexity boundaries to identify blocks, apply 0/1 knapsack for optimal selection
3. **AMI calculation**: `AMI(context, query) = PPL(query) - PPL(query | context)` - positive values mean the context helps

### Heuristic Fallback

When Python is unavailable:

- **Summarization**: Position-based sentence extraction (first/last sentences weighted higher)
- **Chunking**: Paragraph boundary detection (double newlines)
- **AMI**: Word overlap ratio scaled to AMI-like range

## Environment Variables

| Variable                   | Default                            | Description                      |
| -------------------------- | ---------------------------------- | -------------------------------- |
| `SUMMARIZE_MODEL`          | `Qwen/Qwen2.5-Coder-0.5B-Instruct` | Model for perplexity calculation |
| `SUMMARIZE_DEVICE`         | `auto`                             | Device: auto, cpu, cuda, mps     |
| `SUMMARIZE_LOG_LEVEL`      | `INFO`                             | Python logging level             |
| `ALFRED_SUMMARIZE_OFFLINE` | `0`                                | Force heuristic fallback         |

## Architecture

```
@alfred/summarize/
├── src/
│   ├── index.ts       # Package exports
│   ├── summarize.ts   # Main API with fallbacks
│   ├── process.ts     # Python subprocess management
│   ├── types.ts       # TypeScript interfaces
│   └── schema.ts      # Zod schemas
└── python/
    ├── server.py      # JSON-RPC server
    └── compressor.py  # LongCodeZip implementation
```

## Testing

```bash
# Run tests (uses heuristic fallback if Python unavailable)
bun test packages/summarize

# With Python backend
cd packages/summarize && uv sync
bun test packages/summarize
```

## References

- [LongCodeZip: Compressing Long Contexts for LLMs](https://arxiv.org/abs/2510.00446)
- [@alfred/embed](../embed) - Similar Python subprocess pattern
