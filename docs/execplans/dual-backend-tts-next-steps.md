# Dual-Backend TTS Architecture - Next Steps Documentation

## Critical Implementation Tasks

### 1. MLX SNAC Decoder Port (Highest Priority)

**Objective:** Port SNAC decoder from PyTorch to MLX for native Apple Silicon performance.

**Resources:**

#### MLX Framework Documentation
- **Official MLX GitHub:** https://github.com/ml-explore/mlx
- **MLX Documentation:** https://ml-explore.github.io/mlx/
- **MLX Examples:** https://github.com/ml-explore/mlx-examples
- **MLX Core API:** https://ml-explore.github.io/mlx/api/core.html
- **MLX Neural Networks:** https://ml-explore.github.io/mlx/api/nn.html

#### Key MLX Components for SNAC Port:
- **Conv1d:** `mlx.nn.Conv1d` - For SNAC decoder convolutional layers
- **ConvTranspose1d:** `mlx.nn.ConvTranspose1d` - For upsampling in decoder
- **Array Operations:** `mlx.core.array()` - Convert numpy/torch tensors to MLX arrays
- **Quantization:** `mlx.quantize()` - For optional quantization support

#### MLX Audio Processing Examples:
- **F5-TTS MLX:** https://github.com/lucasnewman/f5-tts-mlx (Reference implementation)
- **MLX Audio Library:** https://github.com/Blaizzy/mlx-audio (TTS/STT examples)
- **E2-TTS MLX:** https://github.com/lucasnewman/e2-tts-mlx (Another TTS reference)

#### Implementation Steps:
1. **Analyze SNAC Architecture:**
   - Review `snac` package source code
   - Identify all PyTorch operations (Conv1d, ConvTranspose1d, etc.)
   - Map to MLX equivalents

2. **Port Quantizer:**
   ```python
   # PyTorch version (from snac package)
   # Convert to MLX:
   import mlx.core as mx
   import mlx.nn as nn
   
   class SNACQuantizerMLX(nn.Module):
       def __init__(self, ...):
           # Initialize MLX layers
           pass
       
       def from_codes(self, codes):
           # Convert codes to quantized representation
           # Use mlx operations instead of torch
           pass
   ```

3. **Port Decoder:**
   ```python
   class SNACDecoderMLX(nn.Module):
       def __init__(self, ...):
           # Initialize conv transpose layers
           self.layers = [
               nn.ConvTranspose1d(...),
               # ... more layers
           ]
       
       def __call__(self, z_q):
           # Forward pass using MLX operations
           x = z_q
           for layer in self.layers:
               x = layer(x)
           return x
   ```

4. **Test Audio Quality:**
   - Compare MLX output vs PyTorch output
   - Verify PCM audio matches exactly
   - Benchmark performance improvement

### 2. MLX Model Conversion & Quantization

**Objective:** Convert Maya1 HuggingFace model to MLX format with optional quantization.

**Resources:**

#### MLX-LM (Model Loading):
- **MLX-LM GitHub:** https://github.com/ml-explore/mlx-lm
- **MLX-LM Documentation:** https://ml-explore.github.io/mlx-lm/
- **Converting Models:** https://ml-explore.github.io/mlx-lm/docs/convert/

#### Conversion Process:
```bash
# Install mlx-lm
pip install mlx-lm

# Convert HuggingFace model to MLX
python -m mlx_lm.convert \
    --hf-path maya-research/maya1 \
    --mlx-path packages/voice/models/maya1-mlx \
    --quantize q4_bit  # Optional: q4_bit, q8_bit, etc.
```

#### Quantization Options:
- **q4_bit:** 4-bit quantization (smallest, fastest)
- **q8_bit:** 8-bit quantization (balanced)
- **q4_0:** Alternative 4-bit format
- **No quantization:** Full precision (largest, slowest)

#### Custom Architecture Support:
- MLX-LM supports custom architectures via `mlx_lm.models`
- May need to implement Maya1 architecture definition
- Reference: https://github.com/ml-explore/mlx-lm/tree/main/mlx_lm/models

### 3. ROCm Backend Optimization

**Objective:** Optimize ROCm backend for maximum throughput on AMD GPUs.

**Resources:**

#### ROCm Documentation:
- **ROCm Docs:** https://rocm.docs.amd.com/
- **ROCm Installation:** https://rocm.docs.amd.com/projects/install-on-linux/en/latest/
- **ROCm Developer Hub:** https://www.amd.com/en/developer/resources/rocm-hub.html
- **ROCm GitHub:** https://github.com/ROCm/ROCm

#### PyTorch + ROCm:
- **PyTorch ROCm Builds:** https://pytorch.org/get-started/locally/#rocm
- **ROCm PyTorch Index:** https://download.pytorch.org/whl/rocm6.3
- **ROCm Compatibility:** Check PyTorch version compatibility matrix

#### Quantization with bitsandbytes:
- **bitsandbytes GitHub:** https://github.com/TimDettmers/bitsandbytes
- **ROCm Support:** bitsandbytes requires ROCm-compatible PyTorch build
- **Alternative:** AutoGPTQ if bitsandbytes unavailable
  - **AutoGPTQ:** https://github.com/PanQiWei/AutoGPTQ

#### torch.compile() Optimization:
- **PyTorch Compile Docs:** https://pytorch.org/tutorials/intermediate/torch_compile_tutorial.html
- **ROCm Backend:** Use `torch.compile(backend="hip")` for ROCm
- **Performance Tips:** https://pytorch.org/tutorials/intermediate/torch_compile_tutorial.html#performance-tips

#### Implementation Checklist:
- [ ] Install ROCm-compatible PyTorch
- [ ] Test bitsandbytes quantization
- [ ] Enable `torch.compile()` with ROCm backend
- [ ] Benchmark with/without quantization
- [ ] Optimize KV cache usage
- [ ] Test batch processing (if applicable)

### 4. Docker Containerization (ROCm)

**Objective:** Create Docker container for ROCm backend deployment on Proxmox.

**Resources:**

#### ROCm Docker:
- **ROCm Docker Hub:** https://hub.docker.com/r/rocm/dev
- **ROCm Container Guide:** https://rocm.docs.amd.com/projects/install-on-linux/en/latest/reference/docker.html
- **ROCm Docker Examples:** https://github.com/ROCm/ROCm/tree/develop/docker

#### Base Images:
```dockerfile
# Official ROCm base image
FROM rocm/dev-ubuntu-22.04:6.3

# Or use PyTorch ROCm image
FROM pytorch/pytorch:2.5.0-rocm6.3-ubuntu22.04-py3.11
```

#### Device Access:
```dockerfile
# Required for GPU access
devices:
  - /dev/kfd
  - /dev/dri
```

#### Docker Compose Example:
```yaml
version: '3.8'
services:
  maya-tts:
    build:
      context: .
      dockerfile: Dockerfile.rocm
    devices:
      - /dev/kfd
      - /dev/dri
    environment:
      - MAYA_QUANTIZE_4BIT=true
    volumes:
      - ./models:/app/models
    stdin_open: true
    tty: true
```

#### Implementation Steps:
1. Create `Dockerfile.rocm` with ROCm base image
2. Install Python dependencies (uv/pip)
3. Copy Python code
4. Set up device access
5. Test GPU detection inside container
6. Verify quantization works
7. Document deployment process

### 5. Performance Benchmarking

**Objective:** Measure and compare performance across all backends.

**Metrics to Track:**
- **TTFB (Time to First Byte):** Latency until first audio chunk
- **Total Generation Time:** Complete audio generation duration
- **Memory Usage:** VRAM/RAM consumption
- **Throughput:** Tokens/second, audio samples/second
- **Audio Quality:** Subjective/objective quality metrics

#### Benchmarking Tools:
- **PyTorch Profiler:** https://pytorch.org/tutorials/recipes/recipes/profiler_recipe.html
- **MLX Profiling:** Built-in profiling via `mlx.core.eval()`
- **Memory Profiling:** `memory_profiler`, `nvidia-smi` (for ROCm: `rocm-smi`)

#### Test Cases:
1. **Short Phrase:** "Hello, world." (~10 tokens)
2. **Medium Phrase:** "The quick brown fox jumps over the lazy dog." (~20 tokens)
3. **Long Phrase:** Paragraph of text (~100 tokens)
4. **Voice Variations:** Different voice descriptions
5. **Streaming vs Non-streaming:** Compare modes

#### Benchmark Script Template:
```python
import time
import psutil
import torch  # or mlx

def benchmark_backend(backend, text, voice, iterations=10):
    times = []
    memory_usage = []
    
    for i in range(iterations):
        # Warmup
        if i == 0:
            backend.synthesize(text, voice)
            continue
        
        # Measure
        start = time.time()
        audio = backend.synthesize(text, voice)
        elapsed = time.time() - start
        
        times.append(elapsed)
        memory_usage.append(get_memory_usage())
    
    return {
        'avg_time': sum(times) / len(times),
        'min_time': min(times),
        'max_time': max(times),
        'avg_memory': sum(memory_usage) / len(memory_usage),
    }
```

## Additional Resources

### MLX Community & Examples:
- **MLX Discord:** Community support and discussions
- **MLX Examples Repo:** https://github.com/ml-explore/mlx-examples
- **MLX Blog Posts:** Search for "MLX" on datasay.org, medium.com

### ROCm Community:
- **ROCm GitHub Discussions:** https://github.com/ROCm/ROCm/discussions
- **AMD Developer Forums:** https://community.amd.com/t5/rocm/bd-p/rocm

### SNAC Codec:
- **SNAC GitHub:** https://github.com/hubertsiuzdak/snac (if available)
- **SNAC Paper:** Search for "SNAC audio codec" for research papers
- **HuggingFace Model:** https://huggingface.co/hubertsiuzdak/snac_24khz

### General ML Optimization:
- **PyTorch Performance Tuning:** https://pytorch.org/tutorials/recipes/recipes/tuning_guide.html
- **MLX Performance Tips:** Check MLX documentation for optimization guides

## Implementation Priority

1. **🔴 Critical:** MLX SNAC decoder port (blocks MLX backend)
2. **🟡 High:** MLX model conversion script testing
3. **🟡 High:** ROCm backend quantization testing
4. **🟢 Medium:** Docker containerization
5. **🟢 Medium:** Performance benchmarking
6. **🔵 Low:** Documentation updates

## Quick Reference Commands

### MLX Model Conversion:
```bash
# Install mlx-lm
pip install mlx-lm

# Convert Maya1 to MLX
python -m mlx_lm.convert \
    --hf-path maya-research/maya1 \
    --mlx-path models/maya1-mlx \
    --quantize q4_bit
```

### ROCm PyTorch Installation:
```bash
# Install ROCm-compatible PyTorch
pip install torch torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/rocm6.3

# Install bitsandbytes (if available)
pip install bitsandbytes
```

### Docker ROCm Test:
```bash
# Build container
docker build -f Dockerfile.rocm -t maya-tts-rocm .

# Run with GPU access
docker run --device=/dev/kfd --device=/dev/dri \
    -it maya-tts-rocm python -m python.tts.server_factory
```

### Benchmarking:
```bash
# Run benchmark script
python scripts/benchmark_tts.py \
    --backend mlx \
    --text "Hello world" \
    --iterations 10
```

## Notes

- **MLX Custom Architecture:** Maya1 may require custom MLX model definition if mlx-lm doesn't support it out of the box
- **ROCm Compatibility:** Verify PyTorch version compatibility with ROCm version
- **SNAC Port Complexity:** SNAC decoder is relatively small (~50MB), porting effort is manageable
- **Quantization Trade-offs:** 4-bit quantization reduces memory but may impact quality slightly

