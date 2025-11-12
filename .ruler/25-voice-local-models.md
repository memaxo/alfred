# Voice Local Models Standards

## Core Principle

Local voice models (Faster-Whisper for STT, Piper TTS for TTS) provide zero-cost, privacy-preserving, low-latency voice processing. All implementations must support graceful fallback, process health monitoring, and resource-efficient operation.

## Rules

1. **Provider Selection.** Voice provider is determined by `VOICE_PROVIDER` environment variable:
   - `openai` (default): Uses OpenAI Whisper API and GPT-4o-mini TTS
   - `local`: Uses Faster-Whisper (large-v3-turbo) and Piper TTS
   - Provider selection must be checked at initialization, not per-request

2. **Process Pool Management.** Local models run as Python subprocesses managed by Bun:
   - Use `Bun.spawn()` for subprocess creation
   - Maintain pools (default: 2 processes per STT/TTS)
   - Implement health checks every 30 seconds
   - Auto-restart crashed processes
   - Round-robin load balancing across pool

3. **IPC Protocol.** Subprocess communication uses JSON lines over stdin/stdout:
   - Request format: `{ "id": "uuid", "type": "request_type", "payload": {...} }`
   - Response format: `{ "id": "uuid", "type": "response_type", "payload": {...} }`
   - All requests must have unique UUIDs for correlation
   - Timeout: 10 seconds default, configurable per request

4. **Device Detection.** GPU device selection supports multiple backends:
   - `mps` (default on macOS): Apple Silicon GPUs via Metal Performance Shaders
   - `rocm` (default on Linux): AMD GPUs via ROCm 6+
   - `cuda`: NVIDIA GPUs via CUDA
   - `cpu`: CPU-only fallback
   - Detection: Check `torch.backends.mps.is_available()` for MPS, `torch.version.hip` for ROCm, `torch.cuda.is_available()` for CUDA
   - Faster-Whisper uses PyTorch's device interface (works for MPS, CUDA, ROCm, CPU)
   - Device priority: mps > rocm > cuda > cpu (auto-detected if not specified)

5. **Audio Format Handling.** Standardize audio formats across the pipeline:
   - STT input: Accept WebM, WAV, PCM (16kHz, mono)
   - TTS output: PCM 16kHz (streaming) or MP3 (clip-based)
   - Use `base64ToBuffer`/`bufferToBase64` for encoding/decoding
   - Resample to 16kHz if needed (Whisper requirement)

6. **Streaming Support.** Implement incremental processing:
   - STT: Emit partial transcripts as they arrive (VAD-based chunking)
   - TTS: Stream audio chunks sentence-by-sentence
   - Use callbacks (`onChunk`) for streaming, return full result for non-streaming
   - Session management tracks active connections and buffers

7. **Error Handling.** Graceful degradation and retry logic:
   - Process crashes: Auto-restart with exponential backoff
   - Request failures: Retry up to 3 times with exponential backoff
   - Queue failed requests for background retry (native app)
   - Log errors with context (sessionId, requestId, error message)

8. **Performance Budgets.** Enforce latency targets:
   - STT: <100ms per chunk (GPU) or <500ms (CPU)
   - TTS: <300ms per sentence (GPU) or <1s (CPU)
   - Total pipeline: <500ms (p90) for full round-trip
   - Instrument with `markVoice()` and Prometheus metrics

9. **Resource Management.** Prevent resource exhaustion:
   - Limit pool sizes (default: 2, configurable via env)
   - Session timeout: 5 minutes idle
   - Cleanup interval: Every 60 seconds
   - Monitor memory usage (VRAM for GPU, RAM for CPU)

10. **Model Configuration.** Environment-driven configuration:
    - `WHISPER_MODEL_PATH`: Model name (e.g., "large-v3-turbo") or path
    - `WHISPER_DEVICE`: "rocm", "cuda", or "cpu"
    - `WHISPER_COMPUTE_TYPE`: "int8" (quantized) or "fp16" (full precision)
    - `PIPER_MODEL_PATH`: Directory containing Piper voice models
    - `PIPER_VOICE`: Voice name (e.g., "en_US-lessac-medium")
    - `VOICE_STT_POOL_SIZE`: Number of STT processes (default: 2)
    - `VOICE_TTS_POOL_SIZE`: Number of TTS processes (default: 2)

11. **Python Dependencies.** Use `uv` for optimal package management:
    - Install UV: `curl -LsSf https://astral.sh/uv/install.sh | sh`
    - Virtual environment: UV creates `.venv/` automatically via `uv sync`
    - Installation script: `packages/voice/scripts/install-deps.sh` (uses `uv sync`)
    - Required packages: `faster-whisper`, `piper-tts`, `silero-vad`, `numpy`
    - PyTorch: Automatically selected based on GPU (MPS/CUDA/ROCm/CPU) via extras
    - Python executable resolution: UV run → venv Python → system Python (multi-tier fallback)
    - Environment variable `VOICE_USE_UV` controls UV usage (default: auto-detect)
    - Error messages must suggest `uv sync` or `./scripts/install-deps.sh`
    - Use `pyproject.toml` for development with optional extras (cpu, cu128, rocm, mlx)
    - Dependency verification: Skips for UV run (UV handles it), verifies for venv/system Python

12. **Session Lifecycle.** Manage voice sessions explicitly:
    - Create session on first connection
    - Activate on audio input
    - Deactivate on disconnect
    - Remove after 5 minutes idle
    - Track last activity timestamp for idle detection

13. **Queue System (Native App).** Background resilience for mobile:
    - Enqueue failed STT/TTS requests
    - Exponential backoff: 1s → 2s → 4s → 8s (max 30s)
    - Max retries: 3 attempts
    - Background task drains queue every 2 minutes
    - Persist queue in AsyncStorage

14. **Metrics.** Expose Prometheus metrics for observability:
    - `voice_stt_total{provider, status}` - STT request counts
    - `voice_tts_total{provider, status}` - TTS request counts
    - `voice_stt_duration_seconds{provider}` - STT latency histogram
    - `voice_tts_duration_seconds{provider}` - TTS latency histogram
    - `voice_stream_events_total{event, status}` - Stream event counts
    - `voice_stream_latency_seconds{stage}` - Stream latency by stage
    - `voice_queue_depth_current` - Current queue depth
    - `voice_process_health{type}` - Process health (1 = healthy, 0 = unhealthy)

## Examples

### Process Pool Initialization

```typescript
// ✅ Correct: Check provider at initialization
export async function initializeVoicePools(): Promise<void> {
  const voiceProvider = process.env.VOICE_PROVIDER ?? "openai";
  
  if (voiceProvider !== "local") {
    return; // Skip initialization for OpenAI
  }

  const sttPool = new STTPool(config, poolSize);
  await sttPool.initialize();
}

// ❌ Wrong: Check provider per-request
export async function transcribe(audio: string) {
  if (process.env.VOICE_PROVIDER === "local") {
    // Inefficient, should be initialized once
  }
}
```

### Device Detection

```typescript
// ✅ Correct: Detect ROCm vs CUDA
function _has_rocm(): bool {
  import torch
  return torch.cuda.is_available() and hasattr(torch.version, "hip")

function _has_cuda(): bool:
  import torch
  return torch.cuda.is_available() and not hasattr(torch.version, "hip")
```

### Streaming TTS

```typescript
// ✅ Correct: Use callback for streaming
await ttsPool.synthesize(
  { text: "Hello, world!", streaming: true },
  (chunk) => {
    // Emit chunk immediately
    emit({ type: "audio_chunk", payload: chunk });
  }
);

// ❌ Wrong: Wait for full synthesis
const result = await ttsPool.synthesize({ text: "Hello, world!" });
// Too slow for real-time
```

### Error Recovery

```typescript
// ✅ Correct: Retry with exponential backoff
try {
  await process.sendRequest(request);
} catch (error) {
  if (retryCount < MAX_RETRIES) {
    const backoff = 1000 * Math.pow(2, retryCount);
    await delay(backoff);
    return retry();
  }
  throw error;
}
```

### UV Package Installation

```bash
# ✅ Correct: Use automatic backend detection
uv pip install faster-whisper piper-tts silero-vad numpy --torch-backend=auto

# ✅ Correct: Use installation script
cd packages/voice && ./scripts/install-deps.sh

# ✅ Correct: Use pyproject.toml with extras
cd packages/voice && uv sync --extra rocm

# ❌ Wrong: Manual pip without backend detection
pip install torch torchvision torchaudio  # May install wrong backend
```

- **Hot paths**: Process pool selection, IPC request creation
- **Cold paths**: Model loading, pool initialization
- **Measure**: Use `markVoice()` for latency tracking
- **Optimize**: Prefer process pools over per-request spawning
- **Monitor**: Track `voice_process_health` metrics

## Testing Requirements

- Unit tests for IPC protocol parsing
- Unit tests for process pool management
- Integration tests for full streaming flow (skip if Python deps unavailable)
- Mock pools for tests that don't require actual models
- Test device detection logic (ROCm vs CUDA vs CPU)

## Migration Notes

- Switching from OpenAI to local: Set `VOICE_PROVIDER=local` and restart
- No code changes required (API interface is identical)
- Models must be downloaded first: `python3 packages/voice/scripts/download_models.py`
- Verify GPU availability: `rocm-smi` (AMD) or `nvidia-smi` (NVIDIA)

## Related Rules

- `.ruler/09-purity-and-performance.md` - Performance budgets
- `.ruler/18-observability.md` - Metrics and logging
- `.ruler/16-error-handling.md` - Error handling patterns
- `.ruler/22-bun-runtime.md` - Bun subprocess management

