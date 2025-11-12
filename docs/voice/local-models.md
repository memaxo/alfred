# Local Voice Models Setup Guide

This guide covers setting up and using local voice models (Faster-Whisper for STT and Piper TTS for TTS) instead of OpenAI's hosted services.

## Overview

The voice system supports two providers:
- **OpenAI** (default): Uses OpenAI's Whisper API for STT and GPT-4o-mini TTS
- **Local**: Uses Faster-Whisper (large-v3-turbo) for STT and Piper TTS for TTS

Local models run as Python subprocesses managed by Bun, providing:
- Zero API costs
- Complete privacy (no data leaves your server)
- Lower latency (no network round-trip)
- Offline operation

## Prerequisites

1. **Python 3.10+** with `uv` installed:
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **GPU acceleration (optional)**:
   - **Apple Silicon (macOS)**: Metal Performance Shaders (MPS) - built into macOS 12.3+
   - **AMD GPU (Linux)**: ROCm 6+ 
   - **NVIDIA GPU (Linux/Windows)**: CUDA 12.1+ or 12.8+
   - **CPU-only**: Works but slower (2-3x slower than GPU)

3. **Install Python dependencies**:
   
   **Option 1: Automatic installation (recommended)**
   ```bash
   cd packages/voice
   ./scripts/install-deps.sh
   ```
   
   This script uses UV's automatic PyTorch backend detection (`--torch-backend=auto`) to install the optimal PyTorch build for your system.
   
   **Option 2: Manual installation with UV**
   ```bash
   # Automatic backend detection (recommended)
   uv pip install faster-whisper piper-tts silero-vad numpy --torch-backend=auto
   
   # Or specify backend explicitly
   # For Apple Silicon (MPS):
   uv pip install faster-whisper piper-tts silero-vad numpy torch torchvision torchaudio
   
   # For AMD GPU (ROCm):
   uv pip install faster-whisper piper-tts silero-vad numpy torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.3
   
   # For NVIDIA GPU (CUDA 12.8):
   uv pip install faster-whisper piper-tts silero-vad numpy torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
   
   # For CPU-only:
   uv pip install faster-whisper piper-tts silero-vad numpy torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
   ```
   
   **Option 3: Using pyproject.toml (for development)**
   ```bash
   cd packages/voice
   uv sync --extra cpu    # CPU-only
   uv sync --extra cu128  # CUDA 12.8 (Linux/Windows)
   uv sync --extra rocm   # ROCm (Linux AMD)
   ```

## Installation

### 1. Download Models

Run the model download script:

```bash
cd packages/voice
python3 scripts/download_models.py
```

This will:
- Download Faster-Whisper model (`large-v3-turbo`) - ~2GB
- Download Piper TTS voice (`en_US-lessac-medium`) - ~30MB
- Verify model integrity

### 2. Configure Environment

Update your `.env` file:

```bash
# Enable local provider
VOICE_PROVIDER=local

# Faster-Whisper configuration
WHISPER_MODEL_PATH=large-v3-turbo  # or path to local model directory
WHISPER_DEVICE=rocm  # or "cpu" for CPU-only
WHISPER_COMPUTE_TYPE=int8  # or "fp16" for full precision

# Piper TTS configuration
PIPER_MODEL_PATH=./packages/voice/models/piper
PIPER_VOICE=en_US-lessac-medium

# Process pool sizes (optional, defaults to 2)
VOICE_STT_POOL_SIZE=2
VOICE_TTS_POOL_SIZE=2

# Python executable path (optional, defaults to "python3")
# PYTHON_PATH=python3
```

### 3. Verify Installation

Start the API server and check logs for:

```
[voice] Initializing STT pool with 2 processes
[voice] STT pool ready with 2 processes
[voice] Initializing TTS pool with 2 processes
[voice] TTS pool ready with 2 processes
[voice] Voice pools initialized
```

## Usage

### API Endpoints

The voice API endpoints work identically whether using OpenAI or local models:

**STT Transcription:**
```typescript
const result = await trpc.voice.sttTranscribe.mutate({
  audioBase64: "...",
  mimeType: "audio/webm",
  language: "en", // optional
  prompt: "...", // optional
});
```

**TTS Synthesis:**
```typescript
const result = await trpc.voice.ttsSynthesize.mutate({
  text: "Hello, world!",
  voice: "alloy", // Maps to Piper voice
  format: "mp3",
});
```

**Streaming (Local Only):**
```typescript
const subscription = trpc.voice.stream.useSubscription({
  mode: "stream",
  sessionId: "optional-session-id",
  language: "en",
});
```

### Voice Name Mapping

When using local provider, OpenAI voice names are mapped to Piper voices:
- `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer` → `en_US-lessac-medium`

To use a different Piper voice, specify it directly in the TTS request.

## Performance

### Expected Latencies

- **STT**: <100ms per chunk (with VAD, GPU) or <500ms (CPU)
- **TTS**: <300ms per sentence (GPU) or <1s (CPU)
- **Total Pipeline**: <500ms (p90) for full round-trip

### Optimization Tips

1. **GPU Acceleration**: Ensure ROCm is available and `WHISPER_DEVICE=rocm`
2. **Model Quantization**: Use `int8` for faster inference (slight quality trade-off)
3. **Pool Sizing**: Increase `VOICE_STT_POOL_SIZE` and `VOICE_TTS_POOL_SIZE` for higher concurrency
4. **VAD**: Silero VAD filters silence automatically, reducing processing time

## Troubleshooting

### Models Not Found

**Error**: `Failed to load model: Model not found`

**Solution**: 
1. Verify model path in `WHISPER_MODEL_PATH` or `PIPER_MODEL_PATH`
2. Run `python3 scripts/download_models.py --verify-only` to check models
3. Ensure Python packages are installed: `uv pip install faster-whisper piper-tts`

### Process Crashes

**Error**: `Process exited with code 1`

**Solution**:
1. Check Python version: `python3 --version` (must be 3.10+)
2. Verify GPU availability:
   - ROCm (Linux AMD): `python3 -c "import torch; print(torch.version.hip)"`
   - MPS (macOS Apple Silicon): `python3 -c "import torch; print(torch.backends.mps.is_available())"`
   - CUDA (Linux NVIDIA): `python3 -c "import torch; print(torch.cuda.is_available())"`
3. Check process logs in API server output
4. Try CPU fallback: `WHISPER_DEVICE=cpu`

### High Memory Usage

**Symptom**: Server runs out of memory

**Solution**:
1. Reduce pool sizes: `VOICE_STT_POOL_SIZE=1` and `VOICE_TTS_POOL_SIZE=1`
2. Use quantized models: `WHISPER_COMPUTE_TYPE=int8`
3. Use smaller Whisper model (e.g., `base` instead of `large-v3-turbo`)

### Slow Performance

**Symptom**: High latency (>1s for STT/TTS)

**Solution**:
1. Enable GPU: `WHISPER_DEVICE=rocm`
2. Check GPU utilization: `rocm-smi` (for AMD GPUs)
3. Reduce audio chunk size (client-side)
4. Use smaller models for faster inference

## Architecture

### Process Management

- Each pool (STT/TTS) spawns multiple Python processes
- Processes communicate via JSON IPC over stdin/stdout
- Health checks run every 30 seconds
- Auto-restart on unexpected crashes

### Session Management

- Voice sessions track active connections
- Sessions timeout after 5 minutes of inactivity
- Each session gets assigned processes from pools (round-robin)

### Queue System (Native App)

- Failed requests are enqueued for retry
- Exponential backoff: 1s → 2s → 4s → 8s (max 30s)
- Background task drains queue every 2 minutes
- Queue persists across app restarts

## Monitoring

### Metrics

The system exposes Prometheus metrics:

- `voice_stt_total{provider, status}` - STT request counts
- `voice_tts_total{provider, status}` - TTS request counts
- `voice_stt_duration_seconds{provider}` - STT latency histogram
- `voice_tts_duration_seconds{provider}` - TTS latency histogram
- `voice_stream_events_total{event, status}` - Stream event counts
- `voice_stream_latency_seconds{stage}` - Stream latency by stage
- `voice_queue_depth_current` - Current queue depth
- `voice_process_health{type}` - Process health (1 = healthy, 0 = unhealthy)

### Health Checks

Check process health via metrics endpoint:

```bash
curl http://localhost:3000/api/metrics | grep voice_process_health
```

Healthy processes show `voice_process_health{type="stt"} 1`.

## Advanced Configuration

### Custom Model Paths

Store models in custom locations:

```bash
WHISPER_MODEL_PATH=/opt/models/whisper/large-v3-turbo
PIPER_MODEL_PATH=/opt/models/piper
```

### Multiple Voices

Download additional Piper voices:

```bash
python3 -c "from piper.download import ensure_voice_exists; ensure_voice_exists('en_GB-northern_english_male-medium', ['./packages/voice/models/piper'])"
```

Then use in TTS requests:

```typescript
await trpc.voice.ttsSynthesize.mutate({
  text: "Hello",
  voice: "en_GB-northern_english_male-medium",
});
```

### CPU-Only Setup

For systems without GPU:

1. Install CPU-only dependencies:
   ```bash
   cd packages/voice
   uv pip install faster-whisper piper-tts silero-vad numpy --index-url https://download.pytorch.org/whl/cpu
   ```

2. Set device to CPU:
   ```bash
   WHISPER_DEVICE=cpu
   WHISPER_COMPUTE_TYPE=int8
   ```

Performance will be slower but functional. CPU-only builds are smaller and don't require GPU drivers.

### Apple Silicon Setup (Metal/MPS)

For Macs with Apple Silicon (M1, M2, M3, etc.):

1. Ensure macOS 12.3+ (required for Metal Performance Shaders)
2. Install dependencies with automatic backend detection:
   ```bash
   cd packages/voice
   ./scripts/install-deps.sh
   ```
   
   Or manually:
   ```bash
   uv pip install faster-whisper piper-tts silero-vad numpy --torch-backend=auto
   ```
   
   UV will automatically detect Apple Silicon and install PyTorch with MPS support from PyPI (default PyTorch builds include MPS on macOS).

3. Set device to MPS (or leave unset for auto-detection):
   ```bash
   WHISPER_DEVICE=mps
   ```

4. Verify MPS availability:
   ```python
   python3 -c "import torch; print('MPS available:', torch.backends.mps.is_available())"
   ```

**Note**: PyTorch MPS backend provides GPU acceleration on Apple Silicon via Metal Performance Shaders. Performance is typically 2-3x faster than CPU-only inference. PyTorch wheels from PyPI automatically include MPS support on macOS, so no special index URL is needed.

**Future MLX Support**: MLX (Apple's optimized ML framework) is available as an optional dependency but requires rewriting model inference. Current implementation uses PyTorch MPS for compatibility with Faster-Whisper and Piper TTS.

### ROCm Setup (AMD GPUs)

For AMD GPUs (e.g., RX 7900 XTX) on Ubuntu Server:

1. Install ROCm 6+ following [AMD's official guide](https://rocm.docs.amd.com/)
2. Install dependencies with automatic backend detection:
   ```bash
   cd packages/voice
   ./scripts/install-deps.sh
   ```
   
   Or manually with ROCm-specific PyTorch:
   ```bash
   uv pip install faster-whisper piper-tts silero-vad numpy --torch-backend=auto
   # UV will detect ROCm and use appropriate index
   
   # Or explicitly specify ROCm index:
   uv pip install faster-whisper piper-tts silero-vad numpy torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.3
   ```
3. Set device to ROCm:
   ```bash
   WHISPER_DEVICE=rocm
   ```
4. Verify ROCm availability:
   ```bash
   python3 -c "import torch; print(torch.version.hip)"
   rocm-smi  # Check GPU status
   ```

Note: Faster-Whisper uses CTranslate2 which supports ROCm via PyTorch. The device is set to "rocm" but internally uses "cuda" (PyTorch's unified interface).

## Migration from OpenAI

To switch from OpenAI to local models:

1. Install Python dependencies
2. Download models
3. Set `VOICE_PROVIDER=local` in `.env`
4. Restart API server
5. Verify logs show pool initialization

No code changes required - the API interface is identical.

## UV Package Management

This project uses [UV](https://docs.astral.sh/uv/) for optimal Python package management. UV provides:

- **10-100x faster** package installation than pip
- **Automatic PyTorch backend detection** (`--torch-backend=auto`)
- **Cross-platform support** with proper index selection
- **Reproducible builds** with lock files

### Automatic Backend Detection

UV can automatically detect your GPU and install the appropriate PyTorch build:

```bash
uv pip install torch --torch-backend=auto
```

This queries for:
- CUDA driver version (NVIDIA)
- ROCm version (AMD)
- Intel GPU presence
- Falls back to CPU-only if no GPU detected

### Using pyproject.toml

The `packages/voice/pyproject.toml` file configures:
- PyTorch indexes for different backends (CPU, CUDA 12.1/12.8, ROCm 6.3)
- Optional dependencies for each accelerator
- Platform-specific markers (Linux-only for ROCm/CUDA)
- MLX framework as optional dependency for future use

Install with extras:
```bash
cd packages/voice
uv sync --extra cpu    # CPU-only builds
uv sync --extra cu128  # CUDA 12.8 (Linux/Windows)
uv sync --extra rocm   # ROCm (Linux AMD)
uv sync --extra mlx    # MLX framework (Apple Silicon, optional)
```

### Installation Script

The `packages/voice/scripts/install-deps.sh` script provides a one-command installation:

```bash
cd packages/voice
./scripts/install-deps.sh
```

This script:
1. Uses UV's automatic backend detection
2. Installs core dependencies (faster-whisper, piper-tts, silero-vad, numpy)
3. Verifies installation
4. Checks PyTorch backend availability

### MLX Framework (Future)

MLX is Apple's optimized ML framework for Apple Silicon. It's available as an optional dependency:

```bash
uv sync --extra mlx
```

**Note**: MLX requires rewriting model inference code. Current implementation uses PyTorch MPS for compatibility with Faster-Whisper and Piper TTS. MLX may provide better performance but requires significant development effort.

See [MLX documentation](https://ml-explore.github.io/mlx/build/html/install.html) and [UV PyTorch guide](https://docs.astral.sh/uv/guides/integration/pytorch/) for details.

## Bun + UV Integration

The voice system integrates Bun (JavaScript runtime) with UV (Python package manager) for seamless Python subprocess management.

### Virtual Environment Management

UV automatically creates and manages a virtual environment (`.venv/`) in `packages/voice/`:

- **Automatic**: Virtual environment is created on first `uv sync`
- **Isolated**: Dependencies are isolated from system Python
- **Reproducible**: Lock files ensure consistent installations

### Python Executable Resolution

The system uses a multi-tier fallback strategy:

1. **UV Run** (if `uv` available and `VOICE_USE_UV` not disabled):
   - Uses `uv run python` which automatically manages virtual environment
   - Ensures dependencies are installed before running
   - Best for development and automatic dependency management

2. **Virtual Environment Python** (if `.venv` exists):
   - Uses `.venv/bin/python` directly
   - Fastest execution (~1-5ms overhead)
   - Best for production when venv is guaranteed to exist

3. **System Python** (fallback):
   - Uses `python3` or `PYTHON_PATH` environment variable
   - Requires global installation of dependencies
   - Not recommended for production

### Environment Variables

- `VOICE_USE_UV`: Enable/disable UV usage (default: auto-detect)
  - Set to `"false"` to disable UV and use virtual environment or system Python
  - Unset or `"true"` to use UV when available
- `PYTHON_PATH`: Override Python executable (fallback only)
- `VOICE_PYTHON_VENV`: Override virtual environment path (auto-detected)

### Dependency Verification

Before starting Python processes, the system verifies dependencies are installed:

- Checks for `faster-whisper`, `piper`, `silero-vad`, `numpy`
- Provides helpful error messages if dependencies are missing
- Suggests installation commands (`./scripts/install-deps.sh` or `uv sync`)

### Performance Considerations

- **UV Run**: ~50-100ms overhead (checks environment, ensures dependencies)
- **Direct Venv Python**: ~1-5ms overhead (direct execution)
- **System Python**: ~1ms overhead (direct execution)

**Recommendation**: Use UV Run for development, direct venv Python for production.

### Troubleshooting

**Issue**: "Python dependencies not installed"

**Solution**:
```bash
cd packages/voice
./scripts/install-deps.sh
# or
uv sync
```

**Issue**: "UV not found"

**Solution**: Install UV:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Issue**: Virtual environment not found

**Solution**: Create virtual environment:
```bash
cd packages/voice
uv sync
```

See [Bun + UV Integration Investigation](../investigations/bun-uv-integration.md) for detailed technical information.

## Support

For issues or questions:
1. Check logs: `[voice]` prefixed messages in API server output
2. Verify metrics: `/api/metrics` endpoint
3. Test models directly: `python3 packages/voice/scripts/stt_server.py`

