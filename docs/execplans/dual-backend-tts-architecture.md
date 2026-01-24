# Dual-Backend Architecture for High-Performance Local TTS

**Owner:** voice  
**Status:** Planning  
**Created:** 2025-01-27

## Purpose

Design and implement a dual-backend architecture for Maya1 TTS that optimizes performance on two distinct hardware targets:

1. **Production (Linux/AMD ROCm):** Maximize throughput on consumer AMD GPUs
2. **Development/Local (macOS/Apple Silicon):** Minimize latency (<500ms TTFB) using MLX

The solution must maintain a unified stdin/stdout JSON-lines IPC interface with the Node.js orchestrator (`packages/voice/src/process/maya.ts`) without requiring changes to the TypeScript codebase.

## Current State Analysis

### IPC Contract

The Python server communicates via JSON-lines over stdin/stdout:

**Request Format:**

```json
{"id": "uuid", "type": "synthesize", "payload": {"text": "...", "voice": "...", "streaming": false}}
{"id": "uuid", "type": "ping", "payload": {}}
{"id": "uuid", "type": "shutdown", "payload": {}}
```

**Response Format:**

```json
{"id": "uuid", "type": "status", "payload": {"message": "TTS server ready", "device": "mps", "startup_time": 12.3}}
{"id": "uuid", "type": "audio", "payload": {"audioBase64": "...", "sampleRate": 24000, "isFinal": false}}
{"id": "uuid", "type": "error", "payload": {"message": "..."}}
```

### Current Implementation (`packages/voice/python/tts/server.py`)

**Key Components:**

- `TTSServer`: Main server class managing model lifecycle
- `SNACStreamer`: Custom streamer that decodes SNAC tokens to PCM audio chunks
- Device detection: `cuda` → `mps` → `cpu` fallback
- Model loading: HuggingFace `AutoModelForCausalLM` with `maya-research/maya1`
- SNAC decoder: `hubertsiuzdak/snac_24khz` for audio codec

**Performance Issues:**

- macOS MPS: ~24s for short phrases (transformers not optimized for MPS)
- No quantization support
- Single-threaded generation loop
- No backend-specific optimizations

### Node.js Orchestrator (`packages/voice/src/process/maya.ts`)

- Spawns Python subprocess via `Bun.spawn`
- Uses `Process` class for IPC bridge (JSON-lines over stdin/stdout)
- 60s timeout for synthesis requests
- Streaming support via `onChunk` callback
- No awareness of backend type (abstraction maintained)

## Technical Strategy

### Path A: Linux + Proxmox (AMD ROCm)

**Decision: Raw PyTorch + ROCm over vLLM**

**Rationale:**

- vLLM requires OpenAI-compatible HTTP endpoint (adds latency overhead)
- Maya1 is a custom architecture; vLLM's model registry may not support it
- Direct PyTorch control enables fine-tuned SNAC streaming optimization
- ROCm 6.3+ provides native PyTorch support with `torch.compile()` optimizations

**Implementation Approach:**

1. **Quantization Strategy:**
   - Use `bitsandbytes` (Linux) for 4-bit/8-bit quantization
   - Alternative: `AutoGPTQ` for post-training quantization (better compression)
   - Load model with `load_in_4bit=True` or `load_in_8bit=True`
   - SNAC decoder remains FP16 (quantization not critical for small decoder)

2. **Performance Optimizations:**
   - Enable `torch.compile()` with `mode="reduce-overhead"` for model
   - Use `torch.backends.hip` for ROCm-specific kernels
   - Implement KV cache for repeated voice descriptions
   - Batch token generation when possible (though streaming limits this)

3. **Docker Container Structure:**
   ```dockerfile
   FROM rocm/dev-ubuntu-22.04:6.3
   # Install PyTorch with ROCm support
   # Install dependencies (transformers, snac, bitsandbytes)
   # Copy server.py and backend_rocm.py
   # CMD: python -m tts.server (factory launcher)
   ```

### Path B: macOS (Apple Silicon MLX)

**Decision: Full MLX Port (Model + SNAC)**

**Rationale:**

- MLX provides 3-5x speedup over MPS for transformer inference
- Mixing MLX (LLM) and PyTorch (SNAC) requires tensor conversions (overhead)
- SNAC decoder is small (~50MB); porting effort is justified for latency
- MLX's unified memory architecture eliminates CPU↔GPU transfers

**Implementation Approach:**

1. **Model Porting:**
   - Maya1 uses standard transformer architecture (GPT-style)
   - MLX supports custom architectures via `mlx.nn` modules
   - Convert HuggingFace weights → MLX `.safetensors` format
   - Port attention, MLP, and embedding layers to MLX equivalents

2. **SNAC Porting:**
   - SNAC decoder uses standard conv/transpose operations (MLX compatible)
   - Port quantizer and decoder to `mlx.nn` modules
   - Maintain sliding window logic (pure Python, no framework dependency)

3. **Weight Conversion Process:**
   ```python
   # Conversion script: convert_maya1_to_mlx.py
   # 1. Load HuggingFace model
   # 2. Extract state_dict
   # 3. Map layer names to MLX equivalents
   # 4. Convert tensors: torch → numpy → mlx
   # 5. Save as .safetensors
   ```

## Implementation Plan

### Phase 1: Factory Pattern & Backend Abstraction

**File Structure:**

```
packages/voice/python/tts/
├── __init__.py
├── server.py          # Factory launcher (replaces current server.py)
├── base.py            # Abstract base class TTSServerBase
├── backend_rocm.py    # ServerROCm implementation
├── backend_mlx.py     # ServerMLX implementation
└── utils/
    ├── snac_streamer.py      # Shared SNAC streaming logic
    └── prompt_builder.py     # Shared prompt construction
```

**Factory Launcher (`server.py`):**

```python
import platform
import sys

def detect_backend():
    """Detect available backend based on platform and hardware."""
    if platform.system() == "Darwin":
        try:
            import mlx.core as mx
            return "mlx"
        except ImportError:
            return "mps"  # Fallback to MPS
    elif platform.system() == "Linux":
        try:
            import torch
            if torch.cuda.is_available() or hasattr(torch.backends, "hip"):
                return "rocm"
        except ImportError:
            pass
        return "cpu"
    return "cpu"

def main():
    backend = detect_backend()

    if backend == "mlx":
        from .backend_mlx import ServerMLX as Server
    elif backend == "rocm":
        from .backend_rocm import ServerROCm as Server
    else:
        from .backend_mps import ServerMPS as Server  # Fallback to current MPS impl

    server = Server()
    server.run()

if __name__ == "__main__":
    main()
```

**Abstract Base Class (`base.py`):**

```python
from abc import ABC, abstractmethod
import json
import sys
from typing import Optional

class TTSServerBase(ABC):
    """Abstract base class for TTS backends."""

    def __init__(self):
        self.cache = {}
        self.cache_order = []
        self.MAX_CACHE_SIZE = 50

    @abstractmethod
    def initialize_model(self) -> None:
        """Load model and tokenizer. Emit status messages."""
        pass

    @abstractmethod
    def synthesize(
        self,
        text: str,
        voice_description: str,
        streaming: bool = False,
        request_id: Optional[str] = None
    ) -> bytes:
        """Generate audio. Return full audio bytes."""
        pass

    def build_prompt(self, description: str, text: str) -> str:
        """Shared prompt construction logic."""
        # ... (extract from current server.py)
        pass

    def run(self):
        """Main event loop (shared across backends)."""
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break

                request = json.loads(line.strip())
                request_id = request.get("id", "unknown")
                request_type = request.get("type", "")
                payload = request.get("payload", {})

                if request_type == "ping":
                    self._send_status(request_id, "pong")
                elif request_type == "synthesize":
                    self._handle_synthesize(request_id, payload)
                elif request_type == "shutdown":
                    break
            except Exception as e:
                self._send_error(request_id, str(e))

    def _handle_synthesize(self, request_id: str, payload: dict):
        """Handle synthesize request (shared logic)."""
        # ... (extract from current server.py)
        pass
```

### Phase 2: ROCm Backend Implementation

**File: `backend_rocm.py`**

**Key Features:**

- Quantization support (4-bit/8-bit via bitsandbytes)
- `torch.compile()` optimization
- ROCm-specific device handling
- KV cache for voice descriptions

**Dependencies (`pyproject.toml`):**

```toml
[project]
dependencies = [
    # ... existing deps ...
    "bitsandbytes>=0.43.0; sys_platform == 'linux'",
]

[tool.uv.sources]
bitsandbytes = { index = "pytorch-cu128", marker = "sys_platform == 'linux'" }
```

**Implementation Stub:**

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from .base import TTSServerBase
from .utils.snac_streamer import SNACStreamerROCm

class ServerROCm(TTSServerBase):
    def __init__(self):
        super().__init__()
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.quantization_config = None

    def initialize_model(self):
        # Detect quantization preference
        use_4bit = os.getenv("MAYA_QUANTIZE_4BIT", "false").lower() == "true"
        use_8bit = os.getenv("MAYA_QUANTIZE_8BIT", "false").lower() == "true"

        if use_4bit:
            self.quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.bfloat16,
                bnb_4bit_use_double_quant=True,
            )
        elif use_8bit:
            self.quantization_config = BitsAndBytesConfig(load_in_8bit=True)

        self.tokenizer = AutoTokenizer.from_pretrained(
            "maya-research/maya1",
            trust_remote_code=True
        )

        self.model = AutoModelForCausalLM.from_pretrained(
            "maya-research/maya1",
            quantization_config=self.quantization_config,
            device_map="auto",
            torch_dtype=torch.bfloat16,
            trust_remote_code=True
        )

        # Compile model for ROCm
        if hasattr(torch, "compile"):
            self.model = torch.compile(
                self.model,
                mode="reduce-overhead",
                fullgraph=False  # Allow graph breaks for flexibility
            )

        self.snac_model = SNAC.from_pretrained("hubertsiuzdak/snac_24khz").eval().to(self.device)

        # Warmup generation
        self._warmup()

    def synthesize(self, text, voice_description, streaming=False, request_id=None):
        # Check cache
        cached = self.get_cached_audio(text, voice_description)
        if cached:
            return cached

        prompt = self.build_prompt(voice_description, text)
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)

        audio_chunks = []
        streamer = SNACStreamerROCm(self.snac_model, self._audio_callback, self.device)

        with torch.inference_mode():
            self.model.generate(
                **inputs,
                max_new_tokens=2048,
                min_new_tokens=28,
                temperature=0.4,
                top_p=0.9,
                repetition_penalty=1.1,
                do_sample=True,
                eos_token_id=CODE_END_TOKEN_ID,
                streamer=streamer
            )

        full_audio = b"".join(audio_chunks)
        self.cache_audio(text, voice_description, full_audio)
        return full_audio
```

### Phase 3: MLX Backend Implementation

**File: `backend_mlx.py`**

**Key Features:**

- Native MLX model loading
- MLX-optimized SNAC decoder
- Unified memory (no CPU↔GPU transfers)
- Quantization via MLX's native quantizers

**Dependencies (`pyproject.toml`):**

```toml
[project]
dependencies = [
    # ... existing deps ...
    "mlx>=0.19.0; sys_platform == 'darwin'",
    "mlx-lm>=0.19.0; sys_platform == 'darwin'",
]

[tool.uv.sources]
mlx = { marker = "sys_platform == 'darwin'" }
mlx-lm = { marker = "sys_platform == 'darwin'" }
```

**Weight Conversion Script (`scripts/convert_maya1_to_mlx.py`):**

```python
"""
Convert Maya1 HuggingFace model to MLX format.

Usage:
    python scripts/convert_maya1_to_mlx.py \
        --hf-model maya-research/maya1 \
        --output-dir packages/voice/models/maya1-mlx \
        --quantize 4bit
"""
import argparse
import mlx.core as mx
import mlx.nn as nn
from transformers import AutoModelForCausalLM, AutoTokenizer
from safetensors import safe_open
import json

def convert_weights(hf_model_path: str, output_dir: str, quantize: Optional[str] = None):
    """Convert HuggingFace weights to MLX format."""
    # Load HF model
    model = AutoModelForCausalLM.from_pretrained(hf_model_path, trust_remote_code=True)
    tokenizer = AutoTokenizer.from_pretrained(hf_model_path, trust_remote_code=True)

    # Extract state dict
    state_dict = model.state_dict()

    # Map layer names and convert tensors
    mlx_state = {}
    for name, tensor in state_dict.items():
        # Convert torch tensor → numpy → mlx array
        np_array = tensor.detach().cpu().numpy()
        mlx_array = mx.array(np_array)

        # Apply quantization if requested
        if quantize == "4bit":
            mlx_array = mx.quantize(mlx_array, bits=4)
        elif quantize == "8bit":
            mlx_array = mx.quantize(mlx_array, bits=8)

        mlx_state[name] = mlx_array

    # Save as safetensors
    mx.save_safetensors(output_dir, mlx_state)

    # Save tokenizer config
    tokenizer.save_pretrained(output_dir)

    # Save model config (for architecture reconstruction)
    with open(f"{output_dir}/config.json", "w") as f:
        json.dump(model.config.to_dict(), f, indent=2)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--hf-model", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--quantize", choices=["4bit", "8bit"], default=None)
    args = parser.parse_args()

    convert_weights(args.hf_model, args.output_dir, args.quantize)
```

**MLX Backend Implementation Stub:**

```python
import mlx.core as mx
import mlx.nn as nn
from mlx_lm import load, generate
from .base import TTSServerBase
from .utils.snac_streamer_mlx import SNACStreamerMLX

class ServerMLX(TTSServerBase):
    def __init__(self):
        super().__init__()
        self.model = None
        self.tokenizer = None
        self.snac_decoder = None

    def initialize_model(self):
        model_path = os.getenv("MAYA_MLX_MODEL_PATH", "packages/voice/models/maya1-mlx")

        # Load MLX model
        self.model, self.tokenizer = load(model_path)

        # Load MLX SNAC decoder
        self.snac_decoder = SNACDecoderMLX.from_pretrained("hubertsiuzdak/snac_24khz")

        # Warmup
        self._warmup()

    def synthesize(self, text, voice_description, streaming=False, request_id=None):
        # Check cache
        cached = self.get_cached_audio(text, voice_description)
        if cached:
            return cached

        prompt = self.build_prompt(voice_description, text)

        # Tokenize
        tokens = self.tokenizer.encode(prompt)
        tokens = mx.array([tokens])

        audio_chunks = []
        streamer = SNACStreamerMLX(self.snac_decoder, self._audio_callback)

        # Generate with streaming
        for token_ids in generate(
            self.model,
            self.tokenizer,
            prompt=prompt,
            max_tokens=2048,
            temp=0.4,
            top_p=0.9,
            stream=True
        ):
            # Process tokens through SNAC streamer
            streamer.put(token_ids)

        full_audio = b"".join(audio_chunks)
        self.cache_audio(text, voice_description, full_audio)
        return full_audio
```

### Phase 4: SNAC Decoder Porting (MLX)

**File: `utils/snac_decoder_mlx.py`**

Port SNAC decoder to MLX:

```python
import mlx.core as mx
import mlx.nn as nn
from typing import List, Tuple

class SNACDecoderMLX:
    """MLX implementation of SNAC decoder."""

    def __init__(self, model_path: str):
        # Load SNAC model weights
        # Port conv/transpose layers to mlx.nn.Conv1d, mlx.nn.ConvTranspose1d
        pass

    def from_codes(self, codes: List[mx.array]) -> mx.array:
        """Convert SNAC codes to audio waveform."""
        # Port quantizer logic
        # Port decoder (conv transpose) logic
        pass
```

**Conversion Notes:**

- SNAC uses standard conv operations (fully supported by MLX)
- Quantizer logic is pure NumPy (no framework dependency)
- Maintain sliding window logic from original `SNACStreamer`

### Phase 5: Dependency Management

**Updated `pyproject.toml`:**

```toml
[project]
name = "alfred-voice"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "numpy>=1.24.0",
    "transformers>=4.46.0",
    "snac>=1.2.0",
    "soundfile>=0.12.0",
    "accelerate>=0.26.0",
    # Platform-specific dependencies
    "bitsandbytes>=0.43.0; sys_platform == 'linux'",
    "mlx>=0.19.0; sys_platform == 'darwin'",
    "mlx-lm>=0.19.0; sys_platform == 'darwin'",
]

# PyTorch sources (Linux only)
[tool.uv.sources]
torch = [
    { index = "pytorch-cpu", marker = "sys_platform == 'darwin'" },
    { index = "pytorch-rocm", marker = "sys_platform == 'linux'" },
]
bitsandbytes = { index = "pytorch-rocm", marker = "sys_platform == 'linux'" }

[[tool.uv.index]]
name = "pytorch-rocm"
url = "https://download.pytorch.org/whl/rocm6.3"
explicit = true
```

**Installation Scripts:**

```bash
# packages/voice/scripts/install-deps.sh
#!/bin/bash
set -e

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Installing macOS dependencies (MLX)..."
    uv pip install mlx mlx-lm
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Installing Linux dependencies (ROCm)..."
    uv pip install bitsandbytes
fi

uv sync
```

### Phase 6: Docker Container (ROCm)

**File: `packages/voice/docker/Dockerfile.rocm`**

```dockerfile
FROM rocm/dev-ubuntu-22.04:6.3

WORKDIR /app

# Install Python 3.10+
RUN apt-get update && apt-get install -y python3.10 python3-pip

# Install uv
RUN pip install uv

# Copy pyproject.toml and install dependencies
COPY pyproject.toml ./
RUN uv pip install --system -e .

# Copy Python code
COPY python/ ./python/

# Set environment
ENV PYTHONPATH=/app/python
ENV MAYA_QUANTIZE_4BIT=true

# Run factory launcher
CMD ["python", "-m", "python.tts.server"]
```

**Docker Compose (`packages/voice/docker/docker-compose.rocm.yml`):**

```yaml
version: "3.8"

services:
  maya-tts:
    build:
      context: ..
      dockerfile: docker/Dockerfile.rocm
    stdin_open: true
    tty: true
    devices:
      - /dev/kfd
      - /dev/dri
    environment:
      - MAYA_QUANTIZE_4BIT=true
    volumes:
      - ../models:/app/models
```

## Progress

### Completed

- [x] Codebase analysis
- [x] IPC contract documentation
- [x] Technical strategy research
- [x] Implementation plan structure
- [x] Factory pattern implementation (`server_factory.py`)
- [x] Abstract base class (`base.py`)
- [x] ROCm backend skeleton (`backend_rocm.py`)
- [x] MLX backend skeleton (`backend_mlx.py`)
- [x] Weight conversion script (`scripts/convert_maya1_to_mlx.py`)
- [x] Dependency management updates (`pyproject.toml`)

### In Progress

- [ ] MLX SNAC decoder port (placeholder in `backend_mlx.py`)
- [ ] ROCm backend testing and optimization
- [ ] MLX backend testing and optimization

### Pending

- [ ] Docker containerization (`Dockerfile.rocm`)
- [ ] Performance benchmarking (compare backends)
- [ ] Integration testing (Node.js orchestrator)
- [ ] Documentation updates (README, deployment guides)

## Surprises & Discoveries

1. **MLX Custom Architecture Support:** MLX does not have built-in support for Maya1's architecture. Manual porting is required, but the architecture is standard transformer (GPT-style), making porting feasible.

2. **SNAC PyTorch Dependency:** SNAC decoder uses PyTorch operations. For MLX backend, full porting is necessary to avoid tensor conversion overhead.

3. **ROCm Quantization:** `bitsandbytes` on ROCm requires specific PyTorch builds. May need to use `AutoGPTQ` as alternative if bitsandbytes compatibility issues arise.

4. **vLLM Limitations:** vLLM's OpenAI endpoint adds HTTP overhead. For sub-500ms latency goals, direct PyTorch control is preferable.

## Decision Log

| Date       | Decision                                   | Rationale                                                                  |
| ---------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| 2025-01-27 | Use raw PyTorch over vLLM for ROCm         | Lower latency, direct control, custom architecture support                 |
| 2025-01-27 | Full MLX port (model + SNAC)               | Eliminates tensor conversion overhead, maximizes Apple Silicon performance |
| 2025-01-27 | Factory pattern over environment variables | Cleaner abstraction, easier testing, maintainable                          |

## Outcomes & Retrospective

_To be updated after implementation._

## Performance Targets

- **macOS (MLX):** <500ms TTFB, <2s total generation for short phrases
- **Linux (ROCm):** <1s TTFB, <5s total generation with quantization
- **Memory:** <8GB VRAM with 4-bit quantization on ROCm

## Testing Strategy

1. **Unit Tests:** Test each backend in isolation
2. **Integration Tests:** Verify IPC contract compliance
3. **Performance Tests:** Benchmark against current MPS implementation
4. **Regression Tests:** Ensure voice quality matches baseline

## Migration Path

1. Implement factory launcher (backward compatible)
2. Add ROCm backend (opt-in via environment)
3. Add MLX backend (opt-in via environment)
4. Deprecate MPS backend after MLX validation
5. Update documentation and deployment guides

## Next Steps Documentation

For comprehensive implementation guides, documentation links, and detailed next steps, see:

- **Next Steps Guide:** `docs/execplans/dual-backend-tts-next-steps.md`
  - MLX framework documentation and examples
  - ROCm optimization guides
  - Docker containerization setup
  - Performance benchmarking tools
  - SNAC decoder porting resources
