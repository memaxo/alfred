# @alfred/voice

The Voice package provides local, privacy-preserving Speech-to-Text (STT) and Text-to-Speech (TTS) capabilities for ALFRED.

## Architecture

- **TTS (Text-to-Speech):** Supports multiple providers:
    - [Maya1](https://huggingface.co/maya-research/maya1) (3B parameter model): Expressive, emotional speech generation (default).
      - **macOS**: Runs on **MLX** (Apple Silicon optimized) for low latency. Requires 4-bit converted weights.
      - **Linux**: Runs on **PyTorch/ROCm** (AMD) or **CUDA** (NVIDIA) with 4-bit quantization via `bitsandbytes`.
    - [Supertonic](https://huggingface.co/Supertone/supertonic) (66M parameter model): Lightweight, ultra-low latency (up to 167x real-time) on-device TTS via ONNX Runtime.
- **STT (Speech-to-Text):** Uses NVIDIA [NeMo Parakeet](https://catalog.ngc.nvidia.com/orgs/nvidia/teams/nemo/models/parakeet_realtime_eou_120m) (120M) for fast, accurate transcription with [Silero VAD](https://github.com/snakers4/silero-vad) for voice activity detection.
- **Runtime:** Python subprocesses managed via `Bun.spawn` and JSON-RPC over stdin/stdout (Maya1/STT), or in-process ONNX Runtime (Supertonic).
- **Dependency Management:** Uses `uv` for fast, reliable Python package management.

## Prerequisites

- **Bun** runtime (v1.1+)
- **Python** 3.10+ (managed via `uv`)
- **GPU Recommended:**
    - macOS: Apple Silicon (M1/M2/M3) supported via **MLX** (Maya1) or MPS (STT).
    - Linux: CUDA (NVIDIA) or ROCm (AMD).
    - CPU fallback is available but significantly slower for Maya1 (TTS). Supertonic runs efficiently on CPU.

## Setup

The setup process handles everything automatically:

```bash
# From root
bun run setup

# FOR MACOS (MLX) ONLY:
# You must convert the Maya1 weights to MLX format before running:
python packages/voice/scripts/convert_maya1_to_mlx.py --quantize
```

This command will:
1.  Install Python dependencies in a virtual environment (`packages/voice/.venv`) using `uv`.
2.  Download the Maya1 model (~6GB) and NeMo Parakeet model (~500MB).
3.  Download Supertonic models (~100MB) to `packages/voice/models/supertonic`.

## Usage

### Development

Start the development server (if applicable) or run tests:

```bash
# Test TTS (Maya1)
VOICE_PROVIDER=local bun run scripts/test-tts.ts "Hello world!"

# Test TTS (Supertonic)
VOICE_PROVIDER=local TTS_PROVIDER=supertonic bun run scripts/test-tts.ts "Hello world!"

# Transcribe an audio file
packages/voice/scripts/stt_transcribe.py path/to/audio.wav
```

### Environment Variables

- `VOICE_PROVIDER`: Set to `local` to enable this package. Default is `openai`.
- `TTS_PROVIDER`: Set to `supertonic` to use the lightweight model. Default is `maya1`.
- `VOICE_TTS_POOL_SIZE`: Number of TTS processes (default: 1, due to VRAM usage of Maya1). Ignored for Supertonic (single instance).
- `VOICE_STT_POOL_SIZE`: Number of STT processes (default: 2).
- `WHISPER_MODEL_PATH`: Override STT model (default: `nvidia/parakeet_realtime_eou_120m-v1`).
- `WHISPER_DEVICE`: Override device (`cuda`, `mps`, `cpu`). Auto-detected if unset.

## Supertonic Voices

When using `TTS_PROVIDER=supertonic`, you can select from the following voices in the request:
- `M1` (Male 1) - Default
- `M2` (Male 2)
- `F1` (Female 1)
- `F2` (Female 2)

## Directory Structure

- `src/`: TypeScript source code
    - `process/`: Process management and IPC (Maya1, NeMo, Supertonic)
    - `audio/`: Audio utilities (Opus, PCM)
- `scripts/`: Python inference scripts and utilities
    - `maya_tts.py`: Maya1 inference server
    - `stt_server.py`: NeMo STT inference server
    - `download_models.py`: Python model downloader
    - `download_supertonic.sh`: Shell script for Supertonic models
- `.venv/`: Python virtual environment (created by `uv`)

## Troubleshooting

**Missing Dependencies:**
Run `bun run setup` to ensure the virtual environment is up to date.

**Model Loading Failures:**
Ensure you have internet access for the initial download. Check disk space (~10GB required for models and venv).

**Slow Performance:**
Verify GPU usage. On macOS, ensure `mps` is being used (logs will show "Initializing ... on mps"). On Linux, check `nvidia-smi` or `rocm-smi`.
