#!/usr/bin/env bash
# Install voice model dependencies with optimal UV configuration
# Creates virtual environment and installs dependencies using UV sync

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VOICE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$VOICE_DIR"

echo "Installing voice model dependencies with UV..."

# Check if UV is available
if ! command -v uv &> /dev/null; then
    echo "Error: uv is not installed. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Detect platform and determine appropriate extra
PLATFORM="$(uname -s)"
ARCH="$(uname -m)"

# Determine PyTorch backend extra based on platform
if [[ "$PLATFORM" == "Darwin" ]]; then
    # macOS - use CPU extra (MPS is included in default PyTorch builds)
    EXTRA="cpu"
    echo "Detected macOS - using CPU extra (MPS support included in PyTorch)"
elif [[ "$PLATFORM" == "Linux" ]]; then
    # Linux - try to detect GPU, default to CPU
    if command -v rocm-smi &> /dev/null; then
        EXTRA="rocm"
        echo "Detected ROCm - using ROCm extra"
    elif command -v nvidia-smi &> /dev/null; then
        EXTRA="cu128"
        echo "Detected CUDA - using CUDA 12.8 extra"
    else
        EXTRA="cpu"
        echo "No GPU detected - using CPU extra"
    fi
else
    EXTRA="cpu"
    echo "Unknown platform - using CPU extra"
fi

# Use UV sync to create virtual environment and install dependencies
echo "Creating virtual environment and installing dependencies..."
uv sync --extra "$EXTRA"

echo "✓ Dependencies installed successfully in virtual environment (.venv)"

# Verify installation using UV run (uses virtual environment)
echo ""
echo "Verifying installation..."
uv run python -c "
try:
    from faster_whisper import WhisperModel
    from piper import PiperVoice
    from silero_vad import load_silero_vad_model
    import numpy as np
    print('✓ All core dependencies available')
except ImportError as e:
    print(f'✗ Missing dependency: {e}')
    exit(1)
"

# Check PyTorch backend
echo ""
echo "Checking PyTorch backend..."
uv run python -c "
import torch
print(f'PyTorch version: {torch.__version__}')

if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
    print('✓ MPS (Metal) backend available (Apple Silicon)')
elif torch.cuda.is_available():
    if hasattr(torch.version, 'hip'):
        print('✓ ROCm backend available (AMD GPU)')
    else:
        print('✓ CUDA backend available (NVIDIA GPU)')
else:
    print('ℹ CPU-only backend (no GPU acceleration)')
"

echo ""
echo "Installation complete!"

