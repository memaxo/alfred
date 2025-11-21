# Voice Local Models Standards

## Core Principle

Local voice models (Faster-Whisper for STT, Piper TTS for TTS) provide zero-cost, privacy-preserving, low-latency voice processing. All implementations must support graceful fallback, process health monitoring, and resource-efficient operation.

## Rules

1. **Provider Selection.** Voice provider is determined by `VOICE_PROVIDER` environment variable:
   - `openai` (default): Uses OpenAI Whisper API and GPT-4o-mini TTS
   - `local`: Uses Faster-Whisper (large-v3-turbo) and Piper TTS
   - Provider selection must be checked at initialization, not per-request

2. **Process Pool Management.** Use `Bun.spawn()` for Python subprocesses. Maintain pools (default: 2 per STT/TTS). Health checks every 30s. Auto-restart crashed processes. Round-robin load balancing.

3. **IPC Protocol.** JSON lines over stdin/stdout. Request/response format: `{ "id": "uuid", "type": "...", "payload": {...} }`. Unique UUIDs for correlation. Timeout: 10s default.

4. **Device Detection.** GPU priority: mps > rocm > cuda > cpu (auto-detected). Check `torch.backends.mps.is_available()` (MPS), `torch.version.hip` (ROCm), `torch.cuda.is_available()` (CUDA).

5. **Audio Format Handling.** STT input: WebM/WAV/PCM (16kHz, mono). TTS output: PCM 16kHz (streaming) or MP3 (clip-based). Use `base64ToBuffer`/`bufferToBase64`. Resample to 16kHz if needed.

6. **Streaming Support.** STT: Emit partial transcripts (VAD-based chunking). TTS: Stream sentence-by-sentence. Use `onChunk` callbacks for streaming. Session management tracks connections and buffers.

7. **Error Handling.** Auto-restart crashed processes with exponential backoff. Retry requests up to 3 times. Queue failed requests for background retry (native app). Log with context (sessionId, requestId).

8. **Performance Budgets.** STT: <100ms/chunk (GPU) or <500ms (CPU). TTS: <300ms/sentence (GPU) or <1s (CPU). Total pipeline: <500ms (p90). Instrument with `markVoice()` and Prometheus metrics.

9. **Resource Management.** Limit pool sizes (default: 2, configurable). Session timeout: 5 minutes idle. Cleanup interval: 60 seconds. Monitor memory usage (VRAM/RAM).

10. **Model Configuration.** Env vars: `WHISPER_MODEL_PATH`, `WHISPER_DEVICE` (rocm/cuda/cpu), `WHISPER_COMPUTE_TYPE` (int8/fp16), `PIPER_MODEL_PATH`, `PIPER_VOICE`, `VOICE_STT_POOL_SIZE`, `VOICE_TTS_POOL_SIZE`.

11. **Python Dependencies.** Use `uv` for package management. Install via `curl -LsSf https://astral.sh/uv/install.sh | sh`. Use `uv sync` or `./scripts/install-deps.sh`. Required: `faster-whisper`, `piper-tts`, `silero-vad`, `numpy`. PyTorch auto-selected via extras. Python resolution: UV run → venv → system. Error messages suggest `uv sync` or install script.

12. **Session Lifecycle.** Create on first connection. Activate on audio input. Deactivate on disconnect. Remove after 5 minutes idle. Track last activity timestamp.

13. **Queue System (Native App).** Enqueue failed requests. Exponential backoff: 1s → 2s → 4s → 8s (max 30s). Max 3 retries. Background task drains every 2 minutes. Persist in AsyncStorage.

14. **Metrics.** Expose Prometheus metrics for observability:
    - `voice_stt_total{provider, status}` - STT request counts
    - `voice_tts_total{provider, status}` - TTS request counts
    - `voice_stt_duration_seconds{provider}` - STT latency histogram
    - `voice_tts_duration_seconds{provider}` - TTS latency histogram
    - `voice_stream_events_total{event, status}` - Stream event counts
    - `voice_stream_latency_seconds{stage}` - Stream latency by stage
    - `voice_queue_depth_current` - Current queue depth
    - `voice_process_health{type}` - Process health (1 = healthy, 0 = unhealthy)

15. **Performance.** Hot paths: Process pool selection, IPC request creation. Measure with `markVoice()`. Prefer process pools over per-request spawning. Monitor `voice_process_health` metrics.

