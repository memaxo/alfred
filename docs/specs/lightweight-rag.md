# Specification: Lightweight RAG Configuration

## Context

The current RAG system defaults to `tencent/KaLM-Embedding-Gemma3-12B-2511`, a high-performance but resource-intensive (12B parameter) model. The `EmbedPool` spawns 2 worker processes by default. This combination (2x ~24GB VRAM/RAM usage) makes the system unusable on standard development machines (16GB-32GB RAM), causing OOM crashes.

## Goals

1.  **Make RAG usable on local machines** (16GB RAM minimum).
2.  **Preserve production performance** capability for server deployments.
3.  **Maintain vector compatibility** (1024 dimensions) or handle dimension mismatch gracefully.

## Proposed Changes

### 1. Dynamic Model Selection (`packages/embed`)

Update `EmbedPool` initialization to select a model based on the environment.

- **Default (Dev)**: `nomic-ai/nomic-embed-text-v1.5` (137M params) or `BAAI/bge-m3` (567M params).
  - _Challenge_: These models typically output 768 or 1024 dimensions. `nomic-embed-text-v1.5` supports Matryoshka/variable dimensions (64 to 768).
  - _Conflict_: Our DB schema (`rag.ts`) is hardcoded to `VECTOR_DIM = 1024` (derived from `KaLM`).
  - _Resolution_: Use `Snowflake/snowflake-arctic-embed-l` (1024 dim support) OR keep `KaLM` but enforce `EMBED_POOL_SIZE=1` and add quantization support (4-bit/8-bit) in `embed_server.py`.

  _Decision_: **Quantization + Single Worker** is the safest path to keep the 1024-dim schema constant without complex migration logic.

### 2. Quantization Support (`packages/embed/scripts/embed_server.py`)

Modify the Python server to support loading models in 4-bit or 8-bit precision using `bitsandbytes`.

```python
# embed_server.py concept
model = SentenceTransformer(
    MODEL_NAME,
    model_kwargs={
        "load_in_4bit": os.getenv("EMBED_QUANTIZATION") == "4bit",
        "device_map": "auto"
    }
)
```

### 3. Resource-Aware Defaults (`packages/embed/src/pool.ts`)

Logic to determine default `poolSize`.

- If `NODE_ENV === 'production'`, default `poolSize: 2`.
- If `NODE_ENV !== 'production'`, default `poolSize: 1`.

### 4. Configuration Schema

Expose control via `.env`:

- `EMBED_MODEL_QUANTIZATION`: "4bit" | "8bit" | "none" (Default: "4bit" in dev).
- `EMBED_POOL_SIZE`: Integer (Default: 1 in dev).

## Implementation Steps

1.  **Update Python Dependencies**: Add `bitsandbytes` and `accelerate` to `packages/embed/pyproject.toml` (or `scripts/install-deps.sh`).
2.  **Update `embed_server.py`**: Add quantization loading logic.
3.  **Update `EmbedPool`**:
    - Read `EMBED_POOL_SIZE` with smarter defaults.
    - Pass `EMBED_QUANTIZATION` env var to worker.
4.  **Documentation**: Update `docs/architecture/rag.md` with hardware requirements and configuration guide.

## Risks

- **Quantization Quality**: 4-bit quantization might degrade embedding quality slightly (usually negligible for retrieval).
- **MRL Compatibility**: Ensure `bitsandbytes` quantization plays nicely with `SentenceTransformer` MRL truncation.

## Verification

- Run `scripts/verify-graph-rag.ts` with `EMBED_QUANTIZATION=4bit`.
- Monitor RAM usage during execution.
