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

import sys
import json
import traceback
from sentence_transformers import SentenceTransformer
import torch

MODEL_NAME = "tencent/KaLM-Embedding-Gemma3-12B-2511"
FULL_DIM = 3840  # Model's native dimension
TARGET_DIM = 1024  # MRL truncation target (pgvector HNSW compatible)


def detect_device() -> str:
    """Detect best available device: mps > cuda > cpu"""
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    else:
        return "cpu"


# Load model on startup
print(json.dumps({"id": "init", "type": "status", "payload": {"message": "loading_model"}}), flush=True)

device = detect_device()
print(json.dumps({"id": "init", "type": "status", "payload": {"message": f"using_device_{device}"}}), flush=True)

model = SentenceTransformer(
    MODEL_NAME,
    trust_remote_code=True,
    device=device,
    model_kwargs={"dtype": torch.bfloat16},
)

print(json.dumps({"id": "init", "type": "status", "payload": {"message": "model_loaded"}}), flush=True)


def embed_texts(texts: list[str]) -> list[list[float]]:
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
                    embeddings = embed_texts(texts)
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

