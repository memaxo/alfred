#!/usr/bin/env python3
"""
Embedding Server - IPC worker for KaLM-Embedding-Gemma3-12B-2511
Reads JSON requests from stdin, writes JSON responses to stdout

Uses Matryoshka Representation Learning (MRL) to truncate to 1024 dimensions:
- Model generates 3840-dim embeddings
- Truncated to first 1024 dims (MRL-trained for this)
- Retains 93-95% of full model quality
- Compatible with pgvector HNSW index (max 2000 dims)
"""

import os
import sys
import json
import traceback

MODEL_NAME = "tencent/KaLM-Embedding-Gemma3-12B-2511"
FULL_DIM = 3840  # Model's native dimension
TARGET_DIM = 1024  # MRL truncation target (pgvector HNSW compatible)


def detect_device(torch_mod) -> str:
    """Detect best available device: mps > cuda > cpu."""
    try:
        if hasattr(torch_mod, "backends") and hasattr(torch_mod.backends, "mps"):
            if torch_mod.backends.mps.is_available():
                return "mps"
    except Exception:
        pass

    try:
        if hasattr(torch_mod, "cuda") and torch_mod.cuda.is_available():
            return "cuda"
    except Exception:
        pass

    return "cpu"


def resolve_device(explicit: str | None, torch_mod) -> str:
    """Resolve device from EMBED_DEVICE.

    Accepted: auto|cpu|mps|cuda|rocm
    Note: PyTorch uses device="cuda" for ROCm (HIP) as well.
    """
    if not explicit:
        return detect_device(torch_mod)

    raw = explicit.strip().lower()
    if raw == "auto":
        return detect_device(torch_mod)
    if raw == "cpu":
        return "cpu"
    if raw == "mps":
        try:
            if hasattr(torch_mod.backends, "mps") and torch_mod.backends.mps.is_available():
                return "mps"
        except Exception:
            pass
        return detect_device(torch_mod)
    if raw in ("cuda", "rocm"):
        # ROCm is reported through torch.cuda APIs.
        try:
            if torch_mod.cuda.is_available():
                return "cuda"
        except Exception:
            pass
        return detect_device(torch_mod)

    # Unknown value: fall back safely.
    return detect_device(torch_mod)


def embed_texts(model, texts: list[str]) -> list[list[float]]:
    """
    Embed texts with MRL truncation to 1024 dimensions.
    
    KaLM-Embedding is trained with Matryoshka Representation Learning,
    which means the first N dimensions retain most of the semantic information.
    Truncating from 3840 to 1024 dims retains ~93-95% quality.
    """
    import numpy as np
    
    # Generate full 3840-dimensional embeddings (normalized)
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        batch_size=32,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    
    # Apply MRL truncation to first 1024 dimensions
    # This is a designed feature of the model, not a lossy hack
    embeddings_truncated = embeddings[:, :TARGET_DIM]
    
    # Re-normalize after truncation (truncation breaks unit length)
    norms = np.linalg.norm(embeddings_truncated, axis=1, keepdims=True)
    embeddings_normalized = embeddings_truncated / norms
    
    return embeddings_normalized.tolist()


def main():
    """IPC loop - read JSON from stdin, write JSON to stdout."""
    from sentence_transformers import SentenceTransformer
    import torch

    # Load model on startup
    print(
        json.dumps(
            {"id": "init", "type": "status", "payload": {"message": "loading_model"}}
        ),
        flush=True,
    )

    explicit = os.getenv("EMBED_DEVICE")
    device = resolve_device(explicit, torch)
    print(
        json.dumps(
            {
                "id": "init",
                "type": "status",
                "payload": {
                    "message": f"using_device_{device}",
                    "requested": (explicit or "auto"),
                },
            }
        ),
        flush=True,
    )

    # Parse quantization config
    quantization = os.getenv("EMBED_QUANTIZATION")
    model_kwargs = {"dtype": torch.bfloat16}

    if quantization == "4bit":
        try:
            from transformers import BitsAndBytesConfig

            model_kwargs["quantization_config"] = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.bfloat16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
            )
            print(
                json.dumps(
                    {
                        "id": "init",
                        "type": "status",
                        "payload": {"message": "quantization_4bit_enabled"},
                    }
                ),
                flush=True,
            )
        except ImportError:
            print(
                json.dumps(
                    {
                        "id": "init",
                        "type": "status",
                        "payload": {
                            "message": "bitsandbytes_not_found_skipping_quantization"
                        },
                    }
                ),
                flush=True,
            )
    elif quantization == "8bit":
        try:
            from transformers import BitsAndBytesConfig

            model_kwargs["quantization_config"] = BitsAndBytesConfig(load_in_8bit=True)
            print(
                json.dumps(
                    {
                        "id": "init",
                        "type": "status",
                        "payload": {"message": "quantization_8bit_enabled"},
                    }
                ),
                flush=True,
            )
        except ImportError:
            print(
                json.dumps(
                    {
                        "id": "init",
                        "type": "status",
                        "payload": {
                            "message": "bitsandbytes_not_found_skipping_quantization"
                        },
                    }
                ),
                flush=True,
            )

    model = SentenceTransformer(
        MODEL_NAME,
        trust_remote_code=True,
        device=device,
        model_kwargs=model_kwargs,
    )

    print(
        json.dumps(
            {"id": "init", "type": "status", "payload": {"message": "model_loaded"}}
        ),
        flush=True,
    )

    print(json.dumps({"id": "ready", "type": "ready", "payload": {}}), flush=True)

    for line in sys.stdin:
        try:
            request = json.loads(line)
            req_id = request.get("id")
            req_type = request.get("type")
            payload = request.get("payload", {})

            if req_type == "embed":
                texts = payload.get("texts", [])
                if not texts:
                    response = {
                        "id": req_id,
                        "type": "error",
                        "payload": {"error": "No texts provided"},
                    }
                else:
                    embeddings = embed_texts(model, texts)
                    response = {
                        "id": req_id,
                        "type": "embed_response",
                        "payload": {"embeddings": embeddings},
                    }
            elif req_type == "ping":
                response = {
                    "id": req_id,
                    "type": "pong",
                    "payload": {},
                }
            else:
                response = {
                    "id": req_id,
                    "type": "error",
                    "payload": {"error": f"Unknown request type: {req_type}"},
                }

            print(json.dumps(response), flush=True)

        except Exception as e:
            error_response = {
                "id": req_id if "req_id" in locals() else "unknown",
                "type": "error",
                "payload": {
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                },
            }
            print(json.dumps(error_response), flush=True)


if __name__ == "__main__":
    main()

