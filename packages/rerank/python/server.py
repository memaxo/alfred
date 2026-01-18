"""
Qwen3-VL Reranker HTTP Server

FastAPI server for multimodal document reranking using Qwen3-VL-Reranker.
Supports text, images, and video inputs with batch processing for throughput.

Optimizations:
- MPS (Metal Performance Shaders) acceleration on Apple Silicon
- torch.compile() for faster inference when available
- Batch processing for text-only documents
- Memory-efficient inference with no_grad and inference_mode

Usage:
    uvicorn python.server:app --host 0.0.0.0 --port 8000

Environment Variables:
    RERANK_MODEL: HuggingFace model ID (default: Qwen/Qwen3-VL-Reranker-2B)
    RERANK_DEVICE: Device to use (auto, cpu, cuda, rocm, mps)
    RERANK_BATCH_SIZE: Batch size for text-only documents (default: 8)
    RERANK_COMPILE: Enable torch.compile for faster inference (default: 0)
    RERANK_PORT: Server port (default: 8000)
"""

import os
import sys
import logging
import time
import threading
import uuid
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("Qwen3VLReranker")

# Global model instance
model = None
model_name = None
device_name = None
batch_size = 8  # Default batch size for text-only documents
use_compile = False  # Whether to use torch.compile
profile_lock = threading.Lock()


def detect_device() -> str:
    """
    Detect best available device: cuda > mps > cpu.
    
    MLX Best Practice: On Apple Silicon, MPS provides near-native performance
    for PyTorch models. For true MLX models, use mlx_lm.load() instead.
    """
    try:
        import torch

        # CUDA/ROCm for NVIDIA/AMD GPUs
        if torch.cuda.is_available():
            logger.info("Detected CUDA device")
            return "cuda"
        
        # MPS for Apple Silicon - check properly
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            # Additional check: MPS might be available but not functional
            try:
                # Test MPS with a small tensor operation
                test_tensor = torch.zeros(1, device="mps")
                del test_tensor
                logger.info("Detected MPS device (Apple Silicon)")
                return "mps"
            except Exception as e:
                logger.warning(f"MPS available but not functional: {e}")
                return "cpu"
    except ImportError:
        pass
    
    logger.info("Using CPU device")
    return "cpu"


def resolve_device(explicit: Optional[str]) -> str:
    """
    Resolve device from RERANK_DEVICE env var.
    
    Priority for Apple Silicon optimization:
    - explicit "mps" -> use MPS if available
    - "auto" -> detect best device (mps preferred on macOS)
    """
    if not explicit or explicit == "auto":
        return detect_device()

    raw = explicit.strip().lower()
    if raw == "cpu":
        return "cpu"
    if raw == "mps":
        try:
            import torch
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                return "mps"
            logger.warning("MPS requested but not available, falling back to auto-detect")
        except ImportError:
            pass
        return detect_device()
    if raw in ("cuda", "rocm"):
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
            logger.warning("CUDA requested but not available, falling back to auto-detect")
        except ImportError:
            pass
        return detect_device()

    return detect_device()


def setup_mps_optimizations():
    """
    Configure MPS-specific optimizations for Apple Silicon.
    
    Based on MLX best practices for Apple Silicon performance.
    """
    try:
        import torch
        
        if not (hasattr(torch.backends, "mps") and torch.backends.mps.is_available()):
            return
        
        # Enable MPS fallback for unsupported ops
        os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
        
        # Set memory fraction for MPS (leave some for system)
        # This is similar to MLX's unified memory approach
        if hasattr(torch.mps, "set_per_process_memory_fraction"):
            torch.mps.set_per_process_memory_fraction(0.8)
        
        logger.info("MPS optimizations configured")
    except Exception as e:
        logger.warning(f"Failed to configure MPS optimizations: {e}")


def load_model():
    """
    Load the Qwen3-VL-Reranker model with platform-specific optimizations.
    
    MLX Best Practices Applied:
    - Use appropriate dtype for device (bfloat16 for GPU/MPS, float32 for CPU)
    - Enable torch.compile() for faster inference when supported
    - Configure attention implementation for better performance
    - Use inference_mode for memory efficiency
    """
    global model, model_name, device_name, batch_size, use_compile

    model_name = os.getenv("RERANK_MODEL", "Qwen/Qwen3-VL-Reranker-2B")
    device_name = resolve_device(os.getenv("RERANK_DEVICE"))
    batch_size = int(os.getenv("RERANK_BATCH_SIZE", "8"))
    use_compile = os.getenv("RERANK_COMPILE", "0") == "1"

    logger.info(f"Loading model {model_name} on device {device_name} (batch_size={batch_size}, compile={use_compile})...")

    # Setup device-specific optimizations
    if device_name == "mps":
        setup_mps_optimizations()

    try:
        import torch
        from transformers import AutoProcessor, Qwen3VLForConditionalGeneration

        # Load processor
        processor = AutoProcessor.from_pretrained(model_name, trust_remote_code=True)

        # Choose dtype based on device capabilities
        # MPS supports float16 better than bfloat16 in some cases
        if device_name == "mps":
            torch_dtype = torch.float16
        elif device_name in ("cuda", "rocm"):
            torch_dtype = torch.bfloat16
        else:
            torch_dtype = torch.float32

        # Configure model loading with optimizations
        model_kwargs = {
            "trust_remote_code": True,
            "dtype": torch_dtype,
        }

        # Device-specific loading strategy
        if device_name == "mps":
            # For MPS, load to CPU first then move (more stable)
            model_instance = Qwen3VLForConditionalGeneration.from_pretrained(
                model_name,
                **model_kwargs,
            )
            model_instance = model_instance.to("mps")
        elif device_name in ("cuda", "rocm"):
            # For CUDA, use device_map for efficient loading
            model_kwargs["device_map"] = "auto"
            # Enable flash attention if available
            model_kwargs["attn_implementation"] = "flash_attention_2" if _flash_attn_available() else "sdpa"
            model_instance = Qwen3VLForConditionalGeneration.from_pretrained(
                model_name,
                **model_kwargs,
            )
        else:
            # CPU fallback
            model_instance = Qwen3VLForConditionalGeneration.from_pretrained(
                model_name,
                **model_kwargs,
            )

        # Set to evaluation mode
        model_instance.eval()

        # Apply torch.compile() for faster inference (PyTorch 2.0+)
        # This is similar to how MLX JIT-compiles operations
        if use_compile and hasattr(torch, "compile"):
            try:
                # Use reduce-overhead mode for inference
                compile_mode = "reduce-overhead" if device_name == "cuda" else "default"
                model_instance = torch.compile(model_instance, mode=compile_mode)
                logger.info(f"torch.compile() enabled with mode={compile_mode}")
            except Exception as e:
                logger.warning(f"torch.compile() failed, continuing without: {e}")

        # Get memory usage
        peak_memory = _get_peak_memory(device_name)

        model = {
            "processor": processor,
            "model": model_instance,
            "device": device_name,
            "torch_dtype": torch_dtype,
            "classifier": _resolve_classifier_token_ids(processor),
        }

        logger.info(f"Model loaded successfully on {device_name} (dtype={torch_dtype}, peak_memory={peak_memory:.2f}GB)")

    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise


def _flash_attn_available() -> bool:
    """Check if flash attention is available."""
    try:
        import flash_attn
        return True
    except ImportError:
        return False


def _get_peak_memory(device: str) -> float:
    """Get peak memory usage in GB."""
    try:
        import torch
        if device == "cuda":
            return torch.cuda.max_memory_allocated() / 1e9
        elif device == "mps":
            # MPS doesn't have direct memory tracking, estimate from system
            return 0.0
    except Exception:
        pass
    return 0.0


def _resolve_classifier_token_ids(processor):
    """
    Resolve the vocab IDs for the classifier tokens used by Qwen rerankers.

    vLLM uses `classifier_from_token: ["no", "yes"]` for the original reranker
    family; we match that here by extracting logits for those two tokens and
    computing a 2-way softmax.
    """
    tok = getattr(processor, "tokenizer", None)
    if tok is None:
        raise ValueError("Processor does not expose a tokenizer; cannot resolve classifier tokens.")

    no_ids = tok.encode("no", add_special_tokens=False)
    yes_ids = tok.encode("yes", add_special_tokens=False)
    if len(no_ids) != 1 or len(yes_ids) != 1:
        raise ValueError(f'Expected single-token ids for "no"/"yes", got {no_ids=} {yes_ids=}')

    return {"no": no_ids[0], "yes": yes_ids[0]}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    load_model()
    yield
    # Cleanup on shutdown
    global model
    model = None


app = FastAPI(
    title="Qwen3-VL Reranker",
    description="Multimodal document reranking service",
    version="0.1.0",
    lifespan=lifespan,
)


class QueryInput(BaseModel):
    text: Optional[str] = None
    image: Optional[str] = None


class DocumentInput(BaseModel):
    id: str
    text: Optional[str] = None
    image: Optional[str] = None
    video: Optional[str] = None


class RerankRequest(BaseModel):
    query: QueryInput
    documents: list[DocumentInput]
    instruction: Optional[str] = "Retrieve images or text relevant to the user's query."
    top_n: Optional[int] = 10
    fps: Optional[float] = 1.0
    debug: bool = Field(
        default=False,
        description="Include per-stage timings in the response (profiling for bottlenecks).",
    )
    profile: bool = Field(
        default=False,
        description="Capture a cProfile dump for this request (written to RERANK_PROFILE_DIR).",
    )


class RerankResultItem(BaseModel):
    id: str
    score: float
    index: int


class DebugBatch(BaseModel):
    start_index: int
    size: int
    ms: float
    seq_len: Optional[int] = None


class DebugDoc(BaseModel):
    id: str
    index: int
    ms: float
    seq_len: Optional[int] = None
    has_image: bool = False
    has_video: bool = False


class DebugInfo(BaseModel):
    total_ms: float
    build_query_ms: float
    split_docs_ms: float
    text_only_ms: float
    multimodal_ms: float
    sort_ms: float
    text_batches: list[DebugBatch] = Field(default_factory=list)
    multimodal_docs: list[DebugDoc] = Field(default_factory=list)
    profile_path: Optional[str] = None


class RerankResponse(BaseModel):
    results: list[RerankResultItem]
    debug: Optional[DebugInfo] = None


class HealthResponse(BaseModel):
    status: str
    model: str
    device: str
    batch_size: Optional[int] = None
    compiled: Optional[bool] = None
    peak_memory_gb: Optional[float] = None
    error: Optional[str] = None


def build_content(doc: DocumentInput) -> list[dict]:
    """Build content list for a document."""
    content = []

    if doc.text:
        content.append({"type": "text", "text": doc.text})

    if doc.image:
        # Handles both base64 data URIs and URLs
        content.append({"type": "image", "image": doc.image})

    if doc.video:
        content.append({"type": "video", "video": doc.video})

    if not content:
        content.append({"type": "text", "text": ""})

    return content


def is_text_only(doc: DocumentInput) -> bool:
    """Check if document contains only text (no images or video)."""
    return not doc.image and not doc.video


def build_message(query_content: list[dict], doc_content: list[dict], instruction: str) -> list[dict]:
    """Build a single message for scoring (expects assistant to answer yes/no)."""
    return [
        {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": 'Judge whether the Document meets the requirements based on the Query and the Instruct provided. Note that the answer can only be "yes" or "no".',
                }
            ],
        },
        {
            "role": "user",
            "content": [
                {"type": "text", "text": f"Instruct: {instruction}\nQuery: "},
                *query_content,
                {"type": "text", "text": "\nDocument: "},
                *doc_content,
            ],
        }
    ]


def score_batch_text_only(
    query_content: list[dict],
    doc_contents: list[tuple[int, str, list[dict]]],
    instruction: str,
    want_meta: bool = False,
) -> tuple[list[tuple[int, str, float]], Optional[dict]]:
    """
    Score a batch of text-only query-document pairs.
    
    MLX Best Practices Applied:
    - Use inference_mode() instead of no_grad() for better performance
    - Synchronize device memory after batch completion (like mx.eval())
    - Process in optimal batch sizes for memory efficiency
    
    Args:
        query_content: Content list for the query
        doc_contents: List of (index, doc_id, content) tuples
        instruction: Instruction for the reranker
    
    Returns:
        List of (index, doc_id, score) tuples
    """
    import torch

    if not doc_contents:
        return ([], None)

    processor = model["processor"]
    model_instance = model["model"]
    device = model["device"]

    # Build all messages
    all_messages = [
        build_message(query_content, doc_content, instruction)
        for _, _, doc_content in doc_contents
    ]

    # Process all texts
    texts = [
        processor.apply_chat_template(msg, tokenize=False, add_generation_prompt=True)
        for msg in all_messages
    ]

    # Batch process inputs
    inputs = processor(
        text=texts,
        padding=True,
        return_tensors="pt",
    )

    if device != "cpu":
        inputs = inputs.to(device)

    seq_len = int(inputs["input_ids"].shape[1]) if "input_ids" in inputs else None

    # Use inference_mode for better performance (faster than no_grad)
    # This is similar to MLX's lazy evaluation - compute only when needed
    with torch.inference_mode():
        outputs = model_instance(**inputs)
        last_logits = outputs.logits[:, -1, :]
        yes_probs = _score_yes_prob_from_logits(last_logits, model["classifier"])
        scores = yes_probs.cpu().tolist()

    # Synchronize device memory (like mx.eval() in MLX)
    _sync_device(device)

    # Combine with original indices and IDs
    out = [
        (idx, doc_id, score)
        for (idx, doc_id, _), score in zip(doc_contents, scores)
    ]
    meta = {"seq_len": seq_len, "batch_size": len(doc_contents)} if want_meta else None
    return (out, meta)


def _sync_device(device: str):
    """
    Synchronize device memory after operations.
    
    Similar to mx.eval() in MLX - ensures all async operations complete.
    This is important for accurate timing and memory management.
    """
    try:
        import torch
        if device == "cuda":
            torch.cuda.synchronize()
        elif device == "mps":
            # MPS synchronization
            torch.mps.synchronize()
    except Exception:
        pass


def _score_yes_prob_from_logits(last_token_logits, classifier: dict[str, int]):
    """
    Compute P(yes) from the final-token logits using a 2-way softmax over
    the "no" and "yes" tokens (vLLM-style `classifier_from_token`).
    """
    import torch

    no_id = classifier["no"]
    yes_id = classifier["yes"]
    pair = last_token_logits[:, [no_id, yes_id]]
    probs = torch.softmax(pair, dim=-1)
    return probs[:, 1]


def score_single_multimodal(
    query_content: list[dict],
    doc_content: list[dict],
    instruction: str,
    want_meta: bool = False,
) -> tuple[float, Optional[dict]]:
    """
    Score a single multimodal query-document pair.
    Used for documents with images or video that can't be easily batched.
    
    MLX Best Practices Applied:
    - Use inference_mode() for better performance
    - Proper memory synchronization
    """
    import torch

    processor = model["processor"]
    model_instance = model["model"]
    device = model["device"]

    messages = build_message(query_content, doc_content, instruction)
    text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

    # Handle images/video
    image_inputs = None
    video_inputs = None

    try:
        from qwen_vl_utils import process_vision_info
        image_inputs, video_inputs = process_vision_info(messages)
    except ImportError:
        logger.warning("qwen_vl_utils not available, skipping vision processing")

    inputs = processor(
        text=[text],
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors="pt",
    )

    if device != "cpu":
        inputs = inputs.to(device)

    seq_len = int(inputs["input_ids"].shape[1]) if "input_ids" in inputs else None

    # Use inference_mode for better performance
    with torch.inference_mode():
        outputs = model_instance(**inputs)
        last_logits = outputs.logits[:, -1, :]
        yes_probs = _score_yes_prob_from_logits(last_logits, model["classifier"])
        score = yes_probs[0].item()

    meta = (
        {
            "seq_len": seq_len,
            "has_image": bool(image_inputs),
            "has_video": bool(video_inputs),
        }
        if want_meta
        else None
    )
    return (score, meta)


def score_pair(query_content: list[dict], doc_content: list[dict], instruction: str) -> float:
    """Score a single query-document pair (legacy interface)."""
    score, _meta = score_single_multimodal(query_content, doc_content, instruction, want_meta=False)
    return score


@app.post("/rerank", response_model=RerankResponse)
async def rerank(request: RerankRequest):
    """
    Rerank documents against a query.
    
    Uses batch processing for text-only documents (configurable via RERANK_BATCH_SIZE).
    Multimodal documents (with images/video) are processed sequentially.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    debug_enabled = bool(request.debug) or os.getenv("RERANK_DEBUG", "0") == "1"
    profile_allowed = os.getenv("RERANK_PROFILE", "0") == "1"
    profile_enabled = bool(request.profile) and profile_allowed
    profile_dir = os.getenv("RERANK_PROFILE_DIR", "")
    profile_path: Optional[str] = None

    def _run_once(profile_path_for_debug: Optional[str]) -> tuple[list[RerankResultItem], Optional[DebugInfo]]:
        t0 = time.perf_counter()

        # Build query content
        t_build_query0 = time.perf_counter()
        query_content = []
        if request.query.text:
            query_content.append({"type": "text", "text": request.query.text})
        if request.query.image:
            query_content.append({"type": "image", "image": request.query.image})
        if not query_content:
            query_content.append({"type": "text", "text": ""})
        build_query_ms = (time.perf_counter() - t_build_query0) * 1000

        instruction = request.instruction or "Retrieve images or text relevant to the user's query."

        # Separate text-only and multimodal documents
        t_split0 = time.perf_counter()
        text_only_docs: list[tuple[int, str, list[dict]]] = []
        multimodal_docs: list[tuple[int, DocumentInput]] = []

        for idx, doc in enumerate(request.documents):
            if is_text_only(doc):
                text_only_docs.append((idx, doc.id, build_content(doc)))
            else:
                multimodal_docs.append((idx, doc))

        split_docs_ms = (time.perf_counter() - t_split0) * 1000

        scores: list[tuple[int, str, float]] = []
        debug_batches: list[DebugBatch] = []
        debug_docs: list[DebugDoc] = []

        # Process text-only documents in batches
        t_text0 = time.perf_counter()
        if text_only_docs:
            for i in range(0, len(text_only_docs), batch_size):
                batch = text_only_docs[i : i + batch_size]
                b0 = time.perf_counter()
                try:
                    batch_scores, meta = score_batch_text_only(
                        query_content, batch, instruction, want_meta=debug_enabled
                    )
                    scores.extend(batch_scores)
                    if debug_enabled:
                        debug_batches.append(
                            DebugBatch(
                                start_index=i,
                                size=len(batch),
                                ms=(time.perf_counter() - b0) * 1000,
                                seq_len=(meta or {}).get("seq_len"),
                            )
                        )
                except Exception as e:
                    logger.error(f"Error scoring text batch: {e}")
                    scores.extend([(idx, doc_id, 0.0) for idx, doc_id, _ in batch])
                    if debug_enabled:
                        debug_batches.append(
                            DebugBatch(
                                start_index=i,
                                size=len(batch),
                                ms=(time.perf_counter() - b0) * 1000,
                                seq_len=None,
                            )
                        )
        text_only_ms = (time.perf_counter() - t_text0) * 1000

        # Process multimodal documents sequentially
        t_mm0 = time.perf_counter()
        for idx, doc in multimodal_docs:
            d0 = time.perf_counter()
            try:
                doc_content = build_content(doc)
                score, meta = score_single_multimodal(
                    query_content, doc_content, instruction, want_meta=debug_enabled
                )
                scores.append((idx, doc.id, score))
                if debug_enabled:
                    debug_docs.append(
                        DebugDoc(
                            id=doc.id,
                            index=idx,
                            ms=(time.perf_counter() - d0) * 1000,
                            seq_len=(meta or {}).get("seq_len"),
                            has_image=bool(doc.image),
                            has_video=bool(doc.video),
                        )
                    )
            except Exception as e:
                logger.error(f"Error scoring multimodal document {doc.id}: {e}")
                scores.append((idx, doc.id, 0.0))
                if debug_enabled:
                    debug_docs.append(
                        DebugDoc(
                            id=doc.id,
                            index=idx,
                            ms=(time.perf_counter() - d0) * 1000,
                            seq_len=None,
                            has_image=bool(doc.image),
                            has_video=bool(doc.video),
                        )
                    )
        multimodal_ms = (time.perf_counter() - t_mm0) * 1000

        # Sort by score descending
        t_sort0 = time.perf_counter()
        scores.sort(key=lambda x: x[2], reverse=True)

        # Take top N
        top_n = request.top_n or 10
        top_scores = scores[:top_n]

        results = [
            RerankResultItem(id=doc_id, score=score, index=idx)
            for idx, doc_id, score in top_scores
        ]
        sort_ms = (time.perf_counter() - t_sort0) * 1000

        total_ms = (time.perf_counter() - t0) * 1000

        logger.info(
            f"Reranked {len(request.documents)} documents in {total_ms:.0f}ms "
            f"(text_only={len(text_only_docs)}, multimodal={len(multimodal_docs)}, batch_size={batch_size})"
        )

        if not debug_enabled:
            return (results, None)

        dbg = DebugInfo(
            total_ms=total_ms,
            build_query_ms=build_query_ms,
            split_docs_ms=split_docs_ms,
            text_only_ms=text_only_ms,
            multimodal_ms=multimodal_ms,
            sort_ms=sort_ms,
            text_batches=debug_batches,
            multimodal_docs=debug_docs,
            profile_path=profile_path_for_debug,
        )
        return (results, dbg)

    if not profile_enabled:
        results, dbg = _run_once(None)
        return RerankResponse(results=results, debug=dbg)

    # Deep profiling (cProfile) — gated and lock-protected
    if not profile_dir:
        profile_dir = os.path.join(os.getcwd(), ".agent", "profiles", "rerank")
    os.makedirs(profile_dir, exist_ok=True)
    run_id = uuid.uuid4().hex[:8]
    profile_path = os.path.join(profile_dir, f"rerank_{run_id}.pstats")

    import cProfile

    with profile_lock:
        pr = cProfile.Profile()
        pr.enable()
        results, dbg = _run_once(profile_path)
        pr.disable()
        pr.dump_stats(profile_path)

    return RerankResponse(results=results, debug=dbg)


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    if model is None:
        return HealthResponse(
            status="error",
            model=model_name or "unknown",
            device=device_name or "unknown",
            error="Model not loaded",
        )

    peak_memory = _get_peak_memory(device_name) if device_name else 0.0

    return HealthResponse(
        status="ok",
        model=model_name or "unknown",
        device=device_name or "unknown",
        batch_size=batch_size,
        compiled=use_compile,
        peak_memory_gb=peak_memory if peak_memory > 0 else None,
    )


@app.get("/")
async def root():
    """Root endpoint with basic info."""
    return {
        "service": "Qwen3-VL Reranker",
        "version": "0.3.0",
        "model": model_name,
        "device": device_name,
        "batch_size": batch_size,
        "compiled": use_compile,
        "optimizations": {
            "inference_mode": True,
            "batch_processing": True,
            "mps_optimized": device_name == "mps",
            "flash_attention": device_name == "cuda" and _flash_attn_available(),
        },
        "endpoints": {
            "/rerank": "POST - Rerank documents (batch processing for text-only)",
            "/health": "GET - Health check",
        },
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("RERANK_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
