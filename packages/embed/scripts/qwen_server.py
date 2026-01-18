#!/usr/bin/env python3
"""
Qwen3-VL-Embedding Server - IPC worker for multimodal embeddings
Reads JSON requests from stdin, writes JSON responses to stdout

Supports:
- Text embeddings
- Image embeddings
- Mixed (text + image) embeddings

Uses Matryoshka Representation Learning (MRL) to truncate to 1024 dimensions:
- Model generates 2048-dim embeddings
- Truncated to first 1024 dims (MRL-trained for this)
- Compatible with pgvector HNSW index (max 2000 dims)
"""

import os
import sys
import json
import traceback

MODEL_NAME = os.getenv("EMBED_MODEL", "Qwen/Qwen3-VL-Embedding-2B")
FULL_DIM = 2048  # Model's native dimension
TARGET_DIM = int(os.getenv("EMBED_DIMENSIONS", "1024"))  # MRL truncation target


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
    """Resolve device from EMBED_DEVICE."""
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
        try:
            if torch_mod.cuda.is_available():
                return "cuda"
        except Exception:
            pass
        return detect_device(torch_mod)

    return detect_device(torch_mod)


def format_input(input_item: dict) -> dict:
    """Format input item for Qwen3VLEmbedder."""
    input_type = input_item.get("type", "text")
    
    if input_type == "text":
        return {"text": input_item.get("text", "")}
    elif input_type == "image":
        return {"image": input_item.get("image_url", "")}
    elif input_type == "mixed":
        return {
            "text": input_item.get("text", ""),
            "image": input_item.get("image_url", "")
        }
    else:
        return {"text": ""}


def embed_inputs(model, inputs: list[dict]) -> list[list[float]]:
    """
    Embed inputs with MRL truncation to TARGET_DIM dimensions.
    
    Qwen3-VL-Embedding supports Matryoshka Representation Learning,
    which means the first N dimensions retain most of the semantic information.
    Truncating from 2048 to 1024 dims retains ~95% quality.
    """
    import numpy as np
    
    # Format inputs for the model
    formatted_inputs = [format_input(inp) for inp in inputs]
    
    # Generate embeddings using Qwen3VLEmbedder
    embeddings = model.process(formatted_inputs)
    
    # Convert to numpy for manipulation
    embeddings_array = np.array(embeddings)
    
    # Apply MRL truncation to first TARGET_DIM dimensions
    if embeddings_array.shape[1] > TARGET_DIM:
        embeddings_truncated = embeddings_array[:, :TARGET_DIM]
    else:
        embeddings_truncated = embeddings_array
    
    # Re-normalize after truncation (truncation breaks unit length)
    norms = np.linalg.norm(embeddings_truncated, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)  # Avoid division by zero
    embeddings_normalized = embeddings_truncated / norms
    
    return embeddings_normalized.tolist()


def main():
    """IPC loop - read JSON from stdin, write JSON to stdout."""
    import torch
    
    # Status: loading
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

    # Import and load Qwen3VLEmbedder
    try:
        # Try importing from the official scripts
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from qwen3_vl_embedding import Qwen3VLEmbedder
        
        model = Qwen3VLEmbedder(
            model_name_or_path=MODEL_NAME,
            torch_dtype=torch.float16 if device != "cpu" else torch.float32,
        )
        
        print(
            json.dumps(
                {"id": "init", "type": "status", "payload": {"message": "model_loaded"}}
            ),
            flush=True,
        )
    except ImportError:
        # Fallback: Use transformers directly
        print(
            json.dumps(
                {"id": "init", "type": "status", "payload": {"message": "using_transformers_fallback"}}
            ),
            flush=True,
        )
        
        from transformers import AutoModel, AutoProcessor
        
        processor = AutoProcessor.from_pretrained(MODEL_NAME, trust_remote_code=True)
        model_raw = AutoModel.from_pretrained(
            MODEL_NAME,
            trust_remote_code=True,
            torch_dtype=torch.float16 if device != "cpu" else torch.float32,
        ).to(device)
        
        # Create a wrapper that mimics Qwen3VLEmbedder interface
        class FallbackEmbedder:
            def __init__(self, model, processor, device):
                self.model = model
                self.processor = processor
                self.device = device
            
            def process(self, inputs):
                import numpy as np
                
                embeddings = []
                for inp in inputs:
                    text = inp.get("text", "")
                    image = inp.get("image")
                    
                    if image:
                        # Handle image input
                        from PIL import Image
                        import requests
                        from io import BytesIO
                        
                        if image.startswith(("http://", "https://")):
                            response = requests.get(image)
                            img = Image.open(BytesIO(response.content))
                        else:
                            img = Image.open(image)
                        
                        inputs_processed = self.processor(
                            text=text if text else None,
                            images=img,
                            return_tensors="pt"
                        ).to(self.device)
                    else:
                        inputs_processed = self.processor(
                            text=text,
                            return_tensors="pt"
                        ).to(self.device)
                    
                    with torch.no_grad():
                        outputs = self.model(**inputs_processed)
                        # Get the last hidden state and mean pool
                        if hasattr(outputs, "last_hidden_state"):
                            embedding = outputs.last_hidden_state.mean(dim=1).squeeze().cpu().numpy()
                        else:
                            embedding = outputs[0].mean(dim=1).squeeze().cpu().numpy()
                    
                    embeddings.append(embedding.tolist())
                
                return embeddings
        
        model = FallbackEmbedder(model_raw, processor, device)
        
        print(
            json.dumps(
                {"id": "init", "type": "status", "payload": {"message": "model_loaded_fallback"}}
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
                inputs = payload.get("inputs", [])
                if not inputs:
                    response = {
                        "id": req_id,
                        "type": "error",
                        "payload": {"error": "No inputs provided"},
                    }
                else:
                    embeddings = embed_inputs(model, inputs)
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
