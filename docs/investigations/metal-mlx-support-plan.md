# Metal/MLX Support Implementation Plan

## Overview

Add Apple Silicon GPU acceleration support for local voice models (Faster-Whisper STT and Piper TTS) using Metal Performance Shaders (MPS) via PyTorch or MLX framework.

## Current State

- **STT**: Faster-Whisper (CTranslate2 backend) with PyTorch
- **TTS**: Piper TTS with PyTorch
- **Device Support**: ROCm (AMD), CUDA (NVIDIA), CPU
- **Architecture**: Python subprocesses with IPC over stdin/stdout

## Options Analysis

### Option 1: PyTorch MPS Backend (Recommended)

**Pros:**
- Minimal code changes (Faster-Whisper and Piper TTS already use PyTorch)
- Drop-in replacement for CUDA/ROCm device selection
- Well-tested and stable
- Maintains compatibility with existing models

**Cons:**
- May not be as optimized as MLX for Apple Silicon
- Requires PyTorch 1.12+ with MPS support

**Implementation:**
```python
# Device detection
if torch.backends.mps.is_available():
    device = "mps"  # Metal Performance Shaders
elif torch.cuda.is_available() and hasattr(torch.version, "hip"):
    device = "cuda"  # ROCm (maps to CUDA interface)
elif torch.cuda.is_available():
    device = "cuda"  # NVIDIA CUDA
else:
    device = "cpu"
```

### Option 2: MLX Framework

**Pros:**
- Optimized specifically for Apple Silicon
- Unified memory model (no explicit CPU/GPU transfers)
- Potentially better performance than PyTorch MPS

**Cons:**
- Requires rewriting model inference code
- Faster-Whisper and Piper TTS don't have native MLX support
- Would need custom MLX implementations or model conversion
- More complex migration path

**Implementation:**
- Would require porting Faster-Whisper inference to MLX
- Would require porting Piper TTS inference to MLX
- Significant development effort

## Recommended Approach: PyTorch MPS

Start with PyTorch MPS backend for minimal disruption, then evaluate MLX migration if performance gains justify the effort.

## Implementation Plan

### Phase 1: Device Detection Enhancement

**File**: `packages/voice/scripts/stt_server.py`

1. Add MPS detection function:
```python
def _has_mps(self) -> bool:
    """Check if Metal Performance Shaders (Apple Silicon) is available."""
    try:
        import torch
        return torch.backends.mps.is_available()
    except (ImportError, AttributeError):
        return False
```

2. Update device selection logic:
```python
def __init__(self, model_path: str, device: str = "rocm", compute_type: str = "int8"):
    """Initialize Faster-Whisper model with VAD."""
    self.model_path = model_path
    
    # Determine actual device based on availability
    if device == "mps" and self._has_mps():
        self.device = "mps"
        self.compute_type = compute_type
    elif device == "rocm" and self._has_rocm():
        self.device = "cuda"  # Faster-Whisper uses "cuda" for both CUDA and ROCm
        self.compute_type = compute_type
    elif device == "cuda" and self._has_cuda():
        self.device = "cuda"
        self.compute_type = compute_type
    else:
        self.device = "cpu"
        self.compute_type = "int8"
```

3. Update default device priority:
   - macOS: `mps` → `cpu`
   - Linux AMD: `rocm` → `cpu`
   - Linux NVIDIA: `cuda` → `cpu`
   - Windows/Other: `cpu`

### Phase 2: Environment Configuration

**File**: `config/env.example`

Add MPS device option:
```bash
# Device: "mps" (Apple Silicon), "rocm" (AMD GPU), "cuda" (NVIDIA GPU), or "cpu"
WHISPER_DEVICE=mps  # Auto-detect: mps > rocm > cuda > cpu
```

**File**: `packages/api/src/voice/pools.ts`

Update default device detection:
```typescript
const getDefaultDevice = (): string => {
  if (process.platform === "darwin") {
    return "mps"; // Apple Silicon default
  }
  return "rocm"; // Linux default (AMD)
};

const sttConfig: ProcessConfig = {
  scriptPath: join(process.cwd(), "packages/voice/scripts/stt_server.py"),
  modelPath: whisperModelPath,
  device: process.env.WHISPER_DEVICE ?? getDefaultDevice(),
  computeType: process.env.WHISPER_COMPUTE_TYPE ?? "int8",
};
```

### Phase 3: Documentation Updates

**File**: `docs/voice/local-models.md`

Add Apple Silicon section:
```markdown
### Apple Silicon Setup (Metal/MPS)

For Macs with Apple Silicon (M1, M2, M3, etc.):

1. Ensure macOS 12.3+ (required for Metal Performance Shaders)
2. Install PyTorch with MPS support:
   ```bash
   uv pip install torch torchvision torchaudio
   ```
3. Set device to MPS:
   ```bash
   WHISPER_DEVICE=mps
   ```
4. Verify MPS availability:
   ```python
   python3 -c "import torch; print(torch.backends.mps.is_available())"
   ```

Note: PyTorch MPS backend provides GPU acceleration on Apple Silicon via Metal Performance Shaders. Performance is typically 2-3x faster than CPU-only inference.
```

**File**: `.ruler/25-voice-local-models.md`

Update device detection rule:
```markdown
4. **Device Detection.** GPU device selection supports multiple backends:
   - `mps` (default on macOS): Apple Silicon GPUs via Metal Performance Shaders
   - `rocm` (default on Linux): AMD GPUs via ROCm 6+
   - `cuda`: NVIDIA GPUs via CUDA
   - `cpu`: CPU-only fallback
   - Detection: Check `torch.backends.mps.is_available()` for MPS, `torch.version.hip` for ROCm, `torch.cuda.is_available()` for CUDA
   - Faster-Whisper uses PyTorch's device interface (works for MPS, CUDA, ROCm, CPU)
```

### Phase 4: Testing

**Unit Tests**: `packages/voice/test/device-detection.test.ts`

```typescript
describe("Device Detection", () => {
  it("should detect MPS on macOS", () => {
    // Mock platform detection
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin" });
    
    const device = getDefaultDevice();
    expect(device).toBe("mps");
    
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });
  
  it("should fallback to CPU if MPS unavailable", () => {
    // Test fallback logic
  });
});
```

**Integration Tests**: Verify MPS device selection in Python subprocess

### Phase 5: Performance Benchmarking

Compare performance metrics:
- **CPU-only**: Baseline
- **MPS (Metal)**: Expected 2-3x speedup
- **ROCm (AMD)**: Reference for comparison
- **CUDA (NVIDIA)**: Reference for comparison

Measure:
- STT latency per chunk
- TTS latency per sentence
- Memory usage (VRAM vs RAM)
- Power consumption (if possible)

## Code Changes Summary

### Modified Files

1. `packages/voice/scripts/stt_server.py`
   - Add `_has_mps()` method
   - Update device selection logic
   - Update default device to `mps` on macOS

2. `packages/voice/scripts/tts_server.py`
   - Add `_has_mps()` method (if TTS uses PyTorch)
   - Update device selection logic

3. `packages/api/src/voice/pools.ts`
   - Add `getDefaultDevice()` function
   - Update default device based on platform

4. `packages/voice/src/process/base.ts`
   - Update default device fallback

5. `config/env.example`
   - Add `mps` option to `WHISPER_DEVICE` comment

6. `docs/voice/local-models.md`
   - Add Apple Silicon/MPS setup section

7. `.ruler/25-voice-local-models.md`
   - Update device detection rule

### New Files

1. `packages/voice/test/device-detection.test.ts`
   - Unit tests for device detection logic

## Migration Path

### Step 1: Add MPS Support (No Breaking Changes)
- Add MPS detection and device selection
- Default to `mps` on macOS, `rocm` on Linux
- Maintain backward compatibility

### Step 2: Test and Validate
- Run test suite
- Benchmark performance
- Verify model loading and inference

### Step 3: Update Documentation
- Add setup instructions
- Update troubleshooting guide
- Document performance expectations

### Step 4: Monitor and Optimize
- Collect performance metrics
- Identify bottlenecks
- Consider MLX migration if needed

## Future Considerations: MLX Migration

If PyTorch MPS performance is insufficient, consider MLX migration:

1. **Model Conversion**
   - Convert Faster-Whisper models to MLX format
   - Convert Piper TTS models to MLX format
   - Maintain model quality and accuracy

2. **Inference Rewrite**
   - Port Faster-Whisper inference to MLX
   - Port Piper TTS inference to MLX
   - Leverage MLX's unified memory model

3. **Performance Comparison**
   - Benchmark MLX vs PyTorch MPS
   - Measure latency, throughput, memory usage
   - Determine if migration is justified

## Dependencies

### Required
- PyTorch 1.12+ (for MPS support)
- macOS 12.3+ (for Metal Performance Shaders)
- Apple Silicon Mac (M1, M2, M3, etc.)

### Optional (Future MLX Migration)
- MLX framework (`pip install mlx`)
- MLX model conversion tools

## Success Criteria

- [ ] MPS device detection works on Apple Silicon Macs
- [ ] Faster-Whisper STT runs on MPS device
- [ ] Piper TTS runs on MPS device (if applicable)
- [ ] Performance improvement: 2-3x faster than CPU
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No breaking changes for existing ROCm/CUDA users

## References

- [PyTorch MPS Backend](https://developer.apple.com/metal/pytorch/)
- [MLX Framework](https://github.com/ml-explore/mlx)
- [Metal Performance Shaders](https://developer.apple.com/metal/)
- [Faster-Whisper GitHub](https://github.com/guillaumekln/faster-whisper)
- [Piper TTS GitHub](https://github.com/rhasspy/piper)

