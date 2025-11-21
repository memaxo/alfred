# Voice Server Scripts

Reusable scripts for testing and using the local voice processing servers (Faster-Whisper STT and Piper TTS).

## Quick Start

```bash
# Install dependencies
./scripts/install-deps.sh

# Download voice models (if needed)
python scripts/download_models.py

# Test everything
python scripts/test_voice.py

# Say something
python scripts/tts_say.py "Hello, this is Alfred speaking."

# Transcribe audio
python scripts/stt_transcribe.py audio.wav
```

## Scripts

### `tts_say.py` - Text-to-Speech

Synthesizes text to speech and plays it (or saves to file).

**Basic usage:**
```bash
python scripts/tts_say.py "Hello world"
```

**Options:**
- `--voice VOICE` - Voice model (default: `en_US-lessac-medium`)
- `--streaming` - Enable sentence-level streaming
- `--save FILE` - Save to WAV file instead of playing
- `--no-play` - Don't play audio (useful with `--save`)

**Examples:**
```bash
# Use different voice
python scripts/tts_say.py "Test" --voice en_US-lessac-medium

# Save to file
python scripts/tts_say.py "Hello" --save output.wav

# Generate without playing
python scripts/tts_say.py "Test" --save test.wav --no-play
```

**Environment variables:**
- `PIPER_MODEL_PATH` - Path to Piper models (default: `./models/piper`)
- `PIPER_VOICE` - Default voice model

### `stt_transcribe.py` - Speech-to-Text

Transcribes audio files using Faster-Whisper.

**Basic usage:**
```bash
python scripts/stt_transcribe.py audio.wav
```

**Options:**
- `--model MODEL` - Whisper model (default: `large-v3-turbo`)
- `--device DEVICE` - Device: `cpu`, `cuda`, `mps`, `rocm` (default: auto)
- `--compute-type TYPE` - Compute type: `int8`, `fp16`, `fp32` (default: `int8`)
- `--language LANG` - Language code (e.g., `en`, `es`, `fr`)
- `--prompt TEXT` - Initial prompt to guide transcription
- `--vad-threshold NUM` - VAD threshold (0.0-1.0)

**Examples:**
```bash
# Transcribe with language hint
python scripts/stt_transcribe.py audio.wav --language en

# Use specific model
python scripts/stt_transcribe.py audio.wav --model large-v3-turbo

# Force CPU device
python scripts/stt_transcribe.py audio.wav --device cpu
```

**Environment variables:**
- `WHISPER_MODEL_PATH` - Path to Whisper model (default: `large-v3-turbo`)
- `WHISPER_DEVICE` - Device to use (default: auto-detect)
- `WHISPER_COMPUTE_TYPE` - Compute type (default: `int8`)

### `test_voice.py` - End-to-End Test

Tests both TTS and STT in a round-trip test.

**Usage:**
```bash
# Test with default text
python scripts/test_voice.py

# Test with custom text
python scripts/test_voice.py --text "Custom test phrase"
```

The script will:
1. Generate audio from text using TTS
2. Transcribe the audio back using STT
3. Compare original and transcript
4. Optionally play the generated audio (if interactive)

### `install-deps.sh` - Install Dependencies

Installs Python dependencies using UV with automatic GPU detection.

**Usage:**
```bash
./scripts/install-deps.sh
```

Automatically detects:
- macOS → CPU extra (MPS included in PyTorch)
- Linux with ROCm → ROCm extra
- Linux with CUDA → CUDA 12.8 extra
- Linux without GPU → CPU extra

### `download_models.py` - Download Models

Downloads required voice models from HuggingFace.

**Usage:**
```bash
python scripts/download_models.py
```

## Server Scripts

### `tts_server.py` - TTS Server

JSON-lines IPC server for Piper TTS. Communicates via stdin/stdout.

**Protocol:**
- Request: `{"id": "uuid", "type": "synthesize", "payload": {"text": "...", "voice": "...", "streaming": false}}`
- Response: `{"id": "uuid", "type": "audio", "payload": {"audioBase64": "...", "mimeType": "audio/pcm", "sampleRate": 22050}}`

**Environment variables:**
- `PIPER_MODEL_PATH` - Path to models directory
- `PIPER_VOICE` - Default voice model

### `stt_server.py` - STT Server

JSON-lines IPC server for Faster-Whisper STT. Communicates via stdin/stdout.

**Protocol:**
- Request: `{"id": "uuid", "type": "transcribe", "payload": {"audioBase64": "...", "language": "en"}}`
- Response: `{"id": "uuid", "type": "transcript", "payload": {"text": "...", "language": "en", "isPartial": false, "isEmpty": false}}`

**Environment variables:**
- `WHISPER_MODEL_PATH` - Model name or path (default: `large-v3-turbo`)
- `WHISPER_DEVICE` - Device: `cpu`, `cuda`, `mps`, `rocm` (default: auto)
- `WHISPER_COMPUTE_TYPE` - Compute type (default: `int8`)
