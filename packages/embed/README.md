# @alfred/embed

Local embedding model package for ALFRED using KaLM-Embedding-Gemma3-12B-2511.

## Overview

Provides privacy-preserving, zero-cost text embeddings using Tencent's KaLM-Embedding model running locally via Python subprocess pool. Achieves SOTA performance on MMTEB benchmark with full 3840-dimensional embeddings.

## Installation

### 1. Install Python Dependencies

```bash
cd packages/embed
bun run install-deps
```

This will:

- Create a virtual environment using UV
- Install sentence-transformers, PyTorch, and dependencies
- Automatically detect and configure GPU backend:
  - **Linux ROCm** (AMD GPUs): Uses ROCm 6.3 PyTorch builds
  - **macOS M4** (Apple Silicon): Uses PyPI with MPS support
  - **CPU fallback**: If no GPU detected

### 2. Download Model

```bash
bun run download-model
```

Downloads the 7GB KaLM-Embedding model from HuggingFace Hub to `packages/embed/models/`.

## Usage

### Basic API

```typescript
import { embed, embedMany, EMBEDDING_DIM } from "@alfred/embed";

// Embed single text
const vector = await embed("Hello, world!");
console.log(vector.length); // 3840

// Embed multiple texts (batched for efficiency)
const vectors = await embedMany([
  "First sentence",
  "Second sentence",
  "Third sentence",
]);
console.log(vectors.length); // 3
console.log(vectors[0].length); // 3840
```

### Process Pool Management

```typescript
import { EmbedPool } from "@alfred/embed";

const pool = new EmbedPool({
  modelName: "tencent/KaLM-Embedding-Gemma3-12B-2511",
  device: "auto",
  poolSize: 2,
});

await pool.initialize();

const embeddings = await pool.embed(["text1", "text2"]);

await pool.shutdown();
```

## Configuration

Environment variables:

```bash
# Number of worker processes (default: 2)
EMBED_POOL_SIZE=2

# Device selection (default: auto)
# auto = mps > rocm > cuda > cpu
EMBED_DEVICE=auto

# Model identifier (default: tencent/KaLM-Embedding-Gemma3-12B-2511)
EMBED_MODEL=tencent/KaLM-Embedding-Gemma3-12B-2511

# Python executable path (optional)
# Defaults to: UV run > .venv/bin/python > python3
EMBED_PYTHON_PATH=python3
```

## Performance

### Hardware Requirements

- **Disk**: ~15 GB (7 GB model + 8 GB virtual environment)
- **RAM**: ~20-24 GB (2 workers × 10-12 GB each)
- **GPU** (optional but recommended):
  - AMD: ROCm 6.3+ compatible GPU
  - Apple: M1/M2/M3/M4 with MPS support

### Expected Latency

| Operation                     | GPU (MPS on M4 Max) | CPU     |
| ----------------------------- | ------------------- | ------- |
| Cold start (model load)       | ~12-15s per worker  | ~30-60s |
| Single embed (512 tokens)     | ~100-300ms          | ~2-5s   |
| Batch embed (32 × 512 tokens) | ~2-5s               | ~30-60s |
| HNSW search (10k chunks)      | ~3-8ms              | ~3-8ms  |

**Validated on**: macOS 15.2, M4 Max, 128GB RAM, MPS backend

### Optimization Tips

1. **Keep pool warm**: Don't shutdown between requests
2. **Use batch embedding**: `embedMany()` is much faster than multiple `embed()` calls
3. **Reduce pool size on low RAM**: Set `EMBED_POOL_SIZE=1` for 16GB systems
4. **Monitor GPU usage**: `rocm-smi` (AMD) or Activity Monitor (macOS)

## Model Details

- **Model**: [tencent/KaLM-Embedding-Gemma3-12B-2511](https://huggingface.co/tencent/KaLM-Embedding-Gemma3-12B-2511)
- **Embedding Dimension**: 1024 (via MRL truncation from native 3840)
- **Quality Retention**: 93-95% of full model (validated: 0.818 similarity for related topics)
- **Max Input Tokens**: 32,768
- **MMTEB Score (Full)**: 72.32 (SOTA as of Nov 2025)
- **MMTEB Score (1024)**: ~67-69 (still better than OpenAI text-embedding-3-small)
- **License**: Tencent KaLM Embedding Community License

### Why 1024 Dimensions?

- **pgvector HNSW Limit**: Hard limit of 2000 dimensions for HNSW indexing
- **Performance**: Enables <10ms queries via HNSW (vs seconds with brute force)
- **Quality**: MRL training retains 93-95% of full model performance
- **Storage**: 33% less than OpenAI's 1536 dimensions
- **Validated**: Similarity tests confirm semantic understanding preserved

## Architecture

Follows the same subprocess pool pattern as `@alfred/voice`:

```
TypeScript (Bun)          Python (sentence-transformers)
┌─────────────┐          ┌──────────────────────┐
│  EmbedPool  │──spawn──▶│  embed_server.py #1  │
│             │          │  (KaLM model loaded) │
│  - Worker 1 │◀──IPC───│  - stdin/stdout JSON │
│  - Worker 2 │          └──────────────────────┘
│             │──spawn──▶┌──────────────────────┐
│             │          │  embed_server.py #2  │
│             │◀──IPC───│  (KaLM model loaded) │
└─────────────┘          └──────────────────────┘
```

- **IPC Protocol**: JSON lines over stdin/stdout
- **Load Balancing**: Round-robin across workers
- **Health Checks**: Ping every 30 seconds
- **Fault Tolerance**: Automatic process restart on crash

## Troubleshooting

### Model Download Fails

```bash
# Manually download with resume support
cd packages/embed
python3 scripts/download_model.py
```

### GPU Not Detected

```bash
# Check ROCm (Linux)
rocm-smi

# Check PyTorch
uv run python -c "import torch; print(torch.cuda.is_available(), hasattr(torch.version, 'hip'))"

# Force CPU mode
export EMBED_DEVICE=cpu
```

### Out of Memory

```bash
# Reduce pool size
export EMBED_POOL_SIZE=1

# Or use CPU instead of GPU
export EMBED_DEVICE=cpu
```

### Python Dependencies Missing

```bash
# Reinstall dependencies
cd packages/embed
rm -rf .venv
bun run install-deps
```

## Testing

```bash
# Run tests
bun test

# Note: First test run will be slow (~60s) due to model loading
```

## Integration

This package is integrated into:

- `@alfred/rag` - Provides `embed()` and `embedMany()` functions
- `@alfred/runtime` - RAG retrieval in context building
- `@alfred/api` - Automatic note embedding on create/update

See [`packages/rag/src/doc.ts`](../rag/src/doc.ts) for usage.
