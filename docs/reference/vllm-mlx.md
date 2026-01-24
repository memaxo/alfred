# vllm-mlx

Purpose: run Apple Silicon MLX models locally behind an OpenAI-compatible `/v1` API so ALFRED (running in Docker Compose) can use a “free” local model for chat/planning/orchestration.

Owner: runtime

## Quick start (host → Docker)

- **1) Install vllm-mlx on the host**

From this repo (vendored submodule):

```bash
python3 -m venv .agent/vllmmlx
source .agent/vllmmlx/bin/activate
pip install -e vendor/vllm-mlx
vllm-mlx --help
```

- **2) Start the model server on the host**

GLM-4.7 Flash (MLX 8bit, large):

```bash
vllm-mlx serve mlx-community/GLM-4.7-Flash-8bit-gs32 \
  --host 0.0.0.0 --port 8000 \
  --continuous-batching --use-paged-cache \
  --api-key your-secret-key
```

Notes:

- The model `mlx-community/GLM-4.7-Flash-8bit-gs32` is ~33.7GB in MLX form. See the model card: `https://huggingface.co/mlx-community/GLM-4.7-Flash-8bit-gs32`.
- For faster smoke tests, use a smaller model first, e.g. `mlx-community/Qwen3-0.6B-8bit`.

- LFM2.5 Thinking (MLX 8bit, small ~1.2GB):

```bash
vllm-mlx serve LiquidAI/LFM2.5-1.2B-Thinking-MLX-8bit \
  --host 0.0.0.0 --port 8000 \
  --continuous-batching --use-paged-cache \
  --api-key your-secret-key
```

Notes:

- See model card: `https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking-MLX-8bit`.
- This “Thinking” model emits `<think>...</think>` text in responses. ALFRED can display it verbatim.

- **3) Point Docker Compose ALFRED at the host**

In `docker/alfred/env.example`, uncomment and set:

- `LOCAL_OPENAI_BASE_URL=http://host.docker.internal:8000/v1`
- `LOCAL_OPENAI_API_KEY=your-secret-key`
- `AI_MODEL_CHAT=local:mlx-community/GLM-4.7-Flash-8bit-gs32`
- `AI_MODEL_ORCHESTRATOR=local:mlx-community/GLM-4.7-Flash-8bit-gs32`
- `AI_MODEL_PLANNER=local:mlx-community/GLM-4.7-Flash-8bit-gs32`

Then start ALFRED:

```bash
docker compose -f docker/compose.yml up -d alfred
```

## Verification

- **Host check**:

```bash
VLLM_MLX_BASE_URL=http://localhost:8000/v1 VLLM_MLX_API_KEY=your-secret-key \
  bun run scripts/verify-vllmmlx.ts --model "mlx-community/GLM-4.7-Flash-8bit-gs32"
```

- **From inside the `alfred` container**:

```bash
docker compose -f docker/compose.yml exec -T alfred \
  sh -lc 'VLLM_MLX_BASE_URL=http://host.docker.internal:8000/v1 VLLM_MLX_API_KEY="$LOCAL_OPENAI_API_KEY" bun run scripts/verify-vllmmlx.ts --model "mlx-community/GLM-4.7-Flash-8bit-gs32"'
```

## Reference

- vllm-mlx project: `https://github.com/waybarrios/vllm-mlx`
- OpenAI-compatible server endpoints (vllm upstream): `https://docs.vllm.ai/en/stable/serving/openai_compatible_server/`
