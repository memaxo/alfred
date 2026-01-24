# @alfred/rerank

Multimodal document reranking for ALFRED's RAG system.

## Overview

This package provides a unified interface for document reranking with support for multiple backends:

- **Cohere API** - Text-only reranking via SaaS (requires `COHERE_API_KEY`)
- **Qwen3-VL-Reranker** - Multimodal reranking (text + images + video) via self-hosted server

## Quick Start

```typescript
import { rerank } from "@alfred/rerank";

const results = await rerank({
  query: "A dog playing on a beach",
  documents: [
    { id: "1", text: "Golden retriever running on sand" },
    { id: "2", text: "Cat sleeping on couch" },
    {
      id: "3",
      text: "Beach sunset",
      imageUrl: "https://example.com/beach.jpg",
    },
  ],
  topN: 2,
});

// Results: [{ id: "1", score: 0.92, index: 0 }, { id: "3", score: 0.85, index: 2 }]
```

## Backend Selection

The backend is automatically selected based on environment variables:

1. Explicit: `RERANK_BACKEND=cohere|qwen3vl|none`
2. Auto-detect: Uses Cohere if `COHERE_API_KEY` is set, Qwen3-VL if `QWEN3VL_RERANK_URL` is set
3. Fail-open: Returns empty array if no backend is configured

## Environment Variables

### Backend Selection

| Variable         | Default     | Description                                |
| ---------------- | ----------- | ------------------------------------------ |
| `RERANK_BACKEND` | auto-detect | Force backend: `cohere`, `qwen3vl`, `none` |

### RAG Integration

| Variable     | Default | Description                                                                    |
| ------------ | ------- | ------------------------------------------------------------------------------ |
| `RAG_RERANK` | `0`     | Enable reranking inside RAG retrieval paths (hybrid search candidate reorder). |

### Cohere (SaaS)

| Variable          | Default                 | Description         |
| ----------------- | ----------------------- | ------------------- |
| `COHERE_API_KEY`  | -                       | Cohere API key      |
| `COHERE_BASE_URL` | `https://api.cohere.ai` | Cohere API base URL |

### Qwen3-VL (Self-hosted)

| Variable                 | Default | Description            |
| ------------------------ | ------- | ---------------------- |
| `QWEN3VL_RERANK_URL`     | -       | URL to Qwen3-VL server |
| `QWEN3VL_TIMEOUT_MS`     | `30000` | Request timeout        |
| `QWEN3VL_RETRY_COUNT`    | `2`     | Retry attempts         |
| `QWEN3VL_RETRY_DELAY_MS` | `500`   | Retry delay multiplier |

### Server Configuration (Docker)

| Variable            | Default                     | Description                                                          |
| ------------------- | --------------------------- | -------------------------------------------------------------------- |
| `RERANK_DEVICE`     | `auto`                      | Device: `auto`, `cpu`, `cuda`, `rocm`, `mps`                         |
| `RERANK_MODEL`      | `Qwen/Qwen3-VL-Reranker-2B` | HuggingFace model ID                                                 |
| `RERANK_PORT`       | `8200`                      | HTTP server port                                                     |
| `RERANK_BATCH_SIZE` | `8`                         | Batch size for text-only documents (higher = faster but more memory) |
| `RERANK_COMPILE`    | `0`                         | Enable torch.compile() for faster inference (set to `1` on CUDA)     |

## Docker Deployment

Start the Qwen3-VL reranker as a sidecar:

```bash
# CPU only
docker compose --profile rerank up -d

# With GPU (CUDA/ROCm)
RERANK_DEVICE=cuda docker compose --profile rerank up -d
```

Then configure ALFRED to use it:

```bash
export RAG_RERANK=1
export QWEN3VL_RERANK_URL=http://localhost:8200
# or with Docker networking
export QWEN3VL_RERANK_URL=http://rerank:8000
```

## API Reference

### `rerank(options)`

Rerank documents against a query.

```typescript
type RerankOptions = {
  query: string; // Query text
  queryImageUrl?: string; // Optional query image (multimodal)
  documents: RerankDocument[]; // Documents to rerank
  topN?: number; // Return top N results (default: 10)
  instruction?: string; // Custom instruction (Qwen3-VL only)
};

type RerankDocument = {
  id: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
};

type RerankResult = {
  id: string;
  score: number; // Relevance score (0-1)
  index: number; // Original index
};
```

### `isRerankAvailable()`

Check if any rerank backend is configured.

### `getRerankBackend()`

Get the currently configured backend name.

### `checkHealth()` (Qwen3-VL only)

Check health of the Qwen3-VL server.

## Batch Processing

The Qwen3-VL server uses batch processing for improved throughput:

- **Text-only documents** are batched together (configurable via `RERANK_BATCH_SIZE`)
- **Multimodal documents** (with images/video) are processed sequentially due to variable input sizes

### Performance Tips

1. **Increase batch size** for higher throughput on GPU (e.g., `RERANK_BATCH_SIZE=16`)
2. **Decrease batch size** if running out of memory (e.g., `RERANK_BATCH_SIZE=4`)
3. **Separate text and multimodal** queries when possible for optimal batching

### Typical Performance

| Configuration      | Text-only (10 docs) | Multimodal (10 docs) |
| ------------------ | ------------------- | -------------------- |
| GPU + batch_size=8 | ~50ms               | ~500ms               |
| GPU + batch_size=1 | ~200ms              | ~500ms               |
| CPU + batch_size=8 | ~2s                 | ~10s                 |

## Profiling & Benchmarking

The rerank service supports **two levels** of performance investigation:

- **Lightweight timings**: request `debug=true` to receive per-stage timings (tokenization vs batching vs multimodal processing).
- **Deep profiling (Python)**: request `profile=true` to write a `cProfile` dump (`.pstats`) to `RERANK_PROFILE_DIR` (server-side).

### Quick benchmark (Python)

Run a short load test against a running server:

```bash
cd packages/rerank
uv run python python/bench.py --url http://localhost:8200 --requests 50 --concurrency 4 --docs 20 --debug
```

### Quick benchmark (Bun/TypeScript)

```bash
bun scripts/bench-rerank.ts --base-url http://localhost:8200 --requests 50 --concurrency 4 --docs 20 --debug
```

### Capture a cProfile dump for one request

1. Start the server with profiling enabled:

```bash
RERANK_PROFILE=1 RERANK_PROFILE_DIR=./.agent/profiles/rerank \
  uv run python -m uvicorn python.server:app --host 0.0.0.0 --port 8200
```

2. Trigger a single profiled request:

```bash
cd packages/rerank
uv run python python/bench.py --url http://localhost:8200 --requests 1 --concurrency 1 --docs 20 --profile-once --debug
```

3. Inspect the `.pstats` file:

```bash
python -m pstats ./.agent/profiles/rerank/rerank_<id>.pstats
```

## Hardening & Limits

The server enforces basic safety limits:

- **Max documents per request**: `RERANK_MAX_DOCS` (default: 200)
- **Inference concurrency**: `RERANK_MAX_CONCURRENCY` (default: 1)
- **Disable `file://` by default**: set `RERANK_ALLOW_FILE_URLS=1` only for local testing (Docker should prefer http(s)).

These settings are also reported by `GET /health` (`max_docs`, `max_concurrency`, `allow_file_urls`).

## Apple Silicon Optimizations

The server includes MLX-inspired optimizations for Apple Silicon (M1/M2/M3/M4):

### MPS Backend

When running on macOS with Apple Silicon, the server automatically:

- Detects and uses MPS (Metal Performance Shaders) for GPU acceleration
- Uses `float16` dtype optimized for Apple's Neural Engine
- Configures memory fraction to leave headroom for system
- Enables MPS fallback for unsupported operations

### Configuration for Apple Silicon

```bash
# Automatic detection (recommended)
RERANK_DEVICE=auto

# Force MPS explicitly
RERANK_DEVICE=mps

# Adjust batch size for memory (M1: 4-8, M2/M3 Pro: 8-16, M2/M3 Max: 16-32)
RERANK_BATCH_SIZE=8
```

### Performance on Apple Silicon

| Mac Model     | Batch Size | Text-only (10 docs) | Peak Memory |
| ------------- | ---------- | ------------------- | ----------- |
| M1 (8GB)      | 4          | ~300ms              | ~4GB        |
| M2 Pro (16GB) | 8          | ~150ms              | ~6GB        |
| M3 Max (64GB) | 16         | ~80ms               | ~8GB        |

### MLX Native (Future)

For even better Apple Silicon performance, we plan to add an MLX-native backend using `mlx_lm`. This will provide:

- Native Metal acceleration without PyTorch overhead
- Lower memory usage with unified memory
- Faster inference with MLX's lazy evaluation

## Hardware Requirements

| Model                | VRAM  | Notes                            |
| -------------------- | ----- | -------------------------------- |
| Qwen3-VL-Reranker-2B | ~6GB  | Good for most GPUs               |
| Qwen3-VL-Reranker-8B | ~18GB | Better accuracy, needs A100/H100 |

CPU inference is possible but slow (~2-5s per batch vs ~100ms on GPU).

## Migration from @alfred/rag

The `rerank` export from `@alfred/rag` now delegates to this package. For new code, import directly:

```typescript
// Old (still works, deprecated)
import { rerank } from "@alfred/rag";

// New (recommended)
import { rerank } from "@alfred/rerank";
```
