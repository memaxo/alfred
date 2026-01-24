# STT Server

Modular Python implementation of the Speech-to-Text server using NVIDIA Nemotron Speech ASR with cache-aware streaming.

## Features

- **Nemotron Speech 0.6B**: 600M parameter model with high accuracy (7.16% WER average)
- **Native Punctuation**: Outputs properly capitalized and punctuated text
- **Cache-Aware Streaming**: Maintains encoder state between chunks for efficient processing
- **Configurable Latency**: Runtime-tunable chunk sizes (80ms to 1.12s)
- **VAD Integration**: Silero VAD for voice activity detection

## Structure

- `server.py`: Core STTServer class with model initialization, cache management, and transcription logic.
- `__main__.py`: Entry point handling CLI args, dependency checks, and the JSON-IPC event loop.
- `__init__.py`: Package marker.

## Usage

Run as a module:

```bash
python -m stt
```

## Environment Variables

| Variable               | Default                                    | Description                              |
| ---------------------- | ------------------------------------------ | ---------------------------------------- |
| `VOICE_STT_MODEL`      | `nvidia/nemotron-speech-streaming-en-0.6b` | HuggingFace model ID                     |
| `VOICE_STT_DEVICE`     | auto                                       | Device: `cuda`, `mps`, or `cpu`          |
| `VOICE_STT_CHUNK_SIZE` | `medium`                                   | Chunk size for latency/accuracy tradeoff |

### Chunk Sizes

| Setting    | Chunk Size | Latency  | Use Case              |
| ---------- | ---------- | -------- | --------------------- |
| `fast`     | 80ms       | Lowest   | Real-time feedback    |
| `low`      | 160ms      | Very Low | Voice assistants      |
| `medium`   | 560ms      | Balanced | General use (default) |
| `accurate` | 1.12s      | Higher   | Transcription tasks   |

## IPC Protocol

The server communicates via JSON over stdin/stdout.

### Requests

**transcribe**

```json
{
  "id": "request-123",
  "type": "transcribe",
  "payload": {
    "audioBase64": "<base64-encoded-pcm16>",
    "language": "en",
    "sessionId": "session-456",
    "streaming": true,
    "chunkSize": "medium",
    "clearCache": false
  }
}
```

**clear_cache**

```json
{
  "id": "request-124",
  "type": "clear_cache",
  "payload": {
    "sessionId": "session-456"
  }
}
```

**session_info**

```json
{
  "id": "request-125",
  "type": "session_info",
  "payload": {
    "sessionId": "session-456"
  }
}
```

### Responses

**transcript**

```json
{
  "id": "request-123",
  "type": "transcript",
  "payload": {
    "text": "Hello, how are you?",
    "language": "en",
    "isPartial": false,
    "isEmpty": false,
    "model": "nvidia/nemotron-speech-streaming-en-0.6b",
    "durationSeconds": 1.5,
    "vadConfidence": 0.95,
    "endOfUtterance": true,
    "processingTime": 0.25,
    "streamingEnabled": true
  }
}
```

## Cache-Aware Streaming

When `streaming: true` and `sessionId` is provided, the server maintains encoder cache state between chunks:

1. First chunk: Creates new cache, processes audio
2. Subsequent chunks: Reuses cache, processes only new audio
3. Session end: Cache is cleared automatically or via `clear_cache` request

This eliminates redundant computation and significantly improves throughput for continuous audio streams.

## Fallback Behavior

If the model doesn't support cache-aware streaming (e.g., Parakeet), the server automatically falls back to batch transcription mode.

## Legacy Model Support

To use the older Parakeet 120M model:

```bash
VOICE_STT_MODEL=nvidia/parakeet_realtime_eou_120m-v1 python -m stt
```

Note: Parakeet outputs raw text without punctuation and doesn't support cache-aware streaming.
