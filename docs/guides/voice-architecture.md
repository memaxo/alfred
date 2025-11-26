# Voice Architecture

**Owner:** Voice  
**Last Updated:** 2025-11-26

## Purpose

This guide explains ALFRED's real-time voice system—how it achieves low-latency speech-to-speech interaction through binary transport, process isolation, and voice activity detection, while maintaining privacy through local model inference.

---

Voice is the most natural interface for human communication. Unlike text, which requires explicit attention and typing, voice flows naturally while hands remain free. For a personal assistant, voice interaction transforms ALFRED from a tool that must be explicitly invoked to a presence that can be engaged conversationally. This transformation requires technical foundations that traditional web architectures don't provide: sub-second latency, continuous listening, and natural turn-taking.

ALFRED's voice system addresses these challenges through architecture designed from first principles for real-time audio. Every design decision prioritizes latency and privacy—binary transport eliminates encoding overhead, process isolation protects against model crashes, and local inference ensures that audio never leaves the user's hardware without explicit intent.

## Core Concepts

Real-time voice interaction requires a bidirectional audio pipeline. The upstream path carries user speech from microphone to transcription: audio capture, compression (if needed), transmission, voice activity detection, and speech-to-text inference. The downstream path carries assistant responses from text to speaker: text generation, speech synthesis, audio encoding, transmission, and playback. Both paths must operate concurrently, enabling the natural overlaps of human conversation.

Latency budgets constrain every component. Human perception of real-time interaction degrades noticeably above 200 milliseconds of round-trip delay. ALFRED targets 150ms or less from end of user speech to beginning of assistant audio. This budget leaves no room for encoding overhead, unnecessary buffering, or sequential processing—every millisecond matters.

Privacy guides the default architecture. Voice data is intimate: it contains not just words but tone, emotion, and biometric signatures. ALFRED processes voice locally by default, using on-device models for both speech-to-text and text-to-speech. Audio never traverses the network unless the user explicitly enables cloud fallbacks for quality or language coverage.

## Architecture

The voice registry serves as the central authority for session management. Rather than creating sessions directly, callers request sessions from the registry, which tracks lifecycle, enforces timeouts, and ensures proper cleanup. This indirection prevents resource leaks—orphaned sessions are automatically reaped after five minutes of inactivity.

Sessions encapsulate the state of a voice conversation. Each session maintains audio buffers (for both directions), voice activity state, transcript history, and synthesis queue. Sessions are transport-agnostic: they don't know whether audio arrives via WebSocket, HTTP, or local capture. This separation enables testing without network dependencies and supports future transport options.

Binary transport is non-negotiable for the audio hot path. Audio chunks travel as raw binary WebSocket frames, not Base64-encoded JSON. This distinction matters enormously: a 20ms audio chunk at 16kHz mono is 640 bytes as PCM, but nearly 1KB as Base64 text plus JSON overhead. Multiply by 50 chunks per second and the encoding overhead dominates bandwidth and CPU. JSON remains appropriate for control messages (start, stop, status) where latency is less critical.

Process isolation protects the server from model failures. Speech-to-text and text-to-speech models run in persistent Python subprocesses managed by pools. If a model crashes—out of memory, corrupted weights, numeric instability—only that subprocess dies. The pool restarts it automatically while other subprocess instances continue serving requests. This isolation ensures that ML instability never crashes the main server.

## Voice Activity Detection

Detecting when the user is speaking (and when they've stopped) is surprisingly subtle. Naive amplitude thresholds fail on background noise; fixed timeouts create awkward pauses. ALFRED uses server-side VAD integrated with the speech-to-text model, providing both speech boundaries and transcription in a single inference pass.

VAD events drive the conversation flow. When speech begins, the system enters listening mode, accumulating audio for transcription. When speech ends (with appropriate debouncing to handle natural pauses), the accumulated audio is finalized for transcription and the system can begin generating a response. The gap between speech end and response start is the critical latency that users perceive.

Barge-in interruptibility enables natural conversation dynamics. If the user speaks while ALFRED is responding, the speech interrupts the synthesis. The system detects the interruption through VAD, signals the client to stop playback, and switches to listening mode. This behavior mirrors human conversation where speakers can interrupt each other without explicit turn-taking.

The implementation separates VAD responsibilities. Server-side VAD is authoritative for transcription boundaries—it determines when utterances begin and end. Client-side VAD is purely for interrupt detection—detecting user speech during assistant output. This separation ensures that transcription accuracy isn't compromised by interrupt sensitivity.

## Process Pools and Model Inference

ML inference is computationally intensive and operationally unpredictable. Models may exhaust memory on long inputs, produce NaN outputs on edge cases, or simply hang on certain inputs. Running inference in the main process would expose the entire server to these failures. Process pools provide the necessary isolation.

Each pool maintains a set of worker processes that handle inference requests. The STT pool runs speech-to-text models (NeMo Parakeet by default, with Whisper fallback). The TTS pool runs text-to-speech models (Maya1 by default, with Piper fallback). Pools handle process lifecycle: starting workers at initialization, restarting crashed workers, and gracefully shutting down during server termination.

Communication with workers uses standard IO pipes (stdin/stdout). The server sends requests as JSON over stdin; workers respond with JSON over stdout. Audio data is transmitted as binary after JSON framing. This simple protocol is reliable, debuggable, and supports any language that can read stdin and write stdout.

Load balancing distributes requests across pool workers. Round-robin assignment provides adequate balance for typical workloads. The pool tracks which workers are busy and routes new requests to idle workers when possible, falling back to queueing when all workers are occupied.

## Dual-Backend Support

Hardware diversity requires backend flexibility. Apple Silicon Macs achieve best performance with MLX, Apple's optimized ML framework. Linux servers with NVIDIA or AMD GPUs perform best with transformers and appropriate CUDA or ROCm drivers. ALFRED's dual-backend architecture supports both through runtime detection and backend-specific loading.

Backend selection happens at pool initialization. The system probes available hardware and framework availability, selecting the appropriate backend for the current environment. MLX backends load weights in MLX format; PyTorch backends load weights in safetensors format with optional quantization.

This hardware abstraction extends to model configuration. The same high-level model identifier (Maya1, Parakeet) resolves to different underlying implementations based on backend. From the voice session's perspective, the model interface is identical regardless of which backend executes inference.

## Design Decisions

Binary transport was chosen despite the complexity it adds to debugging and monitoring. The latency savings are substantial: on a fast network, binary frames arrive in 1-2ms while JSON encoding would add 5-10ms per chunk. Over hundreds of chunks per conversation, this compounds to perceptible latency differences.

Process isolation was chosen over in-process inference for reliability. The startup cost of spawning Python processes (a few hundred milliseconds) is paid once at server initialization. The ongoing cost of IPC (sub-millisecond per request) is negligible compared to inference time. The reliability benefit—isolated crashes—is invaluable for production operation.

Local-first inference was chosen for privacy even though cloud models often achieve better quality. For a personal assistant, the sensitivity of voice data outweighs marginal quality improvements. Users who prefer cloud quality can enable it explicitly, but the default preserves privacy.

## Integration Points

The voice session integrates with the cognitive loop through event emission. Transcripts from speech-to-text become input events that trigger cognitive state transitions. Response text from the cognitive loop feeds into text-to-speech synthesis. This integration enables voice conversations to benefit from the same learning and adaptation as text conversations.

The Mindscape UI visualizes voice state in real-time. The OrbNode component displays VAD levels, showing users when the system detects their speech. This visual feedback helps users understand when to speak and when the system is listening—essential for building intuitive interaction patterns.

The admin dashboard exposes voice telemetry and controls. Operators can view session statistics (duration, packet loss, jitter), restart pools after configuration changes, and clear stuck sessions. This administrative interface is essential for debugging production issues and capacity planning.

## Related Documentation

- [Architecture Overview](../architecture/overview.md) — System-wide architecture context
- [Voice Architecture Reference](../architecture/voice.md) — Implementation details and configuration
- [Cognitive State Machine](cognitive-state-machine.md) — How voice input triggers cognitive events
- [Integration Patterns](integration-patterns.md) — How voice composes with other systems

