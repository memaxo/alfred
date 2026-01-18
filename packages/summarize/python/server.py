#!/usr/bin/env python3
"""
LongCodeZip Compression Server

JSON-RPC style server that communicates via stdin/stdout for text compression.
Uses LongCodeZip algorithm for intelligent context compression.

Protocol:
- Input: JSON lines on stdin
- Output: JSON lines on stdout
- Message format: {"id": "uuid", "type": "request_type", "payload": {...}}
"""

import json
import sys
import os
from typing import Optional

from loguru import logger

# Configure logging
logger.remove()
log_level = os.environ.get("SUMMARIZE_LOG_LEVEL", "INFO")
logger.add(sys.stderr, level=log_level)

from compressor import LongCodeZip

# Global compressor instance
_compressor: Optional[LongCodeZip] = None


def get_compressor() -> LongCodeZip:
    """Get or create the global compressor instance."""
    global _compressor
    if _compressor is None:
        model_name = os.environ.get(
            "SUMMARIZE_MODEL", "Qwen/Qwen2.5-Coder-0.5B-Instruct"
        )
        device = os.environ.get("SUMMARIZE_DEVICE", "auto")
        logger.info(f"Initializing LongCodeZip with model={model_name}, device={device}")
        
        # Resolve device
        if device == "auto":
            import torch
            if torch.cuda.is_available():
                device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                device = "mps"
            else:
                device = "cpu"
        
        _compressor = LongCodeZip(model_name=model_name, device_map=device)
        logger.info("LongCodeZip initialized successfully")
    return _compressor


def handle_compress(payload: dict) -> dict:
    """Handle compression request."""
    compressor = get_compressor()
    
    text = payload.get("text", "")
    instruction = payload.get("instruction", "Summarize the following text.")
    target_ratio = payload.get("target_ratio", 0.5)
    target_tokens = payload.get("target_tokens", -1)
    
    # Use coarse-grained compression only for simplicity
    # Fine-grained can be enabled via options
    use_fine_grained = payload.get("use_fine_grained", False)
    
    result = compressor.compress_code_file(
        code=text,
        query=instruction,
        instruction="",
        rate=target_ratio,
        target_token=target_tokens,
        rank_only=not use_fine_grained,
        fine_grained_importance_method="conditional_ppl",
        min_lines_for_fine_grained=5,
        importance_beta=0.5,
        use_knapsack=True,
    )
    
    return {
        "compressed_text": result["compressed_code"],
        "original_tokens": result["original_tokens"],
        "compressed_tokens": result["compressed_tokens"],
        "compression_ratio": result["compression_ratio"],
    }


def handle_chunk(payload: dict) -> dict:
    """Handle semantic chunking request using entropy-based chunking."""
    compressor = get_compressor()
    
    text = payload.get("text", "")
    method = payload.get("method", "std")
    k = payload.get("k", 0.2)
    
    chunks, sentences, ppls, spike_indices = compressor.entropy_chunking.chunk_text_adaptive(
        text, method=method, k=k
    )
    
    return {
        "chunks": chunks,
        "spike_indices": spike_indices,
        "perplexities": ppls,
    }


def handle_ami(payload: dict) -> dict:
    """Handle AMI (Approximated Mutual Information) calculation."""
    compressor = get_compressor()
    
    context = payload.get("context", "")
    instruction = payload.get("instruction", "")
    
    ami_score = compressor.get_condition_ppl(
        text=context,
        question=instruction,
        condition_in_question="prefix",
    )
    
    return {
        "ami_score": ami_score,
    }


def handle_ping(_payload: dict) -> dict:
    """Handle ping request."""
    return {"status": "pong"}


def handle_request(request: dict) -> dict:
    """Route request to appropriate handler."""
    req_type = request.get("type", "")
    payload = request.get("payload", {})
    
    handlers = {
        "compress": handle_compress,
        "chunk": handle_chunk,
        "ami": handle_ami,
        "ping": handle_ping,
    }
    
    handler = handlers.get(req_type)
    if handler is None:
        return {"error": f"Unknown request type: {req_type}"}
    
    try:
        return handler(payload)
    except Exception as e:
        logger.exception(f"Error handling {req_type} request")
        return {"error": str(e)}


def main():
    """Main server loop."""
    logger.info("Starting LongCodeZip compression server...")
    
    # Pre-initialize compressor to load model
    try:
        get_compressor()
        # Signal ready
        print(json.dumps({"type": "ready", "id": "init"}), flush=True)
    except Exception as e:
        logger.exception("Failed to initialize compressor")
        print(json.dumps({"type": "error", "id": "init", "payload": {"error": str(e)}}), flush=True)
        sys.exit(1)
    
    # Process requests
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        
        try:
            request = json.loads(line)
            req_id = request.get("id", "unknown")
            
            result = handle_request(request)
            
            response = {
                "id": req_id,
                "type": "result" if "error" not in result else "error",
                "payload": result,
            }
            print(json.dumps(response), flush=True)
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON: {e}")
            print(json.dumps({
                "id": "unknown",
                "type": "error",
                "payload": {"error": f"Invalid JSON: {e}"}
            }), flush=True)
        except Exception as e:
            logger.exception("Unexpected error")
            print(json.dumps({
                "id": "unknown",
                "type": "error",
                "payload": {"error": str(e)}
            }), flush=True)


if __name__ == "__main__":
    main()
