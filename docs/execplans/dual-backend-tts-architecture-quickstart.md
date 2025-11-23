# Dual-Backend TTS Architecture - Quick Start

## Overview

The dual-backend architecture automatically selects the optimal backend based on platform:
- **macOS (Apple Silicon):** MLX backend (low latency)
- **Linux (AMD GPU):** ROCm backend (high throughput)
- **Fallback:** MPS (macOS) or CPU

## File Structure

```
packages/voice/python/tts/
├── __init__.py              # Package init
├── base.py                  # Abstract base class (TTSServerBase)
├── server_factory.py        # Factory launcher (entry point)
├── backend_rocm.py         # ROCm/Linux backend
├── backend_mlx.py          # MLX/macOS backend
└── server.py               # Original implementation (legacy/MPS fallback)
```

## Usage

### Automatic Backend Selection

The factory automatically detects the platform:

```bash
# macOS: Uses MLX if available, else MPS
python -m python.tts.server_factory

# Linux: Uses ROCm if available, else CPU
python -m python.tts.server_factory
```

### Manual Backend Override

```bash
# Force MLX backend
MAYA_BACKEND=mlx python -m python.tts.server_factory

# Force ROCm backend
MAYA_BACKEND=rocm python -m python.tts.server_factory
```

### ROCm Backend Configuration

Enable quantization for reduced memory usage:

```bash
# 4-bit quantization (recommended for <8GB VRAM)
MAYA_QUANTIZE_4BIT=true python -m python.tts.server_factory

# 8-bit quantization
MAYA_QUANTIZE_8BIT=true python -m python.tts.server_factory
```

### MLX Backend Setup

1. **Convert Maya1 model to MLX format:**

```bash
cd packages/voice
python scripts/convert_maya1_to_mlx.py \
    --hf-model maya-research/maya1 \
    --output-dir models/maya1-mlx \
    --quantize 4bit  # Optional
```

2. **Set model path (if not default):**

```bash
MAYA_MLX_MODEL_PATH=/path/to/maya1-mlx python -m python.tts.server_factory
```

## Integration with Node.js

The Node.js orchestrator (`packages/voice/src/process/maya.ts`) requires no changes. Update the script path in `TTSPool`:

```typescript
// In packages/voice/src/process/tts.ts
scriptPath: this.config.scriptPath.replace(
  "maya_tts.py",
  "server_factory.py"  // Use factory launcher
).replace(
  "server.py",
  "server_factory.py"
),
```

## Performance Targets

- **MLX (macOS):** <500ms TTFB, <2s total for short phrases
- **ROCm (Linux):** <1s TTFB, <5s total with quantization
- **Memory:** <8GB VRAM with 4-bit quantization

## Troubleshooting

### MLX Backend Fails to Start

**Error:** `MLX model not found`

**Solution:** Run conversion script first:
```bash
python scripts/convert_maya1_to_mlx.py --hf-model maya-research/maya1 --output-dir models/maya1-mlx
```

### ROCm Backend Fails to Start

**Error:** `bitsandbytes not available`

**Solution:** Install ROCm-specific PyTorch:
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.3
pip install bitsandbytes
```

### Backend Falls Back to CPU

**Check:**
1. GPU drivers installed?
2. Platform-specific dependencies installed?
3. Environment variables set correctly?

**Debug:**
```bash
# Check backend detection
python -c "from python.tts.server_factory import detect_backend; print(detect_backend())"
```

## Next Steps

1. **Implement MLX SNAC decoder port** (currently placeholder)
2. **Add performance benchmarking** (compare backends)
3. **Create Docker container** for ROCm deployment
4. **Update documentation** with performance metrics

## Implementation Status

- ✅ Factory pattern and base classes
- ✅ ROCm backend skeleton
- ✅ MLX backend skeleton
- ✅ Weight conversion script
- ✅ Dependency management (pyproject.toml)
- ⏳ MLX SNAC decoder port (TODO)
- ⏳ Docker containerization (TODO)
- ⏳ Performance benchmarking (TODO)

